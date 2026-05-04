/**
 * auditLogger — fire-and-forget audit trail writer.
 *
 * Design decisions:
 *  - Never throws: a logging failure must never break the main request flow.
 *  - Async but not awaited by callers — use void logAction(...) at call sites.
 *  - userId is optional (null for system events or pre-auth actions like LOGIN).
 *  - metadata is stored as JSON — pass any serialisable object.
 *
 * @param {string | null} userId   - ID of the acting user (null = system)
 * @param {string}        action   - One of AUDIT_ACTIONS constants
 * @param {string}        entity   - One of AUDIT_ENTITIES constants
 * @param {string | null} entityId - ID of the affected record (null if N/A)
 * @param {object}        metadata - Extra context (e.g. { reason, oldValue })
 * @returns {Promise<void>}
 */

const prisma = require('./prisma');
const logger = require('./logger');

async function logAction(userId, action, entity, entityId = null, metadata = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:   userId   ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        metadata,
      },
    });
  } catch (err) {
    // Log but never propagate — audit failure is non-fatal
    logger.error({ err, userId, action, entity, entityId }, 'Failed to write audit log');
  }
}

module.exports = { logAction };
