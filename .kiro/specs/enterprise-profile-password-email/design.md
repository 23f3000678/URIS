# Design Document: Enterprise Profile, Password & Email

## Overview

This feature extends the URIS platform with production-ready profile management,
password flows, and a centralized email notification system. The implementation
adds five new backend services (Profile_Service, Password_Service, Email_Service,
Notification_Service, Upload_Service), three new Prisma models/extensions, four
new frontend pages, and a GDoc work-log reminder cron job — all while preserving
the existing architecture, design system, and role governance model.

### Key Design Decisions

- **Email_Service / Notification_Service split**: Controllers never call
  Email_Service directly. Notification_Service owns all notification semantics
  (which template, which recipient) and delegates transport to Email_Service.
  This keeps email logic testable in isolation and prevents template-name
  leakage into controllers.
- **Upload_Service as a standalone service**: File validation (magic bytes, size)
  and storage are isolated from auth and profile logic. The database stores only
  the resulting URL, never binary data.
- **Password reset tokens stored as bcrypt hashes**: The plaintext token is
  transmitted once (in the reset email) and never persisted, preventing token
  theft from a database dump.
- **Uniform forgot-password response**: The endpoint always returns HTTP 200
  with the same message regardless of whether the email is registered, preventing
  email enumeration attacks.
- **GDoc_Reminder_Job extends the existing scheduler pattern**: The new job
  follows the exact same `_startXJob()` / `cron.validate()` / fallback pattern
  already used by the six existing scheduler jobs.

---

## Architecture

### System Context

```
Browser (React/TS)
  │
  ├─ /auth/register        → Auth_Controller → Auth_Service
  │                                          → Upload_Service (profile picture)
  │                                          → Notification_Service (welcome)
  │
  ├─ /profile/me           → Profile_Controller → Profile_Service
  ├─ /profile/picture      → Upload_Controller  → Upload_Service
  │
  ├─ /auth/change-password → Password_Controller → Password_Service
  │                                              → Notification_Service
  ├─ /auth/forgot-password → Password_Controller → Password_Service
  │                                              → Notification_Service
  ├─ /auth/reset-password  → Password_Controller → Password_Service
  │                                              → Notification_Service
  │
  └─ (cron)                → GDoc_Reminder_Job → Notification_Service
                                               → Email_Service → SMTP
```

### Request Flow for Profile Picture Upload

```
Client (multipart/form-data)
  → POST /profile/picture
  → verifyToken middleware
  → multer (memory storage, 5 MB limit)
  → Upload_Controller.uploadProfilePicture()
  → Upload_Service.validateAndStore(buffer, mimetype, originalname)
      ├─ readMagicBytes(buffer) → validate MIME
      ├─ checkSize(buffer)      → validate ≤ 5 MB
      └─ writeFile(dest)        → return profilePictureUrl
  → Profile_Service.updateProfilePictureUrl(userId, url)
  → AuditLogger (PROFILE_UPDATE)
  → { profilePictureUrl }
```

### Password Reset Flow

```
1. POST /auth/forgot-password { email }
   → Password_Service.requestReset(email)
       ├─ lookup user (silent if not found)
       ├─ crypto.randomBytes(32).toString('hex') → plaintext token
       ├─ bcrypt.hash(token) → tokenHash
       ├─ prisma.passwordResetToken.create({ tokenHash, expiresAt: +1h })
       └─ Notification_Service.notifyPasswordReset(email, resetUrl)
   → HTTP 200 (always)

2. POST /auth/reset-password { token, newPassword }
   → Password_Service.resetPassword(token, newPassword)
       ├─ find all unexpired, unused tokens
       ├─ bcrypt.compare(token, each.tokenHash) → find match
       ├─ validate newPassword length [8, 128]
       ├─ bcrypt.hash(newPassword) → update User.password
       ├─ prisma.passwordResetToken.update({ usedAt: now() })
       └─ Notification_Service.notifyPasswordChanged(user.email)
   → HTTP 200
```

---

## Components and Interfaces

### Backend Services

#### `profile.service.js`

```js
// GET /profile/me
async function getProfile(userId)
// Returns: { id, name, email, role, status, profilePictureUrl,
//            dateOfBirth, joiningDate, createdAt,
//            intern: { gdocUrl, lastGdocReminderSentAt } | null }

// PATCH /profile/me
async function updateProfile(userId, { name, profilePictureUrl, gdocUrl })
// Validates: name 1–100 chars, gdocUrl prefix, profilePictureUrl ≤ 2048 chars
// Ignores: role, email, password, status
// Returns: updated profile object
// Side-effects: logAction(PROFILE_UPDATE)
```

#### `password.service.js`

