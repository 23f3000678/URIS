const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { normalizeRole }  = require('../constants/roles');
const { logAction }      = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');
const { trackActivity }  = require('../utils/activityTracker');
const { ACTIVITY_TYPES } = require('../constants/activityTypes');

const SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Server cannot start.');
}

// ── Register ──────────────────────────────────────────────────────────────────

async function register({ name, email, password, role }) {
  const prismaRole = normalizeRole(role ?? 'intern');
  if (!prismaRole) {
    const err = new Error(`Invalid role "${role}". Accepted values: intern, admin.`);
    err.status = 400;
    throw err;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.status = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // All new registrations (Admins, Leads, Interns) start as 'pending'.
  // They must be approved by an existing Admin or Lead via the dashboard.
  const status = 'pending';

  // Derive a display name: use the provided name if non-empty, otherwise fall
  // back to the email prefix so existing behaviour is preserved.
  const displayName = (typeof name === 'string' && name.trim())
    ? name.trim()
    : email.split('@')[0];

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name: displayName, role: prismaRole, status },
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
  });

  void logAction(user.id, AUDIT_ACTIONS.REGISTER, AUDIT_ENTITIES.USER, user.id, {
    email:  user.email,
    role:   user.role,
    status: user.status,
  });

  // Pending admin/lead accounts: return no token — they cannot log in until approved.
  if (status === 'pending') {
    return { pending: true, user: { email: user.email, role: user.role.toLowerCase() } };
  }

  // Auto-create an Intern record for intern-role users
  if (prismaRole.includes('INTERN')) {
    // Generate a simple slug from name: "John Doe" -> "john-doe"
    const baseSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    await prisma.intern.create({ 
      data: { 
        userId: user.id,
        slug: slug
      } 
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  return {
    token,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role.toLowerCase(),
    },
  };
}

// ── Login ─────────────────────────────────────────────────────────────────────

// Configurable thresholds (env vars allow tuning without code changes)
const FAILED_LOGIN_THRESHOLD = parseInt(process.env.FAILED_LOGIN_THRESHOLD, 10) || 5;
const FAILED_LOGIN_WINDOW_MS  = parseInt(process.env.FAILED_LOGIN_WINDOW_MS,  10) || 15 * 60 * 1000; // 15 min
const IP_BLOCK_DURATION_MS    = parseInt(process.env.IP_BLOCK_DURATION_MS,    10) || 30 * 60 * 1000; // 30 min

/**
 * Check recent failed logins for an IP and auto-block if threshold exceeded.
 * Fire-and-forget — never throws, never blocks the login response.
 *
 * @param {string} ip
 */
async function checkAndAutoBlockIP(ip) {
  try {
    if (!ip || ip === '0.0.0.0' || ip === 'unknown') return;

    const windowStart = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);

    const recentFailures = await prisma.loginLog.count({
      where: {
        ipAddress: ip,
        success:   false,
        createdAt: { gte: windowStart },
      },
    });

    if (recentFailures >= FAILED_LOGIN_THRESHOLD) {
      const expiresAt = new Date(Date.now() + IP_BLOCK_DURATION_MS);

      // Upsert so repeated failures just refresh the expiry
      await prisma.blockedIP.upsert({
        where:  { ipAddress: ip },
        update: { expiresAt, reason: `Auto-blocked: ${recentFailures} failed logins within ${FAILED_LOGIN_WINDOW_MS / 60000} minutes`, blockedAt: new Date() },
        create: { ipAddress: ip, expiresAt, reason: `Auto-blocked: ${recentFailures} failed logins within ${FAILED_LOGIN_WINDOW_MS / 60000} minutes` },
      });

      // Evict from cache so the block takes effect immediately
      const { invalidateCache } = require('../middleware/ipBlock.middleware');
      invalidateCache(ip);

      const logger = require('../utils/logger');
      logger.warn({ ip, recentFailures }, 'IP auto-blocked due to repeated failed logins');
    }
  } catch {
    // Non-fatal — if the DB is unavailable, skip auto-blocking silently
  }
}

async function login({ email, password, ip = '0.0.0.0' }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const invalidErr = new Error('Invalid email or password.');
  invalidErr.status = 401;

  if (!user) {
    void prisma.loginLog.create({ data: { email, ipAddress: ip, success: false } }).catch(() => {});
    void checkAndAutoBlockIP(ip);
    throw invalidErr;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    void prisma.loginLog.create({ data: { email, ipAddress: ip, success: false } }).catch(() => {});
    void checkAndAutoBlockIP(ip);
    throw invalidErr;
  }

  // Block pending accounts
  if (user.status === 'pending') {
    const pendingErr = new Error('Your account is pending approval. Please wait for a Core Admin to approve your access.');
    pendingErr.status = 403;
    throw pendingErr;
  }

  // Block alumni (Past Employees) from internal dashboard
  if (user.status === 'alumni' || user.role === 'PAST_EMPLOYEE') {
    const alumniErr = new Error('Your internship has concluded. You no longer have access to the internal dashboard.');
    alumniErr.status = 403;
    throw alumniErr;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  const result = {
    token,
    user: {
      id:    user.id,
      name:  user.name || user.email.split('@')[0],  // fallback for legacy rows without a name
      email: user.email,
      role:  user.role.toLowerCase(),
    },
  };

  // Fire-and-forget: login log + audit log + activity tracking
  void prisma.loginLog.create({ data: { email, ipAddress: ip, success: true } }).catch(() => {});
  void logAction(user.id, AUDIT_ACTIONS.LOGIN, AUDIT_ENTITIES.USER, user.id, {
    email: user.email,
  });
  void trackActivity(user.id, ACTIVITY_TYPES.LOGIN);

  return result;
}

module.exports = { register, login };
