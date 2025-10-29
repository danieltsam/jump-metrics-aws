// AWS S3 Service for Jump Metrics
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { awsConfig } from '../config/aws.js';
import { getParameterValue } from '../config/parameterStoreConfig.js';

// Initialize S3 client (may be unused in local fallback mode)
const s3Client = new S3Client({
  region: awsConfig.region,
});

// Local dev/test fallback when AWS creds/role are not available
const useLocalFallback = (
  process.env.USE_LOCAL_S3 === '1' ||
  (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)
);

// Get bucket name from Parameter Store or fallback to environment
let _bucketName = null;

async function getBucketName() {
  if (_bucketName) return _bucketName;
  
  try {
    _bucketName = await getParameterValue('/jump-metrics/s3/bucket-name');
    if (_bucketName) {
      console.log('📋 S3 bucket name loaded from Parameter Store');
      return _bucketName;
    }
  } catch (error) {
    console.warn('⚠️ Failed to load bucket name from Parameter Store, using fallback');
  }
  
  // Fallback to environment variable
  _bucketName = process.env.S3_BUCKET_NAME || 'jump-metrics-storage';
  return _bucketName;
}

export class S3Service {
  
  /**
   * Upload a file to S3
   * @param {string} key - The S3 object key (file path in bucket)
   * @param {Buffer|ReadStream} body - File content
   * @param {string} contentType - MIME type
   * @param {object} metadata - Additional metadata
   * @returns {Promise<string>} - The S3 URL
   */
  async uploadFile(key, body, contentType, metadata = {}) {
    try {
      if (useLocalFallback) {
        const localDir = path.resolve('storage/uploads');
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        const localPath = path.join(localDir, key.replace(/\//g, '_'));
        const writeStream = fs.createWriteStream(localPath);
        await new Promise((resolve, reject) => {
          if (Buffer.isBuffer(body)) {
            writeStream.end(body, (err) => (err ? reject(err) : resolve()));
          } else if (body && typeof body.pipe === 'function') {
            body.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          } else {
            reject(new Error('Unsupported body type for local upload'));
          }
        });
        console.log(`✅ Local upload fallback saved: ${localPath}`);
        return {
          key,
          etag: 'local-dev',
          url: `file://${localPath}`,
          bucket: 'local-fallback'
        };
      }
      const bucketName = await getBucketName();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
        // ServerSideEncryption: 'AES256', // Optional: encrypt at rest
      });

      const result = await s3Client.send(command);
      console.log(`✅ S3 Upload successful: ${key}`);
      
      return {
        key,
        etag: result.ETag,
        url: `https://${await getBucketName()}.s3.amazonaws.com/${key}`,
        bucket: await getBucketName()
      };
    } catch (error) {
      console.error(`❌ S3 Upload failed for ${key}:`, error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Upload a local file to S3
   * @param {string} localFilePath - Path to local file
   * @param {string} s3Key - S3 object key
   * @param {string} contentType - MIME type
   * @returns {Promise<object>} - Upload result
   */
  async uploadLocalFile(localFilePath, s3Key, contentType) {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Local file not found: ${localFilePath}`);
    }

    const fileStream = fs.createReadStream(localFilePath);
    const stats = fs.statSync(localFilePath);
    
    return await this.uploadFile(s3Key, fileStream, contentType, {
      'original-size': stats.size.toString(),
      'upload-date': new Date().toISOString()
    });
  }

  /**
   * Generate a presigned URL for downloading
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration in seconds (default: 1 hour)
   * @returns {Promise<string>} - Presigned URL
   */
  async getPresignedDownloadUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: await getBucketName(),
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      console.log(`🔗 Generated presigned download URL for: ${key}`);
      return url;
    } catch (error) {
      console.error(`❌ Failed to generate presigned URL for ${key}:`, error);
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  /**
   * Download a file from S3 to local filesystem temporarily
   * @param {string} s3Key - S3 object key
   * @param {string} localPath - Local file path to save to
   * @returns {Promise<string>} - Local file path
   */
  async downloadToLocal(s3Key, localPath) {
    try {
      const command = new GetObjectCommand({
        Bucket: await getBucketName(),
        Key: s3Key,
      });

      const response = await s3Client.send(command);
      
      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Stream the response body to a local file
      const writeStream = fs.createWriteStream(localPath);
      
      return new Promise((resolve, reject) => {
        response.Body.pipe(writeStream);
        
        writeStream.on('finish', () => {
          console.log(`⬇️ Downloaded S3 file ${s3Key} to ${localPath}`);
          resolve(localPath);
        });
        
        writeStream.on('error', (error) => {
          console.error(`❌ Failed to download S3 file ${s3Key}:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`❌ Failed to download S3 file ${s3Key}:`, error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for uploading
   * @param {string} key - S3 object key
   * @param {string} contentType - MIME type
   * @param {number} expiresIn - URL expiration in seconds (default: 15 minutes)
   * @returns {Promise<string>} - Presigned URL
   */
  async getPresignedUploadUrl(key, contentType, expiresIn = 900) {
    try {
      const command = new PutObjectCommand({
        Bucket: await getBucketName(),
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      console.log(`📤 Generated presigned upload URL for: ${key}`);
      return url;
    } catch (error) {
      console.error(`❌ Failed to generate presigned upload URL for ${key}:`, error);
      throw new Error(`Presigned upload URL generation failed: ${error.message}`);
    }
  }

  /**
   * Delete an object from S3
   * @param {string} key - S3 object key
   * @returns {Promise<void>}
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: await getBucketName(),
        Key: key,
      });

      await s3Client.send(command);
      console.log(`🗑️ S3 Delete successful: ${key}`);
    } catch (error) {
      console.error(`❌ S3 Delete failed for ${key}:`, error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * Check if an object exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>}
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: await getBucketName(),
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata
   * @param {string} key - S3 object key
   * @returns {Promise<object>}
   */
  async getFileMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: await getBucketName(),
        Key: key,
      });

      const response = await s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error(`❌ Failed to get metadata for ${key}:`, error);
      throw new Error(`Get metadata failed: ${error.message}`);
    }
  }

  /**
   * Generate S3 key for video uploads
   * @param {string} userId - User ID
   * @param {string} videoId - Video ID
   * @param {string} originalName - Original filename
   * @returns {string} - S3 key
   */
  generateVideoKey(userId, videoId, originalName) {
    const extension = path.extname(originalName);
    return `videos/${userId}/${videoId}${extension}`;
  }

  /**
   * Generate S3 key for rendered clips
   * @param {string} userId - User ID
   * @param {string} mediaId - Media ID
   * @returns {string} - S3 key
   */
  generateClipKey(userId, mediaId) {
    return `clips/${userId}/${mediaId}.mp4`;
  }
}

// Export singleton instance
export const s3Service = new S3Service();
