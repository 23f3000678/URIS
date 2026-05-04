const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const WINDOW_DAYS        = 14;
const UPDATE_WEIGHT      = 0.35;
const DEADLINE_WEIGHT    = 0.40;
const THROUGHPUT_WEIGHT  = 0.25;

async function computeUpdateFrequency(internId) {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: { internId, createdAt: { gt: windowStart }, status: { not: 'completed' } }
  });
  if (tasks.length === 0) return 0.5;

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const updatedOnTime = tasks.filter(task => {
    return (Date.now() - new Date(task.lastUpdatedAt).getTime()) <= twoDaysMs;
  });
  return updatedOnTime.length / tasks.length;
}

async function computeDeadlineAdherence(internId) {
  const completed = await prisma.task.findMany({
    where: { internId, status: 'completed', deadline: { not: null } }
  });
  if (completed.length === 0) return 0.5;

  const onTime = completed.filter(task =>
    new Date(task.lastUpdatedAt) <= new Date(task.deadline)
  );
  return onTime.length / completed.length;
}

async function computeThroughputAccuracy(internId, baseCapacity = 0.5) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const completedThisWeek = await prisma.task.count({
    where: { internId, status: 'completed', lastUpdatedAt: { gt: oneWeekAgo } }
  });
  const TASKS_PER_FULL_CAPACITY = 3;
  const expectedTasks = Math.max(1, Math.round(baseCapacity * TASKS_PER_FULL_CAPACITY));
  return Math.min(completedThisWeek / expectedTasks, 1.0);
}

async function computeCredibilityScore(internId, baseCapacity = 0.5) {
  try {
    const [updateFreq, deadlineAdh, throughputAcc] = await Promise.all([
      computeUpdateFrequency(internId),
      computeDeadlineAdherence(internId),
      computeThroughputAccuracy(internId, baseCapacity)
    ]);

    const score = (UPDATE_WEIGHT * updateFreq) +
                  (DEADLINE_WEIGHT * deadlineAdh) +
                  (THROUGHPUT_WEIGHT * throughputAcc);

    const roundedScore = parseFloat(score.toFixed(3));

    try {
      await prisma.intern.upsert({
        where:  { id: internId },
        update: {},
        create: { id: internId }
      });
    } catch (error) {
      logger.error({ err: error, internId }, 'Credibility intern upsert failed');
    }

    await prisma.credibilityScore.upsert({
      where:  { internId },
      update: {
        updateFrequency:    parseFloat(updateFreq.toFixed(3)),
        deadlineAdherence:  parseFloat(deadlineAdh.toFixed(3)),
        throughputAccuracy: parseFloat(throughputAcc.toFixed(3)),
        score:              roundedScore,
        computedAt:         new Date()
      },
      create: {
        internId,
        updateFrequency:    parseFloat(updateFreq.toFixed(3)),
        deadlineAdherence:  parseFloat(deadlineAdh.toFixed(3)),
        throughputAccuracy: parseFloat(throughputAcc.toFixed(3)),
        score:              roundedScore,
      }
    });

    return {
      internId,
      signals: {
        updateFrequency:    parseFloat(updateFreq.toFixed(3)),
        deadlineAdherence:  parseFloat(deadlineAdh.toFixed(3)),
        throughputAccuracy: parseFloat(throughputAcc.toFixed(3))
      },
      score:       roundedScore,
      scoreOut100: Math.round(roundedScore * 100),
      flag:        roundedScore < 0.5 ? 'low_credibility' : null
    };
  } catch (err) {
    logger.error({ err, internId }, 'computeCredibilityScore failed');
    throw err;
  }
}

module.exports = { computeCredibilityScore };
