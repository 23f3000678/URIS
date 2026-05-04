'use strict';

/**
 * Unit tests for businessRules.js
 *
 * Prisma is mocked so no database connection is required.
 * Each test controls exactly what the DB "returns" via jest.fn() mocks.
 */

// ── Mock Prisma before requiring businessRules ────────────────────────────────

jest.mock('../../utils/prisma', () => ({
  task:   { findUnique: jest.fn() },
  intern: { findUnique: jest.fn() },
  review: { findFirst: jest.fn() },
}));

const prisma = require('../../utils/prisma');
const {
  validateTaskCreation,
  validateReviewSubmission,
  validateAvailabilitySubmission,
  validateTaskAssignment,
} = require('../businessRules');

// Helper: reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ── validateAvailabilitySubmission (pure — no DB) ─────────────────────────────

describe('validateAvailabilitySubmission', () => {
  const MONDAY    = '2026-05-04'; // a known Monday
  const NEXT_MON  = '2026-05-11'; // exactly 7 days later

  describe('maxFreeBlockHours validation', () => {
    test('accepts valid integer values 1–6', () => {
      for (const h of [1, 2, 3, 4, 5, 6]) {
        expect(validateAvailabilitySubmission({ maxFreeBlockHours: h }).ok).toBe(true);
      }
    });

    test('rejects 0', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 0 });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/maxFreeBlockHours/);
    });

    test('rejects 7', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 7 });
      expect(r.ok).toBe(false);
    });

    test('rejects non-integer (float)', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 2.5 });
      expect(r.ok).toBe(false);
    });

    test('rejects string', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: '3' });
      expect(r.ok).toBe(false);
    });
  });

  describe('weekStart validation', () => {
    test('accepts a Monday', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, weekStart: MONDAY });
      expect(r.ok).toBe(true);
    });

    test('rejects a non-Monday (Tuesday)', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, weekStart: '2026-05-05' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Monday/);
    });

    test('skips weekStart check when not provided', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3 });
      expect(r.ok).toBe(true);
    });
  });

  describe('weekEnd validation', () => {
    test('accepts weekEnd exactly 7 days after weekStart', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, weekStart: MONDAY, weekEnd: NEXT_MON });
      expect(r.ok).toBe(true);
    });

    test('rejects weekEnd that is 6 days after weekStart', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, weekStart: MONDAY, weekEnd: '2026-05-10' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/7 days/);
    });

    test('rejects weekEnd that is 8 days after weekStart', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, weekStart: MONDAY, weekEnd: '2026-05-12' });
      expect(r.ok).toBe(false);
    });
  });

  describe('busyBlocks validation', () => {
    test('accepts a valid busy block', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MON', reason_code: 'Exam' }],
      });
      expect(r.ok).toBe(true);
    });

    test('rejects an invalid day', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MONDAY', reason_code: 'Exam' }],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/day/);
    });

    test('rejects an invalid reason_code', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MON', reason_code: 'Holiday' }],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/reason_code/);
    });

    test('rejects duplicate days', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [
          { day: 'MON', reason_code: 'Exam' },
          { day: 'MON', reason_code: 'Revision' },
        ],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/Duplicate/);
    });

    test('accepts all valid days without duplicates', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [
          { day: 'MON', reason_code: 'Exam' },
          { day: 'TUE', reason_code: 'Revision' },
          { day: 'WED', reason_code: 'Sprint' },
        ],
      });
      expect(r.ok).toBe(true);
    });

    test('rejects invalid HH:MM start time', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MON', reason_code: 'Exam', start: '9:00', end: '11:00' }],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/HH:MM/);
    });

    test('rejects start time not before end time', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MON', reason_code: 'Exam', start: '11:00', end: '09:00' }],
      });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/before/);
    });

    test('accepts valid HH:MM time range', () => {
      const r = validateAvailabilitySubmission({
        maxFreeBlockHours: 3,
        busyBlocks: [{ day: 'MON', reason_code: 'Exam', start: '09:00', end: '11:00' }],
      });
      expect(r.ok).toBe(true);
    });

    test('accepts empty busyBlocks array', () => {
      const r = validateAvailabilitySubmission({ maxFreeBlockHours: 3, busyBlocks: [] });
      expect(r.ok).toBe(true);
    });
  });
});

// ── validateTaskCreation (async — mocks DB) ───────────────────────────────────

