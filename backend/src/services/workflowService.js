'use strict';

/**
 * workflowService.js — Phase 9 Workflow & Collaboration Layer
 *
 * Handles:
 *   1. Task notes (internal + shared)
 *   2. Escalation workflow
 *   3. WorkflowEvent timeline recording
 */

const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');
const { WORKFLOW_EVENT_TYPES } = require('../constants/workflowEvents');
const logger = require('../utils/logger');

// ── Timeline helper ───────────────────────────────────────────────────────────

/**
 * Append an event to the WorkflowEvent timeline.
 * Fire-and-forget — never throws.
 */
async function recordEvent(taskId, actorId, eventType, payload = null) {
  try {
    await prisma.workflowEvent.create({
      data: { taskId, actorId: actorId ?? null, eventType, payload },
    });
  } catch (err) {
    logger.error({ err, taskId, eventType }, 'Failed to record workflow event');
  }
}

// ── Task Notes ────────────────────────────────────────────────────────────────

/**
 * Add a note to a task.
 *
 * @param {string}  taskId
 * @param {string}  authorId    - User.id
 * @param {string}  content
 * @param {boolean} isInternal  - true = admin/lead only; false = visible to intern
 * @returns {Promise<object>}
 */
async function addNote(taskId, authorId, content, isInternal = true) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  const note = await prisma.taskNote.create({
    data: { taskId, authorId, content: content.trim(), isInternal },
  });

  void recordEvent(taskId, authorId, WORKFLOW_EVENT_TYPES.NOTE_ADDED, {
    noteId: note.id, isInternal,
  });

  void logAction(authorId, AUDIT_ACTIONS.ADD_TASK_NOTE, AUDIT_ENTITIES.TASK, taskId, {
    noteId: note.id, isInternal,
  });

  return note;
}

/**
 * Update a note. Only the original author can update.
 */
async function updateNote(noteId, authorId, content) {
  const note = await prisma.taskNote.findUnique({ where: { id: noteId } });
  if (!note) throw Object.assign(new Error('Note not found'), { status: 404 });
  if (note.authorId !== authorId) throw Object.assign(new Error('You can only edit your own notes'), { status: 403 });

  const updated = await prisma.taskNote.update({
    where: { id: noteId },
    data:  { content: content.trim(), updatedAt: new Date() },
  });

  void recordEvent(note.taskId, authorId, WORKFLOW_EVENT_TYPES.NOTE_UPDATED, { noteId });
  void logAction(authorId, AUDIT_ACTIONS.UPDATE_TASK_NOTE, AUDIT_ENTITIES.TASK, note.taskId, { noteId });

  return updated;
}

/**
 * Delete a note. Only the original author or a CORE_ADMIN can delete.
 */
async function deleteNote(noteId, requesterId, requesterRole) {
  const note = await prisma.taskNote.findUnique({ where: { id: noteId } });
  if (!note) throw Object.assign(new Error('Note not found'), { status: 404 });

  const isCoreAdmin = requesterRole === 'CORE_ADMIN';
  if (note.authorId !== requesterId && !isCoreAdmin) {
    throw Object.assign(new Error('You can only delete your own notes'), { status: 403 });
  }

  await prisma.taskNote.delete({ where: { id: noteId } });

  void recordEvent(note.taskId, requesterId, WORKFLOW_EVENT_TYPES.NOTE_DELETED, { noteId });
  void logAction(requesterId, AUDIT_ACTIONS.DELETE_TASK_NOTE, AUDIT_ENTITIES.TASK, note.taskId, { noteId });
}

/**
 * List notes for a task.
 * Interns only see non-internal notes.
 */
async function listNotes(taskId, viewerRole) {
  const isIntern = ['TECHNICAL_INTERN', 'OPERATIONS_INTERN', 'RESEARCH_INTERN', 'ORENDA_MEMBER'].includes(viewerRole);
  const where = { taskId };
  if (isIntern) where.isInternal = false;

  const notes = await prisma.taskNote.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  // Enrich with author names
  const authorIds = [...new Set(notes.map(n => n.authorId))];
  const authors   = await prisma.user.findMany({
    where:  { id: { in: authorIds } },
    select: { id: true, name: true, email: true },
  });
  const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

  return notes.map(n => ({
    ...n,
    author: authorMap[n.authorId] ?? null,
  }));
}

// ── Escalations ───────────────────────────────────────────────────────────────

const VALID_ESCALATE_TO = ['lead', 'operations', 'core_admin'];

/**
 * Raise an escalation on a task.
 */
