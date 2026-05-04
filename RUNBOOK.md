# URIS Backend — Operator Runbook

This document covers everything needed to deploy, operate, and troubleshoot the URIS backend without the original developers.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [First-Time Setup](#3-first-time-setup)
4. [Starting the Server](#4-starting-the-server)
5. [Scheduler Jobs](#5-scheduler-jobs)
6. [Webhook Setup (Plane.so)](#6-webhook-setup-planeso)
7. [Log Shipping](#7-log-shipping)
8. [Health Checks](#8-health-checks)
9. [Database Migrations](#9-database-migrations)
10. [Graceful Shutdown](#10-graceful-shutdown)
11. [Common Issues](#11-common-issues)

---

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Access to Plane.so workspace (API key + webhook secret)
- Access to Nextcloud instance (WebDAV credentials)

---

## 2. Environment Variables

Copy `.env` and fill in all values. The server **refuses to start in production** if any required variable is missing.

### Required in all environments

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs — min 32 chars, random hex |

### Required in production (`NODE_ENV=production`)

| Variable | Description |
|---|---|
| `FRONTEND_URL` | Full origin of the frontend, e.g. `https://app.uris.com` |
| `PLANE_WEBHOOK_SECRET` | Shared secret from Plane.so webhook settings |

### Plane.so integration

| Variable | Default | Description |
|---|---|---|
| `PLANE_BASE_URL` | — | Plane API base, e.g. `https://plane.uris.com/api/v1` |
| `PLANE_API_KEY` | — | Plane API key |
| `PLANE_WORKSPACE_SLUG` | — | Workspace slug |
| `PLANE_PROJECT_ID` | — | Project UUID |
| `PLANE_REQUEST_TIMEOUT_MS` | `10000` | Timeout per Plane API call (ms) |

### Nextcloud integration

| Variable | Default | Description |
|---|---|---|
| `NEXTCLOUD_URL` | — | WebDAV base URL including `/remote.php/dav/files/{username}` |
| `NEXTCLOUD_USERNAME` | — | Nextcloud username |
| `NEXTCLOUD_PASSWORD` | — | Nextcloud password |
| `NEXTCLOUD_REQUEST_TIMEOUT_MS` | `15000` | Timeout per upload (ms) |

### Scheduler

| Variable | Default | Description |
|---|---|---|
| `SYNC_INTERVAL_CRON` | `*/15 * * * *` | Cron for Plane sync + stale task detection |
| `DIGEST_CRON` | `0 8 * * 1` | Cron for weekly intern digest (Monday 08:00 UTC) |

### Scoring

| Variable | Default | Description |
|---|---|---|
| `RPI_WINDOW_DAYS` | `30` | Days of review history used for Rolling Performance Index |
| `RESERVATION_HOURS` | `48` | Hours a soft reservation holds a −20 capacity penalty after assignment |
| `MIN_CAPACITY_THRESHOLD` | `40` | Minimum capacity score required for task assignment |
| `PERFORMANCE_WEIGHT_QUALITY` | `0.5` | Weight for quality score in RPI |
| `PERFORMANCE_WEIGHT_TIMELINESS` | `0.3` | Weight for timeliness score in RPI |
| `PERFORMANCE_WEIGHT_INITIATIVE` | `0.2` | Weight for initiative score in RPI |

### Rate limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_LOGIN_MAX` | `10` | Max login attempts per 15-minute window |
| `RATE_LIMIT_REGISTER_MAX` | `5` | Max registrations per 60-minute window |
| `RATE_LIMIT_API_MAX` | `200` | Max requests per 60-second window (all routes) |

### Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Minimum log level |
| `PINO_TRANSPORT` | — | Pino transport package for log shipping (see §7) |
| `PINO_TRANSPORT_OPTIONS` | — | JSON options passed to the transport |

---

## 3. First-Time Setup

```bash
cd backend
npm install
npx prisma migrate deploy   # apply all migrations
npx prisma generate         # generate Prisma client
node prisma/seed.js         # optional: seed demo data
```

---

## 4. Starting the Server

```bash
# Development (auto-restarts on file change)
npm run dev

# Production
NODE_ENV=production node app.js

# With PM2
pm2 start app.js --name uris-backend --env production
```

The server starts on `PORT` (default `5000`). On startup it:
1. Validates required env vars (throws if missing in production)
2. Starts the HTTP server
3. Starts the sync scheduler and digest scheduler

---

## 5. Scheduler Jobs

Two background jobs run automatically after server start. Both are skipped when `NODE_ENV=test`.

### Sync job (`SYNC_INTERVAL_CRON`, default every 15 min)
1. `syncTasksFromPlane()` — pulls all issues from Plane, upserts Task rows
2. `detectAndMarkStaleTasks()` — marks tasks with no update in 2+ days as stale, creates alerts
3. `generateBlockerAlerts()` — creates alerts for tasks with blockers

### Digest job (`DIGEST_CRON`, default Monday 08:00 UTC)
- `generateWeeklyDigest()` — writes one `InternDigest` row per intern with a snapshot of capacity, credibility, RPI, task counts, and open alerts

**To run a sync manually** (e.g. after a Plane data import):
```bash
node -e "require('./src/services/taskService').syncTasksFromPlane().then(console.log)"
```

**To run the digest manually**:
```bash
node -e "require('./src/services/digestService').generateWeeklyDigest().then(console.log)"
```

---

## 6. Webhook Setup (Plane.so)

The webhook receiver at `POST /webhooks/plane` handles `issue.created` and `issue.updated` events, triggering a targeted single-issue sync instead of a full poll.

### Steps

1. In Plane.so → Settings → Webhooks → Create webhook
2. Set URL to `https://your-domain/webhooks/plane`
3. Select events: **Issue created**, **Issue updated**
4. Copy the generated secret
5. Set `PLANE_WEBHOOK_SECRET=<copied secret>` in your production `.env`
6. Restart the server

### Verification

Send a test event from Plane. You should see in logs:
```
INFO: Processing Plane webhook event { event: "issue.updated", issueId: "..." }
INFO: Webhook sync completed { synced: 1 }
```

If you see `403 Invalid webhook signature`, the secret does not match — re-copy from Plane.

---

## 7. Log Shipping

In production, pino writes JSON to stdout by default. To ship logs to an aggregator:

### Datadog
```bash
npm install pino-datadog-transport
```
```env
PINO_TRANSPORT=pino-datadog-transport
PINO_TRANSPORT_OPTIONS={"ddClientConf":{"authMethods":{"apiKeyAuth":"<DD_API_KEY>"}},"ddServerConf":{"site":"datadoghq.com"},"service":"uris-backend"}
```

### Loki (Grafana)
```bash
npm install pino-loki
```
```env
PINO_TRANSPORT=pino-loki
PINO_TRANSPORT_OPTIONS={"host":"http://loki:3100","labels":{"app":"uris-backend"}}
```

### CloudWatch
```bash
npm install pino-cloudwatch
```
```env
PINO_TRANSPORT=pino-cloudwatch
PINO_TRANSPORT_OPTIONS={"group":"/uris/backend","region":"us-east-1"}
```

If `PINO_TRANSPORT` is not set, logs go to stdout as JSON — suitable for Docker/Kubernetes log collection via a sidecar or log driver.

---

## 8. Health Checks

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health/live` | Liveness — is the process alive? | None |
| `GET /health/ready` | Readiness — can it serve traffic? (checks DB) | None |
| `GET /health` | Full diagnostic (DB + Nextcloud + Plane) | None |

**Kubernetes example:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 5000
  initialDelaySeconds: 10
readinessProbe:
  httpGet:
    path: /health/ready
    port: 5000
  initialDelaySeconds: 15
```

---

## 9. Database Migrations

```bash
# Apply pending migrations (production deploy)
npx prisma migrate deploy

# Create a new migration (development only)
npx prisma migrate dev --name describe_your_change

# Check migration status
npx prisma migrate status
```

Never run `prisma migrate dev` in production — use `migrate deploy` only.

---

## 10. Graceful Shutdown

The server handles `SIGINT` and `SIGTERM`:
1. Stops all scheduler jobs
2. Disconnects Prisma
3. Closes the HTTP server

```bash
# Send SIGTERM to a running process
kill -TERM <pid>

# PM2
pm2 stop uris-backend
```

---

## 11. Common Issues

### Server refuses to start in production
Check that all required env vars are set: `FRONTEND_URL`, `JWT_SECRET`, `PLANE_WEBHOOK_SECRET`, `DATABASE_URL`.

### Webhook returns 403
`PLANE_WEBHOOK_SECRET` does not match the secret in Plane.so. Re-copy the secret from Plane webhook settings.

### Scheduler not running
Check logs for `SYNC_INTERVAL_CRON is not a valid cron expression`. Validate your cron string at [crontab.guru](https://crontab.guru).

### Capacity scores not updating
The capacity score is written to `ScoreHistory` when an intern submits availability. If scores are stale, check that the availability endpoint is being called and that the `prisma.$transaction` in `availability.controller.js` is not failing (look for `Availability transaction failed` in logs).

### Soft reservation not clearing
Reservations clear automatically when `syncTasksFromPlane` runs and finds the task active in Plane. If a reservation is stuck, clear it manually:
```sql
UPDATE "Intern" SET "reservedUntil" = NULL WHERE id = '<internId>';
```

### Database connection errors
Check `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname`. Ensure the DB is reachable and the user has `CONNECT` and schema privileges.
