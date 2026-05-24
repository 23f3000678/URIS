const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const prisma  = require('../utils/prisma');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a promise with a hard timeout.
 * Resolves to { ok: true } or { ok: false, reason: string }.
 */
async function probe(promise, timeoutMs = 3000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([promise, timeout]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Ping the database with a raw SELECT 1. */
async function checkDatabase() {
  return probe(prisma.$queryRaw`SELECT 1`, 3000);
}

/**
 * Ping Nextcloud by issuing a lightweight PROPFIND on the WebDAV root.
 * Falls back to a plain GET if env vars are missing.
 */
async function checkNextcloud() {
  const base     = process.env.NEXTCLOUD_URL || process.env.NEXTCLOUD_BASE_URL;
  const username = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_PASSWORD;

  if (!base || !username || !password) {
    return { ok: false, reason: 'not configured' };
  }

  const url    = base.endsWith('/') ? base : `${base}/`;
  const auth   = Buffer.from(`${username}:${password}`).toString('base64');

  return probe(
    axios.request({
      method : 'PROPFIND',
      url,
      headers: {
        Authorization: `Basic ${auth}`,
        Depth        : '0',
      },
      // A PROPFIND on the root returns 207 Multi-Status; treat any 2xx/207 as up
      validateStatus: (s) => s < 500,
    }),
    3000,
  );
}

/** Ping Plane.so by fetching the workspace detail endpoint. */
async function checkPlane() {
  const base      = process.env.PLANE_BASE_URL;
  const apiKey    = process.env.PLANE_API_KEY;
  const workspace = process.env.PLANE_WORKSPACE_SLUG;

  if (!base || !apiKey || !workspace) {
    return { ok: false, reason: 'not configured' };
  }

  return probe(
    axios.get(`${base}/workspaces/${workspace}/`, {
      headers      : { 'x-api-key': apiKey },
      validateStatus: (s) => s < 500,
    }),
    3000,
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /health/live
 *
 * Liveness probe — answers "is the process alive?"
 * Kubernetes restarts the pod if this returns non-2xx.
 * Keep it trivial: no I/O, no DB. If Express can respond, the app is alive.
 */
router.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});

/**
 * GET /health/ready
 *
 * Readiness probe — answers "can this instance serve traffic?"
 * Kubernetes stops routing requests here until this returns 200.
 * Checks the database (required) and optional external services.
 */
router.get('/ready', async (req, res) => {
  // Database is required — failure means not ready
  const db = await checkDatabase();
  if (!db.ok) {
    return res.status(503).json({
      status: 'not_ready',
      reason: `database disconnected (${db.reason})`,
    });
  }

  // Optional services — failure degrades but doesn't block readiness
  const [nextcloud, plane] = await Promise.all([
    checkNextcloud(),
    checkPlane(),
  ]);

  const degraded = [];
  if (!nextcloud.ok) degraded.push(`nextcloud: ${nextcloud.reason}`);
  if (!plane.ok)     degraded.push(`plane: ${plane.reason}`);

  if (degraded.length > 0) {
    return res.json({
      status  : 'ready',
      warnings: degraded,
    });
  }

  return res.json({ status: 'ready' });
});

/**
 * GET /health — full diagnostic (existing production health check)
 * public, no auth required
 */
router.get('/', async (req, res) => {
  // Run all checks concurrently for speed
  const [db, nextcloud, plane] = await Promise.all([
    checkDatabase(),
    checkNextcloud(),
    checkPlane(),
  ]);

  const services = {
    database : db.ok        ? 'connected'    : `disconnected (${db.reason})`,
    nextcloud: nextcloud.ok ? 'connected'    : `unreachable (${nextcloud.reason})`,
    plane    : plane.ok     ? 'connected'    : `unreachable (${plane.reason})`,
  };

  // Determine overall status
  let status;
  if (!db.ok) {
    status = 'DOWN';
  } else if (!nextcloud.ok || !plane.ok) {
    status = 'DEGRADED';
  } else {
    status = 'OK';
  }

  const httpStatus = status === 'DOWN' ? 503 : 200;

  return res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    uptime   : process.uptime(),
    services,
  });
});

/**
 * GET /health/integrations
 *
 * Structured integration audit for the admin Integration Status panel.
 * Returns per-integration status, env var presence, and operational notes.
 * No auth required — status data only, no secrets exposed.
 */
