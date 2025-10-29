import fs from 'fs';
import path from 'path';

const storageRoot = path.resolve('storage');
const uploadsDir = path.join(storageRoot, 'uploads');
const rendersDir = path.join(storageRoot, 'renders');

export function ensureStorage() {
  [storageRoot, uploadsDir, rendersDir].forEach(p => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

export function getUploadsDir() { return uploadsDir; }
export function getRendersDir() { return rendersDir; }
