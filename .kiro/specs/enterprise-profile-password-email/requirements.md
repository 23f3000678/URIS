# Requirements Document

## Introduction

This feature extends the URIS intern management platform with a production-ready enterprise profile, password management, and email notification system. The scope covers: expanded intern registration (with profile picture, DOB, joining date, and Google Docs work log URL), a profile management page, change-password and forgot-password flows, a centralized email notification service, a Google Docs work log reminder cron job, and supporting security controls (rate limiting, audit logging, image validation, GDoc URL validation). The implementation must preserve the existing architecture, design system, and role governance model.

## Glossary

- **Registration_Form**: The public-facing registration page at `/register` that allows new users to create accounts.
- **Login_Page**: The public-facing login page at `/login` that allows existing users to authenticate.
- **Profile_Page**: The authenticated page where a user views and edits their own profile information.
- **Settings_Page**: The authenticated page containing account management actions including password change.
- **Auth_Service**: The backend service (`auth.service.js`) responsible for registration, login, and token issuance.
- **Profile_Service**: The new backend service responsible for profile reads and updates.
- **Password_Service**: The new backend service responsible for change-password and forgot/reset-password flows.
- **Email_Service**: The new centralized backend service responsible for composing and dispatching all outbound emails via a configured SMTP/transactional provider.
- **Notification_Service**: The new backend service that acts as the single entry point for triggering email notifications; controllers call Notification_Service, never Email_Service directly.
- **Upload_Service**: The new backend service responsible for receiving, validating, and persisting profile picture files to disk or object storage and returning a URL/path.
- **GDoc_Reminder_Job**: The cron job that runs every 3 days and sends work-log reminder emails to all active interns.
- **Audit_Logger**: The existing `auditLogger.js` utility used for fire-and-forget audit trail writes.
- **Password_Reset_Token**: A cryptographically random, single-use token stored as a bcrypt hash in the database, used to authorize a password reset.
- **Intern**: A user whose role is `TECHNICAL_INTERN`, `OPERATIONS_INTERN`, or `RESEARCH_INTERN`.
- **Public_Role**: A role that may be self-selected during public registration: `TECHNICAL_INTERN` or `RESEARCH_INTERN`.
- **Restricted_Role**: Any role that may NOT be self-selected during public registration: all admin, lead, operations, and program manager roles.
- **GDoc_URL**: A Google Docs URL provided by an intern to link their work log document. Must begin with `https://docs.google.com/document/d/` followed by at least one non-whitespace character.
- **Profile_Picture_URL**: A relative or absolute URL/path pointing to the stored profile picture file; the image binary is never stored in the database.

---

## Requirements

### Requirement 1: Expanded Intern Registration

**User Story:** As a new intern, I want to register with my full name, email, password, date of birth, joining date, role, profile picture, and Google Docs work log URL, so that my profile is complete from the moment I join.

#### Acceptance Criteria

1. THE Registration_Form SHALL present input fields for: full name (1–100 characters), email address (RFC-5322 simplified format), password (minimum 6 characters), date of birth (must be a past date), joining date, role selection, profile picture upload, and GDoc URL.
2. WHEN a user submits the Registration_Form, THE Auth_Service SHALL reject any role value that is not `TECHNICAL_INTERN` or `RESEARCH_INTERN` with HTTP 400 and the message "Role not permitted for public registration."
3. WHEN a user submits the Registration_Form with a duplicate email address, THE Auth_Service SHALL return HTTP 409 with the message "An account with this email already exists."
4. WHEN a user submits the Registration_Form with all required fields valid, THE Auth_Service SHALL create a new User record with status `pending`, persist `dateOfBirth` and `joiningDate` on the User record, and store `gdocUrl` on the associated Intern record.
5. WHEN a user submits the Registration_Form without a profile picture, THE Registration_Form SHALL display a validation error and prevent form submission.
6. WHEN a user uploads a profile picture during registration, THE Upload_Service SHALL accept only files with MIME type `image/jpeg`, `image/png`, or `image/webp` (validated by magic bytes) and reject all other file types with HTTP 422.
7. WHEN a user uploads a profile picture during registration, THE Upload_Service SHALL reject files larger than 5 MB with HTTP 422 and an error message stating the size limit.
8. WHEN a profile picture upload is accepted, THE Upload_Service SHALL store the file outside the database and return a Profile_Picture_URL.
9. WHEN a profile picture upload is accepted, THE Auth_Service SHALL persist only the Profile_Picture_URL on the User record; the image binary SHALL NOT be stored in the database.
10. WHEN a user submits a GDoc URL during registration, THE Auth_Service SHALL validate that the value begins with `https://docs.google.com/document/d/` followed by at least one non-whitespace character; IF invalid, THEN THE Auth_Service SHALL return HTTP 422.
11. WHEN a GDoc URL is supplied during registration for a non-intern role, THE Auth_Service SHALL ignore the GDoc URL field and not persist it.
12. WHEN registration succeeds, THE Registration_Form SHALL display the "Access Requested" pending-approval screen showing the user's name and a message confirming the request is under review.

