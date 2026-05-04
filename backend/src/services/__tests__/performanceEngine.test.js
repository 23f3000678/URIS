'use strict';

/**
 * Unit tests for performanceEngine.js
 *
 * Tests computePerformance (single review) and computePerformanceIndex
 * (complexity-weighted aggregate) using the default env weights:
 *   quality=0.5, timeliness=0.3, initiative=0.2
 *
 * Tests are written against the formula, not hardcoded expected values,
 * so they remain correct if weights are changed via environment variables.
 */

// Ensure default weights are used (no env override during tests)
delete process.env.PERFORMANCE_WEIGHT_QUALITY;
delete process.env.PERFORMANCE_WEIGHT_TIMELINESS;
delete process.env.PERFORMANCE_WEIGHT_INITIATIVE;

const { computePerformance, computePerformanceIndex } = require('../performanceEngine');

// Default weights as defined in performanceEngine.js
const W_QUALITY     = 0.5;
const W_TIMELINESS  = 0.3;
const W_INITIATIVE  = 0.2;

// ── computePerformance ────────────────────────────────────────────────────────

describe('computePerformance', () => {
  test('computes weighted score for a perfect review (5/5/5)', () => {
    const score = computePerformance({ quality: 5, timeliness: 5, initiative: 5 });
    const expected = W_QUALITY * 5 + W_TIMELINESS * 5 + W_INITIATIVE * 5;
    expect(score).toBeCloseTo(expected, 5);
    expect(score).toBeCloseTo(5.0, 5);
  });

  test('computes weighted score for a minimum review (1/1/1)', () => {
    const score = computePerformance({ quality: 1, timeliness: 1, initiative: 1 });
    const expected = W_QUALITY * 1 + W_TIMELINESS * 1 + W_INITIATIVE * 1;
    expect(score).toBeCloseTo(expected, 5);
    expect(score).toBeCloseTo(1.0, 5);
  });

  test('applies correct weight to each dimension', () => {
    // Only quality is non-zero
    expect(computePerformance({ quality: 4, timeliness: 0, initiative: 0 }))
      .toBeCloseTo(W_QUALITY * 4, 5);

    // Only timeliness is non-zero
    expect(computePerformance({ quality: 0, timeliness: 4, initiative: 0 }))
      .toBeCloseTo(W_TIMELINESS * 4, 5);

    // Only initiative is non-zero
    expect(computePerformance({ quality: 0, timeliness: 0, initiative: 4 }))
      .toBeCloseTo(W_INITIATIVE * 4, 5);
  });

  test('quality has the highest weight among the three dimensions', () => {
    const qualityOnly     = computePerformance({ quality: 1, timeliness: 0, initiative: 0 });
    const timelinessOnly  = computePerformance({ quality: 0, timeliness: 1, initiative: 0 });
    const initiativeOnly  = computePerformance({ quality: 0, timeliness: 0, initiative: 1 });
    expect(qualityOnly).toBeGreaterThan(timelinessOnly);
    expect(qualityOnly).toBeGreaterThan(initiativeOnly);
  });

  test('computes a mixed review correctly', () => {
    const score = computePerformance({ quality: 4, timeliness: 3, initiative: 2 });
    const expected = W_QUALITY * 4 + W_TIMELINESS * 3 + W_INITIATIVE * 2;
    expect(score).toBeCloseTo(expected, 5);
  });
});

// ── computePerformanceIndex ───────────────────────────────────────────────────

describe('computePerformanceIndex', () => {
  test('returns { performanceIndex: 0, totalReviews: 0 } for empty array', () => {
    const result = computePerformanceIndex([]);
    expect(result.performanceIndex).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  test('returns { performanceIndex: 0, totalReviews: 0 } for null/undefined', () => {
    const r1 = computePerformanceIndex(null);
    const r2 = computePerformanceIndex(undefined);
    expect(r1.performanceIndex).toBe(0);
    expect(r1.totalReviews).toBe(0);
    expect(r2.performanceIndex).toBe(0);
    expect(r2.totalReviews).toBe(0);
  });

  test('returns correct index for a single review', () => {
    const reviews = [{ quality: 4, timeliness: 3, initiative: 2, complexity: 1 }];
    const { performanceIndex, totalReviews } = computePerformanceIndex(reviews);
    const expected = computePerformance({ quality: 4, timeliness: 3, initiative: 2 });
    expect(performanceIndex).toBeCloseTo(expected, 5);
    expect(totalReviews).toBe(1);
  });

  test('weights reviews by complexity — higher complexity has more influence', () => {
    // Review A: low scores, low complexity
    // Review B: high scores, high complexity
    // Index should be closer to Review B's score
    const reviews = [
      { quality: 1, timeliness: 1, initiative: 1, complexity: 1 },
      { quality: 5, timeliness: 5, initiative: 5, complexity: 5 },
    ];
    const { performanceIndex } = computePerformanceIndex(reviews);
    const lowScore  = computePerformance({ quality: 1, timeliness: 1, initiative: 1 });
    const highScore = computePerformance({ quality: 5, timeliness: 5, initiative: 5 });
    // Index should be closer to highScore than lowScore
    expect(Math.abs(performanceIndex - highScore)).toBeLessThan(Math.abs(performanceIndex - lowScore));
  });

  test('equal complexity reviews produce a simple average', () => {
    const reviews = [
      { quality: 2, timeliness: 2, initiative: 2, complexity: 1 },
      { quality: 4, timeliness: 4, initiative: 4, complexity: 1 },
    ];
    const { performanceIndex } = computePerformanceIndex(reviews);
    const scoreA = computePerformance({ quality: 2, timeliness: 2, initiative: 2 });
    const scoreB = computePerformance({ quality: 4, timeliness: 4, initiative: 4 });
    expect(performanceIndex).toBeCloseTo((scoreA + scoreB) / 2, 5);
  });

  test('returns correct totalReviews count', () => {
    const reviews = [
      { quality: 3, timeliness: 3, initiative: 3, complexity: 1 },
      { quality: 4, timeliness: 4, initiative: 4, complexity: 2 },
      { quality: 5, timeliness: 5, initiative: 5, complexity: 3 },
    ];
    const { totalReviews } = computePerformanceIndex(reviews);
    expect(totalReviews).toBe(3);
  });

  test('formula: PerformanceIndex = sum(perf * complexity) / sum(complexity)', () => {
    const reviews = [
      { quality: 3, timeliness: 4, initiative: 2, complexity: 2 },
      { quality: 5, timeliness: 3, initiative: 4, complexity: 3 },
    ];
    const perfA = computePerformance({ quality: 3, timeliness: 4, initiative: 2 });
    const perfB = computePerformance({ quality: 5, timeliness: 3, initiative: 4 });
    const expected = (perfA * 2 + perfB * 3) / (2 + 3);
    const { performanceIndex } = computePerformanceIndex(reviews);
    expect(performanceIndex).toBeCloseTo(expected, 5);
  });
});
