// AI GENERATED FILE - This file was created by an AI assistant
import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('backend/data/db');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function collectionPath(name) {
  ensureDir(baseDir);
  return path.join(baseDir, `${name}.json`);
}

function ensureCollectionFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]');
  }
}

function readJsonArray(filePath) {
  ensureCollectionFile(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeWriteJsonArray(filePath, array) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = `${filePath}.tmp`;
  const data = Buffer.from(JSON.stringify(array, null, 2));
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data, 0, data.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    // On Windows, rename over existing may fail; unlink then rename.
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
  fs.renameSync(tmp, filePath);
}

function createStore(collectionName, idField) {
  const filePath = collectionPath(collectionName);

  function list(predicate) {
    const items = readJsonArray(filePath);
    return typeof predicate === 'function' ? items.filter(predicate) : items;
  }

  function get(id) {
    const items = readJsonArray(filePath);
    return items.find((it) => it && it[idField] === id) || null;
  }

  function upsert(item) {
    if (!item || typeof item !== 'object') throw new Error('upsert: item must be an object');
    const id = item[idField];
    if (id == null) throw new Error(`upsert: item missing ${idField}`);
    const items = readJsonArray(filePath);
    const idx = items.findIndex((it) => it && it[idField] === id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    safeWriteJsonArray(filePath, items);
    return item;
  }

  function remove(id) {
    const items = readJsonArray(filePath);
    const next = items.filter((it) => !(it && it[idField] === id));
    const changed = next.length !== items.length;
    if (changed) safeWriteJsonArray(filePath, next);
    return changed;
  }

  return { list, get, upsert, remove, filePath, collectionName, idField };
}

// Typed stores for domain entities
export const videosStore = createStore('videos', 'videoId');
export const sessionsStore = createStore('sessions', 'sessionId');
export const jumpsStore = createStore('jumps', 'jumpId');
export const jobsStore = createStore('jobs', 'jobId');
export const mediaStore = createStore('media', 'mediaId');

// Users remain hard-coded for now; when persisted later, use:
export const usersStore = createStore('users', 'id');

// Also export low-level helpers
export const storageDb = {
  baseDir,
  collectionPath,
  readJsonArray,
  safeWriteJsonArray,
  createStore,
};