```js
async function changePassword(userId, { currentPassword, newPassword })
// Validates: currentPassword matches hash, newPassword [8,128], not same as current
// Side-effects: bcrypt.hash, prisma.user.update, logAction(PASSWORD_CHANGED),
//               Notification_Service.notifyPasswordChanged

async function requestPasswordReset(email)
// Always returns { success: true } — never reveals whether email exists
// Side-effects (only if email found): crypto.randomBytes, bcrypt.hash,
//   prisma.passwordResetToken.create, Notification_Service.notifyPasswordReset

async function resetPassword(token, newPassword)
// Validates: token matches unexpired unused hash, newPassword [8,128]
// Side-effects: bcrypt.hash, prisma.user.update,
//   prisma.passwordResetToken.update({ usedAt }), logAction(PASSWORD_RESET),
//   Notification_Service.notifyPasswordChanged
```

#### `email.service.js`

```js
// Single public function — all other email logic is internal
async function sendEmail({ to, subject, templateName, templateData })
// Returns: { success: true } | { success: false, error: string }
// Never throws — all errors are caught and returned as { success: false }
// Reads SMTP config from env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// If SMTP_HOST not set: logs warning, returns { success: false, reason: 'SMTP_NOT_CONFIGURED' }
```

#### `notification.service.js`

```js
// Named functions — sole callers of email.service.js
async function notifyPasswordReset(email, resetUrl)
async function notifyPasswordChanged(email)
async function notifyAccountApproved(email, name)
async function notifyTaskAssigned(email, taskTitle)
async function notifyGdocReminder(email, name, gdocUrl)
async function notifyOperationalAlert(email, alertMessage)
```

#### `upload.service.js`

```js
async function validateAndStore(buffer, originalname)
// 1. readMagicBytes(buffer) — checks first 12 bytes against JPEG/PNG/WebP signatures
// 2. checkSize(buffer)      — rejects if buffer.length > 5 * 1024 * 1024
// 3. ensureUploadDir()      — creates uploads/profile-pictures/ if absent
// 4. writeFile(dest, buffer)
// Returns: { profilePictureUrl: '/uploads/profile-pictures/<uuid>.<ext>' }
// Throws: { status: 422, message: '...' } on validation failure
//         { status: 500, message: 'Upload failed. Please try again.' } on write failure

function readMagicBytes(buffer)
// Returns: 'image/jpeg' | 'image/png' | 'image/webp' | null
// JPEG:  FF D8 FF
// PNG:   89 50 4E 47 0D 0A 1A 0A
// WebP:  52 49 46 46 ?? ?? ?? ?? 57 45 42 50
```

### Backend Controllers

#### `profile.controller.js`

```js
async function getMyProfile(req, res)   // GET  /profile/me
async function updateMyProfile(req, res) // PATCH /profile/me
```

#### `upload.controller.js`

```js
async function uploadProfilePicture(req, res) // POST /profile/picture
```

#### `password.controller.js`

```js
async function changePassword(req, res)       // POST /auth/change-password
async function forgotPassword(req, res)       // POST /auth/forgot-password
async function resetPassword(req, res)        // POST /auth/reset-password
```

### Backend Routes

#### `profile.routes.js`

```
GET  /profile/me        verifyToken → profile.controller.getMyProfile
PATCH /profile/me       verifyToken → validate(schemas.updateProfile) → profile.controller.updateMyProfile
POST /profile/picture   verifyToken → multer.single('profilePicture') → upload.controller.uploadProfilePicture
```

#### Extended `auth.routes.js`

```
POST /auth/change-password  verifyToken → validate(schemas.changePassword) → password.controller.changePassword
POST /auth/forgot-password  forgotPasswordLimiter → validate(schemas.forgotPassword) → password.controller.forgotPassword
POST /auth/reset-password   validate(schemas.resetPassword) → password.controller.resetPassword
```

### Middleware Additions

#### `rateLimit.middleware.js` — new export

```js
const forgotPasswordLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_FORGOT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_FORGOT_MAX)        || 5,
  handler:  rateLimitHandler,  // existing shared handler
});
```

#### `multer` configuration (inline in `upload.routes.js`)

```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 + 1 }, // +1 so we can detect the exact boundary
});
```

Note: multer's `fileSize` limit is a hard stop before the buffer reaches the
service. The Upload_Service performs its own size check on the buffer for
defense-in-depth and to produce the correct error message.

---

## Data Models

### Prisma Schema Extensions

#### Extended `User` model

```prisma
model User {
  // ... existing fields ...
  profilePictureUrl  String?   // URL/path to stored image; binary never in DB
  dateOfBirth        DateTime? // Must be a past date; validated at service layer
  joiningDate        DateTime? // Intern start date
  passwordResetTokens PasswordResetToken[]
}
```

