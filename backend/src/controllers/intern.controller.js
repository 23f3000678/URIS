const prisma = require('../utils/prisma');
const { computePerformanceIndex } = require('../services/performanceEngine');
const { ok, notFound } = require('../utils/respond');
const logger = require('../utils/logger');

async function getInternDashboard(req, res, next) {
  try {
    const intern = await prisma.intern.findUnique({
      where:   { userId: req.user.id },
      include: {
        credibility: true,
        reviews:     true,
        // Fetch the most recent capacity score from the new pipeline
        scoreHistory: {
          where:   { type: 'capacity' },
          orderBy: { createdAt: 'desc' },
          take:    1,
        },
      },
    });

    if (!intern) {
      return notFound(res, 'Intern not found');
    }

    const internId = intern.id;
    logger.info({ internId }, 'Intern dashboard fetched');

    const assignedTasks = await prisma.task.findMany({
      where:  { internId, status: 'active' },
      select: { id: true, title: true, status: true, complexity: true, progressPct: true },
    });

    const { performanceIndex } = computePerformanceIndex(intern.reviews);

    // Capacity score — read from ScoreHistory (integer 0–100) written by the
    // new capacityEngine pipeline. Falls back to 0 if not yet computed.
    const latestCapacity = intern.scoreHistory[0];
    const capacityScore  = latestCapacity ? Math.round(latestCapacity.score) : 0;

    // Credibility score — CredibilityScore.score is a 0–1 float; convert to
    // 0–100 integer for consistent frontend display.
    const credibility = intern.credibility
      ? Math.round(intern.credibility.score * 100)
      : 0;

    return ok(res, { capacityScore, performanceIndex, credibility, assignedTasks });
  } catch (err) {
    next(err);
  }
}

module.exports = { getInternDashboard };
