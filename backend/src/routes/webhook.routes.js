'use strict';

/**
 * webhook.routes.js
 *
 * POST /webhooks/plane
 *
 * IMPORTANT: This route uses express.raw({ type: 'application/json' }) instead
 * of express.json() so the raw request body bytes are available for HMAC-SHA256
 * signature verification.  The verifyPlaneSignature middleware parses the body
 * into req.body after the signature check passes.
 *
 * This route must be registered in app.js BEFORE the global express.json()
 * middleware, or the raw body will already be consumed and signature
 * verification will fail.
 */

const express  = require('express');
const router   = express.Router();
const { verifyPlaneSignature } = require('../middleware/webhookSignature.middleware');
const { handlePlaneWebhook }   = require('../controllers/webhook.controller');

router.post(
  '/plane',
  // Parse body as raw Buffer — required for HMAC verification
  express.raw({ type: 'application/json' }),
  verifyPlaneSignature,
  handlePlaneWebhook
);

module.exports = router;