---

### Requirement 2: Profile Picture System

**User Story:** As an intern, I want to upload and update my profile picture from my profile or settings page, so that my account has a recognizable visual identity.

#### Acceptance Criteria

1. THE Upload_Service SHALL expose a `POST /profile/picture` endpoint that accepts a `multipart/form-data` request containing a single image file field named `profilePicture`.
2. WHEN a profile picture upload request is received, THE Upload_Service SHALL validate MIME type by inspecting file magic bytes; IF the magic bytes do not match `image/jpeg`, `image/png`, or `image/webp`, THEN THE Upload_Service SHALL return HTTP 422 with the message "File type not supported. Accepted formats: JPEG, PNG, WebP."
3. WHEN a profile picture upload request is received, THE Upload_Service SHALL validate that the file size does not exceed 5 MB; IF the file exceeds the limit, THEN THE Upload_Service SHALL return HTTP 422 with the message "File size exceeds the 5 MB limit."
4. WHEN a valid profile picture is uploaded, THE Upload_Service SHALL persist the file to the configured storage location and return `{ profilePictureUrl: "<url>" }` in the response body with HTTP 200.
5. WHEN the Upload_Service fails to persist the file to storage, THE Upload_Service SHALL return HTTP 500 with the message "Upload failed. Please try again." and SHALL NOT update the User record.
6. THE Profile_Page SHALL display a profile picture preview using the stored Profile_Picture_URL; IF no Profile_Picture_URL is set, THEN THE Profile_Page SHALL display a default avatar placeholder image.
7. WHEN a user updates their profile picture from the Profile_Page, THE Profile_Service SHALL update the Profile_Picture_URL on the User record and return the new URL in the response.
8. WHEN a profile picture update fails at the Profile_Service level, THE Profile_Page SHALL display an error message and retain the previously displayed profile picture.
9. THE Profile_Page SHALL display the updated profile picture within 2 seconds of a successful upload response without requiring a full page reload.

---

### Requirement 3: Profile Page

**User Story:** As an authenticated user, I want a profile page where I can view my details and update my profile picture, GDoc link, and basic information, so that I can keep my profile accurate.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Profile_Page, THE Profile_Page SHALL display the user's full name, email address, role, joining date (from `joiningDate` field), profile picture, and GDoc URL.
2. WHEN an authenticated user navigates to the Profile_Page, THE Profile_Service SHALL return the user's current profile data via `GET /profile/me` with HTTP 200.
3. IF a request to `GET /profile/me` is made without a valid authentication token, THEN THE Profile_Service SHALL return HTTP 401.
4. WHEN a user submits a profile update, THE Profile_Service SHALL accept updates to: full name (1–100 characters), profile picture URL (valid URL format, ≤ 2048 characters), and GDoc URL via `PATCH /profile/me`.
5. IF a user attempts to submit a role change via the profile update endpoint, THEN THE Profile_Service SHALL ignore the role field and return the unchanged role in the response.
6. WHEN a GDoc URL update is submitted, THE Profile_Service SHALL validate that the value begins with `https://docs.google.com/document/d/` followed by at least one non-whitespace character; IF invalid, THEN THE Profile_Service SHALL return HTTP 422.
7. WHEN a profile update succeeds, THE Audit_Logger SHALL record the action with entity `USER`, action `PROFILE_UPDATE`, and a metadata object containing only the changed field keys mapped to their new values (e.g., `{ fullName: "New Name" }`).
8. THE Profile_Page SHALL preserve the existing URIS design system (glass-card, gold accents, navy background, nav-label typography).

---

### Requirement 4: Change Password

**User Story:** As an authenticated user, I want to change my password from the Settings page, so that I can maintain account security.

#### Acceptance Criteria

