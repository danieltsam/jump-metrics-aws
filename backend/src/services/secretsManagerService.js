// AWS Secrets Manager Service
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { awsConfig } from '../config/aws.js';

class SecretsManagerService {
  constructor() {
    this.client = new SecretsManagerClient({ region: awsConfig.region });
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    console.log(`🔒 Secrets Manager service initialized`);
  }

  async getSecret(name) {
    if (process.env.USE_LOCAL_SECRETS === '1') {
      return null;
    }
    const cached = this.cache.get(name);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: name });
      const response = await this.client.send(command);
      const value = response.SecretString;
      
      if (value) {
        this.cache.set(name, { value, expiry: Date.now() + this.cacheExpiry });
      }
      return value;
    } catch (error) {
      console.error(`❌ Secrets Manager error for ${name}:`, error);
      throw error;
    }
  }

  async getJwtSecret() {
    return await this.getSecret('jump-metrics/jwt-secret');
  }

  clearCache() {
    this.cache.clear();
  }
}

export const secretsManagerService = new SecretsManagerService();
