'use strict';

exports.handler = async (event) => {
  try {
    const records = event?.Records || [];
    const failures = [];
    for (const r of records) {
      try {
        const body = safeJsonParse(r.body);
        const jobId = body?.jobId || body?.id || null;

        // Structured log for DLQ message (for manual review triage)
        console.log(JSON.stringify({
          type: 'DLQ_MESSAGE',
          messageId: r.messageId,
          jobId,
          attributes: r.attributes,
          approxReceiveCount: r.attributes?.ApproximateReceiveCount,
          body,
        }));

        // CloudWatch Embedded Metric Format (EMF) for operational visibility
        console.log(JSON.stringify({
          _aws: {
            Timestamp: Date.now(),
            CloudWatchMetrics: [
              {
                Namespace: 'JumpMetrics/DLQ',
                Dimensions: [['Queue', 'Outcome']],
                Metrics: [
                  { Name: 'MessagesReceived', Unit: 'Count' },
                  { Name: 'MessagesRequeued', Unit: 'Count' },
                  { Name: 'MessagesSkipped', Unit: 'Count' },
                ],
              },
            ],
          },
          Queue: process.env.QUEUE_NAME || 'jobs-dlq',
          Outcome: 'received',
          MessagesReceived: 1,
          MessagesRequeued: 0,
          MessagesSkipped: 0,
        }));

        // Example handling strategy:
        // 1) If message looks retryable and hasn't been retried via DLQ flow, mark for manual requeue by tagging in logs
        // 2) Otherwise mark as skipped for manual investigation
        const retryable = looksRetryable(body);
        if (retryable) {
          console.log(JSON.stringify({ type: 'DLQ_ACTION', action: 'candidate_requeue', messageId: r.messageId, jobId }));
          // NOTE: Intentionally not auto-requeueing to avoid poison message loops.
          // Optionally, you could publish to an SNS topic or a dedicated "retry" SQS queue.
        } else {
          console.log(JSON.stringify({ type: 'DLQ_ACTION', action: 'skip_manual_review', messageId: r.messageId, jobId }));
        }
      } catch (oneErr) {
        console.error('DLQ record handling error', oneErr);
        failures.push({ itemIdentifier: r.messageId });
      }
    }
    // Report per-record failures for partial batch failure handling
    return { batchItemFailures: failures };
  } catch (err) {
    console.error('DLQ handler error', err);
    // Let Lambda/SQS retry the whole batch
    throw err;
  }
};


function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function looksRetryable(body) {
  if (!body) return false;
  // Heuristic: network/transient flags
  const reason = (body.reason || body.error || '').toString().toLowerCase();
  if (reason.includes('timeout') || reason.includes('throttle') || reason.includes('rate') || reason.includes('temporar')) return true;
  // If the job had no attempts metadata, we might consider it retryable via manual review
  if (body.attempts == null) return true;
  return false;
}


