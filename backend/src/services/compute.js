export function computeFlightTimeMs(takeoffMs, landingMs) {
  if (typeof takeoffMs !== 'number' || typeof landingMs !== 'number') return null;
  return Math.max(0, landingMs - takeoffMs);
}

export function computeJumpHeightMeters(flightTimeMs) {
  if (typeof flightTimeMs !== 'number') return null;
  const t = flightTimeMs / 1000;
  const g = 9.81;
  return (g * t * t) / 8;
}
