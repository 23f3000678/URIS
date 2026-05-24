# Implementation Plan: Enterprise Profile, Password & Email

## Overview

Implement production-ready profile management, password flows, and a centralized email notification system for the URIS platform. Lightweight, deployable, minimal architecture churn. No property-based tests, no fast-check, no test suites. Preserve existing UI design system throughout.

## Tasks

- [ ] 1. Schema extensions and environment setup
  - [ ] 1.1 Extend Prisma schema and run migration
    - Add `profilePictureUrl String?`, `dateOfBirth DateTime?`, `joiningDate DateTime?`, `passwordChangedAt DateTime?` to the `User` model in `backend/prisma/schema.prisma`
    - Add `gdocUrl String?`, `lastGdocReminderSentAt DateTime?` to the `Intern` model
    - Add new `PasswordResetToken` model: `id String @id @default(uuid())`, `userId String` (FK → User, `onDelete: Cascade`), `tokenHash String @unique`, `expiresAt DateTime`, `usedAt DateTime?`, `createdAt DateTime @default(now())`, `@@index([userId])`, `@@index([expiresAt])`
    - Run `npx prisma migrate dev --name add_profile_password_email` then `npx prisma generate`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 1.2 Install dependencies
    - Add `nodemailer ^6.9.16` to `dependencies` in `backend/package.json` (check if multer is already present; add `multer ^1.4.5-lts.1` if not)
    - Run `npm install` inside `backend/`
    - _Requirements: 7.1_

  - [ ] 1.3 Update `.env.example` with new environment variables
    - Append to `backend/.env.example`:
      - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — annotated as required for email
      - `GDOC_REMINDER_CRON` — annotated as optional, default `0 9 */3 * *`
      - `RATE_LIMIT_FORGOT_WINDOW_MS`, `RATE_LIMIT_FORGOT_MAX` — annotated as optional
    - _Requirements: 10.6_

  - [ ] 1.4 Add audit action constants
    - Open `backend/src/constants/auditActions.js` (or wherever audit constants live) and add: `PASSWORD_CHANGED`, `PASSWORD_RESET`, `PROFILE_UPDATE`, `UPLOAD_REJECTED`
    - _Requirements: 8.5, 8.6, 8.7, 8.9_

  - [ ] 1.5 Add Joi validation schemas for new endpoints
    - Open `backend/src/validation/schemas.js` and add four schemas:
      - `updateProfile`: body `{ name? (1–100), profilePictureUrl? (uri, ≤2048), gdocUrl? (≤2048) }` — at least one field required
      - `changePassword`: body `{ currentPassword (required), newPassword (min 8, max 128), confirmPassword (must match newPassword) }`
      - `forgotPassword`: body `{ email (email, required) }`
      - `resetPassword`: body `{ token (required), newPassword (min 8, max 128), confirmPassword (must match newPassword) }`
    - _Requirements: 3.4, 4.4, 5.8_


