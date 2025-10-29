import fs from 'fs';
import path from 'path';
// AI GENERATED FILE - This file was created by an AI assistant
import { videosRepo } from './repos/videosRepo.js';
import { sessionsRepo } from './repos/sessionsRepo.js';
import { jumpsRepo } from './repos/jumpsRepo.js';
import { jobsRepo } from './repos/jobsRepo.js';
import { mediaRepo } from './repos/mediaRepo.js';
import { renderJumpSlowmo, formatOverlayText } from './ffmpeg.js';
import { computeJumpMetrics, computeSessionStats } from './metrics.js';
import { s3Service } from './s3Service.js';
import { isDevelopment } from '../config/aws.js';

function nowIso() { return new Date().toISOString(); }

export class JobRunner {
  constructor() {
    this._running = false;
    this._stopRequested = false;
    this._loopPromise = null;
    this._dynamoUnavailable = false;
    this._currentJobId = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._stopRequested = false;
    this._loopPromise = this._loop();
    // eslint-disable-next-line no-console
    console.log('[JobRunner] started');
  }

  async stop() {
    this._stopRequested = true;
    // eslint-disable-next-line no-console
    console.log('[JobRunner] stop requested');
    await this._loopPromise;
    // eslint-disable-next-line no-console
    console.log('[JobRunner] stopped');
  }

  async _loop() {
    while (!this._stopRequested) {
      try {
        // Find oldest queued job via DynamoDB index
        const { items: queuedItems = [] } = await jobsRepo.listByStatus('queued', { limit: 100 });
        
        // If we got empty results and DynamoDB seems unavailable, reduce polling frequency
        if (queuedItems.length === 0) {
          if (this._dynamoUnavailable) {
            await sleep(5000); // Poll every 5 seconds when DynamoDB is unavailable
          } else {
            await sleep(500); // Normal polling rate
          }
          continue;
        }
        
        // Reset DynamoDB unavailable flag if we get results
        this._dynamoUnavailable = false;
        
        const queued = queuedItems.sort((a, b) => (a.queuedAt || '').localeCompare(b.queuedAt || ''));
        const job = queued[0];
        if (!job) {
          await sleep(500);
          continue;
        }
        
        this._currentJobId = job.jobId;
        try {
          await this._processJob(job);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[JobRunner] job error', job.jobId, err);
        } finally {
          this._currentJobId = null;
        }
      } catch (err) {
        // Handle DynamoDB connection errors
        this._dynamoUnavailable = true;
        console.warn('[JobRunner] DynamoDB unavailable, reducing poll frequency');
        await sleep(5000);
      }
    }
  }

  async _processJob(job) {
    const jobStartTime = Date.now();
    console.log(`[JobRunner] 🚀 Starting job ${job.jobId} (${job.targetType}:${job.targetId})`);
    
    const j = { ...job };
    j.status = 'running';
    j.startedAt = nowIso();
    j.updatedAt = nowIso();
    j.progress = { completed: 0, total: 0, pct: 0 };
    await jobsRepo.put(j);
    
    const startTime = Date.now();
    console.log(`[JobRunner] ✅ Job ${job.jobId} status updated to running at ${new Date().toISOString()}`);

    const options = j.options || {};
    let tempS3Download = null; // Declare at function scope for cleanup access

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
      console.log(`[JobRunner] 📋 Job ${job.jobId} setup complete in ${setupTime}ms`);
      console.log(`[JobRunner] 📊 Job ${job.jobId} processing ${jumps.length} jumps with options:`, options);

      if (!video) throw new Error('Target video not found');

      const owner = j.owner || 'unknown';
      const outputsMediaIds = [];
      const perJumpSummaries = [];

      const durationMs = video.durationSec ? video.durationSec * 1000 : null;

      // Determine the input path for FFmpeg processing
      let inputPath = video.path; // Will be null when using S3-only
      
      // Download S3 video temporarily for FFmpeg processing
      if (video.s3Key) {
        console.log(`[JobRunner] 📥 Downloading S3 video ${video.s3Key} for FFmpeg processing...`);
        const tempDir = path.join('storage', 'temp', owner);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const tempFileName = `${video.videoId}_${Date.now()}.${path.extname(video.originalName || '.mp4')}`;
        tempS3Download = path.join(tempDir, tempFileName);
        
        try {
          inputPath = await s3Service.downloadToLocal(video.s3Key, tempS3Download);
          console.log(`[JobRunner] ✅ S3 video downloaded to ${inputPath}`);
        } catch (downloadError) {
          console.error(`[JobRunner] ❌ Failed to download S3 video ${video.s3Key}:`, downloadError);
          throw new Error(`Cannot process S3 video: ${downloadError.message}`);
        }
      }

      for (let idx = 0; idx < jumps.length; idx++) {
        const jumpStartTime = Date.now();
        const jump = jumps[idx];
        
        console.log(`[JobRunner] 🎯 Job ${job.jobId} processing jump ${idx + 1}/${jumps.length} (ID: ${jump.jumpId})`);
        
        const metrics = computeJumpMetrics(jump.takeoffMs, jump.landingMs);
        const overlayText = formatOverlayText({ index: idx + 1, heightMetres: metrics.heightMetres, tSeconds: metrics.tSeconds });
        
        console.log(`[JobRunner] 📏 Jump ${jump.jumpId} metrics: ${metrics.heightMetres.toFixed(2)}m height, ${metrics.tSeconds.toFixed(3)}s flight time`);
        
        const pad = 300;
        let startMs = Math.max(0, jump.takeoffMs - pad);
        let endMs = Math.max(startMs + 50, jump.landingMs + pad);
        if (durationMs != null) {
          startMs = Math.max(0, Math.min(startMs, durationMs));
          endMs = Math.max(50, Math.min(endMs, durationMs));
        }
        
        console.log(`[JobRunner] 🎬 Jump ${jump.jumpId} video segment: ${startMs}ms → ${endMs}ms (${(endMs - startMs) / 1000}s duration)`);

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
          lowMemoryMode: true, // Enable low memory mode for t3.micro
        });
        
