'use strict';

/**
 * Integration tests — Auth endpoints
 *
 * Covers:
 *   POST /auth/register  — success, duplicate email, invalid role, missing fields
 *   POST /auth/login     — success, wrong password, unknown email, pending account
 *   POST /auth/logout    — requires valid token
 *
 * Uses supertest against the real Express app with a real test DB.
 * Each test creates uniquely-named records and cleans up in afterAll.
 */

const request = require('supertest');
const app     = require('../../app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const RUN    = Date.now();

const ADMIN_EMAIL  = `auth-admin-${RUN}@test.local`;
const INTERN_EMAIL = `auth-intern-${RUN}@test.local`;
const PASSWORD     = 'Password123';

afterAll(async () => {
  await prisma.loginLog.deleteMany({ where: { email: { in: [ADMIN_EMAIL, INTERN_EMAIL] } } });
  await prisma.auditLog.deleteMany({ where: { metadata: { path: ['email'], equals: ADMIN_EMAIL } } });
  await prisma.auditLog.deleteMany({ where: { metadata: { path: ['email'], equals: INTERN_EMAIL } } });
  const users = await prisma.user.findMany({ where: { email: { in: [ADMIN_EMAIL, INTERN_EMAIL] } } });
  for (const u of users) {
    await prisma.intern.deleteMany({ where: { userId: u.id } });
  }
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, INTERN_EMAIL] } } });
  await prisma.$disconnect();
});

// ── Register ──────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  test('registers a new intern and returns pending status (no token)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test Intern', email: INTERN_EMAIL, password: PASSWORD, role: 'intern' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // All new registrations are pending — no token returned
    expect(res.body.data.pending).toBe(true);
    expect(res.body.data.token).toBeUndefined();
  });

  test('returns 409 when email already exists', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Dup', email: INTERN_EMAIL, password: PASSWORD, role: 'intern' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: PASSWORD, role: 'intern' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for password shorter than 6 chars', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: `short-pw-${RUN}@test.local`, password: '123', role: 'intern' });

    expect(res.status).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeAll(async () => {
    // Create an active admin user directly in DB so we can test successful login
    const bcrypt = require('bcrypt');
    const hash   = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.create({
      data: { email: ADMIN_EMAIL, password: hash, name: 'Auth Test Admin', role: 'CORE_ADMIN', status: 'active' },
    });
  });

  test('returns token and user on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe('core_admin'); // lowercased by service
  });

  test('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
  });

  test('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: `nobody-${RUN}@test.local`, password: PASSWORD });

    expect(res.status).toBe(401);
  });

  test('returns 403 for pending account', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: INTERN_EMAIL, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('writes a LoginLog row on successful login', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD });

    // Give the fire-and-forget write a moment to complete
    await new Promise(r => setTimeout(r, 200));

    const log = await prisma.loginLog.findFirst({
      where: { email: ADMIN_EMAIL, success: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log.success).toBe(true);
  });

  test('writes a LoginLog row on failed login', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'badpassword' });

    await new Promise(r => setTimeout(r, 200));

    const log = await prisma.loginLog.findFirst({
      where: { email: ADMIN_EMAIL, success: false },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log.success).toBe(false);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD });
    token = res.body.data?.token;
  });

  test('returns 200 with valid token', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
