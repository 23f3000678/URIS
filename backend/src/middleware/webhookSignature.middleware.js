'use strict';

/**
 * webhookSignature.middleware.js
 *
 * Verifies the HMAC-SHA256 signature on incoming Plane.so webhook requests.
 *
 * Plane signs each request by computing:
 *   HMAC-SHA256(secret, raw_request_body)
 * and sending the hex digest in the `x-plane-signature` header.
 *
 * IMPORTANT: This middleware must be mounted BEFORE express.json() parses the
 * body, because HMAC verification requires the raw bytes.  We achieve this by
 * using express.raw({ type: 'application/json' }) on the webhook route only,
 * then parsing the JSON ourselves after the signature check passes.
 *
 * Configuration:
 *   PLANE_WEBHOOK_SECRET — shared secret configured in Plane's webhook settings.
 *                          If unset the middleware rejects all requests with 500
 *                          so a misconfigured deployment fails loudly.
 *
 * Responses:
 *   401 — signature header missing
 *   403 — signature does not match (timing-safe comparison)
 *   500 — PLANE_WEBHOOK_SECRET not configured
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

function verifyPlaneSignature(req, res, next) {
  const secret = process.env.PLANE_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('PLANE_WEBHOOK_SECRET is not set — rejecting webhook request');
    return res.status(500).json({
      success: false,
      message: 'Webhook secret not configured on server',
    });
  }

  const signature = req.headers['x-plane-signature'];
  if (!signature) {
    logger.warn({ ip: req.ip }, 'Webhook request missing x-plane-signature header');
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature',
    });
  }

  // req.body is a Buffer here because the route uses express.raw()
  const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison prevents timing attacks
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected,  'hex')
    );
  } catch {
    // timingSafeEqual throws if buffers have different lengths (malformed sig)
    valid = false;
  }

  if (!valid) {
    logger.warn({ ip: req.ip }, 'Webhook signature verification failed');
    return res.status(403).json({
      success: false,
      message: 'Invalid webhook signature',
    });
  }

  // Signature valid — parse the raw body into req.body so the controller
  // receives a normal JS object, just like express.json() would provide.
  try {
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    logger.warn({ err, ip: req.ip }, 'Webhook body is not valid JSON');
    return res.status(400).json({
      success: false,
      message: 'Request body is not valid JSON',
    });
  }

  next();
}

module.exports = { verifyPlaneSignature };
