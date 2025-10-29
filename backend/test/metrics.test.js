// AI GENERATED FILE - This file was created by an AI assistant
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeJumpMetrics, mean, stdDev, slopeOverAttempts, computeSessionStats } from '../src/services/metrics.js';

test('computeJumpMetrics basic physics formulas', () => {
  const takeoffMs = 0;
  const landingMs = 1000; // 1s
  const m = computeJumpMetrics(takeoffMs, landingMs);
  assert.ok(Math.abs(m.tSeconds - 1) < 1e-9);
  assert.ok(Math.abs(m.heightMetres - (9.81 * 1 * 1 / 8)) < 1e-9);
  assert.ok(Math.abs(m.takeoffVelocityMs - (9.81 * 1 / 2)) < 1e-9);
});

test('mean and stdDev', () => {
  assert.equal(mean([]), 0);
  assert.equal(stdDev([]), 0);
  const vals = [1, 2, 3, 4];
  assert.equal(mean(vals), 2.5);
  const sd = stdDev(vals);
  assert.ok(sd > 0);
});

test('slopeOverAttempts', () => {
  assert.equal(slopeOverAttempts([]), 0);
  assert.equal(slopeOverAttempts([1]), 0);
  // Increasing heights -> positive slope
  assert.ok(slopeOverAttempts([0.3, 0.31, 0.32]) > 0);
  // Decreasing heights -> negative slope
  assert.ok(slopeOverAttempts([0.4, 0.39, 0.38]) < 0);
});

test('computeSessionStats aggregates', () => {
  const jumps = [
    { takeoffMs: 0, landingMs: 800 },
    { takeoffMs: 0, landingMs: 900 },
    { takeoffMs: 0, landingMs: 1000 }
  ];
  const res = computeSessionStats(jumps);
  assert.equal(res.count, 3);
  assert.ok(res.best > 0);
  assert.ok(res.average > 0);
  assert.ok(res.standardDeviation >= 0);
  assert.ok(res.coefficientOfVariation === null || res.coefficientOfVariation >= 0);
  assert.equal(res.perJump.length, 3);
});
