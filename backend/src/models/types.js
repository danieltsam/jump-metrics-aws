// AI GENERATED FILE - This file was created by an AI assistant
// Entities reference (shapes only)

// User (hard-coded for now)
// { id: string, username: string, role: 'admin'|'user' }

// Video
// { videoId: string,
//   owner: string,                // userId
//   originalName: string,
//   path: string,                 // filesystem path to original video
//   mimeType: string,
//   size: number,                 // bytes
//   createdAt: string,            // ISO timestamp
//   durationSec: number | null,   // seconds, if known
//   fps: number | null            // frames per second, if known
// }

// Session
// { sessionId: string,
//   owner: string,                // userId
//   videoId: string,
//   createdAt: string,            // ISO timestamp
//   notes: string | null
// }

// Jump
// { jumpId: string,
//   sessionId: string,
//   takeoffMs: number,
//   landingMs: number,
//   method: 'manual' | 'refined',
//   createdAt: string             // ISO timestamp
// }

// Job
// { jobId: string,
//   owner: string,                // userId
//   targetType: 'session' | 'jump',
//   targetId: string,
//   status: 'queued'|'running'|'succeeded'|'failed'|'cancelled',
//   queuedAt: string,
//   startedAt: string | null,
//   finishedAt: string | null,
//   stderrTail: string | null,    // last N lines of stderr
//   options: Record<string, any> | null,
//   outputs: string[],            // list of mediaIds
//   summary: string | null,       // short description
//   metricsRef: {                 // link to computed metrics if applicable
//     jumpId?: string,
//     sessionId?: string
//   } | null
// }

// Media
// { mediaId: string,
//   owner: string,                // userId
//   kind: 'slowmo' | 'montage',
//   path: string,                 // filesystem path to rendered media
//   sizeBytes: number,
//   createdAt: string             // ISO timestamp
// }