1. THE Settings_Page SHALL provide a "Change Password" section with fields for current password, new password, and confirm new password.
2. WHEN a change-password request is submitted and the current password matches the stored hash, THE Password_Service SHALL proceed with the password update.
3. IF the current password does not match the stored hash, THEN THE Password_Service SHALL return HTTP 401 with the message "Current password is incorrect."
4. IF the new password is shorter than 8 characters or longer than 128 characters, THEN THE Password_Service SHALL return HTTP 422.
5. IF the new password is identical to the current password, THEN THE Password_Service SHALL return HTTP 422 with the message "New password must differ from the current password."
6. WHEN the new password and confirm new password fields do not match, THE Settings_Page SHALL display a validation error indicating the passwords do not match and prevent form submission.
7. WHEN a valid change-password request is processed, THE Password_Service SHALL hash the new password with bcrypt and update the User record.
8. WHEN a password change succeeds, THE Password_Service SHALL invalidate all existing sessions for the user except the current session.
9. WHEN a password change succeeds, THE Audit_Logger SHALL record the action with entity `USER`, action `PASSWORD_CHANGED`, and the acting user's ID.
10. WHEN a password change succeeds, THE Notification_Service SHALL send a "password changed" confirmation email to the user's registered email address within 5 minutes.
11. IF the confirmation email fails to deliver, THE password change SHALL be retained and the user SHALL be shown a non-blocking notice that the confirmation email could not be sent.

---

### Requirement 5: Forgot Password

**User Story:** As a user who has forgotten their password, I want to request a password reset link via email, so that I can regain access to my account without contacting an administrator.

#### Acceptance Criteria

1. THE Login_Page SHALL include a "Forgot Password?" link that navigates to the Forgot_Password_Page.
2. WHEN a forgot-password request is submitted, THE Password_Service SHALL return HTTP 200 with the message "If an account with that email exists, a reset link has been sent." regardless of whether the email is registered; the plaintext token SHALL never be persisted to the database.
3. WHEN a forgot-password request is submitted and the email matches a registered user, THE Password_Service SHALL generate a cryptographically random Password_Reset_Token, store its bcrypt hash in the database with an expiry of 1 hour.
4. WHEN a forgot-password request is submitted and the email matches a registered user, THE Notification_Service SHALL send a password reset email containing the reset link to that address.
5. IF the email does not match any registered user, THEN no email SHALL be sent and the response SHALL still be HTTP 200 with the generic success message.
6. WHEN a password reset link is followed, THE Reset_Password_Page SHALL display fields for new password and confirm new password.
7. WHEN a reset-password request is submitted, THE Password_Service SHALL validate the token against the stored hash; IF the token is invalid or expired, THEN THE Password_Service SHALL return HTTP 400 with the message "Reset link is invalid or has expired."
8. WHEN a valid reset-password request is processed, THE new password SHALL be at least 8 characters and no more than 128 characters; IF the constraint is violated, THEN THE Password_Service SHALL return HTTP 422.
9. WHEN the new password and confirm new password fields do not match on the Reset_Password_Page, THE Reset_Password_Page SHALL display a validation error and prevent form submission.
10. WHEN a valid reset-password request is processed, THE Password_Service SHALL hash the new password with bcrypt, update the User record, and mark the token as used so it cannot be reused.
11. WHEN a password reset succeeds, THE Notification_Service SHALL send a "password changed" confirmation email to the user's registered email address.
12. WHEN a password reset succeeds, THE Reset_Password_Page SHALL display a success message and redirect the user to the Login_Page after 3 seconds.
13. WHEN a forgot-password request is submitted, THE forgot-password endpoint SHALL be protected by a dedicated rate limiter allowing a maximum of 5 requests per 15-minute window per IP address, returning HTTP 429 with the existing `RATE_LIMITED` error format on breach.

---

### Requirement 6: Google Docs Work Log System

**User Story:** As a platform administrator, I want each intern to maintain a Google Docs work log URL and receive automated reminders every 3 days, so that work logs are kept up to date without manual follow-up.

#### Acceptance Criteria