describe('validateTaskCreation', () => {
  const VALID_INTERN_ID    = 'intern-uuid-001';
  const VALID_PLANE_TASK   = 'plane-task-001';
  const FUTURE_DATE        = '2099-12-31';

  function mockInternExists()    { prisma.intern.findUnique.mockResolvedValue({ id: VALID_INTERN_ID }); }
  function mockInternMissing()   { prisma.intern.findUnique.mockResolvedValue(null); }
  function mockTaskIdFree()      { prisma.task.findUnique.mockResolvedValue(null); }
  function mockTaskIdTaken()     { prisma.task.findUnique.mockResolvedValue({ id: 'existing' }); }

  test('returns ok:true for a fully valid input', async () => {
    mockTaskIdFree();
    mockInternExists();
    const r = await validateTaskCreation({
      complexity: 3,
      deadline: FUTURE_DATE,
      planeTaskId: VALID_PLANE_TASK,
      internId: VALID_INTERN_ID,
    });
    expect(r.ok).toBe(true);
  });

  describe('complexity validation', () => {
    test('rejects complexity 0', async () => {
      const r = await validateTaskCreation({ complexity: 0, planeTaskId: 'x', internId: 'y' });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/complexity/);
    });

    test('rejects complexity 6', async () => {
      const r = await validateTaskCreation({ complexity: 6, planeTaskId: 'x', internId: 'y' });
      expect(r.ok).toBe(false);
    });

    test('rejects float complexity', async () => {
      const r = await validateTaskCreation({ complexity: 2.5, planeTaskId: 'x', internId: 'y' });
      expect(r.ok).toBe(false);
    });

    test('accepts complexity 1–5', async () => {
      for (const c of [1, 2, 3, 4, 5]) {
        mockTaskIdFree();
        mockInternExists();
        const r = await validateTaskCreation({ complexity: c, planeTaskId: `pt-${c}`, internId: VALID_INTERN_ID });
        expect(r.ok).toBe(true);
      }
    });
  });

  describe('deadline validation', () => {
    test('rejects a past deadline', async () => {
      const r = await validateTaskCreation({ complexity: 3, deadline: '2000-01-01', planeTaskId: 'x', internId: 'y' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/deadline/);
    });

    test('accepts a future deadline', async () => {
      mockTaskIdFree();
      mockInternExists();
      const r = await validateTaskCreation({ complexity: 3, deadline: FUTURE_DATE, planeTaskId: VALID_PLANE_TASK, internId: VALID_INTERN_ID });
      expect(r.ok).toBe(true);
    });

    test('accepts no deadline (optional field)', async () => {
      mockTaskIdFree();
      mockInternExists();
      const r = await validateTaskCreation({ complexity: 3, planeTaskId: VALID_PLANE_TASK, internId: VALID_INTERN_ID });
      expect(r.ok).toBe(true);
    });
  });

  describe('planeTaskId uniqueness', () => {
    test('rejects a duplicate planeTaskId', async () => {
      mockTaskIdTaken();
      const r = await validateTaskCreation({ complexity: 3, planeTaskId: VALID_PLANE_TASK, internId: VALID_INTERN_ID });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(409);
      expect(r.message).toMatch(/already exists/);
    });
  });

  describe('intern existence', () => {
    test('rejects a non-existent internId', async () => {
      mockTaskIdFree();
      mockInternMissing();
      const r = await validateTaskCreation({ complexity: 3, planeTaskId: VALID_PLANE_TASK, internId: 'ghost-id' });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(404);
      expect(r.message).toMatch(/does not exist/);
    });
  });
});

// ── validateReviewSubmission (async — mocks DB) ───────────────────────────────

