const { computeAvailabilityIntelligence } = require('./availabilityIntelligence');
const { computeTaskLoadIndex } = require('./taskLoadIndex');
const { calculateCapacityScore } = require('./capacityEngine');
const { computePerformanceIndex, getRpiWindowStart } = require('./performanceEngine');
const { computeCredibilityScore } = require('./credibilityService');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const DEFAULT_PERFORMANCE_INDEX  = 3;  // neutral fallback when no reviews exist
const DEFAULT_CREDIBILITY_SCORE  = 50; // neutral fallback (0–100) when credibility unavailable

/**
 * Main pipeline for computing an intern's capacity.
 *
 * @param {Object} params
 * @param {Array}   params.busyBlocks        - [{ day, reason_code, severity }]
 * @param {number}  params.maxFreeBlockHours - 1 | 2 | 3
 * @param {string}  params.weekStatusToggle  - 'exam' | 'busy' | 'free' | 'normal'
 * @param {Array}   params.tasks             - [{ task_complexity, progress_pct }]
 * @param {boolean} params.examFlag          - Legacy boolean exam flag
 * @param {string}  [params.internId]        - If provided, performance and credibility are fetched from DB
 * @param {number}  [params.performanceIndex] - Manual override (used when internId is absent)
 * @param {number}  [params.credibilityScore] - Manual override 0–100 (used when internId is absent)
 * @returns {Promise<{ availability, TLI, capacityScore, capacityLabel, performanceIndex, credibilityScore }>}
 */
async function processInternCapacity({
  busyBlocks,
  maxFreeBlockHours,
  weekStatusToggle,
  tasks,
  examFlag,
  internId,
  performanceIndex,
  credibilityScore,
}) {
  try {
    const busyBlocksList = busyBlocks || [];
    const tasksList      = tasks      || [];

    // ── Performance index (Rolling) ──────────────────────────────────────────
    // Only reviews within the RPI rolling window are used — lifetime averages
    // misrepresent interns whose recent performance differs from their history.
    let resolvedPerformanceIndex = performanceIndex ?? DEFAULT_PERFORMANCE_INDEX;
    if (internId) {
      const reviews = await prisma.review.findMany({
        where: {
          internId,
          createdAt: { gte: getRpiWindowStart() },
        },
      });
      const { performanceIndex: computed } = computePerformanceIndex(reviews);
      resolvedPerformanceIndex = computed || DEFAULT_PERFORMANCE_INDEX;
    }

    // ── Credibility score (0–100) ────────────────────────────────────────────
    // Fetch live credibility when internId is available.
    // credibilityService returns a 0–1 float; scoreOut100 is the 0–100 integer
    // the capacity engine expects.
    // Fall back to caller-supplied value (if any) or neutral default on error.
    let resolvedCredibilityScore = credibilityScore ?? DEFAULT_CREDIBILITY_SCORE;
    if (internId) {
      try {
        const credResult = await computeCredibilityScore(internId);
        resolvedCredibilityScore = credResult.scoreOut100; // 0–100 integer
      } catch (credErr) {
        logger.warn({ err: credErr, internId }, 'Credibility fetch failed — using fallback');
        // Keep resolvedCredibilityScore as the caller-supplied value or default
      }
    }

    const availability = computeAvailabilityIntelligence(busyBlocksList, maxFreeBlockHours, weekStatusToggle);
    const TLI = computeTaskLoadIndex(tasksList);

    // Fetch the intern's active reservation so the capacity engine can apply
    // the −20 penalty if a task was recently assigned but not yet synced from Plane.
    let reservedUntil = null;
    if (internId) {
      const internRecord = await prisma.intern.findUnique({
        where:  { id: internId },
        select: { reservedUntil: true },
      });
      reservedUntil = internRecord?.reservedUntil ?? null;
    }

    const { capacityScore, capacityLabel } = calculateCapacityScore({
      availabilityScore: availability.availabilityScore,
      tli: TLI,
      weekStatusToggle,
      examFlag,
      performanceIndex: resolvedPerformanceIndex,
      credibilityScore: resolvedCredibilityScore,
      reservedUntil,
    });

    logger.info({ internId, capacityScore }, 'Capacity score computed');

    return {
      availability,
      TLI,
      capacityScore,
      capacityLabel,
      performanceIndex : resolvedPerformanceIndex,
      credibilityScore : resolvedCredibilityScore,
    };
  } catch (err) {
    throw new Error(`processInternCapacity failed: ${err.message}`);
  }
}

module.exports = { processInternCapacity };
