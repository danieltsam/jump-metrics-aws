// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import { computeSessionStats } from '../services/metrics.js';
import { videosRepo } from '../services/repos/videosRepo.js';
import { sessionsRepo } from '../services/repos/sessionsRepo.js';
import { jumpsRepo } from '../services/repos/jumpsRepo.js';

const router = Router();

// GET /api/v1/sessions - list all sessions for the current user
router.get('/', async (req, res) => {
  const owner = req.user?.id || 'unknown';
  
  try {
    const { items } = await sessionsRepo.listByOwner(owner, { limit: 1000 });
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Sessions list error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/v1/sessions - create for a given video
router.post('/', async (req, res) => {
  const owner = req.user?.id || 'unknown';
  const { videoId, notes } = req.body || {};
  if (!videoId) return res.status(400).json({ message: 'videoId required' });
  
  try {
    const video = await videosRepo.get(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    if (req.user?.role !== 'admin' && video.owner !== owner) return res.status(403).json({ message: 'Forbidden' });
    
    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sessionsRepo.put({ sessionId, owner, videoId, createdAt: new Date().toISOString(), notes: notes ?? null });
    return res.status(201).json({ sessionId });
  } catch (error) {
    console.error('Session creation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/v1/sessions/:sessionId/jumps - add a jump
router.post('/:sessionId/jumps', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const session = await sessionsRepo.get(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const owner = req.user?.id || 'unknown';
    if (req.user?.role !== 'admin' && session.owner !== owner) return res.status(403).json({ message: 'Forbidden' });
    
    const { takeoffMs, landingMs, method = 'manual' } = req.body || {};
    if (!Number.isFinite(takeoffMs) || !Number.isFinite(landingMs)) return res.status(400).json({ message: 'takeoffMs and landingMs required' });
    
    const jumpId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await jumpsRepo.put({ jumpId, sessionId, takeoffMs, landingMs, method, createdAt: new Date().toISOString() });
    return res.status(201).json({ jumpId });
  } catch (error) {
    console.error('Jump creation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/sessions/:sessionId/jumps - list jumps
router.get('/:sessionId/jumps', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const session = await sessionsRepo.get(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const owner = req.user?.id || 'unknown';
    if (req.user?.role !== 'admin' && session.owner !== owner) return res.status(403).json({ message: 'Forbidden' });
    
    const { items } = await jumpsRepo.listBySession(sessionId);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Jumps list error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/v1/sessions/:sessionId/results - per jump metrics and aggregated stats
router.get('/:sessionId/results', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const session = await sessionsRepo.get(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const owner = req.user?.id || 'unknown';
    if (req.user?.role !== 'admin' && session.owner !== owner) return res.status(403).json({ message: 'Forbidden' });
    
    const { items: jumps } = await jumpsRepo.listBySession(sessionId);
    const stats = computeSessionStats(jumps);
    return res.status(200).json({ sessionId, ...stats });
  } catch (error) {
    console.error('Session results error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
