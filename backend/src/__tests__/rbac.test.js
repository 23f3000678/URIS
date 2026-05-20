'use strict';

/**
 * Integration tests — RBAC middleware
 *
 * Verifies that role-based access control is enforced correctly:
 *   - Admin-only endpoints reject intern tokens with 403
 *   - Intern-only endpoints reject admin tokens with 403
 *   - All protected endpoints reject missing/invalid tokens with 401
 *   - CORE_ADMIN can access all admin endpoints
 */

const request = require('supertest');
const app     = require('../../app');
const { PrismaClient } = require('@prisma/client');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const prisma = new PrismaClient();
const RUN    = Date.now();

let adminToken;
let internToken;
let adminUserId;
let internUserId;
let internInternId;

beforeAll(async () => {
  const hash = await bcrypt.hash('Password123', 10);

  // Create active admin
  const admin = await prisma.user.create({
    data: { email: `rbac-admin-${RUN}@test.local`, password: hash, name: 'RBAC Admin', role: 'CORE_ADMIN', status: 'active' },
  });
  adminUserId = admin.id;
  adminToken  = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Create active intern
  const intern = await prisma.user.create({
    data: { email: `rbac-intern-${RUN}@test.local`, password: hash, name: 'RBAC Intern', role: 'TECHNICAL_INTERN', status: 'active' },
  });
  internUserId = intern.id;
  internToken  = jwt.sign({ id: intern.id, email: intern.email, role: intern.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const internRecord = await prisma.intern.create({ data: { userId: intern.id } });
  internInternId = internRecord.id;
});

afterAll(async () => {
  await prisma.intern.deleteMany({ where: { userId: internUserId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUserId, internUserId] } } });
  await prisma.$disconnect();
});

// ── Admin-only endpoints ──────────────────────────────────────────────────────

describe('Admin-only endpoints', () => {
  test('GET /admin/overview — allows CORE_ADMIN', async () => {
    const res = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /admin/overview — rejects TECHNICAL_INTERN with 403', async () => {
    const res = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${internToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('GET /admin/pending-users — rejects missing token with 401', async () => {
    const res = await request(app).get('/admin/pending-users');
    expect(res.status).toBe(401);
  });

  test('GET /admin/blocked-ips — allows CORE_ADMIN', async () => {
    const res = await request(app)
      .get('/admin/blocked-ips')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /admin/blocked-ips — rejects TECHNICAL_INTERN with 403', async () => {
    const res = await request(app)
      .get('/admin/blocked-ips')
      .set('Authorization', `Bearer ${internToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /archive — rejects TECHNICAL_INTERN with 403', async () => {
    const res = await request(app)
      .get('/archive')
      .set('Authorization', `Bearer ${internToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Intern-only endpoints ─────────────────────────────────────────────────────

describe('Intern-only endpoints', () => {
  test('PATCH /tasks/:id/progress — rejects CORE_ADMIN with 403', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000/progress')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ progressPct: 50 });
    // 403 because admin role is not in INTERN_ROLES
    expect(res.status).toBe(403);
  });
});

// ── Token validation ──────────────────────────────────────────────────────────

describe('Token validation', () => {
  test('returns 401 for malformed token', async () => {
    const res = await request(app)
      .get('/admin/overview')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  test('returns 401 for expired token', async () => {
    const expired = jwt.sign(
      { id: adminUserId, email: 'x@x.com', role: 'CORE_ADMIN' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 for missing Authorization header', async () => {
    const res = await request(app).get('/admin/overview');
    expect(res.status).toBe(401);
  });
});
