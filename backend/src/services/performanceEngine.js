const logger = require('../utils/logger');

const qualityWeight    = parseFloat(process.env.PERFORMANCE_WEIGHT_QUALITY)    || 0.5;
const timelinessWeight = parseFloat(process.env.PERFORMANCE_WEIGHT_TIMELINESS) || 0.3;
const initiativeWeight = parseFloat(process.env.PERFORMANCE_WEIGHT_INITIATIVE) || 0.2;

// ── Rolling window ────────────────────────────────────────────────────────────
// RPI is computed over the most recent N days of reviews, not lifetime history.
// An intern with 50 old poor reviews and 5 recent excellent ones should reflect
// their current trajectory, not their entire history.
// Configurable via RPI_WINDOW_DAYS; default 30 days.
const RPI_WINDOW_DAYS = parseInt(process.env.RPI_WINDOW_DAYS) || 30;

// Warn if weights don't sum to 1
const totalWeight = qualityWeight + timelinessWeight + initiativeWeight;
if (Math.abs(totalWeight - 1) > 0.001) {
  logger.warn({ totalWeight: totalWeight.toFixed(3) }, 'Performance weights sum does not equal 1.0');
}

logger.info({ qualityWeight, timelinessWeight, initiativeWeight, rpiWindowDays: RPI_WINDOW_DAYS }, 'Performance weights loaded from env');

/**
 * Returns the cutoff Date for the rolling RPI window.
 * Exported so callers can apply the same filter when querying the DB.
 *
 * @returns {Date}
 */
function getRpiWindowStart() {
  return new Date(Date.now() - RPI_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Compute a single review's performance score.
 * Performance = qualityWeight * quality + timelinessWeight * timeliness + initiativeWeight * initiative
 */
function computePerformance({ quality, timeliness, initiative }) {
  return qualityWeight * quality + timelinessWeight * timeliness + initiativeWeight * initiative;
}

/**
 * Compute the complexity-weighted Rolling Performance Index (RPI) across reviews.
 *
 * Only reviews within the rolling window (RPI_WINDOW_DAYS, default 30) are
 * considered. Pass the already-filtered array — callers are responsible for
 * applying the window filter when querying the DB so this function stays pure
 * and unit-testable without a DB connection.
 *
 * Formula: RPI = sum(performance × complexity) / sum(complexity)
 *
 * @param {Array<{quality: number, timeliness: number, initiative: number, complexity: number}>} reviews
 * @returns {{ performanceIndex: number, totalReviews: number, windowDays: number }}
 */
function computePerformanceIndex(reviews) {
  if (!reviews || reviews.length === 0) {
    return { performanceIndex: 0, totalReviews: 0, windowDays: RPI_WINDOW_DAYS };
  }

  let weightedSum     = 0;
  let totalComplexity = 0;

  for (const review of reviews) {
    const performance = computePerformance(review);
    weightedSum     += performance * review.complexity;
    totalComplexity += review.complexity;
  }

  return {
    performanceIndex: weightedSum / totalComplexity,
    totalReviews:     reviews.length,
    windowDays:       RPI_WINDOW_DAYS,
  };
}

module.exports = { computePerformance, computePerformanceIndex, getRpiWindowStart, RPI_WINDOW_DAYS };