- [ ] 2. Backend services
  - [ ] 2.1 Create `upload.service.js`
    - Create `backend/src/services/upload.service.js`
    - Implement `readMagicBytes(buffer)`: inspect first 12 bytes for JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), WebP (`52 49 46 46 ?? ?? ?? ?? 57 45 42 50`) — return detected MIME string or `null`
    - Implement `validateAndStore(buffer, originalname)`:
      1. Call `readMagicBytes` — throw `{ status: 422, message: 'File type not supported. Accepted formats: JPEG, PNG, WebP.' }` if null
      2. Check `buffer.length > 5 * 1024 * 1024` — throw `{ status: 422, message: 'File size exceeds the 5 MB limit.' }` if exceeded
      3. Call `ensureUploadDir()` — create `uploads/profile-pictures/` if absent using `fs.mkdirSync(..., { recursive: true })`
      4. Write file with UUID filename + correct extension, return `{ profilePictureUrl: '/uploads/profile-pictures/<uuid>.<ext>' }`
      5. On write failure throw `{ status: 500, message: 'Upload failed. Please try again.' }`
    - Log `UPLOAD_REJECTED` audit event via `logAction` when validation fails (MIME or size)
    - _Requirements: 1.6, 1.7, 1.8, 2.2, 2.3, 2.4, 2.5, 8.3, 8.9, 10.7, 10.8_

  - [ ] 2.2 Create `email.service.js`
    - Create `backend/src/services/email.service.js`
    - Implement lazy nodemailer transporter (created on first `sendEmail` call, not at module load)
    - Guard: if `SMTP_HOST` not set, log warning and return `{ success: false, reason: 'SMTP_NOT_CONFIGURED' }` — do not throw
    - Implement `TEMPLATES` map with six render functions returning `{ subject, html, text }`:
      - `password-reset`: reset link + 60-min expiry notice
      - `password-changed`: confirmation that password was changed
      - `account-approved`: account approval notification
      - `task-assigned`: task assignment notification
      - `gdoc-reminder`: work log reminder with gdocUrl link
      - `operational-alert`: operational alert message
    - Implement `sendEmail({ to, templateName, templateData })`: look up template, render, dispatch — catch all errors and return `{ success: false, error }`, never throw; log unknown template at `error` level and return `{ success: false, error: 'Unknown template: <name>' }`
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 10.9_

  - [ ] 2.3 Create `notification.service.js`
    - Create `backend/src/services/notification.service.js`
    - Implement six named functions (sole callers of `email.service.sendEmail`):
      - `notifyPasswordReset(email, resetUrl)`
      - `notifyPasswordChanged(email, name)`
      - `notifyAccountApproved(email, name)`
      - `notifyTaskAssigned(email, taskTitle)`
      - `notifyGdocReminder(email, name, gdocUrl)`
      - `notifyOperationalAlert(email, alertMessage)`
    - Implement `sendGdocReminders()`: query all users with `status: 'active'` and intern role (include `intern.gdocUrl`), call `notifyGdocReminder` for each, update `lastGdocReminderSentAt` on success, log per-intern errors without aborting, return `{ sent, errors }`
    - _Requirements: 7.2, 7.8, 6.5, 6.6_

  - [ ] 2.4 Create `profile.service.js`
    - Create `backend/src/services/profile.service.js`
    - Implement `getProfile(userId)`: query User with `intern` relation, return `{ id, name, email, role, status, profilePictureUrl, dateOfBirth, joiningDate, createdAt, intern: { gdocUrl, lastGdocReminderSentAt } | null }`
    - Implement `updateProfile(userId, { name, profilePictureUrl, gdocUrl })`:
      - Validate name 1–100 chars if provided
      - Validate `gdocUrl` with `isValidGdocUrl()` if provided — throw `{ status: 422 }` if invalid
      - Validate `profilePictureUrl` ≤ 2048 chars if provided
      - Silently ignore any other fields (role, email, password, status)
      - Update User and Intern records; call `logAction(PROFILE_UPDATE, ...)` with only changed field keys
    - Implement `updateProfilePictureUrl(userId, url)` — update User.profilePictureUrl, call `logAction(PROFILE_UPDATE, { profilePictureUrl: url })`
    - Export `isValidGdocUrl(url)`: returns true if string starts with `https://docs.google.com/document/d/` followed by ≥1 non-whitespace char and length ≤ 2048
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 6.2, 6.3_

  - [ ] 2.5 Create `password.service.js`
    - Create `backend/src/services/password.service.js`
    - Implement `changePassword(userId, { currentPassword, newPassword })`:
      - `bcrypt.compare(currentPassword, user.password)` — throw `{ status: 401, message: 'Current password is incorrect.' }` if false
      - `bcrypt.compare(newPassword, user.password)` — throw `{ status: 422, message: 'New password must differ from the current password.' }` if true
      - Validate newPassword length [8, 128] — throw `{ status: 422 }` if violated
      - Hash with bcrypt, update User with `{ password: hash, passwordChangedAt: new Date() }`
      - Call `logAction(PASSWORD_CHANGED, ...)` and `notificationService.notifyPasswordChanged`
      - Return `{ success: true, emailSent: <bool> }`
    - Implement `requestPasswordReset(email)`:
      - Always return `{ success: true, message: 'If an account with that email exists, a reset link has been sent.' }`
      - If email found: `crypto.randomBytes(32).toString('hex')` → bcrypt hash → create `PasswordResetToken` with `expiresAt = now + 1h` → call `notificationService.notifyPasswordReset`
    - Implement `resetPassword(token, newPassword)`:
      - Query all unexpired (`expiresAt > now`) unused (`usedAt: null`) tokens; bcrypt-compare each to find match
      - Throw `{ status: 400, message: 'Reset link is invalid or has expired.' }` if no match
      - Validate newPassword length [8, 128] — throw `{ status: 422 }` if violated
      - Hash and update User.password; set `usedAt: new Date()` on token
      - Call `logAction(PASSWORD_RESET, ...)` and `notificationService.notifyPasswordChanged`
    - _Requirements: 4.2–4.9, 5.2–5.11, 8.5, 8.6_


