import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('backend/data');
const dbFile = path.join(dataDir, 'db.json');

function ensure() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({ users: [], media: [], jumps: [], jobs: [], renders: [] }, null, 2));
}

export function readDb() {
  ensure();
  const raw = fs.readFileSync(dbFile, 'utf8');
  return JSON.parse(raw);
}

export function writeDb(db) {
  ensure();
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}
