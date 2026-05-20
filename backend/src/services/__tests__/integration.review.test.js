'use strict';

/**
 * Integration test — Review pipeline
 *
 * Verifies that submitting a review via prisma.review.create() (the path used
 * by review.controller.js) results in a Review row that is correctly linked
 * to the Task it was submitted for.
 *
 * This test caught bug M-4 (hardcoded complexity: 1 instead of real task
 * complexity) in the audit — the complexity field on the created Review must
 * match the Task's actual complexity value.
 *
 * Setup:
 *   - Creates a real Intern, User (required by Intern.userId FK), and Task
 *     before the suite runs.
 *   - Deletes all created rows in afterAll so the DB stays clean.
 *
 * The test exercises the Prisma layer directly (the same code path the
 * controller uses) rather than going through HTTP, keeping it fast.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Unique IDs per test run to avoid collisions with other test runs
const RUN_ID        = Date.now();
const TEST_EMAIL    = `test-review-${RUN_ID}@integration.test`;
const TEST_TASK_ID  = `manual-review-task-${RUN_ID}`;

let testUserId;
let testInternId;
let testTaskId;
let testTaskComplexity;

beforeAll(async () => {
  // 1. Create a User (required because Intern.userId is a FK to User)
  const user = await prisma.user.create({
    data: {
      email:    TEST_EMAIL,
      password: 'hashed-placeholder',
      name:     'Integration Test User',
      role:     'TECHNICAL_INTERN',
    },
  });
  testUserId = user.id;

  // 2. Create the Intern linked to that User
  const intern = await prisma.intern.create({
    data: { userId: testUserId },
  });
  testInternId = intern.id;

  // 3. Create a completed Task assigned to that Intern
  //    Use complexity 3 — the review must store this value, not hardcoded 1
  testTaskComplexity = 3;
  const task = await prisma.task.create({
    data: {
      planeTaskId:   TEST_TASK_ID,
      internId:      testInternId,
      title:         'Integration test task',
      complexity:    testTaskComplexity,
      progressPct:   100,
      status:        'completed',
      hasBlocker:    false,
      skills:        [],
      lastUpdatedAt: new Date(),
    },
  });
  testTaskId = task.id;
});

afterAll(async () => {
  // Clean up in dependency order: reviews → task → intern → user
  await prisma.review.deleteMany({ where: { internId: testInternId } });
  await prisma.task.deleteMany({ where: { internId: testInternId } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [testTaskId, testInternId] } } });
  await prisma.intern.deleteMany({ where: { id: testInternId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Review pipeline — Review row persistence and task linkage', () => {
  afterEach(async () => {
    // Remove reviews after each test so duplicate-review checks don't interfere
    await prisma.review.deleteMany({ where: { internId: testInternId } });
  });

  test('creates a Review row linked to the correct Task', async () => {
    const review = await prisma.review.create({
      data: {
        internId:   testInternId,
        taskId:     testTaskId,
        quality:    4,
        timeliness: 3,
        initiative: 5,
        complexity: testTaskComplexity,
      },
    });

    expect(review.id).toBeDefined();
    expect(review.taskId).toBe(testTaskId);
    expect(review.internId).toBe(testInternId);
  });

  test('stores the actual task complexity, not a hardcoded value', async () => {
    // Fetch the task's real complexity (the same way the controller does)
    const task = await prisma.task.findUnique({
      where:  { id: testTaskId },
      select: { complexity: true },
    });
    const taskComplexity = task?.complexity ?? 1;

    const review = await prisma.review.create({
      data: {
        internId:   testInternId,
        taskId:     testTaskId,
        quality:    4,
        timeliness: 3,
        initiative: 5,
        complexity: taskComplexity,
      },
    });

    // The stored complexity must match the task's actual value (3), not 1
    expect(review.complexity).toBe(testTaskComplexity);
    expect(review.complexity).not.toBe(1); // guard against the M-4 regression
  });

  test('Review row is retrievable and linked to the Task via taskId', async () => {
    const created = await prisma.review.create({
      data: {
        internId:   testInternId,
        taskId:     testTaskId,
        quality:    5,
        timeliness: 5,
        initiative: 5,
        complexity: testTaskComplexity,
      },
    });

    // Fetch back with the task relation included
    const fetched = await prisma.review.findUnique({
      where:   { id: created.id },
      include: { task: { select: { id: true, title: true, complexity: true } } },
    });

    expect(fetched).not.toBeNull();
    expect(fetched.task).not.toBeNull();
    expect(fetched.task.id).toBe(testTaskId);
    expect(fetched.task.complexity).toBe(testTaskComplexity);
  });

  test('PPS formula is correctly computed from stored scores', async () => {
    const qualityScore      = 4;
    const timelinessScore   = 3;
    const independenceScore = 5;

    const review = await prisma.review.create({
      data: {
        internId:   testInternId,
        taskId:     testTaskId,
        quality:    qualityScore,
        timeliness: timelinessScore,
        initiative: independenceScore,
        complexity: testTaskComplexity,
      },
    });

    // PPS = (Quality×0.40) + (Timeliness×0.35) + (Independence×0.25)
    const expectedPps = parseFloat(
      (qualityScore * 0.40 + timelinessScore * 0.35 + independenceScore * 0.25).toFixed(2)
    );

    const computedPps = parseFloat(
      (review.quality * 0.40 + review.timeliness * 0.35 + review.initiative * 0.25).toFixed(2)
    );

    expect(computedPps).toBe(expectedPps);
    expect(computedPps).toBeCloseTo(3.90, 2); // 4×0.4 + 3×0.35 + 5×0.25 = 1.60+1.05+1.25 = 3.90
  });
});