router.get('/integrations', async (req, res) => {
  const [db, nextcloud, plane] = await Promise.all([
    checkDatabase(),
    checkNextcloud(),
    checkPlane(),
  ]);

  // Google: check env vars + DB token count
  let googleTokenCount = 0;
  let googleDbOk = true;
  try {
    googleTokenCount = await prisma.googleToken.count();
  } catch {
    googleDbOk = false;
  }

  const googleEnvOk = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  // Resend: check env var presence only (can't ping without sending)
  const resendEnvOk = !!process.env.RESEND_API_KEY;
  const resendFromOk = !!(process.env.RESEND_FROM || process.env.SMTP_FROM);

  // Plane: env vars
  const planeEnvOk = !!(
    process.env.PLANE_BASE_URL &&
    process.env.PLANE_API_KEY &&
    process.env.PLANE_WORKSPACE_SLUG &&
    process.env.PLANE_PROJECT_ID
  );

  // Nextcloud: env vars
  const nextcloudEnvOk = !!(
    process.env.NEXTCLOUD_URL &&
    process.env.NEXTCLOUD_USERNAME &&
    process.env.NEXTCLOUD_PASSWORD
  );

  // Last Plane sync — most recent SyncLog entry
  let lastSync = null;
  let syncLogCount = 0;
  try {
    const latest = await prisma.syncLog.findFirst({ orderBy: { createdAt: 'desc' } });
    lastSync = latest?.createdAt ?? null;
    syncLogCount = await prisma.syncLog.count();
  } catch { /* graceful */ }

  // Task count (Plane-synced)
  let taskCount = 0;
  try { taskCount = await prisma.task.count(); } catch { /* graceful */ }

  const integrations = [
    {
      id:          'google',
      name:        'Google (Drive · Docs · Calendar)',
      status:      googleEnvOk && googleDbOk ? 'connected' : googleEnvOk ? 'partial' : 'not_configured',
      envOk:       googleEnvOk,
      operational: googleEnvOk && googleDbOk,
      notes:       googleEnvOk
        ? `${googleTokenCount} user${googleTokenCount !== 1 ? 's' : ''} connected`
        : 'GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI missing',
      features:    ['OAuth flow', 'Drive metadata', 'Drive Activity', 'Calendar busy slots', 'GDoc stale detection', 'Cron refresh (6h)'],
      frontendVisible: true,
    },
    {
      id:          'resend',
      name:        'Resend Email',
      status:      resendEnvOk && resendFromOk ? 'connected' : resendEnvOk ? 'partial' : 'not_configured',
      envOk:       resendEnvOk,
      operational: resendEnvOk,
      notes:       resendEnvOk
        ? `Sender: ${process.env.RESEND_FROM || process.env.SMTP_FROM || 'not set'}`
        : 'RESEND_API_KEY missing',
      features:    ['Password reset', 'Password changed', 'Account approved', 'Task assigned', 'GDoc reminder', 'Operational alerts'],
      frontendVisible: false,
    },
    {
      id:          'plane',
      name:        'Plane.so Task Sync',
      status:      plane.ok ? 'connected' : planeEnvOk ? 'partial' : 'not_configured',
      envOk:       planeEnvOk,
      operational: plane.ok,
      notes:       plane.ok
        ? `${taskCount} tasks synced · Last sync: ${lastSync ? new Date(lastSync).toLocaleString('en-GB') : 'never'}`
        : plane.reason ?? 'unreachable',
      features:    ['Webhook (issue.created/updated)', '15-min cron sync', 'HMAC signature verification', 'Single-issue sync'],
      frontendVisible: false,
    },
    {
      id:          'nextcloud',
      name:        'Nextcloud WebDAV',
      status:      nextcloud.ok ? 'connected' : nextcloudEnvOk ? 'partial' : 'not_configured',
      envOk:       nextcloudEnvOk,
      operational: nextcloud.ok,
      notes:       nextcloud.ok
        ? `${syncLogCount} sync log entries`
        : nextcloudEnvOk ? (nextcloud.reason ?? 'unreachable') : 'NEXTCLOUD_URL / USERNAME / PASSWORD missing',
      features:    ['WebDAV PUT upload', 'Retry with backoff', 'Sync log tracking', 'Test route: /nextcloud/test-nextcloud'],
      frontendVisible: false,
    },
    {
      id:          'database',
      name:        'PostgreSQL (Neon)',
      status:      db.ok ? 'connected' : 'failed',
      envOk:       !!process.env.DATABASE_URL,
      operational: db.ok,
      notes:       db.ok ? 'Prisma ORM · Connected' : db.reason ?? 'disconnected',
      features:    ['Prisma ORM', 'Connection pooling', 'All models'],
      frontendVisible: false,
    },
  ];

  const overallStatus = integrations.every(i => i.operational)
    ? 'all_operational'
    : integrations.some(i => i.status === 'failed')
      ? 'degraded'
      : 'partial';

  return res.json({
    status:       overallStatus,
    timestamp:    new Date().toISOString(),
    uptime:       process.uptime(),
    integrations,
  });
});

module.exports = router;