#### Extended `Intern` model

```prisma
model Intern {
  // ... existing fields ...
  gdocUrl                String?   // Must begin with https://docs.google.com/document/d/
  lastGdocReminderSentAt DateTime? // Updated by GDoc_Reminder_Job after each send
}
```

#### New `PasswordResetToken` model

```prisma
model PasswordResetToken {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String    @unique  // bcrypt hash of the plaintext token
  expiresAt  DateTime
  usedAt     DateTime?           // null = unused; set on successful reset
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

**Design rationale for `PasswordResetToken`:**
- `tokenHash` is `@unique` to allow direct lookup by hash (after bcrypt.compare
  narrows candidates). In practice, the service queries by `userId` + `expiresAt`
  + `usedAt IS NULL` and then bcrypt-compares, so the unique constraint is a
  safety net rather than the primary lookup path.
- `onDelete: Cascade` ensures tokens are cleaned up when a user is deleted.
- `usedAt` is preferred over a boolean `used` field so audit queries can
  determine when a reset occurred without joining the AuditLog table.

### New Audit Action Constants

```js
// auditActions.js additions
PASSWORD_CHANGED: 'PASSWORD_CHANGED',
PASSWORD_RESET:   'PASSWORD_RESET',
PROFILE_UPDATE:   'PROFILE_UPDATE',
UPLOAD_REJECTED:  'UPLOAD_REJECTED',
```

### Validation Schemas (Joi additions to `schemas.js`)

```js
// PATCH /profile/me
const updateProfile = Joi.object({
  body: Joi.object({
    name:              Joi.string().trim().min(1).max(100).optional(),
    profilePictureUrl: Joi.string().uri().max(2048).optional().allow('', null),
    gdocUrl:           Joi.string().max(2048).optional().allow('', null),
  }).min(1), // at least one field required
  params: Joi.object(),
  query:  Joi.object(),
});

// POST /auth/change-password
const changePassword = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword:     Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords do not match.' }),
  }).required(),
  params: Joi.object(),
  query:  Joi.object(),
});

// POST /auth/forgot-password
const forgotPassword = Joi.object({
  body:   Joi.object({ email: Joi.string().email().required() }).required(),
  params: Joi.object(),
  query:  Joi.object(),
});

// POST /auth/reset-password
const resetPassword = Joi.object({
  body: Joi.object({
    token:           Joi.string().required(),
    newPassword:     Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords do not match.' }),
  }).required(),
  params: Joi.object(),
  query:  Joi.object(),
});
```

---

## API Endpoint Specifications

### Profile Endpoints

#### `GET /profile/me`

- **Auth**: Bearer token required
- **Response 200**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "technical_intern",
      "status": "active",
      "profilePictureUrl": "/uploads/profile-pictures/abc123.jpg",
      "dateOfBirth": "1999-05-15T00:00:00.000Z",
      "joiningDate": "2024-01-10T00:00:00.000Z",
      "createdAt": "2024-01-10T09:00:00.000Z",
      "intern": {
        "gdocUrl": "https://docs.google.com/document/d/abc123/edit",
        "lastGdocReminderSentAt": "2024-06-01T09:00:00.000Z"
      }
    }
  }
  ```
- **Response 401**: No/invalid token

#### `PATCH /profile/me`

- **Auth**: Bearer token required
- **Body**: `{ name?, profilePictureUrl?, gdocUrl? }` (at least one field)
- **Response 200**: Updated profile object (same shape as GET)
- **Response 401**: No/invalid token
- **Response 422**: GDoc URL format invalid, name out of range, or URL too long

#### `POST /profile/picture`

- **Auth**: Bearer token required
- **Content-Type**: `multipart/form-data`
- **Field**: `profilePicture` (file)
- **Response 200**: `{ "success": true, "data": { "profilePictureUrl": "/uploads/..." } }`
- **Response 422**: Invalid MIME type or file > 5 MB
- **Response 500**: Storage write failure

### Password Endpoints

#### `POST /auth/change-password`

- **Auth**: Bearer token required
- **Body**: `{ currentPassword, newPassword, confirmPassword }`
- **Response 200**: `{ "success": true, "message": "Password changed successfully." }`
- **Response 401**: Current password incorrect
- **Response 422**: New password length violation or same as current

#### `POST /auth/forgot-password`

- **Auth**: None (rate-limited: 5/15 min/IP)
- **Body**: `{ email }`
- **Response 200**: `{ "success": true, "message": "If an account with that email exists, a reset link has been sent." }`
  (always, regardless of whether email is registered)
- **Response 429**: Rate limit exceeded

#### `POST /auth/reset-password`

