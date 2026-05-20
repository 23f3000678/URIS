# Bugfix Requirements Document

## Introduction

This is a pre-deployment critical stabilization effort for the URIS system (University Resource & Intern System). The goal is to prepare the system for real internal usage by interns and admins. The bugs span eight categories: auth and session correctness (login, logout, session persistence, protected routes, role enforcement, JWT handling, redirect flow), end-to-end workflow correctness (task creation → assignment → intern visibility → status updates → review → score → dashboard), field and enum payload mismatches between frontend and backend (availability fields, role enums, score payloads, review payloads, null crashes), mobile usability regressions (sidebar, forms, tables), data integrity issues (junk users, invalid alerts, broken tasks, duplicate test records), environment variable completeness, build and health endpoint correctness, and security cleanup (sensitive console logs, unprotected endpoints, auth bypasses). Together these issues prevent the system from being safely deployed for real usage today.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug Group 1 — Auth & Session**

1.1 WHEN a user submits valid login credentials THEN the system may fail to complete the login flow end-to-end due to unverified integration between the auth controller, JWT signing, and the frontend auth store hydration
1.2 WHEN a user clicks logout THEN the system executes `require('../store/teamStore')` inside the TypeScript/ESM `logout` action using a CommonJS `require()` pattern, which may fail or behave unexpectedly depending on bundler configuration, and the redirect to the landing page is not guaranteed
1.3 WHEN a user reloads or refreshes the page THEN the system may not correctly restore the authenticated session from the persisted Zustand store, leaving the user in an unauthenticated state despite a valid token in localStorage
1.4 WHEN an unauthenticated user navigates to a protected route (e.g. `/dashboard`, `/tasks`) THEN the system may not redirect them to `/login` due to a race condition in the `ProtectedRoute` component where `isAuthenticated` lags one render cycle behind the persisted `token` on initial hydration
1.5 WHEN an intern-role user navigates to an admin-only route (e.g. `/admin`, `/alerts`, `/governance`) THEN the system uses `adminOnly` shorthand in `ProtectedRoute` which checks against the legacy `ROLES.ADMIN` constant (`'admin'`), not the expanded role set — intern-role users with any of the new role strings may not be correctly blocked
1.6 WHEN a request arrives with an expired or malformed JWT THEN the system returns a generic `'Invalid or expired token.'` message and a 401, but the frontend `api.ts` interceptor only calls `logout()` on 401 — it does not distinguish between an expired token (should clear session and redirect) and a malformed token (same behavior), which is correct but unverified end-to-end
1.7 WHEN a user completes registration as a non-admin role THEN the system returns `{ pending: true }` for ALL new registrations (including interns) because `auth.service.js` sets `status = 'pending'` unconditionally, meaning interns never receive a token and are always blocked from logging in until manually approved — the frontend `Register.tsx` handles `data.pending` by showing an approval screen, but the role-based redirect `navigate(data.user.role.includes('intern') ? '/availability' : '/dashboard')` is unreachable for any new registration
1.8 WHEN the frontend evaluates `isAdmin()` for a user with role `'technical_lead'`, `'operations_lead'`, `'research_lead'`, or other expanded admin roles THEN the system correctly includes them in `ADMIN_ROLE_SET`, but `ProtectedRoute` uses `adminOnly` which maps to `allowRoles={[ROLES.ADMIN]}` — `ROLES.ADMIN` is the legacy `'admin'` string, so all expanded admin roles are incorrectly blocked from admin-only routes

**Bug Group 2 — End-to-End Workflow**

