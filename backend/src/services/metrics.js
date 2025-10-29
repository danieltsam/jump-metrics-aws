// AI GENERATED FILE - This file was created by an AI assistant
// Pure metric functions for jump calculations and session stats

// Compute per-jump metrics from timestamps in milliseconds
export function computeJumpMetrics(takeoffMs, landingMs) {
  if (!Number.isFinite(takeoffMs) || !Number.isFinite(landingMs)) {
    throw new Error('Invalid timestamps');
  }
  const dtMs = Math.max(0, landingMs - takeoffMs);
  const tSeconds = dtMs / 1000;
  const g = 9.81;
  const heightMetres = (g * tSeconds * tSeconds) / 8;
  const takeoffVelocityMs = (g * tSeconds) / 2;
  return { tSeconds, heightMetres, takeoffVelocityMs };
}

// Compute mean of numeric array
export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Compute population standard deviation (not sample)
export function stdDev(values) {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

// Linear regression slope of y over x=1..n; returns 0 if n < 2
export function slopeOverAttempts(yValues) {
  const n = yValues.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1; // attempt index starting at 1
    const y = yValues[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  const b = (n * sumXY - sumX * sumY) / denom; // slope
  return b;
}

// Aggregate session stats from jumps [{ takeoffMs, landingMs }]
export function computeSessionStats(jumps) {
  const perJump = jumps.map((j) => {
    const m = computeJumpMetrics(j.takeoffMs, j.landingMs);
    return { ...j, metrics: m };
  });
  const heights = perJump.map((j) => j.metrics.heightMetres);
  const count = perJump.length;
  const best = heights.length ? Math.max(...heights) : 0;
  const average = mean(heights);
  const standardDeviation = stdDev(heights);
  const coefficientOfVariation = average !== 0 ? standardDeviation / average : null;
  const fatigueSlope = slopeOverAttempts(heights);
  return { count, best, average, standardDeviation, coefficientOfVariation, fatigueSlope, perJump };
}