- **Auth**: None
- **Body**: `{ token, newPassword, confirmPassword }`
- **Response 200**: `{ "success": true, "message": "Password reset successfully." }`
- **Response 400**: Token invalid or expired
- **Response 422**: New password length violation

### Static File Route

```
GET /uploads/profile-pictures/:filename
```

Served by `express.static('uploads')` registered in `app.js`. Files are served
with default cache headers. In production, a CDN or reverse proxy should be
placed in front of this route.

---

## Frontend Component Structure

### New Pages

#### `Profile.tsx` — `/profile`

```
Profile
├─ ProfilePictureUploader
│   ├─ <img> or default avatar placeholder
│   ├─ hidden <input type="file" accept=".jpg,.jpeg,.png,.webp">
│   ├─ Upload button (disabled + spinner during upload)
│   └─ Error message on failure (extractErrorMessage)
├─ ProfileForm (inline edit)
│   ├─ Full Name input (1–100 chars)
│   ├─ Email (read-only display)
│   ├─ Role (read-only display)
│   ├─ Joining Date (read-only display)
│   ├─ GDoc URL input (validated on blur)
│   └─ Save / Cancel buttons
└─ Design: glass-card, gold accents, navy background, nav-label typography
```

State: `profile` (fetched on mount), `editMode`, `uploading`, `saving`, `error`

#### `Settings.tsx` — `/settings`

```
Settings
├─ ChangePasswordSection
│   ├─ Current Password input (with show/hide toggle)
│   ├─ New Password input (with show/hide toggle)
│   ├─ Confirm New Password input
│   ├─ Client-side match validation (prevents submit if mismatch)
│   ├─ Submit button
│   └─ Success message / error message
└─ Design: glass-card, gold accents, nav-label typography
```

#### `ForgotPassword.tsx` — `/forgot-password`

```
ForgotPassword
├─ Starfield background
├─ glass-card
│   ├─ Email input
│   ├─ Submit button
│   └─ Success state: generic confirmation message (no email enumeration)
└─ Link back to /login
```

#### `ResetPassword.tsx` — `/reset-password?token=<token>`

```
ResetPassword
├─ On mount: if no ?token param → redirect to /forgot-password
├─ Starfield background
├─ glass-card
│   ├─ New Password input (with show/hide toggle)
│   ├─ Confirm New Password input
│   ├─ Client-side match validation
│   ├─ Submit button
│   └─ Success state: message + 3-second redirect to /login
└─ Error state: "Reset link is invalid or has expired." with link to /forgot-password
```

### Updated Pages

#### `Register.tsx` — additions

New fields added to the existing form (preserving all existing styling):
- Date of Birth (`<input type="date">`, must be past date — validated on submit)
- Joining Date (`<input type="date">`)
- Profile Picture upload (required; preview shown after selection; JPEG/PNG/WebP only)
- GDoc URL (`<input type="url">`, shown only when role is TECHNICAL_INTERN or RESEARCH_INTERN)

Role selector updated to show only `TECHNICAL_INTERN` and `RESEARCH_INTERN`.

Registration flow: picture is uploaded via `POST /profile/picture` first (using
a temporary auth-free upload endpoint or bundled as multipart with the register
call — see implementation note below).

**Implementation note on registration picture upload**: The register endpoint
will accept `multipart/form-data` directly, with multer applied to the register
route. The Upload_Service validates and stores the file, and the resulting URL
is persisted on the User record atomically within the register transaction.
This avoids a two-step flow that could leave orphaned files.

### New Frontend Services

#### `profile.service.ts`

```ts
export async function getMyProfile(): Promise<ProfileData>
export async function updateMyProfile(data: Partial<ProfileUpdatePayload>): Promise<ProfileData>
export async function uploadProfilePicture(file: File): Promise<{ profilePictureUrl: string }>
```

#### `password.service.ts`

```ts
export async function changePassword(data: ChangePasswordPayload): Promise<void>
export async function forgotPassword(email: string): Promise<void>
export async function resetPassword(data: ResetPasswordPayload): Promise<void>
```

### App.tsx Route Additions

```tsx
// Public routes
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password"  element={<ResetPassword />} />

// Protected — any authenticated user
<Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
```

### Sidebar Navigation Additions

The existing `Sidebar.tsx` will gain two new entries under the authenticated
user section:
- **Profile** → `/profile` (User icon)
- **Settings** → `/settings` (Settings/Gear icon)

---

## Email Template System Design

### Template Registry

`email.service.js` maintains a static map of template names to render functions:

```js
const TEMPLATES = {
  'password-reset':    renderPasswordReset,
  'password-changed':  renderPasswordChanged,
  'account-approved':  renderAccountApproved,
  'task-assigned':     renderTaskAssigned,
  'gdoc-reminder':     renderGdocReminder,
  'operational-alert': renderOperationalAlert,
};
```

