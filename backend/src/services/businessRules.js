/**
 * businessRules.js
 *
 * Business-level validation that goes beyond schema shape checks.
 * These rules require database lookups or domain logic that Joi cannot express.
 *
 * Each function returns a { ok: true } on success, or
 * { ok: false, status: number, message: string } on failure.
 *
 * Controllers call these AFTER Joi schema validation passes.
 */

'use strict';

const prisma = require('../utils/prisma');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given date string represents a date strictly in the future
 * (i.e. after today's date in UTC, ignoring time).
 */
function isFutureDate(dateStr) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setUTCHours(0, 0, 0, 0);
  return target > today;
}

/**
 * Returns true if the given date string represents today or a future date.
 * Used for deadlines — same-day deadlines are allowed.
 */
function isTodayOrFuture(dateStr) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setUTCHours(0, 0, 0, 0);
  return target >= today;
}

const VALID_DAYS        = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const VALID_REASON_CODES = ['Exam', 'Revision', 'Academic Project', 'Personal', 'Sprint', 'Other'];
const HH_MM_RE           = /^\d{2}:\d{2}$/;

// ── Tasks ──────────────────────────────────────────────────────────────────────

/**
 * Validates business rules for task creation.
 *
 * Checks:
 *  1. complexity is an integer 1–5
 *  2. deadline is today or a future date
 *  3. planeTaskId is not already in use
 *  4. internId references a real intern record
 */
async function validateTaskCreation({ complexity, deadline, planeTaskId, internId }) {
  // 1. complexity must be integer 1–5
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 5) {
    return {
      ok:      false,
      status:  400,
      message: 'task_complexity must be an integer between 1 and 5',
    };
  }

  // 2. deadline must be today or in the future
  if (deadline && !isTodayOrFuture(deadline)) {
    return {
      ok:      false,
      status:  400,
      message: 'deadline must be today or a future date',
    };
  }

  // 3. planeTaskId must be unique (only checked when explicitly provided)
  if (planeTaskId) {
    const existing = await prisma.task.findUnique({ where: { planeTaskId } });
    if (existing) {
      return {
        ok:      false,
        status:  409,
        message: `A task with planeTaskId "${planeTaskId}" already exists`,
      };
    }
  }

  // 4. intern must exist
  const intern = await prisma.intern.findUnique({ where: { id: internId } });
  if (!intern) {
    return {
      ok:      false,
      status:  404,
      message: `Intern with id "${internId}" does not exist`,
    };
  }

  return { ok: true };
}

// ── Reviews ────────────────────────────────────────────────────────────────────

/**
 * Validates business rules for review submission.
 *
 * Checks:
 *  1. All scores are integers in range 1–5
 *  2. taskId references a real task
 *  3. The task must be in 'completed' status
 *  4. internId matches the task's assigned intern
 *  5. A review for this task does not already exist
 */
async function validateReviewSubmission({ taskId, internId, qualityScore, timelinessScore, independenceScore, user }) {
  const { ROLES } = require('../constants/roles');

  // 1. All scores must be integers 1–5
  const scores = { qualityScore, timelinessScore, independenceScore };
  for (const [field, value] of Object.entries(scores)) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return {
        ok:      false,
        status:  400,
        message: `${field} must be an integer between 1 and 5`,
      };
    }
  }

  // 2. Task must exist
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return {
      ok:      false,
      status:  404,
      message: `Task with id "${taskId}" does not exist`,
    };
  }

  // Role-based limited check: Operations Program Manager can only review operational tasks
  if (user && user.role === ROLES.OPERATIONS_PROGRAM_MANAGER) {
    if (!task.isOperational) {
      return {
        ok:      false,
        status:  403,
        message: 'Operations Program Manager can only review operational tasks',
      };
    }
  }

  // 3. Task must be completed
  if (task.status !== 'completed') {
    return {
      ok:      false,
      status:  422,
      message: `Cannot review a task that is not completed. Current status: "${task.status}"`,
    };
  }

  // 4. internId must match the task's assignee
  if (task.internId !== internId) {
    return {
      ok:      false,
      status:  422,
      message: 'internId does not match the intern assigned to this task',
    };
  }

  // 5. Prevent duplicate reviews for the same task
  const existingReview = await prisma.review.findFirst({ where: { taskId } });
  if (existingReview) {
    return {
      ok:      false,
      status:  409,
      message: `A review for task "${taskId}" has already been submitted`,
    };
  }

  return { ok: true };
}

// ── Availability ───────────────────────────────────────────────────────────────

/**
 * Validates business rules for availability submission.
 *
 * Checks:
 *  1. maxFreeBlockHours is an integer 1–6
 *  2. weekStart is a Monday
 *  3. weekEnd is exactly 7 days after weekStart
 *  4. Each busyBlock has a valid day, reason_code, and optional HH:MM times
 *  5. No duplicate day entries in busyBlocks
 *  6. If start/end times are provided, start must be before end
 */
