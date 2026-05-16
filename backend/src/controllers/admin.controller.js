const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');
const { validateUpdateTaskStatus, isUUID } = require('../utils/validate');
const { ok, validationError, notFound } = require('../utils/respond');
const configStore = require('../services/configStore');
const { getCapacityLabel } = require('../services/capacityEngine');
const { getRpiWindowStart } = require('../services/performanceEngine');

// Default deadline: Monday at 11:00 AM
const DEFAULT_DEADLINE = { day: 1, hour: 11, minute: 0 }; // day: 0=Sun,1=Mon,...6=Sat

async function overrideScore(req, res, next) {
  try {
    const { internId, overrideScore } = req.body;

    if (!internId) {
      return validationError(res, 'internId is required');
    }
    if (!isUUID(internId)) {
      return validationError(res, 'internId must be a valid UUID');
    }
    if (typeof overrideScore !== 'number' || overrideScore < 0 || overrideScore > 100) {
      return validationError(res, 'overrideScore must be a number between 0 and 100');
    }

    const intern = await prisma.intern.findUnique({ where: { id: internId }, select: { overrideScore: true } });
    const previousScore = intern?.overrideScore ?? null;

    await prisma.intern.update({
      where: { id: internId },
      data:  { overrideScore },
    });

    void logAction(req.user?.id ?? null, AUDIT_ACTIONS.OVERRIDE_SCORE, AUDIT_ENTITIES.SCORE, internId, {
      internId,
      previousScore,
      newScore: overrideScore,
      reason:   req.body.reason ?? null,
    });

    return ok(res, null, 'Score overridden successfully');
  } catch (err) {
    next(err);
  }
}