describe('validateReviewSubmission', () => {
  const INTERN_ID = 'intern-uuid-001';
  const TASK_ID   = 'task-uuid-001';

  function mockCompletedTask() {
    prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'completed', internId: INTERN_ID });
  }
  function mockActiveTask() {
    prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'active', internId: INTERN_ID });
  }
  function mockTaskMissing() {
    prisma.task.findUnique.mockResolvedValue(null);
  }
  function mockWrongInternTask() {
    prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'completed', internId: 'other-intern' });
  }

  const VALID_SCORES = { qualityScore: 4, timelinessScore: 3, independenceScore: 5 };

  test('returns ok:true for a fully valid submission', async () => {
    mockCompletedTask();
    prisma.review.findFirst.mockResolvedValue(null);
    const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...VALID_SCORES });
    expect(r.ok).toBe(true);
  });

  describe('score range validation', () => {
    test.each([
      ['qualityScore',      { qualityScore: 0,      timelinessScore: 3, independenceScore: 3 }],
      ['qualityScore',      { qualityScore: 6,      timelinessScore: 3, independenceScore: 3 }],
      ['timelinessScore',   { qualityScore: 3,      timelinessScore: 0, independenceScore: 3 }],
      ['independenceScore', { qualityScore: 3,      timelinessScore: 3, independenceScore: 6 }],
    ])('rejects %s out of range', async (field, scores) => {
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...scores });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
      expect(r.message).toMatch(new RegExp(field));
    });

    test('rejects float scores', async () => {
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, qualityScore: 3.5, timelinessScore: 3, independenceScore: 3 });
      expect(r.ok).toBe(false);
    });
  });

  describe('task existence', () => {
    test('rejects when task does not exist', async () => {
      mockTaskMissing();
      const r = await validateReviewSubmission({ taskId: 'ghost', internId: INTERN_ID, ...VALID_SCORES });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(404);
    });
  });

  describe('task status', () => {
    test('rejects review for a non-completed task', async () => {
      mockActiveTask();
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...VALID_SCORES });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(422);
      expect(r.message).toMatch(/not completed/);
    });
  });

  describe('intern ownership', () => {
    test('rejects when internId does not match task assignee', async () => {
      mockWrongInternTask();
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...VALID_SCORES });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(422);
      expect(r.message).toMatch(/does not match/);
    });
  });

  describe('duplicate review prevention', () => {
    test('rejects when a review for the same task already exists', async () => {
      mockCompletedTask();
      prisma.review.findFirst.mockResolvedValue({ id: 'existing-review' });
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...VALID_SCORES });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(409);
      expect(r.message).toMatch(/already been submitted/);
    });

    test('allows submission when no prior review exists for the task', async () => {
      mockCompletedTask();
      prisma.review.findFirst.mockResolvedValue(null);
      const r = await validateReviewSubmission({ taskId: TASK_ID, internId: INTERN_ID, ...VALID_SCORES });
      expect(r.ok).toBe(true);
    });
  });
});

// ── validateTaskAssignment (async — mocks DB) ─────────────────────────────────

describe('validateTaskAssignment', () => {
  const INTERN_ID = 'intern-uuid-001';
  const TASK_ID   = 'task-uuid-001';

  function mockInternExists()  { prisma.intern.findUnique.mockResolvedValue({ id: INTERN_ID }); }
  function mockInternMissing() { prisma.intern.findUnique.mockResolvedValue(null); }
  function mockActiveTask()    { prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'active',    internId: 'other-intern' }); }
  function mockCompletedTask() { prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'completed', internId: 'other-intern' }); }
  function mockTaskMissing()   { prisma.task.findUnique.mockResolvedValue(null); }
  function mockAlreadyAssigned() { prisma.task.findUnique.mockResolvedValue({ id: TASK_ID, status: 'active', internId: INTERN_ID }); }

  test('returns ok:true for a valid assignment', async () => {
    mockInternExists();
    mockActiveTask();
    const r = await validateTaskAssignment({ internId: INTERN_ID, taskId: TASK_ID });
    expect(r.ok).toBe(true);
    expect(r.task).toBeDefined();
    expect(r.intern).toBeDefined();
  });

  test('rejects when intern does not exist', async () => {
    mockInternMissing();
    const r = await validateTaskAssignment({ internId: 'ghost', taskId: TASK_ID });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.message).toMatch(/does not exist/);
  });

  test('rejects when task does not exist', async () => {
    mockInternExists();
    mockTaskMissing();
    const r = await validateTaskAssignment({ internId: INTERN_ID, taskId: 'ghost' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  test('rejects duplicate assignment (task already assigned to same intern)', async () => {
    mockInternExists();
    mockAlreadyAssigned();
    const r = await validateTaskAssignment({ internId: INTERN_ID, taskId: TASK_ID });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(409);
    expect(r.message).toMatch(/already assigned/);
  });

  test('rejects assignment of a completed task', async () => {
    mockInternExists();
    mockCompletedTask();
    const r = await validateTaskAssignment({ internId: INTERN_ID, taskId: TASK_ID });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(422);
    expect(r.message).toMatch(/completed/);
  });
});
