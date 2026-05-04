# URIS E2E Tests

Playwright end-to-end tests covering the five critical user journeys.

## Prerequisites

Both servers must be running and the database must be seeded before running tests.

```bash
# 1. Seed the database (from /backend)
node prisma/seed.js

# 2. Start the backend (from /backend)
npm run dev

# 3. Start the frontend (from /frontend)
npm run dev
```

## Setup

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

## Running Tests

```bash
# Headless (default)
npm test

# Headed — watch the browser
npm run test:headed

# Interactive UI mode
npm run test:ui

# View the last HTML report
npm run test:report
```

## Test Journeys

| File | Journey |
|---|---|
| `01-intern-registration.spec.ts` | New intern registers, is redirected to /availability, duplicate email shows error |
| `02-availability-submission.spec.ts` | Intern submits availability (free week, exam week, with busy blocks, re-submission) |
| `03-task-assignment.spec.ts` | Admin creates a task, assigns it to an intern, resolves an alert |
| `04-review-submission.spec.ts` | Admin selects a completed task, rates all dimensions, submits review |
| `05-intern-dashboard-scores.spec.ts` | Intern sees capacity, performance, and credibility scores on their dashboard |

## Seed Credentials

All accounts use password `123456`.

| Email | Role | Notes |
|---|---|---|
| `admin@uris.com` | ADMIN | Full access |
| `rahul@uris.com` | INTERN | Capacity 82, credibility 88 |
| `priya@uris.com` | INTERN | Capacity 65, credibility 78 |
| `arjun@uris.com` | INTERN | Capacity 91, credibility 94 |

## CI

Tests run automatically on every push and pull request to `main` and `develop` via `.github/workflows/e2e.yml`. The workflow:

1. Starts a PostgreSQL service container
2. Runs Prisma migrations against the test database
3. Seeds the test database
4. Starts the backend and frontend servers
5. Runs all Playwright tests
6. Uploads the HTML report and failure artifacts

On failure, screenshots, traces, and videos are uploaded as CI artifacts and retained for 7 days.
