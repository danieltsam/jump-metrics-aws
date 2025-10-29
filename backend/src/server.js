// AI GENERATED FILE - This file was created by an AI assistant
import dotenv from 'dotenv';
import app from './app.js';
// Note: Job processing is handled by separate SQS worker service (do not start here)
import { loadParameterStoreConfig } from './config/parameterStoreConfig.js';
import { cognitoService } from './services/cognitoService.js';

dotenv.config();

const port = process.env.PORT || 8080;

// Load configuration from Parameter Store on startup
let appConfig = null;

async function initializeApp() {
  try {
    console.log('🚀 Initializing Jump Metrics application...');
    
    // Load configuration from Parameter Store
    appConfig = await loadParameterStoreConfig();
    if (appConfig) {
      console.log('✅ Configuration loaded from Parameter Store');
    } else {
      console.log('⚠️ Using fallback environment variables');
    }
    
    // Initialize Cognito service
    await cognitoService.initialize();
    
    // API does not process SQS jobs; worker service does. Keep API lightweight.
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Jump Metrics server listening on port ${port}`);
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
}

const server = await initializeApp();

function shutdown() {
  // eslint-disable-next-line no-console
  console.log('Shutting down...');
  server.close(() => {
    process.exit(0);
  });
  // Fallback hard exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