- [ ] 3. Backend controllers, routes, and middleware
  - [ ] 3.1 Add `forgotPasswordLimiter` to rate limit middleware
    - Open `backend/src/middleware/rateLimit.middleware.js`
    - Add and export `forgotPasswordLimiter` using `express-rate-limit` with `windowMs: RATE_LIMIT_FORGOT_WINDOW_MS || 15*60*1000`, `max: RATE_LIMIT_FORGOT_MAX || 5`, using the existing shared `rateLimitHandler`
    - _Requirements: 5.13, 8.2_

  - [ ] 3.2 Update `verifyToken` middleware for session invalidation
    - Open `backend/src/middleware/auth.middleware.js`
    - After existing token decode and user lookup, add: if `user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000` → return HTTP 401 `{ message: 'Session expired. Please log in again.' }`
    - _Requirements: 4.8_

  - [ ] 3.3 Create `upload.controller.js`
    - Create `backend/src/controllers/upload.controller.js`
    - Implement `uploadProfilePicture(req, res)`: call `uploadService.validateAndStore(req.file.buffer, req.file.originalname)`, then `profileService.updateProfilePictureUrl(req.user.id, url)`, return `{ success: true, data: { profilePictureUrl } }`
    - Handle missing `req.file` — return HTTP 400 `{ message: 'No file uploaded.' }`
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ] 3.4 Create `profile.controller.js`
    - Create `backend/src/controllers/profile.controller.js`
    - `getMyProfile(req, res)`: call `profileService.getProfile(req.user.id)`, return `{ success: true, data: profile }`
    - `updateMyProfile(req, res)`: call `profileService.updateProfile(req.user.id, req.body)`, return `{ success: true, data: updatedProfile }`
    - _Requirements: 3.2, 3.4_

  - [ ] 3.5 Create `password.controller.js`
    - Create `backend/src/controllers/password.controller.js`
    - `changePassword(req, res)`: delegate to `passwordService.changePassword(req.user.id, req.body)`, return `{ success: true, message: 'Password changed successfully.', emailSent }`
    - `forgotPassword(req, res)`: delegate to `passwordService.requestPasswordReset(req.body.email)`, return the service result (always HTTP 200)
    - `resetPassword(req, res)`: delegate to `passwordService.resetPassword(req.body.token, req.body.newPassword)`, return `{ success: true, message: 'Password reset successfully.' }`
    - _Requirements: 4.1, 5.1, 5.6_

  - [ ] 3.6 Create `profile.routes.js` and extend `auth.routes.js`
    - Create `backend/src/routes/profile.routes.js`:
      - `POST /picture` → `verifyToken` → `multer.single('profilePicture')` (memoryStorage, limit 5MB+1) → `upload.controller.uploadProfilePicture`
      - `GET /me` → `verifyToken` → `profile.controller.getMyProfile`
      - `PATCH /me` → `verifyToken` → `validate(schemas.updateProfile)` → `profile.controller.updateMyProfile`
    - Open `backend/src/routes/auth.routes.js` and add three routes:
      - `POST /change-password` → `verifyToken` → `validate(schemas.changePassword)` → `password.controller.changePassword`
      - `POST /forgot-password` → `forgotPasswordLimiter` → `validate(schemas.forgotPassword)` → `password.controller.forgotPassword`
      - `POST /reset-password` → `validate(schemas.resetPassword)` → `password.controller.resetPassword`
    - _Requirements: 2.1, 3.2, 3.4, 4.1, 5.1, 5.6, 5.13_

  - [ ] 3.7 Update `auth.service.js` register function for new fields
    - Open `backend/src/services/auth.service.js`
    - Update `register` to accept `dateOfBirth`, `joiningDate`, `profilePictureUrl` (from upload), and `gdocUrl`
    - Persist `dateOfBirth` and `joiningDate` on the User record
    - If role is `TECHNICAL_INTERN` or `RESEARCH_INTERN`: validate `gdocUrl` is present and valid (throw HTTP 422 if absent/invalid), persist on Intern record
    - If role is not an intern role: ignore `gdocUrl`
    - Persist `profilePictureUrl` on User record (URL from upload, not binary)
    - Note: multer is applied at the route level in `auth.routes.js` before this handler runs
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.9, 1.10, 1.11, 6.1, 10.4_

  - [ ] 3.8 Wire up routes and static serving in `app.js`
    - Open `backend/app.js`
    - Import and register `app.use('/profile', profileRoutes)` after `express.json()`
    - Register `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` for serving profile pictures
    - Ensure multer is applied to the register route in `auth.routes.js` (before the existing `validate` middleware)
    - _Requirements: 2.1, 10.7_