1.9 WHEN an admin creates a task and requests the assignment shortlist THEN the system requires `requiredSkills` from the taxonomy `['Frontend', 'Backend', 'Testing', 'Documentation', 'AI/ML', 'Research', 'Design', 'DevOps']`, but the frontend task creation form may send free-text skill tags that do not match this taxonomy, causing the shortlist endpoint to reject the request
1.10 WHEN an admin assigns a task to an intern THEN the system stores `internId` referencing the Intern table UUID, but if the task was created with a User UUID as `internId` (due to the ID mapping bug), the assignment will reference a non-existent Intern record
1.11 WHEN an intern requests their task list THEN the system in `getTaskFilter` correctly resolves `intern.id` via `prisma.intern.findUnique({ where: { userId: user.id } })`, but if no Intern record exists for the user (e.g. non-intern roles or missing backfill), the filter falls back to `filter.internId = 'none'` returning zero tasks with no error
1.12 WHEN an intern submits a task progress update THEN the system validates `progressPct` between 0 and 99 (interns cannot mark complete), but the frontend `UpdateProgressPayload` interface does not enforce this constraint, allowing a value of 100 to be sent and rejected server-side with a validation error
1.13 WHEN an admin submits a review for a completed task THEN the system expects `qualityScore`, `timelinessScore`, and `independenceScore` fields, but the frontend `performanceAPI.submitReview` sends `quality`, `timeliness`, `initiative` — the field names do not match the backend schema, causing a validation error on every review submission
1.14 WHEN a review is submitted and the score is computed THEN the system stores `quality`, `timeliness`, `initiative`, `complexity` in the Review model, but the backend `submitReview` schema expects `qualityScore`, `timelinessScore`, `independenceScore` — the controller and model field names are inconsistent with the validation schema
1.15 WHEN an admin requests the overview dashboard after a score update THEN the system reads `capacityScore` from `ScoreHistory` (type `'capacity'`) and `credibilityScore` from `CredibilityScore.score * 100`, but if no ScoreHistory entry exists for an intern the capacity score defaults to 0 and availability shows `'No data'` — this is correct behavior but may appear as a bug if seed data is missing
1.16 WHEN a task status is updated to `'completed'` THEN the system does not automatically trigger a score recalculation or credibility update, meaning the dashboard scores remain stale until the next scheduled sync

**Bug Group 3 — Field/Enum/Payload Mismatches**

1.17 WHEN the frontend `Availability.tsx` submits availability THEN the system sends `busyBlocks` with `reason` field (e.g. `'Exam'`), but `availability.service.ts` correctly maps it to `reason_code` before sending to the backend — however the `severity` mapping converts `'full'` → `'high'` and `'partial'` → `'medium'`, while the backend schema accepts `'low'`, `'medium'`, `'high'` — the `'partial'` → `'medium'` mapping is correct but `'full'` → `'high'` skips `'low'`, which may not match admin expectations
1.18 WHEN the frontend sends `maxFreeBlockHours` values of 4, 5, or 6 (selectable in `Availability.tsx`) THEN the system rejects the request because the backend schema enforces `maxFreeBlockHours` between 1 and 3, causing a validation error for any intern who selects more than 3 hours
1.19 WHEN the frontend `Register.tsx` sends a role value such as `'TECHNICAL_INTERN'` (uppercase) THEN the system backend `schemas.register` validates against `VALID_ROLES` which contains uppercase values (`'TECHNICAL_INTERN'`, `'CORE_ADMIN'`, etc.), so this is accepted — but `normalizeRole` in `auth.service.js` lowercases the input before lookup, and the map contains lowercase keys, so `'TECHNICAL_INTERN'` → lowercase `'technical_intern'` → maps to `ROLES.TECHNICAL_INTERN` correctly — this path works but is fragile
1.20 WHEN the frontend sends a role value of `'ORENDA_MEMBER'` or `'PAST_EMPLOYEE'` via the register form THEN the system backend `normalizeRole` does not have entries for these exact strings in the map (only lowercase versions), but since the function lowercases input first, `'ORENDA_MEMBER'` → `'orenda_member'` → found in map — this works but `'PAST_EMPLOYEE'` → `'past_employee'` → found in map — both work, but `PAST_EMPLOYEE` should not be a self-registerable role
1.21 WHEN the frontend `adminAPI.overrideScore` sends `{ internId, overrideScore: data.score, reason }` THEN the system backend `overrideScore` controller reads `req.body.overrideScore` — the field name matches, but the frontend `endpoints.ts` maps `data.score` to `overrideScore` while the admin UI may pass `score` directly — if the UI passes `score` without the mapping, the backend receives `undefined` for `overrideScore` and returns a validation error
1.22 WHEN the system encounters a null `intern.user` reference in `getAdminOverview` THEN the system accesses `i.user?.name` with optional chaining, which is safe — but `i.user?.email?.split('@')[0]` can still return `undefined` if both `name` and `email` are null, causing the intern's display name to be `undefined` in the response