If `templateName` is not a key in `TEMPLATES`, the service logs at `error` level
and returns `{ success: false, error: 'Unknown template: <name>' }` without
dispatching.

### Template Render Functions

Each render function takes `templateData` and returns `{ subject, html, text }`.
Templates are plain JavaScript string templates (no external template engine
dependency) to keep the dependency footprint minimal.

```js
function renderPasswordReset({ resetUrl, expiresInMinutes = 60 }) {
  return {
    subject: 'Reset your URIS password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.
           This link expires in ${expiresInMinutes} minutes.</p>`,
    text: `Reset your password: ${resetUrl}\nExpires in ${expiresInMinutes} minutes.`,
  };
}

function renderPasswordChanged({ name }) {
  return {
    subject: 'Your URIS password was changed',
    html: `<p>Hi ${name}, your password was successfully changed.</p>`,
    text: `Hi ${name}, your password was successfully changed.`,
  };
}

function renderGdocReminder({ name, gdocUrl }) {
  return {
    subject: 'URIS Work Log Reminder',
    html: `<p>Hi ${name}, please update your <a href="${gdocUrl}">work log</a>.</p>`,
    text: `Hi ${name}, please update your work log: ${gdocUrl}`,
  };
}
// ... similar for account-approved, task-assigned, operational-alert
```

### SMTP Transport

`email.service.js` uses **nodemailer** (to be added as a dependency) with a
transporter created from environment variables:

```js
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

The transporter is created lazily (on first `sendEmail` call) so the application
starts successfully even when SMTP is not configured.

### New Dependency

```
nodemailer ^6.9.x  (pinned minor, stable API)
```

---

## Cron Job Design

### GDoc_Reminder_Job

The job follows the exact pattern of the six existing scheduler jobs in
`scheduler.js`. It is registered as `_gdocReminderTask` and started by
`_startGdocReminderJob()` called from `start()`.

```js
// scheduler.js additions

const DEFAULT_GDOC_REMINDER_CRON = '0 9 */3 * *'; // Every 3 days at 09:00 UTC
let _gdocReminderTask = null;

function _startGdocReminderJob() {
  const expression = process.env.GDOC_REMINDER_CRON || DEFAULT_GDOC_REMINDER_CRON;

  if (!cron.validate(expression)) {
    logger.warn({ expression },
      'GDOC_REMINDER_CRON is not a valid cron expression — falling back to default');
    // Fall back to default rather than skipping the job entirely
    return _startGdocReminderJobWithExpression(DEFAULT_GDOC_REMINDER_CRON);
  }

  return _startGdocReminderJobWithExpression(expression);
}

function _startGdocReminderJobWithExpression(expression) {
  logger.info({ expression }, 'Starting GDoc reminder job');
  _gdocReminderTask = cron.schedule(expression, async () => {
    try {
      const { sent, errors } = await sendGdocReminders();
      if (errors > 0) logger.warn({ sent, errors }, 'GDoc reminder job completed with errors');
      else logger.info({ sent }, 'GDoc reminder job completed successfully');
    } catch (err) {
      logger.error({ err }, 'GDoc reminder job threw unexpectedly');
    }
  });
}
```

### `sendGdocReminders()` in `notification.service.js`

```js
async function sendGdocReminders() {
  const INTERN_ROLES = ['TECHNICAL_INTERN', 'OPERATIONS_INTERN', 'RESEARCH_INTERN'];

  const interns = await prisma.user.findMany({
    where: {
      status: 'active',
      role:   { in: INTERN_ROLES },
    },
    include: { intern: { select: { gdocUrl: true } } },
  });

  let sent = 0;
  let errors = 0;

  for (const user of interns) {
    try {
      await notifyGdocReminder(user.email, user.name, user.intern?.gdocUrl);
      // Update lastGdocReminderSentAt on the Intern record
      if (user.intern) {
        await prisma.intern.update({
          where: { userId: user.id },
          data:  { lastGdocReminderSentAt: new Date() },
        });
      }
      sent++;
    } catch (err) {
      logger.error({ err, userId: user.id, email: user.email },
        'Failed to send GDoc reminder to intern');
      errors++;
      // Continue to next intern — per-intern errors do not abort the job
    }
  }

  return { sent, errors };
}
```

**Design note**: The job does NOT integrate with the Google Docs API, parse
document content, or track edit history. It is a simple reminder-only system
that sends an email with the intern's stored GDoc URL.

---

## Security Design

### Rate Limiting

