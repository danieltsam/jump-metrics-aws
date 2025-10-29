// AI GENERATED FILE - This file was created by an AI assistant
import dotenv from 'dotenv';
import http from 'http';
import { sqsJobRunner } from './services/sqsJobRunner.js';
import { loadParameterStoreConfig } from './config/parameterStoreConfig.js';
import { cognitoService } from './services/cognitoService.js';
import { sqsService } from './services/sqsService.js';

dotenv.config();

const HEALTH_PORT = process.env.WORKER_HEALTH_PORT || 9090;

async function main() {
  try {
    console.log('🚀 Initializing Jump Metrics worker...');

    // Load configuration from Parameter Store (mirrors server init)
    await loadParameterStoreConfig();

    // Initialize Cognito (if worker needs to verify tokens for any reason)
    await cognitoService.initialize();

    // Initialize SQS service
    await sqsService.initialize();

    // Start health probe server
    const server = http.createServer((req, res) => {
      if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(HEALTH_PORT, () => {
      console.log(`Worker health endpoint listening on :${HEALTH_PORT}/healthz`);
    });

    // Start SQS job runner loop
    sqsJobRunner.start();

    const shutdown = async () => {
      console.log('Worker shutting down...');
      try {
        await sqsJobRunner.stop();
      } finally {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 5000).unref();
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('❌ Worker failed to initialize:', err);
    process.exit(1);
  }
}

await main();



