import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import fs from 'fs';
import path from 'path';

function createTempVideoFile() {
  const dir = path.resolve('storage/uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `test_${Date.now()}.mp4`);
  fs.writeFileSync(p, Buffer.from('fakevideo'));
  return p;
}

test('auth login returns JWT and user', async () => {
  const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.token);
  assert.ok(res.body.user);
});

test('videos -> sessions -> jumps -> jobs flow enqueues analyze job', async () => {
  // Login
  const login = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin' });
  const token = login.body.token;
  const authHeader = { Authorization: `Bearer ${token}` };

  // Upload
  const tempPath = createTempVideoFile();
  const resUpload = await request(app)
    .post('/api/v1/videos')
    .set(authHeader)
    .attach('video', tempPath);
  assert.equal(resUpload.statusCode, 201);
  const videoId = resUpload.body.videoId;
  assert.ok(videoId);

  // Create session
  const resSession = await request(app)
    .post('/api/v1/sessions')
    .set(authHeader)
    .send({ videoId });
  assert.equal(resSession.statusCode, 201);
  const sessionId = resSession.body.sessionId;
  assert.ok(sessionId);

  // Add two jumps
  const jump1 = await request(app)
    .post(`/api/v1/sessions/${sessionId}/jumps`)
    .set(authHeader)
    .send({ takeoffMs: 1000, landingMs: 1500, method: 'manual' });
  assert.equal(jump1.statusCode, 201);

  const jump2 = await request(app)
    .post(`/api/v1/sessions/${sessionId}/jumps`)
    .set(authHeader)
    .send({ takeoffMs: 2000, landingMs: 2600, method: 'manual' });
  assert.equal(jump2.statusCode, 201);

  // Start analyze job
  const resAnalyze = await request(app)
    .post('/api/v1/jobs/analyze')
    .set(authHeader)
    .send({ targetType: 'session', targetId: sessionId, options: { interpolationFps: 60, workFactor: 1 } });
  assert.equal(resAnalyze.statusCode, 202);
  const jobId = resAnalyze.body.jobId;
  assert.ok(jobId);

  // Fetch job detail
  const resJob = await request(app)
    .get(`/api/v1/jobs/${jobId}`)
    .set(authHeader);
  assert.equal(resJob.statusCode, 200);
  assert.equal(resJob.body.status, 'queued');

  // Session results
  const resResults = await request(app)
    .get(`/api/v1/sessions/${sessionId}/results`)
    .set(authHeader);
  assert.equal(resResults.statusCode, 200);
  assert.equal(resResults.body.count, 2);
  assert.ok(typeof resResults.body.average === 'number');
});
