// Parameter Store Configuration Loader
import { parameterStoreService } from '../services/parameterStoreService.js';

let cachedConfig = null;
let lastLoadTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load configuration from Parameter Store with caching
 * @returns {Promise<Object>} Configuration object
 */
export async function loadParameterStoreConfig() {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - lastLoadTime) < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    console.log('📋 Loading configuration from Parameter Store...');
    const appConfig = await parameterStoreService.getAppConfig();
    
    cachedConfig = {
      appUrl: appConfig.appUrl,
      apiBaseUrl: appConfig.apiBaseUrl,
      s3BucketName: appConfig.s3BucketName,
      dynamodbTablePrefix: appConfig.dynamodbTablePrefix,
      environment: appConfig.environment
    };
    
    lastLoadTime = now;
    console.log('✅ Configuration loaded from Parameter Store');
    return cachedConfig;
  } catch (error) {
    console.warn('⚠️ Failed to load configuration from Parameter Store:', error.message);
    return null;
  }
}

/**
 * Get a specific parameter value from Parameter Store
 * @param {string} parameterName - The parameter name
 * @returns {Promise<string|null>} The parameter value
 */
export async function getParameterValue(parameterName) {
  try {
    return await parameterStoreService.getParameter(parameterName);
  } catch (error) {
    console.warn(`⚠️ Failed to get parameter ${parameterName}:`, error.message);
    return null;
  }
}

/**
 * Clear the configuration cache
 */
export function clearConfigCache() {
  cachedConfig = null;
  lastLoadTime = 0;
  parameterStoreService.clearCache();
}