**Bug Group 4 — Mobile Usability**

1.23 WHEN a user accesses the application on a mobile device THEN the `Sidebar.tsx` component uses `hidden md:flex` CSS classes, making it completely invisible on screens narrower than the `md` breakpoint (768px) with no mobile navigation alternative provided
1.24 WHEN an intern fills out the availability form on a mobile device THEN the busy blocks section uses `sm:grid sm:grid-cols-12` layout which collapses to a stacked layout on mobile — the mobile layout adds `p-3` padding and `bg-ice/5` background per block, which is functional but the remove button alignment may be inconsistent
1.25 WHEN a user views data tables on a mobile device THEN tables that do not have `overflow-x-auto` wrapper containers will overflow the viewport horizontally, causing layout breakage

**Bug Group 5 — Data Cleanup**

1.26 WHEN the database contains users created during development testing THEN the system may have junk users with invalid email formats, missing Intern records for intern-role users, or users with `status: 'pending'` that were never approved and are blocking real usage
1.27 WHEN the database contains Alert records from repeated seed runs THEN the system accumulates duplicate `availability_reminder`, `task_reminder`, and `form_reminder` alerts because `seed.js` does not check for existing unresolved alerts before creating new ones for the same intern
1.28 WHEN the database contains Task records from broken assignments THEN the system may have tasks with `internId` values that reference non-existent Intern records (orphaned tasks), causing null reference errors in dashboard queries
1.29 WHEN `seed.js` is run THEN the system creates `ScoreHistory` entries with `createdAt` set to `daysAgo(w * 7)` using `prisma.scoreHistory.create` — but Prisma's `create` with a custom `createdAt` requires the field to not have `@default(now())` enforced at the DB level, or the custom value must be passed correctly — duplicate score history entries accumulate on repeated seed runs

**Bug Group 6 — Environment Variables**

1.30 WHEN the backend starts in production without `DATABASE_URL` set THEN the system will crash at Prisma client initialization with an unhelpful error rather than a clear startup guard message
1.31 WHEN the backend starts in production without `JWT_SECRET` set THEN the system throws `'JWT_SECRET environment variable is not set. Server cannot start.'` in `auth.service.js` — this guard exists but is only triggered when `auth.service.js` is first imported, not at app startup
1.32 WHEN the frontend is built without `VITE_API_URL` set THEN the system falls back to `'http://localhost:5000'` in `api.ts`, which will cause all API calls to fail in a production deployment where the backend is not on localhost
1.33 WHEN the backend starts in production without `FRONTEND_URL` set THEN the system correctly throws an error and refuses to start — this guard is in place and working
1.34 WHEN the backend starts in production without `PLANE_WEBHOOK_SECRET` set THEN the system correctly throws an error and refuses to start — this guard is in place and working

**Bug Group 7 — Build & Health**

1.35 WHEN the TypeScript frontend is built with `tsc` or `vite build` THEN the system may emit TypeScript errors due to type mismatches in the auth store (e.g. `UserRole` union not covering all backend role strings), missing type annotations in service files, or incorrect prop types in components
1.36 WHEN `GET /health` is called and the database is connected THEN the system returns `{ status: 'OK' }` correctly — but if Nextcloud or Plane are not configured, it returns `{ status: 'DEGRADED' }` with warnings, which may cause monitoring systems to alert on a healthy deployment where these integrations are intentionally not configured
1.37 WHEN `GET /health/ready` is called and the database is connected but Nextcloud/Plane are not configured THEN the system returns `{ status: 'ready', warnings: [...] }` — this is correct behavior but the warnings may confuse operators who have not configured optional integrations

