const { register, login } = require('../services/auth.service');
const { validateAuth }    = require('../utils/validate');
const { trackActivity }   = require('../utils/activityTracker');
const { logAction }       = require('../utils/auditLogger');
const { ok, created, validationError } = require('../utils/respond');
const { ACTIVITY_TYPES }  = require('../constants/activityTypes');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');

/**
 * POST /auth/register
 */
async function registerUser(req, res, next) {
  try {
    const name     = typeof req.body.name     === 'string' ? req.body.name.trim() : '';
    const email    = typeof req.body.email    === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role     = typeof req.body.role     === 'string' ? req.body.role.trim() : 'TECHNICAL_INTERN';
    const dateOfBirth = req.body.dateOfBirth || null;
    const joiningDate = req.body.joiningDate || null;
    const gdocUrl     = req.body.gdocUrl     || null;

    const errors = validateAuth({ email, password });
    if (errors.length > 0) {
      return validationError(res, errors[0]);
    }

    // Handle profile picture upload if file was attached
    let profilePictureUrl = null;
    if (req.file) {
      const uploadService = require('../services/upload.service');
      try {
        const result = await uploadService.validateAndStore(req.file.buffer, req.file.originalname, null);
        profilePictureUrl = result.profilePictureUrl;
      } catch (uploadErr) {
        return res.status(uploadErr.status || 422).json({
          success: false,
          message: uploadErr.message,
          data: null,
        });
      }
    }

    const user = await register({ name, email, password, role, dateOfBirth, joiningDate, gdocUrl, profilePictureUrl });

    return created(res, user, 'Account created successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 */
async function loginUser(req, res, next) {
  try {
    const email    = typeof req.body.email    === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const ip       = req.ip || req.socket?.remoteAddress || '0.0.0.0';

    const errors = validateAuth({ email, password });
    if (errors.length > 0) {
      return validationError(res, errors[0]);
    }

    const result = await login({ email, password, ip });

    return ok(res, result, 'Login successful.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 *
 * JWT is stateless — logout is client-side (clear the token).
 * This endpoint exists solely to record the logout event for activity tracking.
 * Requires a valid token so we know who is logging out.
 */
async function logoutUser(req, res) {
  const userId = req.user?.id;
  if (userId) {
    void trackActivity(userId, ACTIVITY_TYPES.LOGOUT);
    void logAction(userId, AUDIT_ACTIONS.LOGOUT, AUDIT_ENTITIES.USER, userId, {});
  }
  return ok(res, null, 'Logged out.');
}

/**
 * POST /auth/activity
 *
 * Called by the frontend to record a TASK_WORK or IDLE period.
 * Body: { type: 'TASK_WORK' | 'IDLE', duration: number (seconds) }
 */
async function recordActivity(req, res) {
  const userId   = req.user?.id;
  const { type, duration } = req.body;

  const allowed = [ACTIVITY_TYPES.TASK_WORK, ACTIVITY_TYPES.IDLE];
  if (!allowed.includes(type)) {
    return validationError(res, `type must be one of: ${allowed.join(', ')}`);
  }
  if (typeof duration !== 'number' || duration < 0) {
    return validationError(res, 'duration must be a non-negative number (seconds)');
  }

  void trackActivity(userId, type, Math.round(duration));
  return ok(res, null, 'Activity recorded.');
}

module.exports = { registerUser, loginUser, logoutUser, recordActivity };