- [ ] 4. Cron job — GDoc reminder
  - [ ] 4.1 Extend `scheduler.js` with GDoc reminder job
    - Open `backend/src/services/scheduler.js`
    - Add `let _gdocReminderTask = null`
    - Add `_startGdocReminderJob()` following the exact existing `_startXJob()` / `cron.validate()` / fallback pattern:
      - Read `GDOC_REMINDER_CRON` env var; if missing or invalid cron expression, log warning and fall back to `'0 9 */3 * *'`
      - Schedule job to call `notificationService.sendGdocReminders()`, log `{ sent, errors }` on completion, catch unexpected throws at `error` level
    - Call `_startGdocReminderJob()` from the existing `start()` function
    - _Requirements: 6.4, 6.5, 6.6, 10.5_


- [ ] 5. Frontend services
  - [ ] 5.1 Create `profile.service.ts`
    - Create `frontend/src/services/profile.service.ts`
    - Export interfaces: `ProfileData`, `ProfileUpdatePayload`
    - `getMyProfile(): Promise<ProfileData>` — GET `/profile/me` with auth header
    - `updateMyProfile(data: Partial<ProfileUpdatePayload>): Promise<ProfileData>` — PATCH `/profile/me`
    - `uploadProfilePicture(file: File): Promise<{ profilePictureUrl: string }>` — POST `/profile/picture` as `multipart/form-data`
    - _Requirements: 3.2, 3.4, 2.4_

  - [ ] 5.2 Create `password.service.ts`
    - Create `frontend/src/services/password.service.ts`
    - Export interfaces: `ChangePasswordPayload`, `ResetPasswordPayload`
    - `changePassword(data: ChangePasswordPayload): Promise<{ emailSent: boolean }>` — POST `/auth/change-password`
    - `forgotPassword(email: string): Promise<void>` — POST `/auth/forgot-password`
    - `resetPassword(data: ResetPasswordPayload): Promise<void>` — POST `/auth/reset-password`
    - _Requirements: 4.1, 5.1, 5.6_


