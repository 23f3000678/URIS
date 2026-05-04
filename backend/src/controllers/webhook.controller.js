'use strict';

/**
 * webhook.controller.js
 *
 * Handles incoming Plane.so webhook events.
 *
 * Supported events:
 *   issue.created — sync the new issue into the Task table
 *   issue.updated — sync the updated issue into the Task table
 *
 * All other event types are acknowledged with 200 and ignored so Plane does
 * not retry them.  Plane expects a 2xx response within a few seconds; any
 * processing that might be slow is fire-and-forget.
 *
 * The HMAC signature has already been verified by verifyPlaneSignature
 * middleware before this handler is called.
 */

const logger = require('../utils/logger');
const { syncSingleIssueFromPlane } = require('../services/taskService');

// Events we act on — everything else is silently acknowledged
const HANDLED_EVENTS = new Set(['issue.created', 'issue.updated']);

async function handlePlaneWebhook(req, res) {
  const { event, data } = req.body ?? {};

  // Acknowledge immediately — Plane has a short response timeout
  // We process asynchronously so the HTTP response is never delayed by DB work
  if (!HANDLED_EVENTS.has(event)) {
    logger.debug({ event }, 'Plane webhook event ignored (not handled)');
    return res.status(200).json({ success: true, message: 'Event acknowledged (not handled)' });
  }

  const issueId = data?.id ?? data?.issue?.id;

  if (!issueId) {
    logger.warn({ event, body: req.body }, 'Plane webhook payload missing issue ID');
    return res.status(400).json({ success: false, message: 'Missing issue ID in webhook payload' });
  }

  // Respond immediately, then sync in the background
  res.status(200).json({ success: true, message: 'Webhook received' });

  // Fire-and-forget — errors are logged but never bubble up to the client
  // (response already sent above)
  setImmediate(async () => {
    logger.info({ event, issueId }, 'Processing Plane webhook event');
    const result = await syncSingleIssueFromPlane(issueId);
    if (result.error) {
      logger.error({ event, issueId, error: result.error }, 'Webhook sync failed');
    } else {
      logger.info({ event, issueId, synced: result.synced }, 'Webhook sync completed');
    }
  });
}

module.exports = { handlePlaneWebhook };
