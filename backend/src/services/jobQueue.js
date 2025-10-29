// AI GENERATED FILE - This file was created by an AI assistant
const queue = [];
let nextId = 1;

export function enqueueJob(type, payload) {
  const job = { id: String(nextId++), type, payload, status: 'queued', createdAt: Date.now() };
  queue.push(job);
  return job;
}

export function getJob(id) {
  return queue.find(j => j.id === id) || null;
}

export function listJobs() {
  return [...queue];
}

export function clearQueue() {
  queue.length = 0;
  nextId = 1;
  console.log('Job queue cleared');
}