- [ ] 6. Frontend pages
  - [ ] 6.1 Create `ForgotPassword.tsx`
    - Create `frontend/src/pages/ForgotPassword.tsx` at route `/forgot-password`
    - Match existing auth page design: Starfield background, glass-card, gold accents
    - Email input + submit button
    - On success: show generic message "If an account with that email exists, a reset link has been sent." (never reveal whether email is registered)
    - On error: use `extractErrorMessage` to display error
    - "Back to Login" link
    - _Requirements: 5.1, 5.2, 5.5, 9.5_

  - [ ] 6.2 Create `ResetPassword.tsx`
    - Create `frontend/src/pages/ResetPassword.tsx` at route `/reset-password`
    - On mount: read `?token` query param — if absent, redirect to `/forgot-password`
    - New password + confirm password inputs with show/hide toggles
    - Client-side match validation prevents submit when passwords differ
    - On success: show success message, redirect to `/login` after 3 seconds
    - On error: show "Reset link is invalid or has expired." with link to `/forgot-password`
    - Match existing auth page design (Starfield, glass-card, gold accents)
    - _Requirements: 5.6, 5.7, 5.9, 5.12, 9.6_

  - [ ] 6.3 Create `Settings.tsx`
    - Create `frontend/src/pages/Settings.tsx` at route `/settings`
    - "Change Password" section: current password, new password, confirm new password — all with show/hide toggles
    - Client-side match validation prevents submit when new ≠ confirm
    - On success: show "Password changed successfully."
    - If `emailSent: false` in response: show non-blocking notice "Confirmation email could not be sent."
    - On error: use `extractErrorMessage`
    - Apply glass-card, gold accents, nav-label typography — preserve existing URIS design system
    - _Requirements: 4.1, 4.6, 4.11, 9.4_

  - [ ] 6.4 Create `Profile.tsx`
    - Create `frontend/src/pages/Profile.tsx` at route `/profile`
    - Fetch profile on mount via `profileService.getMyProfile()`
    - Display: full name (editable), email (read-only), role (read-only), joining date (read-only), profile picture, GDoc URL (editable)
    - Profile picture uploader: show `<img>` with stored URL or default avatar placeholder; hidden `<input type="file" accept=".jpg,.jpeg,.png,.webp">`; upload button disabled + spinner while uploading; error on failure; update displayed picture immediately on success (no page reload)
    - Inline edit form for name and GDoc URL with Save/Cancel buttons; validate GDoc URL format on blur
    - On save error: use `extractErrorMessage`, retain previous values
    - Apply glass-card, gold accents, navy background, nav-label typography
    - _Requirements: 2.6–2.9, 3.1, 3.3, 3.8, 9.3, 9.7, 9.8_

  - [ ] 6.5 Update `Register.tsx` with new fields
    - Open `frontend/src/pages/Register.tsx`
    - Restrict role selector to `TECHNICAL_INTERN` and `RESEARCH_INTERN` only — remove all other options
    - Add Date of Birth `<input type="date">` — validate it is a past date on submit
    - Add Joining Date `<input type="date">`
    - Add profile picture upload (required field): `<input type="file" accept=".jpg,.jpeg,.png,.webp">`; show preview after selection; validate ≤ 5 MB client-side; prevent submit if no file selected
    - Add GDoc URL `<input type="url">` — show only when selected role is `TECHNICAL_INTERN` or `RESEARCH_INTERN`
    - Update form submission to use `multipart/form-data` (FormData with file + all other fields)
    - Preserve all existing glass-card, gold-accent, navy-background styling — do not redesign
    - _Requirements: 1.1, 1.2, 1.5, 1.10, 1.11, 1.12, 9.1, 9.2_

  - [ ] 6.6 Update `App.tsx` with new routes
    - Open `frontend/src/App.tsx`
    - Add public routes: `/forgot-password` → `<ForgotPassword />`, `/reset-password` → `<ResetPassword />`
    - Add protected routes: `/profile` → `<ProtectedRoute><Profile /></ProtectedRoute>`, `/settings` → `<ProtectedRoute><Settings /></ProtectedRoute>`
    - Import all four new page components
    - _Requirements: 9.3, 9.4, 9.5, 9.6_

  - [ ] 6.7 Update `Sidebar.tsx` with Profile and Settings nav entries
    - Open `frontend/src/components/Sidebar.tsx`
    - Add "Profile" nav entry → `/profile` (User icon) in the authenticated user section
    - Add "Settings" nav entry → `/settings` (Gear icon) in the authenticated user section
    - _Requirements: 9.3, 9.4_


## Notes

- No property-based tests, no fast-check, no large test suites — keep it lightweight and deployable
- All new backend services use the existing throw-with-`.status` error pattern; the global `errorHandler` middleware handles formatting
- Frontend pages use the existing `extractErrorMessage` utility for all error display
- The `passwordChangedAt` field on User (added in task 1.1) is required for session invalidation in task 3.2 — ensure the migration includes it
- The register route in `auth.routes.js` must apply multer before the existing `validate` middleware so `req.file` is populated
- `nodemailer` transporter is created lazily — app starts fine even when SMTP is not configured
- Profile pictures are stored in `uploads/profile-pictures/` on disk; only the URL is stored in the database
- The GDoc reminder cron job reuses the existing scheduler infrastructure — no new cron library needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["3.1", "3.2", "5.1", "5.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["3.6", "3.7"] },
    { "id": 6, "tasks": ["3.8", "4.1"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 8, "tasks": ["6.5", "6.6", "6.7"] }
  ]
}
```
