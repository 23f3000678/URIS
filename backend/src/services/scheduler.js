'use strict';

/**
 * scheduler.js — periodic background sync scheduler.
 *
 * Jobs:
 *   1. Sync scheduler (SYNC_INTERVAL_CRON, default every 15 min):
 *      - syncTasksFromPlane()
 *      - detectAndMarkStaleTasks()
 *      - generateBlockerAlerts()
 *
 *   2. Weekly digest (DIGEST_CRON, default Monday 08:00 UTC):
 *      - generateWeeklyDigest() — snapshots capacity/credibility/RPI per intern
 *
 * Configuration:
 *   SYNC_INTERVAL_CRON — 5-field cron for the sync job (default: "*/15 * * * *")
 *   DIGEST_CRON        — 5-field cron for the digest job (default: "0 8 * * 1")
 *
 * Both jobs are skipped when NODE_ENV === 'test'.
 * Call scheduler.stop() on SIGINT/SIGTERM to clean up cron tasks.
 */

const cron   = require('node-cron');
const logger = require('../utils/logger');
const { syncTasksFromPlane, detectAndMarkStaleTasks } = require('./taskService');
const { generateBlockerAlerts } = require('./alertService');
const { generateWeeklyDigest }  = require('./digestService');

const DEFAULT_SYNC_CRON   = '*/15 * * * *';
const DEFAULT_DIGEST_CRON = '0 8 * * 1';   // Monday 08:00 UTC

let _syncTask   = null;
let _digestTask = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

function _startSyncJob() {
  const expression = process.env.SYNC_INTERVAL_CRON || DEFAULT_SYNC_CRON;

  if (!cron.validate(expression)) {
    logger.error({ expression }, 'SYNC_INTERVAL_CRON is not a valid cron expression — sync job not started');
    return;
  }

  logger.info({ expression }, 'Starting periodic sync job');

  _syncTask = cron.schedule(expression, async () => {
    const runId = Date.now();
    logger.info({ runId }, 'Sync job started');

    try {
      const { synced, error: syncErr } = await syncTasksFromPlane();
      if (syncErr) logger.warn({ runId, syncErr }, 'syncTasksFromPlane completed with error');
      else         logger.info({ runId, synced }, 'syncTasksFromPlane completed');
    } catch (err) {
      logger.error({ runId, err }, 'syncTasksFromPlane threw unexpectedly');
    }

    try {
      const staleCount = await detectAndMarkStaleTasks();
      logger.info({ runId, staleCount }, 'detectAndMarkStaleTasks completed');
    } catch (err) {
      logger.error({ runId, err }, 'detectAndMarkStaleTasks threw unexpectedly');
    }

    try {
      await generateBlockerAlerts();
      logger.info({ runId }, 'generateBlockerAlerts completed');
    } catch (err) {
      logger.error({ runId, err }, 'generateBlockerAlerts threw unexpectedly');
    }

    logger.info({ runId }, 'Sync job finished');
  });
}

function _startDigestJob() {
  const expression = process.env.DIGEST_CRON || DEFAULT_DIGEST_CRON;

  if (!cron.validate(expression)) {
    logger.error({ expression }, 'DIGEST_CRON is not a valid cron expression — digest job not started');
    return;
  }

  logger.info({ expression }, 'Starting weekly digest job');

  _digestTask = cron.schedule(expression, async () => {
    try {
      const { generated, errors } = await generateWeeklyDigest();
      if (errors > 0) logger.warn({ generated, errors }, 'Weekly digest completed with errors');
      else            logger.info({ generated }, 'Weekly digest completed successfully');
    } catch (err) {
      logger.error({ err }, 'Weekly digest job threw unexpectedly');
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start all scheduled jobs.
 * Safe to call multiple times — subsequent calls are no-ops if already running.
 */
function start() {
  if (_syncTask || _digestTask) {
    logger.warn('Scheduler already running — ignoring duplicate start() call');
    return;
  }
  _startSyncJob();
  _startDigestJob();
}

/**
 * Stop all scheduled jobs and release resources.
 * Called during graceful shutdown (SIGINT / SIGTERM).
 */
function stop() {
  if (_syncTask) {
    _syncTask.stop();
    _syncTask = null;
  }
  if (_digestTask) {
    _digestTask.stop();
    _digestTask = null;
  }
  logger.info('All scheduled jobs stopped');
}

module.exports = { start, stop };
