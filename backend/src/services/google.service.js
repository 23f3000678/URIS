'use strict';

/**
 * google.service.js
 * Handles Google OAuth token management, Drive metadata, Drive Activity,
 * and Calendar busy-slot fetching.
 *
 * All API calls are graceful — they never throw to callers.
 * Token refresh is automatic when the access token is expired.
 */

const { google } = require('googleapis');
const prisma     = require('../utils/prisma');
const logger     = require('../utils/logger');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'profile',
  'email',
];

// ── OAuth2 client factory ─────────────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google OAuth authorization URL.
 * The `state` param carries the URIS userId so we can link the token on callback.
 */
function getAuthUrl(userId) {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type:  'offline',
    prompt:       'consent',          // force refresh_token on every connect
    scope:        SCOPES,
    state:        userId,
  });
}

/**
 * Exchange an authorization code for tokens and persist them.
 */
async function handleCallback(code, userId) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  await prisma.googleToken.upsert({
    where:  { userId },
    update: {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt:    new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      scope:        tokens.scope ?? SCOPES.join(' '),
      updatedAt:    new Date(),
    },
    create: {
      userId,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresAt:    new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      scope:        tokens.scope ?? SCOPES.join(' '),
    },
  });

  logger.info({ userId }, 'Google token stored');
  return tokens;
}

/**
 * Get an authenticated OAuth2 client for a user, refreshing the token if needed.
 * Returns null if the user has no Google token or refresh fails.
 */
async function getAuthClientForUser(userId) {
  const record = await prisma.googleToken.findUnique({ where: { userId } });
  if (!record) return null;

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token:  record.accessToken,
    refresh_token: record.refreshToken,
    expiry_date:   record.expiresAt.getTime(),
  });

  // Auto-refresh if expired (with 60s buffer)
  if (record.expiresAt.getTime() < Date.now() + 60_000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      await prisma.googleToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token,
          expiresAt:   new Date(credentials.expiry_date ?? Date.now() + 3600_000),
          updatedAt:   new Date(),
        },
      });
      oauth2.setCredentials(credentials);
      logger.info({ userId }, 'Google token refreshed');
    } catch (err) {
      logger.error({ err, userId }, 'Google token refresh failed — user must reconnect');
      return null;
    }
  }

  return oauth2;
}

/**
 * Disconnect Google — delete stored token.
 */
async function disconnectGoogle(userId) {
  await prisma.googleToken.deleteMany({ where: { userId } });
  logger.info({ userId }, 'Google token disconnected');
}

/**
 * Check if a user has a connected Google account.
 */
async function isConnected(userId) {
  const record = await prisma.googleToken.findUnique({ where: { userId } });
  return !!record;
}

// ── Google Drive — Doc metadata ───────────────────────────────────────────────

/**
 * Extract the Google Doc file ID from a docs.google.com URL.
 * e.g. https://docs.google.com/document/d/FILE_ID/edit → FILE_ID
 */
function extractDocId(gdocUrl) {
  if (!gdocUrl) return null;
  const match = gdocUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch Drive file metadata (name, modifiedTime) for a Google Doc.
 * Uses the Drive API with the intern's own OAuth token.
 * Falls back gracefully if the user hasn't connected Google.
 */
async function getDocMetadata(userId, gdocUrl) {
  const fileId = extractDocId(gdocUrl);
  if (!fileId) return null;

  const auth = await getAuthClientForUser(userId);
  if (!auth) return null;

  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get({
      fileId,
      fields: 'id,name,modifiedTime,owners',
    });
    return res.data;
  } catch (err) {
    logger.warn({ err, userId, fileId }, 'Drive metadata fetch failed');
    return null;
  }
}

/**
 * Fetch recent Drive Activity for a Google Doc.
 * Returns the last N activity events (default 5).
 */
async function getDocActivity(userId, gdocUrl, maxResults = 5) {
  const fileId = extractDocId(gdocUrl);
  if (!fileId) return [];

  const auth = await getAuthClientForUser(userId);
  if (!auth) return [];

  try {
    const driveActivity = google.driveactivity({ version: 'v2', auth });
    const res = await driveActivity.activity.query({
      requestBody: {
        itemName:   `items/${fileId}`,
        pageSize:   maxResults,
      },
    });
    return res.data.activities ?? [];
  } catch (err) {
    logger.warn({ err, userId, fileId }, 'Drive Activity fetch failed');
    return [];
  }
}

// ── Google Calendar — busy slots ──────────────────────────────────────────────

/**
 * Fetch busy time slots from the user's primary Google Calendar
 * for the next N days (default 7).
 */
async function getCalendarBusySlots(userId, days = 7) {
  const auth = await getAuthClientForUser(userId);
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const now      = new Date();
    const end      = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin:  now.toISOString(),
        timeMax:  end.toISOString(),
        items:    [{ id: 'primary' }],
      },
    });

    return res.data.calendars?.primary?.busy ?? [];
  } catch (err) {
    logger.warn({ err, userId }, 'Calendar freebusy fetch failed');
    return [];
  }
}

/**
 * Fetch upcoming calendar events (title + time) for display.
 */
async function getUpcomingEvents(userId, maxResults = 10) {
  const auth = await getAuthClientForUser(userId);
  if (!auth) return [];

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy:      'startTime',
    });
    return (res.data.items ?? []).map(e => ({
      id:      e.id,
      summary: e.summary ?? '(No title)',
      start:   e.start?.dateTime ?? e.start?.date,
      end:     e.end?.dateTime   ?? e.end?.date,
      allDay:  !e.start?.dateTime,
    }));
  } catch (err) {
    logger.warn({ err, userId }, 'Calendar events fetch failed');
    return [];
  }
}

// ── Cron: refresh GDoc metadata for all interns ───────────────────────────────

const STALE_DAYS = 3; // mark doc as stale if not modified in 3+ days

/**
 * Refresh GDoc metadata for all interns who have a gdocUrl and a connected
 * Google account. Updates gdocLastModified, gdocIsStale, gdocMetaRefreshedAt.
 * Called by the scheduler every 6 hours.
 */
async function refreshAllGdocMetadata() {
  const INTERN_ROLES = ['TECHNICAL_INTERN', 'OPERATIONS_INTERN', 'RESEARCH_INTERN'];

  const interns = await prisma.intern.findMany({
    where: {
      gdocUrl: { not: null },
      user:    { status: 'active', role: { in: INTERN_ROLES } },
    },
    include: { user: { select: { id: true, name: true } } },
  });

  let refreshed = 0;
  let errors    = 0;

  for (const intern of interns) {
    if (!intern.userId || !intern.gdocUrl) continue;

    try {
      const meta = await getDocMetadata(intern.userId, intern.gdocUrl);
      if (!meta) continue;

      const lastModified = meta.modifiedTime ? new Date(meta.modifiedTime) : null;
      const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
      const isStale = lastModified ? lastModified < staleThreshold : false;

      await prisma.intern.update({
        where: { id: intern.id },
        data: {
          gdocLastModified:    lastModified,
          gdocIsStale:         isStale,
          gdocMetaRefreshedAt: new Date(),
        },
      });

      refreshed++;
    } catch (err) {
      logger.error({ err, internId: intern.id }, 'GDoc metadata refresh failed for intern');
      errors++;
    }
  }

  return { refreshed, errors };
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getAuthClientForUser,
  disconnectGoogle,
  isConnected,
  extractDocId,
  getDocMetadata,
  getDocActivity,
  getCalendarBusySlots,
  getUpcomingEvents,
  refreshAllGdocMetadata,
};