1. THE Auth_Service SHALL require a GDoc URL field during intern registration; IF the field is absent or empty, THEN THE Auth_Service SHALL return HTTP 422 with the message "Google Docs work log URL is required."
2. WHEN an authenticated intern submits a GDoc URL update via `PATCH /profile/me`, THE Profile_Service SHALL validate and persist the new value on the Intern record.
3. WHEN a GDoc URL is submitted (at registration or profile update), THE system SHALL validate that the value begins with `https://docs.google.com/document/d/` followed by at least one non-whitespace character and does not exceed 2048 characters; IF invalid, THEN THE system SHALL return HTTP 422.
4. THE GDoc_Reminder_Job SHALL be registered in `scheduler.js` using the `GDOC_REMINDER_CRON` environment variable; IF `GDOC_REMINDER_CRON` is not set or is an invalid cron expression, THEN the scheduler SHALL fall back to the default schedule `0 9 */3 * *` and log a warning.
5. WHEN the GDoc_Reminder_Job executes, THE GDoc_Reminder_Job SHALL call `sendGdocReminders()` which queries all users with status `active` and an intern role, then sends a work-log reminder email to each via the Notification_Service.
6. WHEN the GDoc_Reminder_Job executes, THE GDoc_Reminder_Job SHALL log the total count of reminder emails successfully sent and SHALL log each per-intern error individually at `error` level without aborting the remaining sends.
7. THE GDoc_Reminder_Job SHALL NOT integrate with the Google Docs API, parse document content, or track edit history; it is a simple reminder-only system.

---

### Requirement 7: Centralized Email Notification System

**User Story:** As a platform operator, I want all outbound emails to flow through a single centralized service with reusable templates, so that email delivery is consistent, auditable, and maintainable.

#### Acceptance Criteria

1. THE Email_Service SHALL expose a single `sendEmail({ to, subject, templateName, templateData })` function where `to` is a single recipient email address string, that composes and dispatches all outbound emails.
2. THE Notification_Service SHALL be the sole caller of Email_Service from application code; controllers and other services SHALL call Notification_Service, never Email_Service directly.
3. THE Email_Service SHALL support the following named templates: `password-reset`, `password-changed`, `account-approved`, `task-assigned`, `gdoc-reminder`, `operational-alert`; IF an unknown `templateName` is passed, THEN THE Email_Service SHALL log an error at `error` level and return without dispatching.
4. WHEN an email dispatch fails, THE Email_Service SHALL log the failure with structured logger at `error` level including recipient address, template name, and error message.
5. WHEN an email dispatch fails, THE Email_Service SHALL NOT throw an unhandled exception that propagates to the caller; it SHALL resolve with `{ success: false, error: <message> }`.
6. THE Email_Service SHALL read SMTP configuration from environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
7. WHEN `SMTP_HOST` is not set, THE Email_Service SHALL log a warning, skip dispatch, and return `{ success: false, reason: "SMTP_NOT_CONFIGURED" }` so that the application starts successfully in environments without email configured.
8. THE Notification_Service SHALL expose named functions for each notification type: `notifyPasswordReset`, `notifyPasswordChanged`, `notifyAccountApproved`, `notifyTaskAssigned`, `notifyGdocReminder`, `notifyOperationalAlert`.

---

### Requirement 8: Security and Validation

**User Story:** As a platform security officer, I want login rate limiting, forgot-password rate limiting, image validation, GDoc URL validation, and audit logging for all profile and password actions, so that the platform is protected against abuse and all sensitive actions are traceable.

#### Acceptance Criteria

1. THE login endpoint SHALL be protected by the existing `loginLimiter` (10 attempts per 15-minute window per IP).
2. THE forgot-password endpoint SHALL be protected by a dedicated `forgotPasswordLimiter` allowing a maximum of 5 requests per 15-minute window per IP; WHEN the limit is exceeded, THE endpoint SHALL return HTTP 429 with the existing `{ error: "RATE_LIMITED", message: "..." }` response format.
3. WHEN an image file is uploaded, THE Upload_Service SHALL validate MIME type by inspecting file magic bytes (not only the `Content-Type` header); IF the magic bytes do not match `image/jpeg`, `image/png`, or `image/webp`, THEN THE Upload_Service SHALL reject the file with HTTP 422.
4. WHEN a GDoc URL is submitted at any endpoint, THE system SHALL validate the URL begins with `https://docs.google.com/document/d/` followed by at least one non-whitespace character; IF invalid, THEN THE system SHALL return HTTP 422.
5. WHEN a password change succeeds, THE Audit_Logger SHALL record the event with action `PASSWORD_CHANGED`, entity `USER`, and the acting user's ID.
6. WHEN a password reset succeeds, THE Audit_Logger SHALL record the event with action `PASSWORD_RESET`, entity `USER`, and the acting user's ID.
7. WHEN a profile field is updated, THE Audit_Logger SHALL record the event with action `PROFILE_UPDATE`, entity `USER`, and a metadata object listing the changed field names.
8. THE existing IP auto-blocking mechanism (based on `LoginLog` failed-login counts) SHALL continue to apply to the login endpoint without modification.
9. IF a profile picture upload is rejected due to invalid MIME type or file size exceeding 5 MB, THEN THE Audit_Logger SHALL record the event with action `UPLOAD_REJECTED` and metadata including the rejection reason.

