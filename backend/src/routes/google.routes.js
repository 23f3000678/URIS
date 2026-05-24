'use strict';

/**
 * google.routes.js
 *
 * Mounted twice in app.js:
 *   app.use('/auth',   googleRoutes)  → /auth/google, /auth/google/callback
 *   app.use('/google', googleRoutes)  → /google/worklog, /google/calendar, /google/status
 */

const express = require('express');
const router  = express.Router();
const {
  initiateGoogleAuth,
  handleGoogleCallback,
  disconnectGoogle,
  getGoogleStatus,
  getWorklogStatus,
  getCalendarData,
  getGoogleIntelligence,
} = require('../controllers/google.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// ── OAuth flow (mounted under /auth) ──────────────────────────────────────────
router.get('/google',           verifyToken, initiateGoogleAuth);
router.get('/google/callback',               handleGoogleCallback);  // no JWT — Google redirects here
router.delete('/google',        verifyToken, disconnectGoogle);

// ── Status + data (mounted under /google AND /auth) ───────────────────────────
router.get('/google/status',    verifyToken, getGoogleStatus);
router.get('/worklog',          verifyToken, getWorklogStatus);
router.get('/calendar',         verifyToken, getCalendarData);
router.get('/intelligence',     verifyToken, getGoogleIntelligence);

module.exports = router;
