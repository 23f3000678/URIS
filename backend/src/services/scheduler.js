'use strict';

// scheduler.js — periodic background sync scheduler.
//
// Jobs:
//   1. Sync scheduler (SYNC_INTERVAL_CRON, default every 15 min):
//      - syncTasksFromPlane()
//      - detectAndMarkStaleTasks()
//      - generateBlockerAlerts()
//
//   2. Weekly digest (DIGEST_CRON, default Monday 08:00 UTC):
//      - generateWeeklyDigest() — snapshots capacity/credibility/RPI per intern
//
// Configuration:
//   SYNC_INTERVAL_CRON — 5-field cron for the sync job (default: "*/15 * * * *")
//   DIGEST_CRON        — 5-field cron for the digest job (default: "0 8 * * 1")
//
// Both jobs are skipped when NODE_ENV === 'test'.
// Call scheduler.stop() on SIGINT / SIGTERM to clean up cron tasks.

const cron = require('node-cron');
const logger = require('../utils/logger');
const { syncTasksFromPlane, detectAndMarkStaleTasks, generateDeadlineAlerts, generateAvailabilityReminders, generateTaskReminders, generateFormReminders } = require('./taskService');
const { generateBlockerAlerts } = require('./alertService');
const { generateWeeklyDigest } = require('./digestService');

const DEFAULT_SYNC_CRON         = '*/15 * * * *';
const DEFAULT_DIGEST_CRON       = '0 8 * * 1';   // Monday 08:00 UTC
const DEFAULT_DEADLINE_CRON     = '0 * * * *';   // Every hour
const DEFAULT_AVAILABILITY_CRON = '0 9 * * 1';   // Monday 09:00 UTC
const DEFAULT_TASK_REMINDER_CRON = '0 9 * * 0,4'; // Thursday and Sunday 09:00 UTC
const DEFAULT_FORM_REMINDER_CRON = '0 9 */3 * *'; // Every 3 days at 09:00 UTC
const DEFAULT_GDOC_REMINDER_CRON = '0 9 */3 * *'; // Every 3 days at 09:00 UTC
const DEFAULT_GDOC_META_CRON     = '0 */6 * * *'; // Every 6 hours

let _syncTask         = null;
let _digestTask       = null;
let _deadlineTask     = null;
let _availabilityTask = null;
let _taskReminderTask = null;
let _formReminderTask = null;
let _gdocReminderTask = null;
let _gdocMetaTask     = null;

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
      else logger.info({ runId, synced }, 'syncTasksFromPlane completed');
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
      else logger.info({ generated }, 'Weekly digest completed successfully');
    } catch (err) {
      logger.error({ err }, 'Weekly digest job threw unexpectedly');
    }
  });
}

function start() {
  if (_syncTask || _digestTask) {
    logger.warn('Scheduler already running — ignoring duplicate start() call');
    return;
  }
  _startSyncJob();
  _startDigestJob();
  _startDeadlineJob();
  _startAvailabilityReminderJob();
  _startTaskReminderJob();
  _startFormReminderJob();
  _startGdocReminderJob();
  _startGdocMetaRefreshJob();
}

function stop() {
  if (_syncTask)         { _syncTask.stop();         _syncTask         = null; }
  if (_digestTask)       { _digestTask.stop();       _digestTask       = null; }
  if (_deadlineTask)     { _deadlineTask.stop();     _deadlineTask     = null; }
  if (_availabilityTask) { _availabilityTask.stop(); _availabilityTask = null; }
  if (_taskReminderTask) { _taskReminderTask.stop(); _taskReminderTask = null; }
  if (_formReminderTask) { _formReminderTask.stop(); _formReminderTask = null; }
  if (_gdocReminderTask) { _gdocReminderTask.stop(); _gdocReminderTask = null; }
  if (_gdocMetaTask)     { _gdocMetaTask.stop();     _gdocMetaTask     = null; }
  logger.info('All scheduled jobs stopped');
}

function _startDeadlineJob() {
  const expression = process.env.DEADLINE_CRON || DEFAULT_DEADLINE_CRON;
  if (!cron.validate(expression)) {
    logger.error({ expression }, 'DEADLINE_CRON is not valid — deadline alert job not started');
    return;
  }
  logger.info({ expression }, 'Starting deadline alert job');
  _deadlineTask = cron.schedule(expression, async () => {
    try {
      const count = await generateDeadlineAlerts();
      logger.info({ count }, 'generateDeadlineAlerts completed');
    } catch (err) {
      logger.error({ err }, 'generateDeadlineAlerts threw unexpectedly');
    }
  });
}