---

### Requirement 9: Frontend Pages and UI

**User Story:** As a user, I want all new pages (updated register, profile, settings/password, forgot/reset password) to match the existing URIS design system, so that the experience is visually consistent and mobile-friendly.

#### Acceptance Criteria

1. THE Registration_Form SHALL be updated to include fields for date of birth, joining date, profile picture upload (accepting JPEG, PNG, WebP files up to 5 MB, with preview), and GDoc URL while preserving the existing glass-card, gold-accent, navy-background design.
2. THE Registration_Form role selector SHALL offer only `TECHNICAL_INTERN` and `RESEARCH_INTERN` as selectable options; all other roles SHALL be removed from the public registration dropdown.
3. THE Profile_Page SHALL be accessible at `/profile` for authenticated users and SHALL display full name, email, role, joining date, profile picture, and GDoc URL with save and cancel controls for inline edits.
4. THE Settings_Page SHALL be accessible at `/settings` for authenticated users and SHALL include a "Change Password" section with current password verification, new password, and confirm new password fields, and SHALL display a success message upon completion.
5. THE Forgot_Password_Page SHALL be accessible at `/forgot-password` (unauthenticated) and SHALL match the existing auth page design (Starfield background, glass-card, gold accents).
6. THE Reset_Password_Page SHALL be accessible at `/reset-password` (unauthenticated, token passed as query parameter `token`) and SHALL match the existing auth page design; IF the token query parameter is absent, THEN THE Reset_Password_Page SHALL redirect to `/forgot-password`.
7. WHILE a profile picture is being uploaded, THE Profile_Page SHALL display a loading indicator and disable the upload button to prevent duplicate submissions.
8. IF a network or server error occurs during any form submission, THEN THE relevant page SHALL display a user-readable error message using the existing `extractErrorMessage` utility.
9. THE frontend pages SHALL be responsive and usable on mobile viewports (minimum 320 px width) with no horizontal overflow and touch-friendly input targets of at least 44 × 44 px.

---

### Requirement 10: Backend Schema and Service Updates

**User Story:** As a backend engineer, I want the Prisma schema, auth service, and supporting services updated to support all new fields and flows, so that the data model is consistent and the architecture remains clean.

#### Acceptance Criteria

1. THE Prisma `User` model SHALL be extended with fields: `profilePictureUrl` (String, optional), `dateOfBirth` (DateTime, optional), `joiningDate` (DateTime, optional).
2. THE Prisma `Intern` model SHALL be extended with fields: `gdocUrl` (String, optional), `lastGdocReminderSentAt` (DateTime, optional).
3. THE Prisma schema SHALL include a `PasswordResetToken` model with fields: `id` (UUID, default `uuid()`), `userId` (String, FK to User with cascade delete), `tokenHash` (String, unique), `expiresAt` (DateTime), `usedAt` (DateTime, optional), `createdAt` (DateTime, default `now()`).
4. WHEN the Auth_Service `register` function is called, THE Auth_Service SHALL accept and persist `dateOfBirth` and `joiningDate` on the User record; IF the registering role is an intern role, THEN THE Auth_Service SHALL also persist `gdocUrl` on the associated Intern record; IF the role is not an intern role, THEN `gdocUrl` SHALL be ignored.
5. THE scheduler (`scheduler.js`) SHALL be extended to register the GDoc_Reminder_Job using the `GDOC_REMINDER_CRON` environment variable; IF the value is missing or an invalid cron expression, THE scheduler SHALL fall back to `0 9 */3 * *` and log a warning.
6. THE `GDOC_REMINDER_CRON`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` environment variables SHALL be documented in `.env.example` as commented-out entries with inline annotations indicating which are required and which are optional.
7. THE Upload_Service SHALL store uploaded profile pictures in a configurable local directory (default: `uploads/profile-pictures/`) and serve them via a static file route at `/uploads`; IF the upload directory does not exist at startup, THE Upload_Service SHALL create it automatically.
8. THE Upload_Service SHALL validate uploaded files for both MIME type (magic bytes: `image/jpeg`, `image/png`, `image/webp`) and file size (maximum 5 MB) before persisting; IF either check fails, THE Upload_Service SHALL return HTTP 422 without writing to disk.
9. IF the application starts in production (`NODE_ENV=production`) and `SMTP_HOST` is not set, THEN THE application SHALL log a warning at startup but SHALL NOT throw a startup error, preserving deployability in environments where email is not yet configured.