| Endpoint | Limiter | Window | Max | Env Vars |
|---|---|---|---|---|
| `POST /auth/login` | `loginLimiter` (existing) | 15 min | 10 | `RATE_LIMIT_LOGIN_*` |
| `POST /auth/register` | `registerLimiter` (existing) | 60 min | 5 | `RATE_LIMIT_REGISTER_*` |
| `POST /auth/forgot-password` | `forgotPasswordLimiter` (new) | 15 min | 5 | `RATE_LIMIT_FORGOT_*` |
| All other routes | `apiLimiter` (existing) | 1 min | 200 | `RATE_LIMIT_API_*` |

The `forgotPasswordLimiter` uses the same `rateLimitHandler` function as the
existing limiters, returning `{ error: 'RATE_LIMITED', message: '...' }` on
breach, consistent with the existing error format.

### Image Validation (Magic Bytes)

MIME type validation is performed by inspecting the raw file bytes, not the
`Content-Type` header or file extension. This prevents MIME-type spoofing.

```
JPEG magic bytes: FF D8 FF (first 3 bytes)
PNG  magic bytes: 89 50 4E 47 0D 0A 1A 0A (first 8 bytes)
WebP magic bytes: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (bytes 0–3 = "RIFF", bytes 8–11 = "WEBP")
```

The `readMagicBytes(buffer)` function in `upload.service.js` checks these
signatures and returns the detected MIME type or `null` if unrecognized.

### GDoc URL Validation

Applied at every entry point (registration, profile update) via a shared
validator function:

```js
function isValidGdocUrl(url) {
  if (typeof url !== 'string') return false;
  if (url.length > 2048) return false;
  return /^https:\/\/docs\.google\.com\/document\/d\/\S+/.test(url);
}
```

This function is used in both the Joi schema (custom validator) and the service
layer (defense-in-depth).

### Audit Logging

All sensitive actions produce fire-and-forget audit log entries via the existing
`logAction` utility:

| Action | Entity | Trigger |
|---|---|---|
| `PROFILE_UPDATE` | `USER` | Successful `PATCH /profile/me` |
| `PASSWORD_CHANGED` | `USER` | Successful `POST /auth/change-password` |
| `PASSWORD_RESET` | `USER` | Successful `POST /auth/reset-password` |
| `UPLOAD_REJECTED` | `USER` | Upload rejected for MIME or size violation |

For `PROFILE_UPDATE`, the metadata object contains only the changed field keys
mapped to their new values (e.g., `{ name: "New Name" }`). Sensitive fields
(password, token) are never included in metadata.

### Password Reset Token Security

- Tokens are generated with `crypto.randomBytes(32)` (256 bits of entropy).
- Only the bcrypt hash is stored in the database; the plaintext is transmitted
  once in the reset email and never persisted.
- Tokens expire after 1 hour (`expiresAt = new Date(Date.now() + 3600_000)`).
- Tokens are single-use: `usedAt` is set on successful reset; subsequent
  attempts with the same token are rejected.
- The lookup strategy avoids timing attacks: the service queries all unexpired
  unused tokens for the user and bcrypt-compares each, rather than doing a
  direct hash lookup (which would require storing the hash in a way that enables
  direct comparison without bcrypt).

### Session Invalidation on Password Change

When a password is changed via `POST /auth/change-password`, all existing JWTs
for the user are effectively invalidated by updating a `passwordChangedAt`
timestamp on the User record. The `verifyToken` middleware checks this timestamp
against the JWT `iat` claim and rejects tokens issued before the password change.

```js
// In verifyToken middleware (addition):
if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
  return res.status(401).json({ message: 'Session expired. Please log in again.' });
}
```

This requires adding `passwordChangedAt DateTime?` to the User model.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Role Restriction Invariant

*For any* role string submitted to the registration endpoint, if the role is not
`TECHNICAL_INTERN` or `RESEARCH_INTERN`, the Auth_Service SHALL reject the
request with HTTP 400 and the message "Role not permitted for public registration."

**Validates: Requirements 1.2**

---

### Property 2: Registration Data Round-Trip

*For any* valid registration payload containing a name, email, password,
dateOfBirth, joiningDate, and gdocUrl (for intern roles), after a successful
registration the stored User record SHALL have `dateOfBirth` and `joiningDate`
matching the submitted values, and the associated Intern record SHALL have
`gdocUrl` matching the submitted value.

**Validates: Requirements 1.4, 10.4**

---

### Property 3: Magic Bytes MIME Validation

*For any* byte sequence whose first bytes do not match the JPEG (`FF D8 FF`),
PNG (`89 50 4E 47 0D 0A 1A 0A`), or WebP (`52 49 46 46 ... 57 45 42 50`) magic
byte signatures, the Upload_Service SHALL reject the file with HTTP 422 and the
message "File type not supported. Accepted formats: JPEG, PNG, WebP."