function _startAvailabilityReminderJob() {
  const expression = process.env.AVAILABILITY_REMINDER_CRON || DEFAULT_AVAILABILITY_CRON;
  if (!cron.validate(expression)) {
    logger.error({ expression }, 'AVAILABILITY_REMINDER_CRON is not valid — reminder job not started');
    return;
  }
  logger.info({ expression }, 'Starting availability reminder job');
  _availabilityTask = cron.schedule(expression, async () => {
    try {
      const count = await generateAvailabilityReminders();
      logger.info({ count }, 'generateAvailabilityReminders completed');
    } catch (err) {
      logger.error({ err }, 'generateAvailabilityReminders threw unexpectedly');
    }
  });
}

function _startTaskReminderJob() {
  const expression = process.env.TASK_REMINDER_CRON || DEFAULT_TASK_REMINDER_CRON;
  if (!cron.validate(expression)) {
    logger.error({ expression }, 'TASK_REMINDER_CRON is not valid — task reminder job not started');
    return;
  }
  logger.info({ expression }, 'Starting task reminder job');
  _taskReminderTask = cron.schedule(expression, async () => {
    try {
      const count = await generateTaskReminders();
      logger.info({ count }, 'generateTaskReminders completed');
    } catch (err) {
      logger.error({ err }, 'generateTaskReminders threw unexpectedly');
    }
  });
}

function _startFormReminderJob() {
  const expression = process.env.FORM_REMINDER_CRON || DEFAULT_FORM_REMINDER_CRON;
  if (!cron.validate(expression)) {
    logger.error({ expression }, 'FORM_REMINDER_CRON is not valid — form reminder job not started');
    return;
  }
  logger.info({ expression }, 'Starting form reminder job');
  _formReminderTask = cron.schedule(expression, async () => {
    try {
      const count = await generateFormReminders();
      logger.info({ count }, 'generateFormReminders completed');
    } catch (err) {
      logger.error({ err }, 'generateFormReminders threw unexpectedly');
    }
  });
}

function _startGdocReminderJob() {
  const expression = process.env.GDOC_REMINDER_CRON || DEFAULT_GDOC_REMINDER_CRON;

  if (!cron.validate(expression)) {
    logger.warn({ expression }, 'GDOC_REMINDER_CRON is not a valid cron expression — falling back to default');
    return _startGdocReminderJobWithExpression(DEFAULT_GDOC_REMINDER_CRON);
  }

  return _startGdocReminderJobWithExpression(expression);
}

function _startGdocReminderJobWithExpression(expression) {
  logger.info({ expression }, 'Starting GDoc reminder job');
  _gdocReminderTask = cron.schedule(expression, async () => {
    try {
      const { sendGdocReminders } = require('./notification.service');
      const { sent, errors } = await sendGdocReminders();
      if (errors > 0) logger.warn({ sent, errors }, 'GDoc reminder job completed with errors');
      else logger.info({ sent }, 'GDoc reminder job completed successfully');
    } catch (err) {
      logger.error({ err }, 'GDoc reminder job threw unexpectedly');
    }
  });
}

module.exports = { start, stop };

function _startGdocMetaRefreshJob() {
  const expression = process.env.GDOC_META_CRON || DEFAULT_GDOC_META_CRON;
  if (!cron.validate(expression)) {
    logger.warn({ expression }, 'GDOC_META_CRON is not valid — falling back to default');
  }
  const expr = cron.validate(expression) ? expression : DEFAULT_GDOC_META_CRON;
  logger.info({ expr }, 'Starting GDoc metadata refresh job');
  _gdocMetaTask = cron.schedule(expr, async () => {
    try {
      const { refreshAllGdocMetadata } = require('./google.service');
      const { refreshed, errors } = await refreshAllGdocMetadata();
      if (errors > 0) logger.warn({ refreshed, errors }, 'GDoc meta refresh completed with errors');
      else logger.info({ refreshed }, 'GDoc meta refresh completed');
    } catch (err) {
      logger.error({ err }, 'GDoc meta refresh job threw unexpectedly');
    }
  });
}