function validateAvailabilitySubmission({ maxFreeBlockHours, weekStart, weekEnd, busyBlocks }) {
  // 1. maxFreeBlockHours must be integer 1–6
  if (!Number.isInteger(maxFreeBlockHours) || maxFreeBlockHours < 1 || maxFreeBlockHours > 6) {
    return {
      ok:      false,
      status:  400,
      message: 'maxFreeBlockHours must be an integer between 1 and 6',
    };
  }

  // 2. weekStart must be a Monday (getUTCDay() === 1)
  if (weekStart) {
    const startDate = new Date(weekStart);
    if (startDate.getUTCDay() !== 1) {
      return {
        ok:      false,
        status:  400,
        message: 'weekStart must be a Monday',
      };
    }
  }

  // 3. weekEnd must be exactly 7 days after weekStart
  if (weekStart && weekEnd) {
    const start   = new Date(weekStart);
    const end     = new Date(weekEnd);
    const diffMs  = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays !== 7) {
      return {
        ok:      false,
        status:  400,
        message: 'weekEnd must be exactly 7 days after weekStart',
      };
    }
  }

  // 4 & 5. Validate each busyBlock structure and check for duplicate days
  if (Array.isArray(busyBlocks)) {
    const seenDays = new Set();

    for (let i = 0; i < busyBlocks.length; i++) {
      const block  = busyBlocks[i];
      const prefix = `busyBlocks[${i}]`;

      if (!block.day || !VALID_DAYS.includes(block.day)) {
        return {
          ok:      false,
          status:  400,
          message: `${prefix}.day must be one of: ${VALID_DAYS.join(', ')}`,
        };
      }

      if (!block.reason_code || !VALID_REASON_CODES.includes(block.reason_code)) {
        return {
          ok:      false,
          status:  400,
          message: `${prefix}.reason_code must be one of: ${VALID_REASON_CODES.join(', ')}`,
        };
      }

      if (seenDays.has(block.day)) {
        return {
          ok:      false,
          status:  400,
          message: `Duplicate busy block for day "${block.day}". Each day may appear at most once`,
        };
      }
      seenDays.add(block.day);

      // 6. If time range provided, validate format and order
      if (block.start !== undefined || block.end !== undefined) {
        if (!HH_MM_RE.test(block.start)) {
          return {
            ok:      false,
            status:  400,
            message: `${prefix}.start must be in HH:MM format`,
          };
        }
        if (!HH_MM_RE.test(block.end)) {
          return {
            ok:      false,
            status:  400,
            message: `${prefix}.end must be in HH:MM format`,
          };
        }
        if (block.start >= block.end) {
          return {
            ok:      false,
            status:  400,
            message: `${prefix}.start must be before ${prefix}.end`,
          };
        }
      }
    }
  }

  return { ok: true };
}

// ── Assignment ─────────────────────────────────────────────────────────────────

/**
 * Validates business rules for task assignment.
 *
 * Checks:
 *  1. intern exists in the database
 *  2. task exists in the database
 *  3. task is not already assigned to this intern (duplicate assignment)
 *  4. task is not already completed
 */
async function validateTaskAssignment({ internId, taskId, user }) {
  const { ROLES } = require('../constants/roles');
  
  // 1. Intern must exist
  const intern = await prisma.intern.findUnique({ where: { id: internId } });
  if (!intern) {
    return {
      ok:      false,
      status:  404,
      message: `Intern with id "${internId}" does not exist`,
    };
  }

  // 2. Task must exist
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return {
      ok:      false,
      status:  404,
      message: `Task with id "${taskId}" does not exist`,
    };
  }

  // Role-based limited check: Collaborator Lead can only assign collaborator-linked tasks
  if (user && user.role === ROLES.COLLABORATOR_LEAD) {
    if (!task.collaboratorIds.includes(user.id)) {
      return {
        ok:      false,
        status:  403,
        message: 'Collaborator Lead can only assign tasks they are linked to as a collaborator',
      };
    }
  }

  // 3. Prevent duplicate assignment — task already assigned to this intern
  if (task.internId === internId) {
    return {
      ok:      false,
      status:  409,
      message: `Task "${taskId}" is already assigned to intern "${internId}"`,
    };
  }

  // 4. Cannot assign a completed task
  if (task.status === 'completed') {
    return {
      ok:      false,
      status:  422,
      message: `Cannot assign a completed task`,
    };
  }

  return { ok: true, task, intern };
}

module.exports = {
  validateTaskCreation,
  validateReviewSubmission,
  validateAvailabilitySubmission,
  validateTaskAssignment,
};
