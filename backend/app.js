require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const logger  = require('./src/utils/logger');
const { apiLimiter } = require('./src/middleware/rateLimit.middleware');

const availabilityRoutes = require('./src/routes/availabilityRoutes');
const assignmentRoutes   = require('./src/routes/assignmentRoutes');
const demoRoutes         = require('./src/routes/demoRoutes');
const authRoutes         = require('./src/routes/authRoutes');
const taskRoutes         = require('./src/routes/taskRoutes');
const credibilityRoutes  = require('./src/routes/credibilityRoutes');
const alertRoutes        = require('./src/routes/alertRoutes');
const reviewRoutes       = require('./src/routes/reviewRoutes');
const performanceRoutes  = require('./src/routes/performanceRoutes');
const adminRoutes        = require('./src/routes/admin.routes');
const scoreRoutes        = require('./src/routes/score.routes');
const internRoutes       = require('./src/routes/intern.routes');
const nextcloudRoutes    = require('./src/routes/nextcloud.routes');
const auditLogRoutes     = require('./src/routes/auditLog.routes');
const activityRoutes     = require('./src/routes/activity.routes');
const teamRoutes         = require('./src/routes/team.routes');

const healthRoutes       = require('./src/routes/health.routes');
const webhookRoutes      = require('./src/routes/webhook.routes');
const { errorHandler } = require('./src/middleware/error.middleware');

const app = express();

// ── Production startup guard ──────────────────────────────────────────────────
// In production, FRONTEND_URL must be explicitly set. Falling back to
// localhost in production would silently open CORS to the wrong origin.
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is not set. Server cannot start in production.');
}

// PLANE_WEBHOOK_SECRET must be set in production — without it every incoming
// webhook request will be rejected with 500, silently breaking real-time sync.
if (process.env.NODE_ENV === 'production' && !process.env.PLANE_WEBHOOK_SECRET) {
  throw new Error('PLANE_WEBHOOK_SECRET environment variable is not set. Server cannot start in production.');
}

// SCOPE NOTE: OpenProject integration is DESCOPED.
// The system uses Plane.so as the sole project management integration.
// All task sync, webhook, and issue mapping code targets Plane.so only.
// OpenProject support will not be added unless explicitly re-scoped.

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Security headers ──────────────────────────────────────────────────────────
// helmet sets X-Content-Type-Options, X-Frame-Options, HSTS, CSP, and more.
// Must come before any route handlers.
app.use(helmet());

// ── Global API rate limiter ───────────────────────────────────────────────────
// Applied to all routes except /health (probes must never be throttled).
// Auth routes have their own tighter limiters applied at the route level.
app.use(apiLimiter);

// ── Webhook routes MUST be registered before express.json() ──────────────────
// The Plane webhook route uses express.raw() internally so it can read the
// raw body bytes for HMAC-SHA256 signature verification.  If express.json()
// runs first the raw body is consumed and verification will always fail.
app.use('/webhooks', webhookRoutes);

app.use(express.json());

// ── Minimal structured HTTP request log ──────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'incoming request');
  next();
});

app.use('/availability', availabilityRoutes);
app.use('/assign',       assignmentRoutes);
app.use('/demo',         demoRoutes);
app.use('/auth',         authRoutes);
app.use('/tasks',        taskRoutes);
app.use('/credibility',  credibilityRoutes);
app.use('/alerts',       alertRoutes);
app.use('/review',       reviewRoutes);
app.use('/performance',  performanceRoutes);
app.use('/admin',        adminRoutes);
app.use('/score',        scoreRoutes);
app.use('/intern',       internRoutes);
app.use('/audit-logs',   auditLogRoutes);
app.use('/activity',     activityRoutes);
app.use('/teams',        teamRoutes);
app.use('/health',       healthRoutes);
app.use('/',             nextcloudRoutes);
app.use(errorHandler);

const prisma    = require('./src/utils/prisma');
const scheduler = require('./src/services/scheduler');

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server running');

  // Start the periodic sync scheduler after the HTTP server is ready.
  // Skipped in test environments to avoid background jobs interfering with tests.
  if (process.env.NODE_ENV !== 'test') {
    scheduler.start();
  }
});

const shutdown = () => {
  scheduler.stop();
  prisma.$disconnect().finally(() => server.close());
};

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
