/**
 * activityTracker — fire-and-forget activity event writer.
 *
 * Same design contract as auditLogger:
 *  - Never throws — a tracking failure must never break the main request.
 *  - Called with `void trackActivity(...)` at call sites.
 *  - duration is optional (null for point-in-time events like LOGIN/LOGOUT).
 *
 * @param {string}      userId   - ID of the user performing the activity
 * @param {string}      type     - One of ACTIVITY_TYPES constants
 * @param {number|null} duration - Duration in seconds (null for events)
 * @returns {Promise<void>}
 */

const prisma = require('./prisma');
const logger = require('./logger');

async function trackActivity(userId, type, duration = null) {
  try {
    await prisma.activity.create({
      data: {
        userId,
        type,
        duration: duration ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, userId, type, duration }, 'Failed to write activity');
  }
}

module.exports = { trackActivity };
