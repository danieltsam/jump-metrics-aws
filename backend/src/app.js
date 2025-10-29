// AI GENERATED FILE - This file was created by an AI assistant
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import videosRouter from './routes/videos.js';
import sessionsRouter from './routes/sessions.js';
import jobsRouter from './routes/jobs.js';
import mediaRouter from './routes/media.js';
import adminRouter from './routes/admin.js';
import configRouter from './routes/config.js';
import secretsRouter from './routes/secrets.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/', express.static(path.join(__dirname, '../../client/public')));

app.get('/api/v1/healthz', (req, res) => {
  res.json({ ok: true });
});

// Public
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/config', configRouter);
app.use('/api/v1/secrets', secretsRouter);

// Protected
app.use('/api/v1/videos', requireAuth, videosRouter);
app.use('/api/v1/sessions', requireAuth, sessionsRouter);
app.use('/api/v1/jobs', requireAuth, jobsRouter);
app.use('/api/v1/media', requireAuth, mediaRouter);
app.use('/api/v1/admin', requireAuth, adminRouter);

app.use(errorHandler);

export default app;
