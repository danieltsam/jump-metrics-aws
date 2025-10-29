// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import os from 'os';
import { requireRole, requireAdminGroup } from '../middleware/auth.js';
import { sqsService } from '../services/sqsService.js';
import { jobsRepo } from '../services/repos/jobsRepo.js';

const router = Router();

// GET /api/v1/admin/metrics (admin group only)
router.get('/metrics', requireAdminGroup, (req, res) => {
  const load = os.loadavg();
  res.status(200).json({ hostname: os.hostname(), loadavg: load, cpus: os.cpus().length, uptime: os.uptime() });
});

// POST /api/v1/admin/stress-test (admin group only)
// body: { sessionId: string, jobs?: number, options?: { interpolationFps?, workFactor?, preset?, slowFactor? } }
router.post('/stress-test', requireAdminGroup, async (req, res) => {
  const { sessionId, jobs = 10, options = {} } = req.body || {};
  if (!sessionId) return res.status(400).json({ message: 'sessionId required' });
  const owner = req.user?.id || 'unknown';
  const count = Math.max(1, Math.min(500, Number(jobs) || 1)); // Increased max to 500
  
  // Enhanced options for better CPU load
  const enhancedOptions = {
    interpolationFps: Number(options.interpolationFps) || 120, // Higher default FPS
    workFactor: Number(options.workFactor) || 3, // Higher default work factor
    preset: options.preset || 'slow', // Slowest preset for max CPU
    slowFactor: Number(options.slowFactor) || 4, // Higher slow factor
    ...options
  };
  
  const jobIds = [];
  const now = new Date().toISOString();
  
  try {
    for (let i = 0; i < count; i++) {
      const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const job = {
        jobId,
        owner,
        targetType: 'session',
        targetId: sessionId,
        status: 'queued',
        queuedAt: now,
        startedAt: null,
        finishedAt: null,
        stderrTail: null,
        options: enhancedOptions,
        outputs: [],
        summary: null,
        metricsRef: null,
        progress: { completed: 0, total: 0, pct: 0 },
        updatedAt: now,
      };
      await jobsRepo.put(job);
      
      // Send job to SQS for processing
      await sqsService.sendJobMessage({
        jobId,
        type: 'analyze',
        targetType: 'session',
        targetId: sessionId,
        owner,
        options: enhancedOptions
      });
      
      jobIds.push(jobId);
    }
  } catch (error) {
    console.error('Stress test job creation error:', error);
    return res.status(500).json({ message: 'Failed to create stress test jobs' });
  }
  
  // Log stress test for monitoring
  console.log(`[ADMIN] Stress test triggered: ${count} jobs with options:`, enhancedOptions);
  
  return res.status(202).json({ 
    enqueued: jobIds.length, 
    jobIds,
    options: enhancedOptions,
    message: `Enqueued ${count} CPU-intensive jobs. Monitor CPU usage with: GET /api/v1/admin/metrics`
  });
});

// GET /api/v1/admin/user-info (admin group only) - Show user groups and role info
router.get('/user-info', requireAdminGroup, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      groups: req.user.groups || [],
      cognito: req.user.cognito || false
    },
    message: 'User groups and role information',
    timestamp: new Date().toISOString()
  });
});

export default router;

// SQS DLQ inspection (admin only)
router.get('/dlq', requireAdminGroup, async (req, res) => {
  try {
    await sqsService.initialize();
    const attrs = await sqsService.getDLQAttributes();
    res.json({ dlqApproximateNumberOfMessages: Number(attrs?.ApproximateNumberOfMessages || 0) });
  } catch (err) {
    console.error('[ADMIN] DLQ inspect failed', err);
    res.status(500).json({ message: 'Failed to query DLQ' });
  }
});
