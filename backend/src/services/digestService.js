'use strict';

/**
 * digestService.js — weekly intern performance digest.
 *
 * Runs every Monday at 08:00 (wired via scheduler.js).
 * For each intern, captures a point-in-time snapshot of:
 *   - Latest capacity score (from ScoreHistory)
 *   - Latest credibility score (from CredibilityScore)
 *   - Rolling performance index (RPI, last RPI_WINDOW_DAYS days)
 *   - Active / completed task counts
 *   - Open alert count
 *
 * Rows are upserted so re-running the digest for the same week is idempotent.
 * The weekStart is always the Monday of the current week (UTC).
 *
 * Design decisions:
 *   - Fire-and-forget per intern: one intern failing does not abort the rest.
 *   - All DB reads are done in a single pass per intern to minimise round-trips.
 *   - No email sending here — this service writes to InternDigest only.
 *     A future notification layer can query InternDigest to build emails.
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { computePerformanceIndex, getRpiWindowStart } = require('./performanceEngine');

/**
 * Returns the Monday of the current UTC week at midnight.
 * @returns {Date}
 */
function getCurrentWeekStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const day  = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // roll back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Generate and persist weekly digest rows for all interns.
 * Called by the scheduler every Monday at 08:00.
 *
 * @returns {Promise<{ generated: number, errors: number }>}
 */
async function generateWeeklyDigest() {
  const weekStart = getCurrentWeekStart();
  const runId     = Date.now();

  logger.info({ runId, weekStart }, 'Weekly digest generation started');

  const interns = await prisma.intern.findMany({
    select: { id: true },
  });

  let generated = 0;
  let errors    = 0;

  for (const { id: internId } of interns) {
    try {
      // Fetch all data for this intern in parallel
      const [latestCapacity, credibility, rollingReviews, taskCounts, openAlerts] = await Promise.all([
        // Most recent capacity score
        prisma.scoreHistory.findFirst({
          where:   { internId, type: 'capacity' },
          orderBy: { createdAt: 'desc' },
          select:  { score: true },
        }),
        // Latest credibility score (0–1 float)
        prisma.credibilityScore.findUnique({
          where:  { internId },
          select: { score: true },
        }),
        // Reviews within the rolling RPI window
        prisma.review.findMany({
          where:  { 
            internId, 
            createdAt: { gte: getRpiWindowStart() },
            task: { deletedAt: null }
          },
          select: { quality: true, timeliness: true, initiative: true, complexity: true },
        }),
        // Active and completed task counts
        prisma.task.groupBy({
          by:     ['status'],
          where:  { 
            internId, 
            status: { in: ['active', 'completed'] },
            deletedAt: null 
          },
          _count: { _all: true },
        }),
        // Open (unresolved) alert count
        prisma.alert.count({
          where: { internId, resolved: false },
        }),
      ]);

      // Derive values from fetched data
      const capacityScore    = latestCapacity ? Math.round(latestCapacity.score) : 0;
      const credibilityScore = credibility    ? Math.round(credibility.score * 100) : 0;
      const { performanceIndex } = computePerformanceIndex(rollingReviews);

      const activeCount    = taskCounts.find(r => r.status === 'active')?._count._all    ?? 0;
      const completedCount = taskCounts.find(r => r.status === 'completed')?._count._all ?? 0;

      // Upsert — idempotent if the digest is re-run for the same week
      await prisma.internDigest.upsert({
        where: {
          internId_weekStart: { internId, weekStart },
        },
        update: {
          capacityScore,
          credibilityScore,
          performanceIndex,
          activeTasks:   activeCount,
          completedTasks: completedCount,
          openAlerts,
          generatedAt:   new Date(),
        },
        create: {
          internId,
          weekStart,
          capacityScore,
          credibilityScore,
          performanceIndex,
          activeTasks:   activeCount,
          completedTasks: completedCount,
          openAlerts,
        },
      });

      generated++;
    } catch (err) {
      errors++;
      logger.error({ err, internId, runId }, 'Failed to generate digest for intern');
    }
  }

  logger.info({ runId, weekStart, generated, errors }, 'Weekly digest generation completed');
  return { generated, errors };
}

module.exports = { generateWeeklyDigest, getCurrentWeekStart };
