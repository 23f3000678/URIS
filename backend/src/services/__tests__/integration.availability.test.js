'use strict';

/**
 * Integration test — Availability pipeline
 *
 * Verifies that submitting availability via processAvailability() results in
 * an AvailabilitySlot row being created (or updated) in the real database.
 *
 * This test caught bug M-3 (availability slot not persisted) in the audit.
 *
 * Setup:
 *   - Creates a real Intern row with a unique ID before each test.
 *   - Deletes all created rows in afterEach so the DB stays clean.
 *
 * The test uses processAvailability() from availability.service.js directly
 * (service-layer integration) rather than going through the HTTP layer, which
 * keeps it fast and avoids needing a running Express server.
 */

const { PrismaClient } = require('@prisma/client');
const { processAvailability } = require('../availability.service');

const prisma = new PrismaClient();

// Unique intern ID per test run so parallel runs don't collide
const TEST_INTERN_ID = `test-avail-${Date.now()}`;
const WEEK_START     = '2099-01-06'; // a Monday far in the future
const WEEK_END       = '2099-01-13'; // exactly 7 days later

// A valid busy block — validate.js requires start + end in HH:MM format
const BUSY_BLOCK_MON = { day: 'MON', reason_code: 'Exam',     start: '09:00', end: '11:00' };
const BUSY_BLOCK_TUE = { day: 'TUE', reason_code: 'Revision', start: '14:00', end: '16:00' };

beforeAll(async () => {
  // Create the Intern row the availability slot will reference
  await prisma.intern.upsert({
    where:  { id: TEST_INTERN_ID },
    update: {},
    create: { id: TEST_INTERN_ID },
  });
});

afterAll(async () => {
  // Clean up in dependency order: slots → score history → intern
  await prisma.availabilitySlot.deleteMany({ where: { internId: TEST_INTERN_ID } });
  await prisma.scoreHistory.deleteMany({ where: { internId: TEST_INTERN_ID } });
  await prisma.intern.deleteMany({ where: { id: TEST_INTERN_ID } });
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Availability pipeline — AvailabilitySlot persistence', () => {
  afterEach(async () => {
    // Remove the slot after each test so the next test starts clean
    await prisma.availabilitySlot.deleteMany({ where: { internId: TEST_INTERN_ID } });
  });

  test('creates an AvailabilitySlot row when availability is submitted', async () => {
    const result = await processAvailability({
      internId:          TEST_INTERN_ID,
      weekStart:         WEEK_START,
      weekEnd:           WEEK_END,
      busyBlocks:        [BUSY_BLOCK_MON],
      maxFreeBlockHours: 3,
    });

    // Service should return the persisted slot data
    expect(result.submissionId).toBeDefined();
    expect(result.internId).toBe(TEST_INTERN_ID);

    // Verify the row actually exists in the DB
    const slot = await prisma.availabilitySlot.findUnique({
      where: {
        internId_weekStart: {
          internId:  TEST_INTERN_ID,
          weekStart: new Date(WEEK_START),
        },
      },
    });

    expect(slot).not.toBeNull();
    expect(slot.internId).toBe(TEST_INTERN_ID);
    expect(slot.maxFreeBlockHours.toString()).toBe('3');
    expect(slot.busyBlocks).toEqual([BUSY_BLOCK_MON]);
  });

  test('updates an existing AvailabilitySlot on re-submission (upsert)', async () => {
    // First submission
    await processAvailability({
      internId:          TEST_INTERN_ID,
      weekStart:         WEEK_START,
      weekEnd:           WEEK_END,
      busyBlocks:        [],
      maxFreeBlockHours: 2,
    });

    // Second submission for the same week — should update, not duplicate
    await processAvailability({
      internId:          TEST_INTERN_ID,
      weekStart:         WEEK_START,
      weekEnd:           WEEK_END,
      busyBlocks:        [BUSY_BLOCK_TUE],
      maxFreeBlockHours: 3,
    });

    const slots = await prisma.availabilitySlot.findMany({
      where: { internId: TEST_INTERN_ID },
    });

    // Must be exactly one row — upsert, not insert
    expect(slots).toHaveLength(1);
    expect(slots[0].maxFreeBlockHours.toString()).toBe('3');
    expect(slots[0].busyBlocks).toEqual([BUSY_BLOCK_TUE]);
  });

  test('stores busyBlocks as JSON and retrieves them correctly', async () => {
    const busyBlocks = [BUSY_BLOCK_MON, BUSY_BLOCK_TUE];

    await processAvailability({
      internId:          TEST_INTERN_ID,
      weekStart:         WEEK_START,
      weekEnd:           WEEK_END,
      busyBlocks,
      maxFreeBlockHours: 3,
    });

    const slot = await prisma.availabilitySlot.findUnique({
      where: {
        internId_weekStart: {
          internId:  TEST_INTERN_ID,
          weekStart: new Date(WEEK_START),
        },
      },
    });

    expect(slot.busyBlocks).toEqual(busyBlocks);
  });
});