async function raiseEscalation(taskId, requestedById, escalateTo, reason) {
  if (!VALID_ESCALATE_TO.includes(escalateTo)) {
    throw Object.assign(
      new Error(`escalateTo must be one of: ${VALID_ESCALATE_TO.join(', ')}`),
      { status: 400 }
    );
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true, internId: true } });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  // Check for existing open escalation
  const existing = await prisma.taskEscalation.findFirst({
    where: { taskId, status: 'open' },
  });
  if (existing) {
    throw Object.assign(new Error('An open escalation already exists for this task'), { status: 409 });
  }

  const escalation = await prisma.taskEscalation.create({
    data: { taskId, requestedById, escalateTo, reason: reason.trim() },
  });

  // Create an alert for the target audience
  await prisma.alert.create({
    data: {
      internId: task.internId,
      taskId,
      type:     'escalation_raised',
      severity: 'critical',
      message:  `Task "${task.title}" has been escalated to ${escalateTo.replace('_', ' ')}. Reason: ${reason}`,
    },
  });

  void recordEvent(taskId, requestedById, WORKFLOW_EVENT_TYPES.ESCALATION_RAISED, {
    escalationId: escalation.id, escalateTo, reason,
  });

  void logAction(requestedById, AUDIT_ACTIONS.RAISE_ESCALATION, AUDIT_ENTITIES.TASK, taskId, {
    escalationId: escalation.id, escalateTo, reason,
  });

  logger.info({ taskId, escalateTo }, 'Escalation raised');
  return escalation;
}

/**
 * Acknowledge an escalation (admin/lead confirms they've seen it).
 */
async function acknowledgeEscalation(escalationId, reviewerId) {
  const esc = await _getOpenEscalation(escalationId);

  const updated = await prisma.taskEscalation.update({
    where: { id: escalationId },
    data:  { status: 'acknowledged', resolvedById: reviewerId, updatedAt: new Date() },
  });

  void recordEvent(esc.taskId, reviewerId, WORKFLOW_EVENT_TYPES.ESCALATION_ACKNOWLEDGED, { escalationId });
  void logAction(reviewerId, AUDIT_ACTIONS.ACKNOWLEDGE_ESCALATION, AUDIT_ENTITIES.TASK, esc.taskId, { escalationId });

  return updated;
}

/**
 * Resolve an escalation.
 */
async function resolveEscalation(escalationId, reviewerId, resolvedNote) {
  const esc = await _getOpenEscalation(escalationId);

  const updated = await prisma.taskEscalation.update({
    where: { id: escalationId },
    data:  {
      status:       'resolved',
      resolvedById: reviewerId,
      resolvedNote: resolvedNote?.trim() ?? null,
      updatedAt:    new Date(),
    },
  });

  // Resolve the escalation alert
  await prisma.alert.updateMany({
    where: { taskId: esc.taskId, type: 'escalation_raised', resolved: false },
    data:  { resolved: true },
  });

  void recordEvent(esc.taskId, reviewerId, WORKFLOW_EVENT_TYPES.ESCALATION_RESOLVED, {
    escalationId, resolvedNote,
  });
  void logAction(reviewerId, AUDIT_ACTIONS.RESOLVE_ESCALATION, AUDIT_ENTITIES.TASK, esc.taskId, {
    escalationId, resolvedNote,
  });

  return updated;
}

/**
 * List escalations, optionally filtered by status.
 */
async function listEscalations({ taskId, status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (taskId) where.taskId = taskId;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [total, escalations] = await Promise.all([
    prisma.taskEscalation.count({ where }),
    prisma.taskEscalation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip,
    }),
  ]);

  // Enrich with requester/resolver names
  const userIds = [...new Set([
    ...escalations.map(e => e.requestedById),
    ...escalations.map(e => e.resolvedById).filter(Boolean),
  ])];
  const users   = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return {
    escalations: escalations.map(e => ({
      ...e,
      requester: userMap[e.requestedById] ?? null,
      resolver:  e.resolvedById ? (userMap[e.resolvedById] ?? null) : null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ── Timeline ──────────────────────────────────────────────────────────────────

/**
 * Get the full workflow timeline for a task.
 */
async function getTimeline(taskId) {
  const events = await prisma.workflowEvent.findMany({
    where:   { taskId },
    orderBy: { createdAt: 'asc' },
  });

  // Enrich with actor names
  const actorIds = [...new Set(events.map(e => e.actorId).filter(Boolean))];
  const actors   = await prisma.user.findMany({
    where:  { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));

  return events.map(e => ({
    ...e,
    actor: e.actorId ? (actorMap[e.actorId] ?? null) : null,
  }));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _getOpenEscalation(escalationId) {
  const esc = await prisma.taskEscalation.findUnique({ where: { id: escalationId } });
  if (!esc) throw Object.assign(new Error('Escalation not found'), { status: 404 });
  if (esc.status === 'resolved') throw Object.assign(new Error('Escalation is already resolved'), { status: 400 });
  return esc;
}

module.exports = {
  recordEvent,
  addNote,
  updateNote,
  deleteNote,
  listNotes,
  raiseEscalation,
  acknowledgeEscalation,
  resolveEscalation,
  listEscalations,
  getTimeline,
};
