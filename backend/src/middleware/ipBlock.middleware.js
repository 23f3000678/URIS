/**
 * ipBlock.middleware.js — Phase 2
 *
 * Blocks requests from IPs that have been added to the BlockedIP table.
 * Uses a short-lived in-memory cache to avoid a DB hit on every request.
 *
 * NOTE: The BlockedIP and LoginLog Prisma models must be present in the schema
 * before the DB-backed checks will work. Until that migration is applied the
 * middleware degrades gracefully — all requests pass through.
 *
 * Cache TTL: 60 seconds (configurable via IP_BLOCK_CACHE_TTL_MS env var).
 */

'use strict';

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const TTL_MS = parseInt(process.env.IP_BLOCK_CACHE_TTL_MS, 10) || 60_000;

// ip → { blocked: boolean, expiresAt: Date|null, cachedAt: number }
const cache = new Map();

/**
 * Evict a single IP from the in-memory cache.
 * Called by admin.controller after block/unblock operations so the change
 * takes effect on the next request rather than waiting for TTL expiry.
 *
 * @param {string} ip
 */
function invalidateCache(ip) {
  cache.delete(ip);
}

/**
 * Express middleware — rejects requests from blocked IPs with 403.
 * Degrades gracefully if the BlockedIP table does not yet exist.
 */
async function ipBlockMiddleware(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  try {
    const now = Date.now();
    const cached = cache.get(ip);

    let blocked = false;
    let blockExpiresAt = null;

    if (cached && now - cached.cachedAt < TTL_MS) {
      // Cache hit
      blocked = cached.blocked;
      blockExpiresAt = cached.expiresAt;
    } else {
      // Cache miss — query DB
      // eslint-disable-next-line no-undef
      const record = await prisma.blockedIP.findUnique({ where: { ipAddress: ip } }).catch(() => null);

      if (record) {
        // Treat as unblocked if the block has expired
        const expired = record.expiresAt && new Date(record.expiresAt) < new Date();
        blocked = !expired;
        blockExpiresAt = record.expiresAt ?? null;
      }

      cache.set(ip, { blocked, expiresAt: blockExpiresAt, cachedAt: now });
    }

    if (blocked) {
      logger.warn({ ip }, 'Blocked IP attempted access');
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
        data:    null,
      });
    }

    next();
  } catch (err) {
    // If the BlockedIP table doesn't exist yet, degrade gracefully
    logger.debug({ err: err.message }, 'ipBlockMiddleware: DB unavailable, skipping check');
    next();
  }
}

module.exports = { ipBlockMiddleware, invalidateCache };
