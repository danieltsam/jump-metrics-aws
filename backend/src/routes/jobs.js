// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import { jobsRepo } from '../services/repos/jobsRepo.js';
import { sqsService } from '../services/sqsService.js';

const router = Router();

// POST /api/v1/jobs/analyze -> start background job for a session or jump
router.post('/analyze', async (req, res) => {
  const { targetType, targetId, options } = req.body || {};
  if (!['session', 'jump'].includes(targetType) || !targetId) {
    return res.status(400).json({ message: 'targetType must be session|jump and targetId required' });
  }
  
  try {
    const owner = req.user?.id || 'unknown';
    const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      jobId,
      owner,
      targetType,
      targetId,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      stderrTail: null,
      options: options || {},
      outputs: [],
      summary: null,
      metricsRef: null,
      progress: { completed: 0, total: 0, pct: 0 },
      updatedAt: new Date().toISOString(),
    };
    
    // Store job in DynamoDB
    await jobsRepo.put(job);
    
    // Send job message to SQS for worker processing
    await sqsService.sendJobMessage({
      jobId,
      type: 'analyze',
      targetType,
      targetId,
      owner,
      options: options || {}
    });
    console.log(`[Jobs] Job ${jobId} queued in SQS for processing`);
    
    return res.status(202).json({ jobId });
  } catch (error) {
    console.error('Job creation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/jobs?status=&limit=&offset= -> list jobs with pagination and status filter
router.get('/', async (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query;
  const owner = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  
  try {
    let items;
    if (status) {
      const { items: statusItems = [] } = await jobsRepo.listByStatus(status, { limit: 1000 });
      items = statusItems;
    } else if (isAdmin) {
      const { items: allItems = [] } = await jobsRepo.listByOwner('*', { limit: 1000 });
      items = allItems;
    } else {
      const { items: ownerItems = [] } = await jobsRepo.listByOwner(owner, { limit: 1000 });
      items = ownerItems;
    }
    
    if (!isAdmin) {
      items = items.filter(j => j.owner === owner);
    }
    
    const total = items.length;
    const start = Number(offset) || 0;
    const lim = Number(limit) || 20;
    const page = items.slice(start, start + lim);
    res.setHeader('X-Total-Count', String(total));
    return res.status(200).json({ items: page, limit: lim, offset: start });
  } catch (error) {
    console.error('Jobs list error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/jobs/:jobId -> status, progress, summary, links to outputs
router.get('/:jobId', async (req, res) => {
  try {
    const job = await jobsRepo.get(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Not found' });
    const owner = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && job.owner !== owner) return res.status(403).json({ message: 'Forbidden' });
    return res.status(200).json(job);
  } catch (error) {
    console.error('Job get error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
