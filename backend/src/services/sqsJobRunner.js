// AI GENERATED FILE - This file was created by an AI assistant
import { sqsService } from './sqsService.js';
import { jobsRepo } from './repos/jobsRepo.js';
import { videosRepo } from './repos/videosRepo.js';
import { sessionsRepo } from './repos/sessionsRepo.js';
import { jumpsRepo } from './repos/jumpsRepo.js';
import { mediaRepo } from './repos/mediaRepo.js';
import { renderJumpSlowmo, formatOverlayText } from './ffmpeg.js';
import { computeJumpMetrics, computeSessionStats } from './metrics.js';
import { s3Service } from './s3Service.js';
import fs from 'fs';
import path from 'path';

function nowIso() { return new Date().toISOString(); }

export class SQSJobRunner {
  constructor() {
    this._running = false;
    this._stopRequested = false;
    this._loopPromise = null;
    this._currentJobId = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._stopRequested = false;
    this._loopPromise = this._loop();
    console.log('[SQSJobRunner] started - consuming from SQS');
  }

  async stop() {
    this._stopRequested = true;
    console.log('[SQSJobRunner] stop requested');
    await this._loopPromise;
    console.log('[SQSJobRunner] stopped');
  }

  async _loop() {
    while (!this._stopRequested) {
      try {
        // Receive messages from SQS (long polling)
        const messages = await sqsService.receiveJobMessages(1, 20); // 1 message, 20s wait
        
        if (messages.length === 0) {
          // No messages, continue polling
          continue;
        }

        for (const message of messages) {
          if (this._stopRequested) break;
          
          try {
            await this._processSQSMessage(message);
          } catch (err) {
            console.error('[SQSJobRunner] Error processing SQS message:', err);
            // Message will be retried automatically by SQS (up to maxReceiveCount)
          }
        }
      } catch (err) {
        console.error('[SQSJobRunner] Error in main loop:', err);
        // Wait before retrying
        await sleep(5000);
      }
    }
  }

  async _processSQSMessage(message) {
    try {
      const jobData = JSON.parse(message.Body);
      console.log(`[SQSJobRunner] Processing SQS message for job ${jobData.jobId}`);
      
      // Get the full job from DynamoDB
      const job = await jobsRepo.get(jobData.jobId);
      if (!job) {
        console.error(`[SQSJobRunner] Job ${jobData.jobId} not found in DynamoDB`);
        await sqsService.deleteJobMessage(message.ReceiptHandle);
        return;
      }

      // Check if job is already being processed or completed
      if (job.status !== 'queued') {
        console.log(`[SQSJobRunner] Job ${jobData.jobId} is not queued (status: ${job.status}), deleting message`);
        await sqsService.deleteJobMessage(message.ReceiptHandle);
        return;
      }

      this._currentJobId = job.jobId;
      
      try {
        await this._processJob(job);
        // Delete message from SQS after successful processing
        await sqsService.deleteJobMessage(message.ReceiptHandle);
        console.log(`[SQSJobRunner] Job ${jobData.jobId} completed and message deleted from SQS`);
      } catch (err) {
        console.error(`[SQSJobRunner] Job ${jobData.jobId} failed:`, err);
        // Don't delete message - let SQS retry or send to DLQ
        throw err;
      } finally {
        this._currentJobId = null;
      }
    } catch (err) {
      console.error('[SQSJobRunner] Error processing SQS message:', err);
      // Delete message to prevent infinite retries for parsing errors
      try {
        await sqsService.deleteJobMessage(message.ReceiptHandle);
      } catch (deleteErr) {
        console.error('[SQSJobRunner] Failed to delete malformed message:', deleteErr);
      }
    }
  }

