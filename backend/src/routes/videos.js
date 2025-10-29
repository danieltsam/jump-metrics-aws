// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { videosRepo } from '../services/repos/videosRepo.js';
import { s3Service } from '../services/s3Service.js';
import { awsConfig } from '../config/aws.js';

const uploadDir = 'storage/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const router = Router();

// POST /api/v1/videos - multipart upload field "video"
router.post('/', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'video file required (field "video")' });
  
  const owner = req.user?.id || 'unknown';
  const { originalname, mimetype, size, path: filePath, filename, destination } = req.file;
  const videoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    // Always upload to S3
    const storedPath = filePath || path.join(destination || uploadDir, filename);
    const s3Key = s3Service.generateVideoKey(owner, videoId, originalname);
    const s3Result = await s3Service.uploadLocalFile(storedPath, s3Key, mimetype);
    const s3Url = s3Result.url;
    if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
    console.log(`☁️ Uploaded video to S3 at ${s3Key}`);

    const item = {
      videoId,
      owner,
      originalName: originalname,
      path: null,
      s3Key: s3Key,
      s3Url: s3Url,
      mimeType: mimetype,
      size,
      createdAt: new Date().toISOString(),
      durationSec: null,
      fps: null,
      storageType: 's3',
    };
    
    await videosRepo.put(item);
    console.log(`✅ Video ${videoId} metadata saved to database`);
    
    return res.status(201).json({ 
      videoId, 
      metadata: item,
      storageType: item.storageType
    });
    
  } catch (error) {
    console.error(`❌ Video upload failed for ${videoId}:`, error);
    
    // Clean up local file if it exists
    const tempPath = filePath || path.join(destination || uploadDir, filename);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    return res.status(500).json({ 
      message: 'Video upload failed', 
      error: error.message 
    });
  }
});

// GET /api/v1/videos?limit=&offset=
router.get('/', async (req, res) => {
  const owner = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  if (isAdmin) {
    return res.status(400).json({ message: 'Admin listing not implemented' });
  }
  const { items } = await videosRepo.listByOwner(owner, { limit: Number(req.query.limit) || 20 });
  res.setHeader('X-Total-Count', String(items.length));
  return res.status(200).json({ items, limit: items.length, offset: 0 });
});

// GET /api/v1/videos/:videoId/original - stream original with Range support
router.get('/:videoId/original', async (req, res) => {
  const v = await videosRepo.get(req.params.videoId);
  if (!v) return res.status(404).json({ message: 'Not found' });
  
  const owner = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && v.owner !== owner) return res.status(403).json({ message: 'Forbidden' });

  try {
    // Handle S3-stored videos
    if (v.storageType === 's3' && v.s3Key) {
      // For S3 videos, redirect to presigned URL
      const presignedUrl = await s3Service.getPresignedDownloadUrl(v.s3Key, 3600); // 1 hour expiry
      console.log(`🔗 Redirecting to S3 presigned URL for video ${req.params.videoId}`);
      return res.redirect(presignedUrl);
    }
    
    // Handle locally-stored videos (development mode)
    if (v.path) {
      const abs = path.resolve(v.path);
      if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File missing' });
      
      const stat = fs.statSync(abs);
      const range = req.headers.range;
      
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunkSize);
          res.setHeader('Content-Type', v.mimeType || 'video/mp4');
          fs.createReadStream(abs, { start, end }).pipe(res);
          return;
        }
      }
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', v.mimeType || 'video/mp4');
      fs.createReadStream(abs).pipe(res);
      return;
    }
    
    // Neither S3 nor local path available
    return res.status(404).json({ message: 'Video file not accessible' });
    
  } catch (error) {
    console.error(`❌ Error accessing video ${req.params.videoId}:`, error);
    return res.status(500).json({ message: 'Error accessing video file' });
  }
});

export default router;
