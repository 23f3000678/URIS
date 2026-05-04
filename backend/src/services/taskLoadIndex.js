const logger = require('../utils/logger');

/**
 * Compute Task Load Index (TLI).
 *
 * Formula per task:
 *   remainingWork = totalDays * (1 - progress / 100)
 *   TLI           = complexity * remainingWork
 *
 * Supports both field naming conventions:
 *   - { task_complexity, progress_pct, total_days }  (legacy pipeline input)
 *   - { complexity, progressPct, totalDays }          (DB model / taskService)
 *
 * Missing fields default to safe values so existing callers are unaffected.
 *
 * @param {Array<Object>} tasks
 * @returns {number}
 */
function computeTaskLoadIndex(tasks) {
  const tasksList = tasks || [];

  const total = tasksList.reduce((sum, task) => {
    const complexity  = task.complexity    ?? task.task_complexity ?? 1;
    const progress    = task.progressPct   ?? task.progress_pct   ?? 0;
    const totalDays   = task.totalDays     ?? task.total_days      ?? 1;

    const remainingWork = totalDays * (1 - progress / 100);
    const tli           = complexity * remainingWork;
    const safeTLI       = Math.max(0, tli);

    return sum + safeTLI;
  }, 0);

  logger.debug({ tli: total, taskCount: tasksList.length }, 'TLI computed');
  return total;
}

module.exports = { computeTaskLoadIndex };
