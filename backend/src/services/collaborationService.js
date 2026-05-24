'use strict';

/**
 * collaborationService.js
 * Handles task collaborators (teams) and observers (users).
 */

const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');

// ── Collaborators (teams) ─────────────────────────────────────────────────────

async function addCollaborator(taskId, teamId, addedById) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { const e = new Error('Task not found.'); e.status = 404; throw e; }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) { const e = new Error('Team not found.'); e.status = 404; throw e; }

  const existing = await prisma.taskCollaborator.findUnique({
    where: { taskId_teamId: { taskId, teamId } },
  });
  if (existing) return existing;

  const collab = await prisma.taskCollaborator.create({
    data: { taskId, teamId, addedById: addedById ?? null },
    include: { team: { select: { id: true, name: true } } },
  });

  void logAction(addedById, 'ADD_TASK_COLLABORATOR', AUDIT_ENTITIES.TASK, taskId, { teamId, teamName: team.name });
  return collab;
}

async function removeCollaborator(taskId, teamId, removedById) {
  const existing = await prisma.taskCollaborator.findUnique({
    where: { taskId_teamId: { taskId, teamId } },
  });
  if (!existing) { const e = new Error('Collaborator not found.'); e.status = 404; throw e; }

  await prisma.taskCollaborator.delete({ where: { taskId_teamId: { taskId, teamId } } });
  void logAction(removedById, 'REMOVE_TASK_COLLABORATOR', AUDIT_ENTITIES.TASK, taskId, { teamId });
}

async function getCollaborators(taskId) {
  return prisma.taskCollaborator.findMany({
    where: { taskId },
    include: {
      team: {
        select: {
          id: true, name: true,
          members: {
            where: { leftAt: null },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Observers (users) ─────────────────────────────────────────────────────────

async function addObserver(taskId, userId, addedById) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { const e = new Error('Task not found.'); e.status = 404; throw e; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { const e = new Error('User not found.'); e.status = 404; throw e; }

  const existing = await prisma.taskObserver.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) return existing;

  const observer = await prisma.taskObserver.create({
    data: { taskId, userId, addedById: addedById ?? null },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  void logAction(addedById, 'ADD_TASK_OBSERVER', AUDIT_ENTITIES.TASK, taskId, { userId, userName: user.name });
  return observer;
}

async function removeObserver(taskId, userId, removedById) {
  const existing = await prisma.taskObserver.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!existing) { const e = new Error('Observer not found.'); e.status = 404; throw e; }

  await prisma.taskObserver.delete({ where: { taskId_userId: { taskId, userId } } });
  void logAction(removedById, 'REMOVE_TASK_OBSERVER', AUDIT_ENTITIES.TASK, taskId, { userId });
}

async function getObservers(taskId) {
  return prisma.taskObserver.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Check if a user has observer or collaborator access to a task.
 * Used to extend task visibility beyond the primary assignee.
 */
async function hasCollaborativeAccess(taskId, userId) {
  // Direct observer
  const observer = await prisma.taskObserver.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (observer) return true;

  // Member of a collaborator team
  const userTeams = await prisma.userTeam.findMany({
    where: { userId, leftAt: null },
    select: { teamId: true },
  });
  const teamIds = userTeams.map(t => t.teamId);
  if (teamIds.length === 0) return false;

  const collab = await prisma.taskCollaborator.findFirst({
    where: { taskId, teamId: { in: teamIds } },
  });
  return !!collab;
}

module.exports = {
  addCollaborator, removeCollaborator, getCollaborators,
  addObserver, removeObserver, getObservers,
  hasCollaborativeAccess,
};