*For any* byte sequence whose first bytes DO match one of the three accepted
signatures, the Upload_Service SHALL not reject the file for MIME type reasons.

**Validates: Requirements 1.6, 2.2, 8.3**

---

### Property 4: GDoc URL Validation

*For any* string submitted as a GDoc URL at any endpoint (registration, profile
update), if the string does not begin with `https://docs.google.com/document/d/`
followed by at least one non-whitespace character, or if the string exceeds 2048
characters, the system SHALL return HTTP 422.

*For any* string that does satisfy the prefix requirement and length constraint,
the system SHALL not reject it for GDoc URL format reasons.

**Validates: Requirements 1.10, 3.6, 6.3, 8.4**

---

### Property 5: Profile Data Round-Trip

*For any* authenticated user, after a successful `PATCH /profile/me` with a
valid payload containing updated `name`, `profilePictureUrl`, and/or `gdocUrl`,
a subsequent `GET /profile/me` SHALL return the updated values for those fields
and SHALL return unchanged values for all other fields.

**Validates: Requirements 3.2, 3.4**

---

### Property 6: Role Immutability via Profile Update

*For any* authenticated user with any role, submitting any `role` value in a
`PATCH /profile/me` request SHALL result in the response containing the user's
original, unchanged role. The role field SHALL be silently ignored.

**Validates: Requirements 3.5**

---

### Property 7: Password Length Validation

*For any* string with length less than 8 or greater than 128 characters,
submitting it as `newPassword` to either `POST /auth/change-password` or
`POST /auth/reset-password` SHALL result in HTTP 422.

*For any* string with length in the range [8, 128], the request SHALL not be
rejected for password length reasons.

**Validates: Requirements 4.4, 5.8**

---

### Property 8: Password Change Round-Trip

*For any* user and any valid new password, after a successful
`POST /auth/change-password`, `bcrypt.compare(newPassword, storedHash)` SHALL
return `true`, and `bcrypt.compare(oldPassword, storedHash)` SHALL return
`false`.

**Validates: Requirements 4.7**

---

### Property 9: Forgot-Password Anti-Enumeration

*For any* email string (whether registered or not), `POST /auth/forgot-password`
SHALL always return HTTP 200 with the message "If an account with that email
exists, a reset link has been sent." The response body SHALL be identical
regardless of whether the email matches a registered user.

**Validates: Requirements 5.2, 5.5**

---

### Property 10: Password Reset Token Single-Use

*For any* valid password reset token that has been successfully used to reset a
password, submitting the same token again to `POST /auth/reset-password` SHALL
return HTTP 400 with the message "Reset link is invalid or has expired."

**Validates: Requirements 5.7, 5.10**

---

### Property 11: Email_Service No-Throw on Failure

*For any* simulated SMTP transport failure (network error, authentication
failure, timeout), `sendEmail(...)` SHALL resolve (never reject) with
`{ success: false, error: <string> }`. The caller SHALL never receive an
unhandled promise rejection from Email_Service.

**Validates: Requirements 7.5**

---

### Property 12: Unknown Email Template Rejection

*For any* string not in the set `{ 'password-reset', 'password-changed',
'account-approved', 'task-assigned', 'gdoc-reminder', 'operational-alert' }`
passed as `templateName` to `sendEmail(...)`, the function SHALL return
`{ success: false, error: 'Unknown template: <name>' }` without dispatching
any email.

**Validates: Requirements 7.3**

---

## Error Handling

### Backend Error Conventions

All new services follow the existing pattern: throw an `Error` with a `.status`
property for expected failures; let unexpected errors propagate to the global
`errorHandler` middleware.

```js
// Expected failure pattern (used in all new services)
const err = new Error('Current password is incorrect.');
err.status = 401;
throw err;
```

The existing `error.middleware.js` catches these and returns:
```json
{ "success": false, "message": "Current password is incorrect.", "data": null }
```

### Email Failure Handling

Email failures are non-fatal by design. The pattern is:

```js
// In password.service.js changePassword():
await prisma.user.update({ where: { id: userId }, data: { password: newHash } });
// Password change is committed before email is attempted
const emailResult = await notificationService.notifyPasswordChanged(user.email);
if (!emailResult.success) {
  logger.warn({ userId, email: user.email }, 'Password changed but confirmation email failed');
  // Return a non-blocking notice to the caller
  return { success: true, emailSent: false };
}
return { success: true, emailSent: true };
```

The controller surfaces `emailSent: false` as a non-blocking UI notice
("Password changed. Confirmation email could not be sent.").

### Upload Failure Handling

If the file write fails after validation passes, Upload_Service returns HTTP 500
and does NOT update the User record. The partial file (if any) is cleaned up
before returning.

### GDoc Reminder Job Error Handling

