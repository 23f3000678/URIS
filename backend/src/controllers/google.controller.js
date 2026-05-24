'use strict';

const googleService = require('../services/google.service');
const { ok, notFound } = require('../utils/respond');
const logger = require('../utils/logger');

/**
 * GET /auth/google
 * Redirect the authenticated user to Google's OAuth consent screen.
 */
async function initiateGoogleAuth(req, res) {
  const userId = req.user.id;
  const url = googleService.getAuthUrl(userId);
  return res.redirect(url);
}

/**
 * GET /auth/google/callback
 * Handle the OAuth callback from Google.
 * Exchanges the code for tokens, stores them, then redirects to the frontend profile page.
 */
async function handleGoogleCallback(req, res) {
  const { code, state: userId, error } = req.query;

  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

  if (error) {
    logger.warn({ error, userId }, 'Google OAuth denied by user');
    return res.redirect(`${frontendBase}/profile?google=denied`);
  }

  if (!code || !userId) {
    return res.redirect(`${frontendBase}/profile?google=error`);
  }

  try {
    await googleService.handleCallback(code, userId);
    return res.redirect(`${frontendBase}/profile?google=connected`);
  } catch (err) {
    logger.error({ err, userId }, 'Google OAuth callback failed');
    return res.redirect(`${frontendBase}/profile?google=error`);
  }
}

/**
 * DELETE /auth/google
 * Disconnect Google account — removes stored tokens.
 */
async function disconnectGoogle(req, res, next) {
  try {
    await googleService.disconnectGoogle(req.user.id);
    return ok(res, null, 'Google account disconnected.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/google/status
 * Returns whether the current user has a connected Google account.
 */
async function getGoogleStatus(req, res, next) {
  try {
    const connected = await googleService.isConnected(req.user.id);
    return ok(res, { connected }, 'Google connection status.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /google/worklog
 * Returns GDoc metadata + recent activity for the authenticated intern's work log.
 */
async function getWorklogStatus(req, res, next) {
  try {
    const userId = req.user.id;

    // Get intern's gdocUrl
    const prisma = require('../utils/prisma');
    const intern = await prisma.intern.findUnique({
      where: { userId },
      select: {
        gdocUrl:             true,
        gdocLastModified:    true,
        gdocIsStale:         true,
        gdocMetaRefreshedAt: true,
      },
    });

    if (!intern?.gdocUrl) {
      return ok(res, { gdocUrl: null, connected: false }, 'No work log URL set.');
    }

    const connected = await googleService.isConnected(userId);

    // Fetch live metadata if connected
    let meta     = null;
    let activity = [];
    if (connected) {
      [meta, activity] = await Promise.all([
        googleService.getDocMetadata(userId, intern.gdocUrl),
        googleService.getDocActivity(userId, intern.gdocUrl, 5),
      ]);
    }

    return ok(res, {
      gdocUrl:          intern.gdocUrl,
      connected,
      lastModified:     meta?.modifiedTime ?? intern.gdocLastModified,
      isStale:          intern.gdocIsStale,
      metaRefreshedAt:  intern.gdocMetaRefreshedAt,
      recentActivity:   activity.slice(0, 5).map(a => ({
        timestamp: a.timestamp?.nanos
          ? new Date(parseInt(a.timestamp.seconds ?? 0) * 1000).toISOString()
          : null,
        actions: a.actions?.map(ac => Object.keys(ac)[0]) ?? [],
      })),
    }, 'Work log status.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /google/calendar
 * Returns busy slots and upcoming events from the user's Google Calendar.
 */
async function getCalendarData(req, res, next) {
  try {
    const userId = req.user.id;
    const connected = await googleService.isConnected(userId);

    if (!connected) {
      return ok(res, { connected: false, busySlots: [], events: [] }, 'Google not connected.');
    }

    const days = parseInt(req.query.days) || 7;
    const [busySlots, events] = await Promise.all([
      googleService.getCalendarBusySlots(userId, days),
      googleService.getUpcomingEvents(userId, 10),
    ]);

    return ok(res, { connected: true, busySlots, events }, 'Calendar data.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /google/intelligence
 * Returns Google-sourced operational intelligence for admin dashboards.
 * Requires admin/lead role — checked at route level.
 */
async function getGoogleIntelligence(req, res, next) {
  try {
    const { getGoogleIntelligence } = require('../services/googleIntelligence.service');
    const data = await getGoogleIntelligence();
    return ok(res, data, 'Google intelligence data.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiateGoogleAuth,
  handleGoogleCallback,
  disconnectGoogle,
  getGoogleStatus,
  getWorklogStatus,
  getCalendarData,
  getGoogleIntelligence,
};
