// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { mediaRepo } from '../services/repos/mediaRepo.js';
import { s3Service } from '../services/s3Service.js';
import { isDevelopment } from '../config/aws.js';

const router = Router();

// GET /api/v1/media/:mediaId -> stream rendered clip (owned or admin)
router.get('/:mediaId', async (req, res) => {
  try {
    const item = await mediaRepo.get(req.params.mediaId);
    if (!item) return res.status(404).json({ message: 'Not found' });
    
    const owner = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && item.owner !== owner) return res.status(403).json({ message: 'Forbidden' });

    // Handle S3-stored clips
    if (item.storageType === 's3' && item.s3Key) {
      // For S3 clips, redirect to presigned URL
      const presignedUrl = await s3Service.getPresignedDownloadUrl(item.s3Key, 3600); // 1 hour expiry
      console.log(`🔗 Redirecting to S3 presigned URL for media ${req.params.mediaId}`);
      return res.redirect(presignedUrl);
    }
    
    // Handle locally-stored clips (development mode)
    if (item.path) {
      const abs = path.resolve(item.path);
      if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File missing' });
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', item.sizeBytes || fs.statSync(abs).size);
      fs.createReadStream(abs).pipe(res);
      return;
    }
    
    // Neither S3 nor local path available
    return res.status(404).json({ message: 'Media file not accessible' });
    
  } catch (error) {
    console.error(`❌ Error accessing media ${req.params.mediaId}:`, error);
    return res.status(500).json({ message: 'Error accessing media file' });
  }
});

export default router;
