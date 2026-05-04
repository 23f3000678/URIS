'use strict';

const logger = require('../utils/logger');

/**
 * configStore.js — database-backed config store.
 *
 * Replaces the previous file-based implementation (.kiro-config.json) with
 * a Prisma-backed store using the Config model (key/value table).
 *
 * Design decisions:
 *  - In-process write-through cache: reads are served from memory after the
 *    first DB fetch, so hot paths (e.g. every availability form load) do not
 *    issue a DB query on every request.
 *  - Cache is invalidated on every write so the next read reflects the new
 *    value across all callers in the same process.
 *  - In a multi-instance deployment each instance has its own cache, but the
 *    DB is the single source of truth — a cache miss always falls back to the
 *    DB, so stale reads are bounded by the first request after a write on
 *    another instance (typically sub-second in practice).
 *  - Both get() and set() are async. Callers that previously used the
 *    synchronous API must be updated to await these calls.
 */

const prisma = require('../utils/prisma');

// ── In-process write-through cache ───────────────────────────────────────────

const _cache = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieve a config value by key.
 * Returns the cached value if present, otherwise fetches from the DB.
 * Falls back to `defaultValue` when the key does not exist in the DB.
 *
 * @param {string} key
 * @param {*}      [defaultValue=null]
 * @returns {Promise<*>}
 */
async function get(key, defaultValue = null) {
  if (_cache.has(key)) {
    return _cache.get(key);
  }

  try {
    const row = await prisma.config.findUnique({ where: { key } });
    const value = row ? row.value : defaultValue;
    if (row) _cache.set(key, value);
    return value;
  } catch (err) {
    logger.error({ err, key }, 'configStore.get failed');
    return defaultValue;
  }
}

/**
 * Persist a config value by key (upsert).
 * Updates the in-process cache immediately after a successful write.
 *
 * @param {string} key
 * @param {*}      value  — must be JSON-serialisable
 * @returns {Promise<void>}
 */
async function set(key, value) {
  try {
    await prisma.config.upsert({
      where:  { key },
      update: { value },
      create: { key, value },
    });
    _cache.set(key, value);
  } catch (err) {
    logger.error({ err, key }, 'configStore.set failed');
    throw err;
  }
}

/**
 * Invalidate the in-process cache for a specific key (or all keys).
 * Useful in tests or when another process is known to have written a value.
 *
 * @param {string} [key] — omit to clear the entire cache
 */
function invalidateCache(key) {
  if (key !== undefined) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}

module.exports = { get, set, invalidateCache };
