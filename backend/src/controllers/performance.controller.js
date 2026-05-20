const prisma = require('../utils/prisma');
const { computePerformanceIndex, getRpiWindowStart, RPI_WINDOW_DAYS } = require('../services/performanceEngine');
const { uploadToNextcloud } = require('../services/storage.service');
const { saveScoreHistory } = require('../services/scoreHistory.service');
const { ok, notFound, forbidden } = require('../utils/respond');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

// Roles that can view any intern's performance (not just their own)
const ADMIN_ROLES = new Set([
  ROLES.CORE_ADMIN,
  ROLES.TECHNICAL_LEAD,
  ROLES.OPERATIONS_LEAD,
  ROLES.RESEARCH_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD,
  ROLES.COLLABORATOR_LEAD,
]);

async function getPerformance(req, res, next) {
  try {
    const isAdmin = ADMIN_ROLES.has(req.user.role);

    let internId;

    if (isAdmin) {
      // Admin path: internId comes from the route param, must be a valid integer
      internId = parseInt(req.params.internId, 10);
      if (isNaN(internId)) {
        return forbidden(res, 'Invalid internId');
      }
    } else {
      // Intern self-service path (/mine): resolve internId from the JWT owner
      // No route param is present — the intern can only ever see their own data
      const intern = await prisma.intern.findUnique({ where: { userId: req.user.id } });
      if (!intern) {
        return notFound(res, 'Intern record not found');
      }
      internId = intern.id;
    }

    // Rolling window — only reviews within RPI_WINDOW_DAYS are used
    const reviews = await prisma.review.findMany({
      where: {
        internId,
        createdAt: { gte: getRpiWindowStart() },
      },
    });
    const { performanceIndex: computedIndex, totalReviews: reviewCount } = computePerformanceIndex(reviews);

    // Respect admin override if set — use parsed integer for the lookup
    const intern = await prisma.intern.findUnique({ where: { id: internId }, select: { overrideScore: true } });
    
    let performanceIndex;
    let isOverridden = false;
    let source;
    
    if (intern?.overrideScore !== null && intern?.overrideScore !== undefined) {
      performanceIndex = intern.overrideScore;
      isOverridden = true;
      source = 'override';
    } else {
      performanceIndex = computedIndex;
      source = 'computed';
    }

    try {
      await uploadToNextcloud(`performance_${internId}_${Date.now()}.json`, {
        internId,
        performanceIndex,
        reviewCount,
        isOverridden,
        source,
        timestamp: new Date(),
      });
      logger.info({ internId }, 'Nextcloud sync success: performance');
    } catch (uploadErr) {
      logger.error({ err: uploadErr, internId }, 'Nextcloud sync failed: performance');
    }

    await saveScoreHistory(internId, performanceIndex, 'performance');

    return ok(res, { performanceIndex, reviewCount, isOverridden, source, windowDays: RPI_WINDOW_DAYS }, 'Performance retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = { getPerformance };