async function updateTaskStatus(req, res, next) {
  try {
    const { taskId, status, progress, hasBlocker, blockerType, pauseReason } = req.body;

    const errors = validateUpdateTaskStatus({ taskId, status, progress });
    if (errors.length > 0) {
      return validationError(res, errors[0]);
    }

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return notFound(res, 'Task not found');
    }

    await prisma.task.update({
      where: { id: taskId },
      data:  {
        status,
        lastUpdatedAt: new Date(),
        ...(typeof progress === 'number'    ? { progressPct: progress }   : {}),
        ...(typeof hasBlocker === 'boolean' ? { hasBlocker }              : {}),
        ...(blockerType !== undefined       ? { blockerType: hasBlocker ? blockerType : null } : {}),
      },
    });

    // If admin is pausing or blocking, create an alert with the reason
    if ((status === 'paused' || hasBlocker === true) && (pauseReason || blockerType)) {
      const reason = pauseReason || (blockerType ? blockerType.replace(/_/g, ' ') : 'admin action');
      const alertType = status === 'paused' ? 'task_paused' : 'blocker_reported';
      const existing = await prisma.alert.findFirst({
        where: { taskId, type: alertType, resolved: false },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            internId: existingTask.internId,
            taskId,
            type:     alertType,
            severity: 'warning',
            message:  status === 'paused'
              ? `Admin paused task "${existingTask.title}". Reason: ${reason}.`
              : `Admin flagged blocker on task "${existingTask.title}": ${reason}.`,
          },
        });
      }
    }

    // If admin is resuming (active) or unblocking, resolve related alerts
    if (status === 'active' || hasBlocker === false) {
      await prisma.alert.updateMany({
        where: {
          taskId,
          type:     { in: ['task_paused', 'blocker_reported'] },
          resolved: false,
        },
        data: { resolved: true },
      });
    }

    void logAction(req.user?.id ?? null, AUDIT_ACTIONS.UPDATE_TASK, AUDIT_ENTITIES.TASK, taskId, {
      taskId,
      previousStatus: existingTask.status,
      newStatus:      status,
      hasBlocker:     hasBlocker ?? null,
      blockerType:    blockerType ?? null,
      pauseReason:    pauseReason ?? null,
      ...(typeof progress === 'number' ? { progressPct: progress } : {}),
    });

    return ok(res, null, `Task status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

async function getAdminOverview(req, res, next) {
  try {
    const [totalInterns, activeTasks, openAlerts, completedLast30, allInterns, alerts] = await Promise.all([
      prisma.intern.count(),
      prisma.task.count({ where: { status: 'active' } }),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.task.count({ where: { status: 'completed', lastUpdatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.intern.findMany({
        take:    100,
        include: {
          user:        { select: { email: true, name: true } },
          credibility: true,
          // Rolling window — only reviews within RPI_WINDOW_DAYS contribute to RPI
          reviews: {
            where:  { createdAt: { gte: getRpiWindowStart() } },
            select: { quality: true, timeliness: true, initiative: true },
          },
          tasks: {
            select: { status: true, complexity: true, progressPct: true },
          },
          // Fetch the most recent capacity score written by the new pipeline
          scoreHistory: {
            where:   { type: 'capacity' },
            orderBy: { createdAt: 'desc' },
            take:    1,
          },
        },
      }),
      prisma.alert.findMany({
        where:   { resolved: false },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
    ]);

    const interns = allInterns.map(i => {
      const activeTasksList = i.tasks.filter(t => t.status === 'active');
      const completedTasks  = i.tasks.filter(t => t.status === 'completed');
      const totalTasks      = i.tasks.length;

      // Task Load Index — sum of (complexity × remaining work) for active tasks
      const tli = activeTasksList.reduce(
        (sum, t) => sum + t.complexity * (1 - t.progressPct / 100),
        0
      );

      // Review Performance Index — average of (quality + timeliness + initiative) / 3
      // Scaled to 0–100 from a 0–5 rating scale
      const rpi = i.reviews.length > 0
        ? parseFloat(
            (
              i.reviews.reduce((sum, r) => sum + (r.quality + r.timeliness + r.initiative) / 3, 0)
              / i.reviews.length
              * 20  // convert 0–5 → 0–100
            ).toFixed(1)
          )
        : 0;

      // Task completion percentage
      const completionPct = totalTasks > 0
        ? Math.round((completedTasks.length / totalTasks) * 100)
        : 0;

      // Capacity score — read from ScoreHistory (integer 0–100) written by the
      // new capacityEngine pipeline via saveScoreHistory.
      // Falls back to 0 if no capacity score has been computed yet.
      const latestCapacity = i.scoreHistory[0];
      const capacityScore  = latestCapacity ? Math.round(latestCapacity.score) : 0;

      // Derive the human-readable availability label from the single authoritative
      // source in capacityEngine.js — thresholds stay in sync automatically.
      const availability = latestCapacity
        ? getCapacityLabel(capacityScore)
        : 'No data';

      // Credibility score — CredibilityScore.score is a 0–1 float; multiply by
      // 100 to get the 0–100 integer the frontend expects.
      const credibilityScore = i.credibility
        ? Math.round(i.credibility.score * 100)
        : 0;

      return {
        id:            i.id,
        name:          i.user?.name || i.user?.email?.split('@')[0] || i.id,
        capacityScore,
        tli:           parseFloat(tli.toFixed(2)),
        rpi,
        credibilityScore,
        availability,
        taskCount:     totalTasks,
        activeTasks:   activeTasksList.length,
        completedTasks: completedTasks.length,
        completionPct,
      };
    });

    return ok(res, { totalInterns, activeTasks, openAlerts, completedLast30, interns, alerts });
  } catch (err) {
    next(err);
  }
}

async function getPendingUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where:   { status: 'pending' },
      select:  { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, users, 'Pending users fetched');
  } catch (err) {
    next(err);
  }
}

async function approveUser(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) return validationError(res, 'userId is required');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)                    return notFound(res, 'User not found');
    if (user.status !== 'pending') return validationError(res, 'User is not pending approval');

    await prisma.user.update({ where: { id: userId }, data: { status: 'active' } });

    void logAction(req.user?.id ?? null, 'APPROVE_USER', 'USER', userId, {
      approvedEmail: user.email,
      approvedRole:  user.role,
    });

    return ok(res, null, `User ${user.email} approved successfully`);
  } catch (err) {
    next(err);
  }
}

async function getAvailabilityDeadline(req, res, next) {
  try {
    const deadline = await configStore.get('availabilityDeadline', DEFAULT_DEADLINE);
    return ok(res, deadline, 'Availability deadline fetched');
  } catch (err) {
    next(err);
  }
}

async function setAvailabilityDeadline(req, res, next) {
  const { day, hour, minute } = req.body;

  if (typeof day !== 'number' || day < 0 || day > 6) {
    return validationError(res, 'day must be an integer 0 (Sun) – 6 (Sat)');
  }
  if (typeof hour !== 'number' || hour < 0 || hour > 23) {
    return validationError(res, 'hour must be an integer 0–23');
  }
  if (typeof minute !== 'number' || minute < 0 || minute > 59) {
    return validationError(res, 'minute must be an integer 0–59');
  }

  try {
    await configStore.set('availabilityDeadline', { day, hour, minute });

    void logAction(req.user?.id ?? null, 'SET_AVAILABILITY_DEADLINE', 'CONFIG', null, { day, hour, minute });

    return ok(res, { day, hour, minute }, 'Availability deadline updated');
  } catch (err) {
    next(err);
  }
}

async function finishInternship(req, res, next) {
  try {
    const { internId } = req.body;
    if (!internId) return validationError(res, 'internId is required');

    const intern = await prisma.intern.findUnique({ 
      where: { id: internId },
      include: { user: true }
    });

    if (!intern) return notFound(res, 'Intern not found');

    // Update user status and role
    await prisma.user.update({
      where: { id: intern.userId },
      data: {
        status: 'alumni',
        role: 'PAST_EMPLOYEE'
      }
    });

    void logAction(req.user?.id ?? null, 'FINISH_INTERNSHIP', 'INTERN', internId, {
      internEmail: intern.user.email,
      internName: intern.user.name,
    });

    return ok(res, null, `Internship finished for ${intern.user.name}. Access removed.`);
  } catch (err) {
    next(err);
  }
}

module.exports = { overrideScore, updateTaskStatus, getAdminOverview, getPendingUsers, approveUser, getAvailabilityDeadline, setAvailabilityDeadline, finishInternship };
