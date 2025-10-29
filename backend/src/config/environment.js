// Environment Configuration for Jump Metrics
export const environment = {
  // Application settings
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  
  // AWS settings
  aws: {
    region: process.env.AWS_REGION || 'ap-southeast-2', // Matching your terraform region
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  
  // S3 settings  
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'jump-metrics-storage',
    bucketNameDev: process.env.S3_BUCKET_NAME_DEV || 'jump-metrics-storage-dev',
  },
  
  // DynamoDB settings (for next step)
  dynamodb: {
    tablePrefix: process.env.DYNAMODB_TABLE_PREFIX || 'JumpMetrics',
  },
  
  // Cognito settings (for next step) 
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-2',
  },
  
  // Domain settings (for Route53)
  domain: {
    name: process.env.DOMAIN_NAME,
  }
};

// Helper functions
export const isDevelopment = environment.nodeEnv === 'development';
export const isProduction = environment.nodeEnv === 'production';
export const isTest = environment.nodeEnv === 'test';

// Validation
export function validateEnvironment() {
  const required = [];
  
  if (isProduction) {
    if (!environment.aws.region) required.push('AWS_REGION');
    if (!environment.s3.bucketName) required.push('S3_BUCKET_NAME');
  }
  
  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }
  
  return true;
}

