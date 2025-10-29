// AWS Systems Manager Parameter Store Service
import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';
import { awsConfig } from '../config/aws.js';

class ParameterStoreService {
  constructor() {
    this.client = new SSMClient({ region: awsConfig.region });
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get a single parameter from Parameter Store
   * @param {string} parameterName - The parameter name (e.g., '/jump-metrics/app/url')
   * @param {boolean} withDecryption - Whether to decrypt SecureString parameters
   * @returns {Promise<string|null>} The parameter value or null if not found
   */
  async getParameter(parameterName, withDecryption = false) {
    // Local fallback without AWS creds
    if (process.env.USE_LOCAL_PARAMS === '1') {
      return null;
    }

    // Check cache first
    const cacheKey = `${parameterName}_${withDecryption}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`📋 Parameter Store cache hit: ${parameterName}`);
      return cached.value;
    }

    try {
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: withDecryption
      });
      
      const response = await this.client.send(command);
      const value = response.Parameter?.Value || null;
      
      // Cache the result
      this.cache.set(cacheKey, {
        value,
        timestamp: Date.now()
      });
      
      console.log(`📋 Parameter Store retrieved: ${parameterName} = ${value ? '[REDACTED]' : 'null'}`);
      return value;
    } catch (error) {
      if (error.name === 'ParameterNotFound') {
        console.warn(`⚠️ Parameter not found: ${parameterName}`);
        return null;
      }
      console.error(`❌ Parameter Store error for ${parameterName}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple parameters from Parameter Store
   * @param {string[]} parameterNames - Array of parameter names
   * @param {boolean} withDecryption - Whether to decrypt SecureString parameters
   * @returns {Promise<Object>} Object with parameter names as keys and values as values
   */
  async getParameters(parameterNames, withDecryption = false) {
    if (process.env.USE_LOCAL_PARAMS === '1') {
      const result = {};
      for (const name of parameterNames) result[name] = null;
      return result;
    }

    try {
      const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: withDecryption
      });
      
      const response = await this.client.send(command);
      const result = {};
      
      // Map successful parameters
      response.Parameters?.forEach(param => {
        result[param.Name] = param.Value;
      });
      
      // Map invalid parameters as null
      response.InvalidParameters?.forEach(paramName => {
        result[paramName] = null;
      });
      
      console.log(`📋 Parameter Store retrieved ${Object.keys(result).length} parameters`);
      return result;
    } catch (error) {
      console.error(`❌ Parameter Store error for multiple parameters:`, error);
      throw error;
    }
  }

  /**
   * Get application configuration from Parameter Store
   * @returns {Promise<Object>} Application configuration object
   */
  async getAppConfig() {
    const parameterNames = [
      '/jump-metrics/app/url',
      '/jump-metrics/api/base-url',
      '/jump-metrics/s3/bucket-name',
      '/jump-metrics/dynamodb/table-prefix',
      '/jump-metrics/cognito/user-pool-id',
      '/jump-metrics/cognito/client-id',
      '/jump-metrics/cognito/region',
      '/jump-metrics/app/environment'
    ];

    const parameters = await this.getParameters(parameterNames);
    
    return {
      appUrl: parameters['/jump-metrics/app/url'],
      apiBaseUrl: parameters['/jump-metrics/api/base-url'],
      s3BucketName: parameters['/jump-metrics/s3/bucket-name'],
      dynamodbTablePrefix: parameters['/jump-metrics/dynamodb/table-prefix'],
      cognitoUserPoolId: parameters['/jump-metrics/cognito/user-pool-id'],
      cognitoClientId: parameters['/jump-metrics/cognito/client-id'],
      cognitoRegion: parameters['/jump-metrics/cognito/region'],
      environment: parameters['/jump-metrics/app/environment']
    };
  }

  /**
   * Clear the parameter cache
   */
  clearCache() {
    this.cache.clear();
    console.log('📋 Parameter Store cache cleared');
  }
}

// Export singleton instance
export const parameterStoreService = new ParameterStoreService();