**Bug Group 8 — Security Cleanup**

1.38 WHEN the backend processes a login request THEN the system may log sensitive information (email addresses, IP addresses) at debug level via the structured logger — while not plain-text password logging, email/IP in logs should be reviewed
1.39 WHEN a protected endpoint is accessed without a token THEN the system correctly returns 401 via `verifyToken` middleware — but if `verifyToken` is accidentally omitted from a route registration, the endpoint becomes publicly accessible with no auth check
1.40 WHEN the `ipBlockMiddleware` is applied THEN the system degrades gracefully if the `BlockedIP` table does not exist, but the 60-second cache means a newly blocked IP can still make requests for up to 60 seconds after being blocked

---

### Expected Behavior (Correct)

**Bug Group 1 — Auth & Session**

2.1 WHEN a user submits valid login credentials THEN the system SHALL complete the full login flow: backend returns `{ token, user }`, frontend stores token in Zustand persist store, `isAuthenticated` becomes `true`, and the user is redirected to their role-appropriate dashboard
2.2 WHEN a user clicks logout THEN the system SHALL clear the auth store, clear the team store using a dynamic `import()` (not CommonJS `require()`), call `POST /auth/logout` to record the activity, and redirect to the landing page `/`
2.3 WHEN a user reloads or refreshes the page THEN the system SHALL correctly rehydrate the Zustand persist store from localStorage, restoring `token`, `user`, and `isAuthenticated` so the user remains authenticated without re-login
2.4 WHEN an unauthenticated user navigates to a protected route THEN the system SHALL redirect to `/login` — the `ProtectedRoute` component SHALL check both `isAuthenticated` and `token` directly to handle the rehydration race condition (this check already exists and SHALL be verified as working)
2.5 WHEN an intern-role user navigates to an admin-only route THEN the system SHALL redirect to `/dashboard` — `ProtectedRoute` `adminOnly` SHALL be updated to use `allowRoles` with the full set of admin roles from `ADMIN_ROLES` rather than the legacy `ROLES.ADMIN` string
2.6 WHEN a request arrives with an expired JWT THEN the system SHALL return 401, the frontend interceptor SHALL call `logout()` and redirect to `/login`, clearing the stale session
2.7 WHEN a new intern-role user completes registration THEN the system SHALL create the account with `status: 'pending'` and return `{ pending: true }` — the frontend SHALL display the pending approval screen — this is the correct and intended behavior for the current approval workflow
2.8 WHEN `ProtectedRoute` evaluates `adminOnly` THEN the system SHALL check the user's role against the full `ADMIN_ROLES` array (all expanded admin roles) rather than only the legacy `'admin'` string, so all legitimate admin-role users can access admin routes

**Bug Group 2 — End-to-End Workflow**

2.9 WHEN an admin creates a task and requests the assignment shortlist THEN the system SHALL accept skill tags from the defined taxonomy and the frontend task creation form SHALL only offer taxonomy-valid skill options to prevent validation errors
2.10 WHEN an admin assigns a task THEN the system SHALL use the Intern table UUID (not User UUID) as `internId`, and the assignment endpoint SHALL validate that the referenced Intern record exists before creating the assignment
2.11 WHEN an intern with no Intern record requests their task list THEN the system SHALL return a clear 404 or empty result with an informative message rather than silently returning zero tasks
2.12 WHEN an intern submits a task progress update with `progressPct: 100` THEN the system SHALL return a validation error explaining that only admins can mark tasks complete, and the frontend SHALL prevent submission of 100% progress from the intern UI
2.13 WHEN an admin submits a review THEN the system SHALL accept `qualityScore`, `timelinessScore`, and `independenceScore` field names as defined in the validation schema, and the frontend `performanceAPI.submitReview` SHALL send these exact field names
2.14 WHEN a review is submitted THEN the system SHALL store the review using the field names defined in the Prisma Review model (`quality`, `timeliness`, `initiative`, `complexity`) and the review controller SHALL map from the validated schema field names to the model field names correctly
2.15 WHEN an admin views the dashboard after a score update THEN the system SHALL display the most recently computed scores — if no ScoreHistory entry exists, the system SHALL display `0` for capacity and `'No data'` for availability as a clear indicator that scores have not been computed yet
2.16 WHEN a task is marked complete THEN the system SHALL trigger or schedule a credibility and capacity score recalculation so dashboard scores reflect the completed work within the next scheduler cycle

