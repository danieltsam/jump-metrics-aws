// Configuration API routes
import { Router } from 'express';
import { loadParameterStoreConfig, getParameterValue } from '../config/parameterStoreConfig.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/config - Get application configuration from Parameter Store
router.get('/', requireAuth, async (req, res) => {
  try {
    const config = await loadParameterStoreConfig();
    
    if (!config) {
      return res.status(503).json({ 
        message: 'Configuration service unavailable',
        fallback: 'Using environment variables'
      });
    }

    // Return configuration (excluding sensitive values)
    res.json({
      appUrl: config.appUrl,
      apiBaseUrl: config.apiBaseUrl,
      s3BucketName: config.s3BucketName,
      dynamodbTablePrefix: config.dynamodbTablePrefix,
      cognitoUserPoolId: config.cognitoUserPoolId,
      cognitoClientId: config.cognitoClientId,
      cognitoRegion: config.cognitoRegion,
      environment: config.environment,
      source: 'Parameter Store',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Config API error:', error);
    res.status(500).json({ 
      message: 'Failed to load configuration',
      error: error.message 
    });
  }
});

// GET /api/v1/config/parameter/:name - Get specific parameter value
router.get('/parameter/:name', requireAuth, async (req, res) => {
  const { name } = req.params;
  const isAdmin = req.user?.role === 'admin';
  
  // Only allow admin users to access individual parameters
  if (!isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  try {
    const parameterName = `/jump-metrics/${name}`;
    const value = await getParameterValue(parameterName);
    
    if (value === null) {
      return res.status(404).json({ 
        message: 'Parameter not found',
        parameterName 
      });
    }

    res.json({
      parameterName,
      value,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Parameter API error:', error);
    res.status(500).json({ 
      message: 'Failed to get parameter',
      error: error.message 
    });
  }
});

// GET /api/v1/config/health - Health check for Parameter Store
router.get('/health', async (req, res) => {
  try {
    // Try to get a simple parameter to test connectivity
    const testParam = await getParameterValue('/jump-metrics/app/environment');
    
    res.json({
      status: 'healthy',
      parameterStore: testParam ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      parameterStore: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
