// AI GENERATED FILE - This file was created by an AI assistant
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';

function resolveDefaultFont() {
  const candidates = [];
  if (process.env.FFMPEG_FONT) candidates.push(process.env.FFMPEG_FONT);
  
  // Windows common fonts - try multiple variations
  if (process.platform === 'win32') {
    candidates.push('C:/Windows/Fonts/arial.ttf');
    candidates.push('C:/Windows/Fonts/ARIAL.TTF');
    candidates.push('C:/Windows/Fonts/calibri.ttf');
    candidates.push('C:/Windows/Fonts/CALIBRI.TTF');
    candidates.push('C:/Windows/Fonts/tahoma.ttf');
    candidates.push('C:/Windows/Fonts/TAHOMA.TTF');
  }
  
  // macOS common fonts
  if (process.platform === 'darwin') {
    candidates.push('/System/Library/Fonts/Supplemental/Arial.ttf');
    candidates.push('/Library/Fonts/Arial.ttf');
    candidates.push('/System/Library/Fonts/Helvetica.ttc');
  }
  
  // Linux common fonts
  if (process.platform === 'linux') {
    candidates.push('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    // Alpine Linux common path
    candidates.push('/usr/share/fonts/dejavu/DejaVuSans.ttf');
    candidates.push('/usr/share/fonts/truetype/freefont/FreeSans.ttf');
    candidates.push('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf');
  }
  
  for (const p of candidates) {
    try { 
      if (p && fs.existsSync(p)) {
        console.log(`Using font: ${p}`);
        return p; 
      } 
    } catch {}
  }
  
  console.warn('No suitable font found, text overlay may not work properly');
  return undefined;
}

const DEFAULT_FONT = resolveDefaultFont();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function buildOverlayFilter(overlayText, fontPath = DEFAULT_FONT) {
  // Escape special characters in the text for ffmpeg filter
  const escaped = String(overlayText).replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/\\/g, '\\\\');
  
  // For now, use default font to avoid Windows path issues
  // TODO: Implement proper font path handling for cross-platform compatibility
  const filterString = `drawtext=text='${escaped}':x=10:y=10:fontcolor=white:fontsize=28:box=1:boxcolor=black@0.45:boxborderw=12`;
  
  return filterString;
}

function collectStderr(proc, maxBytes = 20000) {
  let tail = '';
  proc.stderr.on('data', (chunk) => {
    const str = chunk.toString();
    tail += str;
    if (tail.length > maxBytes) {
      tail = tail.slice(tail.length - maxBytes);
    }
  });
  return () => tail;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ['-hide_banner', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    const getTail = collectStderr(proc);
    proc.on('error', (err) => {
      reject({ error: err, stderrTail: getTail() });
    });
    proc.on('close', (code) => {
      const tail = getTail();
      if (code === 0) resolve({ code, stderrTail: tail });
      else reject({ error: new Error(`${FFMPEG_BIN} exited with code ${code}`), stderrTail: tail, code });
    });
  });
}

export function formatOverlayText({ index, heightMetres, tSeconds }) {
  const heightCm = Math.round(heightMetres * 100);
  const tMs = Math.round(tSeconds * 1000);
  const takeoffVelocityMs = (9.81 * tSeconds) / 2;
  const takeoffVelocityKmh = Math.round(takeoffVelocityMs * 3.6);
  return `Jump ${index}  |  ${heightCm} cm  |  ${tMs} ms  |  ${takeoffVelocityMs.toFixed(1)} m/s`;
}

/**
 * Cut and render a slow-motion clip for a jump
 * @param {Object} params
 * @param {string} params.inputPath - path to source video
 * @param {string} params.outputDir - directory to write outputs
 * @param {number} params.startMs - window start in ms (clamped >= 0)
 * @param {number} params.endMs - window end in ms (> start)
 * @param {string} params.overlayText - overlay text for drawtext
 * @param {number} [params.interpolationFps=60] - fps for minterpolate (30|60|120)
 * @param {string} [params.preset='slow'] - encoder preset
 * @param {number} [params.workFactor=1] - number of variants to amplify CPU cost
 * @param {number} [params.slowFactor=2] - video slow-down factor (2 => 0.5x)
 * @param {string} [params.fontFile] - optional font file path for drawtext
 * @returns {Promise<{ outputPath: string, outputs: string[], stderrTail: string }>}
 */
export async function renderJumpSlowmo({
  inputPath,
  outputDir,
  startMs,
  endMs,
  overlayText,
  interpolationFps = 60,
  preset = 'slow',
  workFactor = 1,
  slowFactor = 2,
  fontFile,
}) {
  if (!fs.existsSync(inputPath)) throw new Error('Input video not found');
  ensureDir(outputDir);
  const startSec = Math.max(0, (startMs || 0) / 1000);
  const endSec = Math.max(startSec + 0.05, (endMs || 0) / 1000);
  const baseName = path.parse(inputPath).name;

  // workFactor now only affects CPU usage, not output count
  const cpuIntensivePasses = Math.max(1, Number(workFactor) || 1);
  const outputs = [];
  let lastTail = '';

  // Always create just one output file
  const outPath = path.join(outputDir, `${baseName}_slowmo.mp4`);
  
  // Build the video filter
  const filterParts = [];
  filterParts.push(`minterpolate=fps=${interpolationFps}`);
  if (slowFactor && slowFactor !== 1) filterParts.push(`setpts=${slowFactor}*PTS`);
  
  // Re-enable text overlay
  if (overlayText) {
    const overlayFilter = buildOverlayFilter(overlayText);
    console.log('Generated overlay filter:', overlayFilter);
    filterParts.push(overlayFilter);
  }
  
  const vf = filterParts.join(',');
  console.log('Final video filter:', vf);

  // Run FFmpeg with CPU-intensive processing (multiple passes if workFactor > 1)
  for (let pass = 1; pass <= cpuIntensivePasses; pass++) {
    console.log(`🔄 FFmpeg pass ${pass}/${cpuIntensivePasses} for CPU load testing`);
    
    const args = [
      '-y',
      '-ss', String(startSec),
      '-to', String(endSec),
      '-i', inputPath,
      '-an',
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outPath,
    ];

    const { stderrTail } = await runFfmpeg(args);
    lastTail = stderrTail;
    
    // Only keep the final output, not intermediate passes
    if (pass === cpuIntensivePasses) {
      outputs.push(outPath);
    }
  }

  return { outputPath: outputs[0], outputs, stderrTail: lastTail };
}

export async function concatClipsToMontage(clipPaths, outputPath, preset = 'slow') {
  if (!clipPaths?.length) throw new Error('No clips provided');
  ensureDir(path.dirname(outputPath));
  const listFile = `${outputPath}.txt`;
  const content = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, content);
  try {
    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-an',
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ];
    const { stderrTail } = await runFfmpeg(args);
    return { outputPath, stderrTail };
  } finally {
    try { fs.unlinkSync(listFile); } catch {}
  }
}

export function renderSlowMotionStub(inputPath, outputPath, options = {}) {
  return Promise.resolve({ inputPath, outputPath, options, note: 'ffmpeg stub (deprecated)' });
}

export function spawnFfmpeg(args = []) {
  const proc = spawn(FFMPEG_BIN, args, { stdio: 'inherit' });
  return proc;
}
