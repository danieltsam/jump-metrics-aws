// AWS Configuration for Jump Metrics
import { environment, isDevelopment as envIsDevelopment, isProduction } from './environment.js';

export const awsConfig = {
  region: environment.aws.region,
  s3: {
    bucketName: environment.s3.bucketName,
    bucketNameDev: environment.s3.bucketNameDev,
    presignedUrlExpiry: {
      download: 3600, // 1 hour
      upload: 900,    // 15 minutes
    }
  },
  dynamodb: {
    tablePrefix: environment.dynamodb.tablePrefix,
    tables: {
      // Match Terraform resource names exactly
      videos: 'jump-metrics-videos',
      sessions: 'jump-metrics-sessions',
      jumps: 'jump-metrics-jumps',
      jobs: 'jump-metrics-jobs',
      media: 'jump-metrics-media',
    }
  }
};

// Environment detection
export const isDevelopment = envIsDevelopment;
export { isProduction };

// Get the appropriate S3 bucket name based on environment
export function getS3BucketName() {
  return isDevelopment ? awsConfig.s3.bucketNameDev : awsConfig.s3.bucketName;
}
