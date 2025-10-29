// Secrets Manager API routes
import { Router } from 'express';
import { secretsManagerService } from '../services/secretsManagerService.js';

const router = Router();

// GET /api/v1/secrets/health - Check Secrets Manager connectivity
router.get('/health', async (req, res) => {
  try {
    await secretsManagerService.getJwtSecret();
    res.json({ 
      status: 'healthy', 
      secretsManager: 'connected', 
      timestamp: new Date().toLocaleString() 
    });
  } catch (error) {
    console.error('Secrets health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      secretsManager: 'disconnected', 
      error: error.message, 
      timestamp: new Date().toLocaleString() 
    });
  }
});

// GET /api/v1/secrets/jwt - Get JWT secret (admin only)
router.get('/jwt', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const jwtSecret = await secretsManagerService.getJwtSecret();
    res.json({ 
      secret: jwtSecret ? '[REDACTED]' : null,
      source: 'Secrets Manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('JWT secret retrieval error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve JWT secret',
      error: error.message 
    });
  }
});

export default router;