  async _processJob(job) {
    const jobStartTime = Date.now();
    console.log(`[SQSJobRunner] 🚀 Starting job ${job.jobId} (${job.targetType}:${job.targetId})`);
    
    const j = { ...job };
    j.status = 'running';
    j.startedAt = nowIso();
    j.updatedAt = nowIso();
    j.progress = { completed: 0, total: 0, pct: 0 };
    await jobsRepo.put(j);
    
    const startTime = Date.now();
    console.log(`[SQSJobRunner] ✅ Job ${job.jobId} status updated to running at ${new Date().toISOString()}`);

    const options = j.options || {};
    let tempS3Download = null;

    try {
      let jumps = [];
      let video = null;

      if (j.targetType === 'session') {
        const { items } = await jumpsRepo.listBySession(j.targetId, { limit: 1000 });
        jumps = items || [];
        const session = await sessionsRepo.get(j.targetId);
        if (session) video = await videosRepo.get(session.videoId);
      } else if (j.targetType === 'jump') {
        const one = await jumpsRepo.get(j.targetId);
        if (one) {
          jumps = [one];
          const session = await sessionsRepo.get(one.sessionId);
          if (session) video = await videosRepo.get(session.videoId);
        }
      }

      j.progress.total = jumps.length;
      await jobsRepo.update(j.jobId, { progress: j.progress, updatedAt: j.updatedAt });
      
      const setupTime = Date.now() - startTime;
      console.log(`[SQSJobRunner] 📋 Job ${job.jobId} setup complete in ${setupTime}ms`);
      console.log(`[SQSJobRunner] 📊 Job ${job.jobId} processing ${jumps.length} jumps with options:`, options);

      if (!video) throw new Error('Target video not found');

      const owner = j.owner || 'unknown';
      const outputsMediaIds = [];
      const perJumpSummaries = [];

      const durationMs = video.durationSec ? video.durationSec * 1000 : null;

      // Determine the input path for FFmpeg processing
      let inputPath = video.path;
      
      // Download S3 video temporarily for FFmpeg processing
      if (video.s3Key) {
        console.log(`[SQSJobRunner] 📥 Downloading S3 video ${video.s3Key} for FFmpeg processing...`);
        const tempDir = path.join('storage', 'temp', owner);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const tempFileName = `${video.videoId}_${Date.now()}.${path.extname(video.originalName || '.mp4')}`;
        tempS3Download = path.join(tempDir, tempFileName);
        
        try {
          inputPath = await s3Service.downloadToLocal(video.s3Key, tempS3Download);
          console.log(`[SQSJobRunner] ✅ S3 video downloaded to ${inputPath}`);
        } catch (downloadError) {
          console.error(`[SQSJobRunner] ❌ Failed to download S3 video ${video.s3Key}:`, downloadError);
          throw new Error(`Cannot process S3 video: ${downloadError.message}`);
        }
      }

      for (let idx = 0; idx < jumps.length; idx++) {
        const jumpStartTime = Date.now();
        const jump = jumps[idx];
        
        console.log(`[SQSJobRunner] 🎯 Job ${job.jobId} processing jump ${idx + 1}/${jumps.length} (ID: ${jump.jumpId})`);
        
        const metrics = computeJumpMetrics(jump.takeoffMs, jump.landingMs);
        const overlayText = formatOverlayText({ index: idx + 1, heightMetres: metrics.heightMetres, tSeconds: metrics.tSeconds });
        
        console.log(`[SQSJobRunner] 📏 Jump ${jump.jumpId} metrics: ${metrics.heightMetres.toFixed(2)}m height, ${metrics.tSeconds.toFixed(3)}s flight time`);
        
        const pad = 300;
        let startMs = Math.max(0, jump.takeoffMs - pad);
        let endMs = Math.max(startMs + 50, jump.landingMs + pad);
        if (durationMs != null) {
          startMs = Math.max(0, Math.min(startMs, durationMs));
          endMs = Math.max(50, Math.min(endMs, durationMs));
        }
        
        console.log(`[SQSJobRunner] 🎬 Jump ${jump.jumpId} video segment: ${startMs}ms → ${endMs}ms (${(endMs - startMs) / 1000}s duration)`);

        const outputDir = path.join('storage', 'renders', owner);
        const { outputs, stderrTail } = await renderJumpSlowmo({
          inputPath: inputPath,
          outputDir,
          startMs,
          endMs,
          overlayText,
          interpolationFps: Number(options.interpolationFps) || 60,
          preset: options.preset || 'slow',
          workFactor: Number(options.workFactor) || 1,
          slowFactor: Number(options.slowFactor) || 2,
          lowMemoryMode: true,
        });
        
        const ffmpegTime = Date.now() - jumpStartTime;
        console.log(`[SQSJobRunner] ✅ FFmpeg render for jump ${jump.jumpId} completed in ${ffmpegTime}ms`);
        console.log(`[SQSJobRunner] 📁 Jump ${jump.jumpId} generated ${outputs.length} output files`);
        
        // Create media entries for each output
        for (const outPath of outputs) {
          const mediaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const sizeBytes = safeStatSize(outPath);
          
          let s3Key = null, s3Url = null;
          try {
            s3Key = s3Service.generateClipKey(owner, mediaId);
            const s3Result = await s3Service.uploadLocalFile(outPath, s3Key, 'video/mp4');
            s3Url = s3Result.url;
            
            if (fs.existsSync(outPath)) {
              fs.unlinkSync(outPath);
            }
            
            console.log(`☁️ Uploaded clip ${mediaId} to S3: ${s3Key}`);
          } catch (s3Error) {
            console.error(`❌ Failed to upload clip ${mediaId} to S3:`, s3Error);
            throw s3Error;
          }
          
          const mediaItem = {
            mediaId,
            owner,
            kind: 'slowmo',
            path: null,
            s3Key: s3Key,
            s3Url: s3Url,
            sizeBytes,
            createdAt: nowIso(),
            storageType: 's3',
          };
          
          await mediaRepo.put(mediaItem);
          outputsMediaIds.push(mediaId);
          console.log(`💾 Media ${mediaId} saved to database (${mediaItem.storageType} storage)`);
        }

        perJumpSummaries.push({ jumpId: jump.jumpId, metrics });
        j.progress.completed = idx + 1;
        j.progress.pct = j.progress.total ? Math.round((j.progress.completed / j.progress.total) * 100) : 100;
        j.updatedAt = nowIso();
        await jobsRepo.put(j);
        
        const jumpTotalTime = Date.now() - jumpStartTime;
        console.log(`[SQSJobRunner] 📊 Job ${job.jobId} progress: ${j.progress.completed}/${j.progress.total} jumps (${j.progress.pct}%) - Jump ${jump.jumpId} took ${jumpTotalTime}ms total`);

        if (this._stopRequested) break;
      }

      // Session-level stats
      const stats = computeSessionStats(jumps);

      j.outputs = outputsMediaIds;
      j.summary = {
        perJump: perJumpSummaries,
        session: {
          count: stats.count,
          best: stats.best,
          average: stats.average,
          standardDeviation: stats.standardDeviation,
          coefficientOfVariation: stats.coefficientOfVariation,
          fatigueSlope: stats.fatigueSlope,
        },
      };
      j.metricsRef = j.targetType === 'session' ? { sessionId: j.targetId } : { jumpId: j.targetId };
      j.status = 'succeeded';
      j.finishedAt = nowIso();
      j.updatedAt = nowIso();
      j.stderrTail = null;
      
      console.log(`[SQSJobRunner] 💾 Storing job ${j.jobId} with outputs:`, outputsMediaIds);
      
      await jobsRepo.update(j.jobId, {
        outputs: j.outputs,
        summary: j.summary,
        metricsRef: j.metricsRef,
        status: j.status,
        finishedAt: j.finishedAt,
        updatedAt: j.updatedAt,
        stderrTail: j.stderrTail || null,
      });

      // Clean up temporary S3 download if it exists
      if (tempS3Download && fs.existsSync(tempS3Download)) {
        try {
          fs.unlinkSync(tempS3Download);
          console.log(`[SQSJobRunner] 🗑️ Cleaned up temporary S3 download: ${tempS3Download}`);
        } catch (cleanupError) {
          console.warn(`[SQSJobRunner] ⚠️ Failed to clean up temporary file ${tempS3Download}:`, cleanupError);
        }
      }

      const totalJobTime = Date.now() - jobStartTime;
      console.log(`[SQSJobRunner] 🎉 Job ${j.jobId} SUCCEEDED in ${totalJobTime}ms`);
      console.log(`[SQSJobRunner] 📊 Job ${j.jobId} final stats: ${outputsMediaIds.length} outputs, ${jumps.length} jumps processed`);
    } catch (err) {
      // Clean up temporary S3 download if it exists (error case)
      if (tempS3Download && fs.existsSync(tempS3Download)) {
        try {
          fs.unlinkSync(tempS3Download);
          console.log(`[SQSJobRunner] 🗑️ Cleaned up temporary S3 download after error: ${tempS3Download}`);
        } catch (cleanupError) {
          console.warn(`[SQSJobRunner] ⚠️ Failed to clean up temporary file ${tempS3Download}:`, cleanupError);
        }
      }

      const totalJobTime = Date.now() - jobStartTime;
      j.status = 'failed';
      j.finishedAt = nowIso();
      j.updatedAt = nowIso();
      j.stderrTail = err?.stderrTail || String(err?.stack || err);
      await jobsRepo.update(j.jobId, {
        status: j.status,
        finishedAt: j.finishedAt,
        updatedAt: j.updatedAt,
        stderrTail: j.stderrTail,
      });
      console.error(`[SQSJobRunner] ❌ Job ${j.jobId} FAILED after ${totalJobTime}ms`, err);
      throw err; // Re-throw to trigger SQS retry/DLQ
    }
  }
}

function safeStatSize(p) {
  try { return (fs.statSync(p).size) || 0; } catch { return 0; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export const sqsJobRunner = new SQSJobRunner();