                const ffmpegTime = Date.now() - jumpStartTime;
        console.log(`[JobRunner] ✅ FFmpeg render for jump ${jump.jumpId} completed in ${ffmpegTime}ms`);
        console.log(`[JobRunner] 📁 Jump ${jump.jumpId} generated ${outputs.length} output files`);
        console.log(`[JobRunner] 📂 Output paths:`, outputs);
        
        // Create media entries for each output
        for (const outPath of outputs) {
          const mediaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const sizeBytes = safeStatSize(outPath);
          
          let s3Key = null, s3Url = null;
          // Always upload rendered clip to S3
          try {
            s3Key = s3Service.generateClipKey(owner, mediaId);
            const s3Result = await s3Service.uploadLocalFile(outPath, s3Key, 'video/mp4');
            s3Url = s3Result.url;
            
            // Clean up local file after S3 upload
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
        console.log(`[JobRunner] 📊 Job ${job.jobId} progress: ${j.progress.completed}/${j.progress.total} jumps (${j.progress.pct}%) - Jump ${jump.jumpId} took ${jumpTotalTime}ms total`);

        if (this._stopRequested) break; // graceful exit after current jump
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
      
      console.log(`[JobRunner] 💾 Storing job ${j.jobId} with outputs:`, outputsMediaIds);
      console.log(`[JobRunner] 💾 Job ${j.jobId} outputs array length:`, j.outputs.length);
      
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
          console.log(`[JobRunner] 🗑️ Cleaned up temporary S3 download: ${tempS3Download}`);
        } catch (cleanupError) {
          console.warn(`[JobRunner] ⚠️ Failed to clean up temporary file ${tempS3Download}:`, cleanupError);
        }
      }

      const totalJobTime = Date.now() - jobStartTime;
      console.log(`[JobRunner] 🎉 Job ${j.jobId} SUCCEEDED in ${totalJobTime}ms`);
      console.log(`[JobRunner] 📊 Job ${j.jobId} final stats: ${outputsMediaIds.length} outputs, ${jumps.length} jumps processed`);
      console.log(`[JobRunner] 📈 Job ${j.jobId} performance: ${(totalJobTime / 1000).toFixed(1)}s total, ${(totalJobTime / jumps.length).toFixed(0)}ms per jump average`);
    } catch (err) {
      // Clean up temporary S3 download if it exists (error case)
      if (tempS3Download && fs.existsSync(tempS3Download)) {
        try {
          fs.unlinkSync(tempS3Download);
          console.log(`[JobRunner] 🗑️ Cleaned up temporary S3 download after error: ${tempS3Download}`);
        } catch (cleanupError) {
          console.warn(`[JobRunner] ⚠️ Failed to clean up temporary file ${tempS3Download}:`, cleanupError);
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
      console.error(`[JobRunner] ❌ Job ${j.jobId} FAILED after ${totalJobTime}ms`, err);
    }
  }
}

function safeStatSize(p) {
  try { return (fs.statSync(p).size) || 0; } catch { return 0; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export const jobRunner = new JobRunner();
