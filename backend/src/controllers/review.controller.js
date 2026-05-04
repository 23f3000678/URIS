const prisma = require('../utils/prisma');
const { validateReviewSubmission } = require('../services/businessRules');
const { created, businessError } = require('../utils/respond');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');

async function submitReview(req, res, next) {
  try {
    const { taskId, internId, qualityScore, timelinessScore, independenceScore, reviewNotes } = req.body;

    // Business-level rules: integer scores, task exists, task completed, intern matches, no duplicate
    const biz = await validateReviewSubmission({ taskId, internId, qualityScore, timelinessScore, independenceScore });
    if (!biz.ok) {
      return businessError(res, biz.status, biz.message);
    }

    // Design §9.2 — PPS = (Quality×0.40) + (Timeliness×0.35) + (Independence×0.25)
    const perTaskPps = parseFloat(
      (qualityScore * 0.40 + timelinessScore * 0.35 + independenceScore * 0.25).toFixed(2)
    );

    // Fetch the task's actual complexity so the performance index weighting is correct.
    // validateReviewSubmission already confirmed the task exists and is completed.
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { complexity: true } });
    const taskComplexity = task?.complexity ?? 1;

    const review = await prisma.review.create({
      data: {
        internId,
        taskId,
        quality:    qualityScore,
        timeliness: timelinessScore,
        initiative: independenceScore,   // DB column kept as 'initiative' for backward compat
        complexity: taskComplexity,      // use actual task complexity for weighted performance index
        ...(reviewNotes ? { reviewNotes } : {}),
      },
    });

    // Audit log — review submission is a write operation and must be traceable
    void logAction(req.user?.id ?? null, AUDIT_ACTIONS.SUBMIT_REVIEW, AUDIT_ENTITIES.REVIEW, review.id, {
      internId,
      taskId,
      perTaskPps,
    });

    return created(res, { ...review, perTaskPps }, 'Review submitted');
  } catch (err) {
    next(err);
  }
}

module.exports = { submitReview };