**Bug Group 3 — Field/Enum/Payload Mismatches**

2.17 WHEN the frontend submits availability with `maxFreeBlockHours` of 4, 5, or 6 THEN the system SHALL accept these values — the backend schema SHALL be updated to allow `maxFreeBlockHours` up to 6 to match the frontend UI which offers 1–6 hour options
2.18 WHEN the frontend submits availability with `busyBlocks` containing `severity: 'full'` THEN the system SHALL map this to `'high'` severity correctly, and the backend schema SHALL document this mapping explicitly
2.19 WHEN `PAST_EMPLOYEE` role is present in the register form options THEN the system SHALL remove it from the self-registration dropdown since past employees cannot self-register — only admins can assign this role
2.20 WHEN `adminAPI.overrideScore` is called THEN the system SHALL send `{ internId, overrideScore: score, reason }` with the correct field name `overrideScore` matching the backend controller expectation
2.21 WHEN `getAdminOverview` builds the intern display name THEN the system SHALL use `i.user?.name || i.user?.email?.split('@')[0] || i.id` with a final fallback to the intern ID to prevent `undefined` display names

**Bug Group 4 — Mobile Usability**

2.22 WHEN a user accesses the application on a mobile device THEN the system SHALL provide a usable navigation mechanism — either a hamburger menu that opens the sidebar, or a bottom navigation bar — so users are not stranded without navigation on screens narrower than 768px
2.23 WHEN an intern fills out the availability form on a mobile device THEN the system SHALL render the busy blocks section in a readable stacked layout with correct button alignment and no overflow
2.24 WHEN a user views data tables on a mobile device THEN the system SHALL wrap all tables in `overflow-x-auto` containers so tables scroll horizontally rather than overflowing the viewport

**Bug Group 5 — Data Cleanup**

2.25 WHEN the database is prepared for production THEN the system SHALL remove all junk/test users that do not correspond to real interns or admins, and all intern-role users SHALL have a corresponding Intern record
2.26 WHEN `seed.js` is run THEN the system SHALL check for existing unresolved alerts of the same type for the same intern before creating new ones, preventing duplicate alert accumulation
2.27 WHEN the database contains orphaned Task records (tasks whose `internId` references a non-existent Intern) THEN the system SHALL soft-delete or reassign these tasks so dashboard queries do not encounter null reference errors
2.28 WHEN `seed.js` is run multiple times THEN the system SHALL use `upsert` or existence checks for all created records (users, interns, tasks, scores, alerts) so repeated runs are idempotent

**Bug Group 6 — Environment Variables**

