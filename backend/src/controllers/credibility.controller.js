const { computeCredibilityScore } = require('../services/credibilityService');
const { saveScoreHistory } = require('../services/scoreHistory.service');
const { ok, validationError, notFound } = require('../utils/respond');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

async function getCredibility(req, res) {
  const { internId } = req.query;

  if (!internId) {
    return validationError(res, 'internId is required');
  }

  try {
    const result = await computeCredibilityScore(internId);
    // Save the 0–100 integer to score history for consistency with the capacity pipeline
    await saveScoreHistory(internId, result.scoreOut100, 'credibility');
    return ok(res, result, 'Credibility score computed.');
  } catch (err) {
    logger.error({ err }, 'getCredibility failed');
    return res.status(500).json({
      success: false,
      error:   'SERVER_ERROR',
      message: 'Failed to compute credibility score.',
      data:    null,
    });
  }
}

async function getMyCredibility(req, res, next) {
  try {
    const intern = await prisma.intern.findUnique({ where: { userId: req.user.id } });
    if (!intern) {
      return notFound(res, 'Intern not found');
    }
    const internId = intern.id;

    logger.info({ internId }, 'Credibility fetched');

    const result = await computeCredibilityScore(internId);
    // Save the 0–100 integer to score history for consistency with the capacity pipeline
    await saveScoreHistory(internId, result.scoreOut100, 'credibility');

    const factors = [];
    if (result.signals.updateFrequency < 0.5)   factors.push('late updates');
    if (result.signals.deadlineAdherence < 0.5)  factors.push('missed deadlines');
    if (result.signals.throughputAccuracy < 0.5) factors.push('low task throughput');

    return ok(res, {
      score:   result.scoreOut100,
      factors: factors.length ? factors : ['no issues detected'],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCredibility, getMyCredibility };
