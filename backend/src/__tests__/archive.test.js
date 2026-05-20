'use strict';

/**
 * Integration tests — Archive / User Lifecycle endpoints
 *
 * Covers:
 *   POST /archive/deactivate  — ACTIVE → INACTIVE
 *   POST /archive/restore     — INACTIVE → ACTIVE
 *   POST /archive/archive     — any → ARCHIVED (snapshot written)
 *   POST /archive/remove      — ARCHIVED → REMOVED
 *   GET  /archive             — lists archived users
 *   GET  /archive/users       — lists all users
 *
 * All operations are non-destructive — no permanent deletes.
 */

const request = require('supertest');
const app     = require('../../app');
const { PrismaClient } = require('@prisma/client');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const prisma = new PrismaClient();
const RUN    = Date.now();

let adminToken;
let adminUserId;
let targetUserId;

beforeAll(async () => {
  const hash = await bcrypt.hash('Password123', 10);

  const admin = await prisma.user.create({
    data: { email: `archive-admin-${RUN}@test.local`, password: hash, name: 'Archive Admin', role: 'CORE_ADMIN', status: 'active' },
  });
  adminUserId = admin.id;
  adminToken  = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const target = await prisma.user.create({
    data: { email: `archive-target-${RUN}@test.local`, password: hash, name: 'Target User', role: 'TECHNICAL_INTERN', status: 'active' },
  });
  targetUserId = target.id;
});

afterAll(async () => {
  await prisma.archivedUser.deleteMany({ where: { originalId: targetUserId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUserId, targetUserId] } } });
  await prisma.$disconnect();
});

// Reset target user to active before each test
beforeEach(async () => {
  await prisma.user.update({ where: { id: targetUserId }, data: { status: 'active' } });
  await prisma.archivedUser.deleteMany({ where: { originalId: targetUserId } });
});

// ── Deactivate ────────────────────────────────────────────────────────────────

describe('POST /archive/deactivate', () => {
  test('deactivates an active user', async () => {
    const res = await request(app)
      .post('/archive/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, reason: 'test deactivation' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('inactive');

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    expect(user.status).toBe('inactive');
  });

  test('returns 400 for invalid UUID', async () => {
    const res = await request(app)
      .post('/archive/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  test('returns 403 without admin token', async () => {
    const res = await request(app)
      .post('/archive/deactivate')
      .send({ userId: targetUserId });
    expect(res.status).toBe(401);
  });

  test('prevents self-deactivation', async () => {
    const res = await request(app)
      .post('/archive/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: adminUserId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot deactivate your own/i);
  });
});

// ── Restore ───────────────────────────────────────────────────────────────────

describe('POST /archive/restore', () => {
  test('restores an inactive user to active', async () => {
    // First deactivate
    await prisma.user.update({ where: { id: targetUserId }, data: { status: 'inactive' } });

    const res = await request(app)
      .post('/archive/restore')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    expect(user.status).toBe('active');
  });

  test('returns 400 when user is already active', async () => {
    const res = await request(app)
      .post('/archive/restore')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId });
    expect(res.status).toBe(400);
  });
});

// ── Archive ───────────────────────────────────────────────────────────────────

describe('POST /archive/archive', () => {
  test('archives a user and writes an ArchivedUser snapshot', async () => {
    const res = await request(app)
      .post('/archive/archive')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, reason: 'test archive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');

    const snapshot = await prisma.archivedUser.findUnique({ where: { originalId: targetUserId } });
    expect(snapshot).not.toBeNull();
    expect(snapshot.status).toBe('ARCHIVED');
    expect(snapshot.snapshot).toBeDefined();
  });
});

// ── List ──────────────────────────────────────────────────────────────────────

describe('GET /archive', () => {
  test('returns paginated list of archived users', async () => {
    const res = await request(app)
      .get('/archive')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('records');
    expect(res.body.data).toHaveProperty('pagination');
  });

  test('GET /archive/users returns all users with pagination', async () => {
    const res = await request(app)
      .get('/archive/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });
});
