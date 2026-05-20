/**
 * support.controller.js — Phase 3
 *
 * Support request lifecycle management.
 *
 * Interns can submit and view their own requests.
 * Operations admins can list all, assign, update status, and add notes.
 */

'use strict';

const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');
const { ok, created, validationError, notFound, forbidden } = require('../utils/respond');
const { isUUID } = require('../utils/validate');

const VALID_CATEGORIES = ['general', 'technical', 'hr', 'access', 'other'];
const VALID_STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// ── POST /support ─────────────────────────────────────────────────────────────
// Intern submits a new support request.

async function createRequest(req, res, next) {
  try {
    const { title, description, category = 'general', priority = 'normal' } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return validationError(res, 'title is required');
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return validationError(res, 'description is required');
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return validationError(res, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      return validationError(res, `priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    const request = await prisma.supportRequest.create({
      data: {
        submittedById: req.user.id,
        title:         title.trim(),
        description:   description.trim(),
        category,
        priority,
      },
      select: {
        id:          true,
        title:       true,
        description: true,
        category:    true,
        priority:    true,
        status:      true,
        createdAt:   true,
      },
    });

    void logAction(req.user.id, AUDIT_ACTIONS.CREATE_SUPPORT_REQUEST, AUDIT_ENTITIES.SUPPORT, request.id, {
      title:    request.title,
      category: request.category,
      priority: request.priority,
    });

    return created(res, request, 'Support request submitted.');
  } catch (err) {
    next(err);
  }
}

// ── GET /support ──────────────────────────────────────────────────────────────
// Admin lists all support requests with optional filters.

async function listRequests(req, res, next) {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip     = (page - 1) * limit;
    const { status, priority, category, assignedToId } = req.query;

    const where = {};
    if (status     && VALID_STATUSES.includes(status))       where.status   = status;
    if (priority   && VALID_PRIORITIES.includes(priority))   where.priority = priority;
    if (category   && VALID_CATEGORIES.includes(category))   where.category = category;
    if (assignedToId === 'unassigned') where.assignedToId = null;
    else if (assignedToId && isUUID(assignedToId))           where.assignedToId = assignedToId;

    const [total, requests] = await Promise.all([
      prisma.supportRequest.count({ where }),
      prisma.supportRequest.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take:    limit,
        skip,
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
          assignedTo:  { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return ok(res, {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Support requests fetched.');
  } catch (err) {
    next(err);
  }
}

// ── GET /support/my ───────────────────────────────────────────────────────────
// Intern lists their own requests.

async function listMyRequests(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const where = { submittedById: req.user.id };
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }

    const [total, requests] = await Promise.all([
      prisma.supportRequest.count({ where }),
      prisma.supportRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip,
        select: {
          id:          true,
          title:       true,
          category:    true,
          priority:    true,
          status:      true,
          resolvedAt:  true,
          createdAt:   true,
          updatedAt:   true,
          assignedTo:  { select: { name: true } },
          // internalNotes intentionally excluded — intern-facing view
        },
      }),
    ]);

    return ok(res, {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Your support requests fetched.');
  } catch (err) {
    next(err);
  }
}

// ── PATCH /support/:id/assign ─────────────────────────────────────────────────
// Admin assigns a request to a handler.

async function assignRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    if (!isUUID(id)) return validationError(res, 'Invalid request ID');
    if (assignedToId && !isUUID(assignedToId)) {
      return validationError(res, 'assignedToId must be a valid UUID');
    }

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) return notFound(res, 'Support request not found');

    // Verify the assignee exists if provided
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) return notFound(res, 'Assignee user not found');
    }

    const updated = await prisma.supportRequest.update({
      where: { id },
      data:  {
        assignedToId: assignedToId ?? null,
        status:       assignedToId ? 'in_progress' : 'open',
        updatedAt:    new Date(),
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        assignedTo:  { select: { id: true, name: true, email: true } },
      },
    });

    void logAction(req.user.id, AUDIT_ACTIONS.ASSIGN_SUPPORT_REQUEST, AUDIT_ENTITIES.SUPPORT, id, {
      assignedToId: assignedToId ?? null,
    });

    return ok(res, updated, 'Support request assigned.');
  } catch (err) {
    next(err);
  }
}

// ── PATCH /support/:id/status ─────────────────────────────────────────────────
// Admin updates the status of a request.

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isUUID(id)) return validationError(res, 'Invalid request ID');
    if (!status || !VALID_STATUSES.includes(status)) {
      return validationError(res, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) return notFound(res, 'Support request not found');

    const updated = await prisma.supportRequest.update({
      where: { id },
      data:  {
        status,
        resolvedAt: (status === 'resolved' || status === 'closed') ? new Date() : null,
        updatedAt:  new Date(),
      },
    });

    void logAction(req.user.id, AUDIT_ACTIONS.UPDATE_SUPPORT_REQUEST_STATUS, AUDIT_ENTITIES.SUPPORT, id, {
      previousStatus: existing.status,
      newStatus:      status,
    });

    return ok(res, updated, `Support request marked as ${status}.`);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /support/:id/notes ──────────────────────────────────────────────────
// Admin updates internal notes (never visible to the intern).

async function updateNotes(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!isUUID(id)) return validationError(res, 'Invalid request ID');
    if (typeof notes !== 'string') {
      return validationError(res, 'notes must be a string');
    }

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) return notFound(res, 'Support request not found');

    const updated = await prisma.supportRequest.update({
      where: { id },
      data:  { internalNotes: notes.trim(), updatedAt: new Date() },
      select: { id: true, internalNotes: true, updatedAt: true },
    });

    void logAction(req.user.id, AUDIT_ACTIONS.UPDATE_SUPPORT_NOTES, AUDIT_ENTITIES.SUPPORT, id, {});

    return ok(res, updated, 'Internal notes updated.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  listRequests,
  listMyRequests,
  assignRequest,
  updateStatus,
  updateNotes,
};