Per-intern errors are logged at `error` level and do not abort the remaining
sends. The job logs a summary at the end:
```
{ sent: 42, errors: 2 } 'GDoc reminder job completed with errors'
```

### Frontend Error Handling

All new pages use the existing `extractErrorMessage` utility from
`services/error.ts` to surface backend error messages. Network errors fall back
to a generic message. No raw error objects are ever displayed to the user.

---

## Testing Strategy

### Overview

The testing strategy uses a dual approach: example-based unit/integration tests
for specific scenarios and property-based tests for universal correctness
properties. The existing Jest + Supertest setup is used throughout.

### Property-Based Testing

The project uses **fast-check** (to be added as a dev dependency) for
property-based testing. Each property test runs a minimum of 100 iterations.

```
fast-check ^3.x.x  (pinned major, stable API)
```

Each property test is tagged with a comment referencing the design property:

```js
// Feature: enterprise-profile-password-email, Property 3: Magic Bytes MIME Validation
it('rejects files with non-matching magic bytes', () => {
  fc.assert(fc.property(
    fc.uint8Array({ minLength: 12, maxLength: 1024 })
      .filter(buf => !isJpeg(buf) && !isPng(buf) && !isWebp(buf)),
    (buffer) => {
      const result = readMagicBytes(Buffer.from(buffer));
      expect(result).toBeNull();
    }
  ), { numRuns: 100 });
});
```

### Property Test Implementations

| Property | Test File | Generator |
|---|---|---|
| 1: Role Restriction | `auth.service.pbt.test.js` | `fc.string()` filtered to non-permitted roles |
| 2: Registration Round-Trip | `auth.service.pbt.test.js` | `fc.record({ name, email, password, dob, joiningDate, gdocUrl })` |
| 3: Magic Bytes MIME | `upload.service.pbt.test.js` | `fc.uint8Array()` with/without magic byte prefixes |
| 4: GDoc URL Validation | `validation.pbt.test.js` | `fc.string()` with/without required prefix |
| 5: Profile Round-Trip | `profile.service.pbt.test.js` | `fc.record({ name, profilePictureUrl, gdocUrl })` |
| 6: Role Immutability | `profile.service.pbt.test.js` | `fc.constantFrom(...ALL_ROLES)` |
| 7: Password Length | `password.service.pbt.test.js` | `fc.string()` with length < 8 or > 128 |
| 8: Password Change Round-Trip | `password.service.pbt.test.js` | `fc.string({ minLength: 8, maxLength: 128 })` |
| 9: Anti-Enumeration | `password.service.pbt.test.js` | `fc.emailAddress()` |
| 10: Token Single-Use | `password.service.pbt.test.js` | Valid token generation + reuse attempt |
| 11: Email No-Throw | `email.service.pbt.test.js` | Simulated SMTP failures via mock |
| 12: Unknown Template | `email.service.pbt.test.js` | `fc.string()` filtered to non-template names |

### Unit Tests (Example-Based)

Key example-based tests to complement the property tests:

- `auth.service.test.js`: duplicate email → 409; valid registration → pending status
- `password.service.test.js`: wrong current password → 401; same password → 422; expired token → 400
- `upload.service.test.js`: file > 5 MB → 422; storage write failure → 500
- `profile.service.test.js`: unauthenticated GET → 401; role field ignored in PATCH
- `email.service.test.js`: SMTP_HOST not set → `{ success: false, reason: 'SMTP_NOT_CONFIGURED' }`
- `notification.service.test.js`: each named function calls Email_Service with correct template
- `upload.controller.test.js`: rejected upload creates UPLOAD_REJECTED audit log

### Integration Tests

- `POST /auth/forgot-password` rate limiter: 6th request in 15 min → 429
- `POST /profile/picture` end-to-end: valid JPEG → 200 with URL; invalid file → 422
- `GET /profile/me` → `PATCH /profile/me` → `GET /profile/me` round-trip via Supertest
- GDoc reminder job: mock `sendGdocReminders`, verify scheduler calls it on cron tick

### Frontend Tests

Frontend tests use Vitest + React Testing Library (existing setup):

- `Register.test.tsx`: all new fields render; GDoc URL field hidden for non-intern roles
- `Profile.test.tsx`: profile data displayed; upload button disabled during upload
- `Settings.test.tsx`: password mismatch prevents submit; success message shown
- `ForgotPassword.test.tsx`: success message shown regardless of email
- `ResetPassword.test.tsx`: redirect to /forgot-password when no token param

### Test Configuration

```js
// jest.config.js — no changes needed; new test files follow existing pattern
// Test files: backend/src/__tests__/ and backend/src/services/__tests__/
// PBT files named *.pbt.test.js to distinguish from example-based tests
```