2.29 WHEN the backend starts THEN the system SHALL validate all required environment variables (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` in production, `PLANE_WEBHOOK_SECRET` in production) at startup and throw a clear error if any are missing, before any routes are registered
2.30 WHEN the frontend is built for production THEN the system SHALL require `VITE_API_URL` to be set in the build environment and SHALL fail the build or log a clear warning if it is missing, rather than silently falling back to localhost

**Bug Group 7 — Build & Health**

2.31 WHEN the TypeScript frontend is built THEN the system SHALL produce zero TypeScript errors — all type mismatches in auth store, service files, and component props SHALL be resolved
2.32 WHEN `GET /health` is called and optional integrations (Nextcloud, Plane) are not configured THEN the system SHALL return `{ status: 'OK' }` rather than `'DEGRADED'` when the database is connected and the only issues are unconfigured optional services
2.33 WHEN the backend starts THEN the system SHALL successfully connect to the database and all registered routes SHALL be reachable without crashing

**Bug Group 8 — Security Cleanup**

2.34 WHEN the backend processes any request THEN the system SHALL NOT log JWT token values, raw passwords, or full credential payloads at any log level
2.35 WHEN any protected endpoint is accessed THEN the system SHALL require a valid JWT via `verifyToken` middleware — all routes that handle user-specific or sensitive data SHALL have `verifyToken` applied
2.36 WHEN an IP is added to the block list THEN the system SHALL invalidate the cache immediately (this already happens via `invalidateCache`) so the block takes effect within the next request rather than waiting up to 60 seconds

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user logs in with valid credentials THEN the system SHALL CONTINUE TO return `{ token, user: { id, name, email, role } }` with the role lowercased
3.2 WHEN a user logs in with invalid credentials THEN the system SHALL CONTINUE TO return a 401 error with the message `'Invalid email or password.'`
3.3 WHEN a user registers with an email that already exists THEN the system SHALL CONTINUE TO return a 409 conflict error
3.4 WHEN a pending user attempts to log in THEN the system SHALL CONTINUE TO return a 403 error with the pending approval message
3.5 WHEN an alumni/PAST_EMPLOYEE user attempts to log in THEN the system SHALL CONTINUE TO return a 403 error blocking dashboard access
3.6 WHEN an admin submits a valid score override THEN the system SHALL CONTINUE TO update the intern's `overrideScore` and log the audit action
3.7 WHEN an admin queries all active alerts via `GET /alerts` THEN the system SHALL CONTINUE TO return all unresolved alerts from the Alert table
3.8 WHEN an admin resolves an alert via `PATCH /alerts/:id/resolve` THEN the system SHALL CONTINUE TO mark the alert as resolved
3.9 WHEN an admin creates a task with valid fields THEN the system SHALL CONTINUE TO create the task and return the created record
3.10 WHEN an admin requests the overview THEN the system SHALL CONTINUE TO return `totalInterns`, `activeTasks`, `openAlerts`, and `completedLast30` counts from real DB queries
3.11 WHEN a non-admin user is authenticated THEN the system SHALL CONTINUE TO be restricted from admin-only endpoints by the existing `verifyToken` + `requireRole` middleware chain
3.12 WHEN the auth store is rehydrated from localStorage THEN the system SHALL CONTINUE TO restore `token`, `user`, and `isAuthenticated` correctly via the Zustand persist middleware
3.13 WHEN an intern requests `GET /alerts/my` THEN the system SHALL CONTINUE TO return their own alerts filtered by their Intern UUID
3.14 WHEN `GET /health/live` is called THEN the system SHALL CONTINUE TO return `{ status: 'alive' }` with no I/O operations
3.15 WHEN `GET /health/ready` is called and the database is connected THEN the system SHALL CONTINUE TO return `{ status: 'ready' }` (with optional warnings for unconfigured integrations)
3.16 WHEN the IP block middleware runs and the `BlockedIP` table does not exist THEN the system SHALL CONTINUE TO degrade gracefully and allow the request through rather than crashing
3.17 WHEN an intern submits availability with valid fields THEN the system SHALL CONTINUE TO compute and persist the capacity score, write a ScoreHistory entry, and upsert the AvailabilitySlot atomically in a transaction
3.18 WHEN `taskService.js` `generateAvailabilityReminders` runs THEN the system SHALL CONTINUE TO skip creation if an unresolved `availability_reminder` already exists for the intern for the current week
3.19 WHEN the backend scheduler runs THEN the system SHALL CONTINUE TO execute `syncTasksFromPlane`, `detectAndMarkStaleTasks`, `generateDeadlineAlerts`, and `generateAvailabilityReminders` on their configured intervals
3.20 WHEN a user with role `TECHNICAL_LEAD`, `OPERATIONS_LEAD`, `RESEARCH_LEAD`, or `OPERATIONS_PROGRAM_MANAGER` logs in THEN the system SHALL CONTINUE TO be recognized as an admin-level user by `isAdmin()` in the auth store
