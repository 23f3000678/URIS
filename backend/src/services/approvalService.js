'use strict';

/**
 * approvalService.js — Phase 8 Enterprise Governance Layer
 *
 * Two-admin approval workflow for sensitive governance actions.
 *
 * Supported actions (APPROVAL_ACTIONS):
 *   CHANGE_USER_ROLE    — role promotion/demotion
 *   ARCHIVE_USER        — user archival
 *   FINISH_INTERNSHIP   — internship completion
 *   REMOVE_USER         — compliance removal
 *
 * Flow:
 *   1. Admin A calls requestApproval() → creates ApprovalRequest (status: pending)
 *   2. Admin B calls approveRequest() or rejectRequest()
 *   3. On approval, executeApprovedAction() runs the actual operation
 *
 * Rules:
 *   - Self-approval is blocked (reviewer !== requester)
 *   - Only CORE_ADMIN can approve/reject
 *   - Pending requests expire after APPROVAL_EXPIRY_HOURS (default 72h)
 *   - All transitions are audit-logged
 */

const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');
const logger = require('../utils/logger');

const APPROVAL_EXPIRY_HOURS = parseInt(process.env.APPROVAL_EXPIRY_HOURS) || 72;

// Actions that require a second admin to approve
const APPROVAL_ACTIONS = Object.freeze({
  CHANGE_USER_ROLE:  'CHANGE_USER_ROLE',
  ARCHIVE_USER:      'ARCHIVE_USER',
  FINISH_INTERNSHIP: 'FINISH_INTERNSHIP',
  REMOVE_USER:       'REMOVE_USER',
});

// ── Request ───────────────────────────────────────────────────────────────────

/**
 * Submit a new approval request.
 *
 * @param {object} params
 * @param {string} params.action       - One of APPROVAL_ACTIONS
 * @param {string} params.targetId     - ID of the affected entity
 * @param {string} params.targetType   - "USER" | "INTERN" | "TASK"
 * @param {string} params.requestedById - User.id of the requesting admin
 * @param {object} params.payload      - Action-specific data
 * @returns {Promise<object>} The created ApprovalRequest
 */
async function requestApproval({ action, targetId, targetType, requestedById, payload }) {
  if (!APPROVAL_ACTIONS[action]) {
    throw Object.assign(new Error(`Unknown approval action: ${action}`), { status: 400 });
  }

  // Check for an existing pending request for the same action + target
  const existing = await prisma.approvalRequest.findFirst({
    where: { action, targetId, status: 'pending' },
  });
  if (existing) {
    throw Object.assign(
      new Error('A pending approval request already exists for this action and target.'),
      { status: 409 }
    );
  }

  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000);

  const request = await prisma.approvalRequest.create({
    data: { action, targetId, targetType, requestedById, payload, expiresAt },
  });

  void logAction(requestedById, AUDIT_ACTIONS.REQUEST_APPROVAL, AUDIT_ENTITIES.APPROVAL, request.id, {
    action, targetId, targetType, payload,
  });

  logger.info({ requestId: request.id, action, targetId }, 'Approval request created');
  return request;
}

// ── Approve ───────────────────────────────────────────────────────────────────

/**
 * Approve a pending request and execute the underlying action.
 *
 * @param {string} requestId   - ApprovalRequest.id
 * @param {string} reviewerId  - User.id of the approving admin
 * @param {string} [reviewNote]
 * @returns {Promise<object>} { request, result }
 */
async function approveRequest(requestId, reviewerId, reviewNote = null) {
  const request = await _getValidPendingRequest(requestId, reviewerId);

  // Mark approved
  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data:  { status: 'approved', reviewedById: reviewerId, reviewNote, updatedAt: new Date() },
  });

  void logAction(reviewerId, AUDIT_ACTIONS.APPROVE_ACTION, AUDIT_ENTITIES.APPROVAL, requestId, {
    action:    request.action,
    targetId:  request.targetId,
    reviewNote,
  });

  // Execute the approved action
  const result = await _executeAction(request, reviewerId);

  void logAction(reviewerId, AUDIT_ACTIONS.EXECUTE_APPROVED_ACTION, AUDIT_ENTITIES.APPROVAL, requestId, {
    action:   request.action,
    targetId: request.targetId,
    result,
  });

  logger.info({ requestId, action: request.action }, 'Approval request approved and executed');
  return { request: updated, result };
}

// ── Reject ────────────────────────────────────────────────────────────────────

/**
 * Reject a pending request.
 *
 * @param {string} requestId
 * @param {string} reviewerId
 * @param {string} [reviewNote]
 * @returns {Promise<object>} The updated ApprovalRequest
 */
async function rejectRequest(requestId, reviewerId, reviewNote = null) {
  const request = await _getValidPendingRequest(requestId, reviewerId);

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data:  { status: 'rejected', reviewedById: reviewerId, reviewNote, updatedAt: new Date() },
  });

  void logAction(reviewerId, AUDIT_ACTIONS.REJECT_ACTION, AUDIT_ENTITIES.APPROVAL, requestId, {
    action:    request.action,
    targetId:  request.targetId,
    reviewNote,
  });

  logger.info({ requestId, action: request.action }, 'Approval request rejected');
  return updated;
}

// ── Cancel ────────────────────────────────────────────────────────────────────

/**
 * Cancel a pending request (by the original requester or a CORE_ADMIN).
 *
 * @param {string} requestId
 * @param {string} cancelledById
 * @returns {Promise<object>}
 */
async function cancelRequest(requestId, cancelledById) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Cannot cancel a ${request.status} request`), { status: 400 });
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data:  { status: 'cancelled', reviewedById: cancelledById, updatedAt: new Date() },
  });

  void logAction(cancelledById, AUDIT_ACTIONS.CANCEL_APPROVAL, AUDIT_ENTITIES.APPROVAL, requestId, {
    action: request.action, targetId: request.targetId,
  });

  return updated;
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List approval requests with optional filters.
 */
async function listRequests({ status, action, page = 1, limit = 50 } = {}) {
  const where = {};
  if (status) where.status = status;
  if (action) where.action = action;

  const skip = (page - 1) * limit;

  const [total, requests] = await Promise.all([
    prisma.approvalRequest.count({ where }),
    prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip,
    }),
  ]);

  // Enrich with requester/reviewer names
  const userIds = [...new Set([
    ...requests.map(r => r.requestedById),
    ...requests.map(r => r.reviewedById).filter(Boolean),
  ])];

  const users = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return {
    requests: requests.map(r => ({
      ...r,
      requester: userMap[r.requestedById] ?? null,
      reviewer:  r.reviewedById ? (userMap[r.reviewedById] ?? null) : null,
      isExpired: r.expiresAt ? new Date(r.expiresAt) < new Date() : false,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _getValidPendingRequest(requestId, reviewerId) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Request is already ${request.status}`), { status: 400 });
  }
  if (request.requestedById === reviewerId) {
    throw Object.assign(new Error('You cannot approve your own request.'), { status: 403 });
  }
  if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'cancelled' } });
    throw Object.assign(new Error('This approval request has expired.'), { status: 410 });
  }
  return request;
}

/**
 * Execute the approved action by delegating to the appropriate service.
 * Lazy-requires services to avoid circular dependencies.
 */
async function _executeAction(request, reviewerId) {
  const { action, targetId, payload } = request;

  switch (action) {
    case APPROVAL_ACTIONS.CHANGE_USER_ROLE: {
      const { normalizeRole } = require('../constants/roles');
      const normalizedRole = normalizeRole(payload.newRole);
      if (!normalizedRole) throw new Error(`Invalid role: ${payload.newRole}`);

      const previousRole = (await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } }))?.role;

      await prisma.$transaction([
        prisma.user.update({ where: { id: targetId }, data: { role: normalizedRole } }),
        prisma.userRoleHistory.create({
          data: { userId: targetId, previousRole, newRole: normalizedRole, changedById: reviewerId, reason: payload.reason ?? 'Approved via governance workflow' },
        }),
      ]);
      return { userId: targetId, previousRole, newRole: normalizedRole };
    }

    case APPROVAL_ACTIONS.ARCHIVE_USER: {
      const { archiveUser } = require('./archiveService');
      return archiveUser(targetId, reviewerId, payload.reason ?? 'Approved via governance workflow');
    }

    case APPROVAL_ACTIONS.FINISH_INTERNSHIP: {
      const intern = await prisma.intern.findUnique({ where: { id: targetId }, include: { user: true } });
      if (!intern) throw Object.assign(new Error('Intern not found'), { status: 404 });
      await prisma.user.update({ where: { id: intern.userId }, data: { status: 'alumni', role: 'PAST_EMPLOYEE' } });
      return { internId: targetId, userId: intern.userId };
    }

    case APPROVAL_ACTIONS.REMOVE_USER: {
      const { markRemoved } = require('./archiveService');
      return markRemoved(targetId, reviewerId, payload.reason ?? 'Approved via governance workflow');
    }

    default:
      throw new Error(`No executor for action: ${action}`);
  }
}

module.exports = {
  APPROVAL_ACTIONS,
  requestApproval,
  approveRequest,
  rejectRequest,
  cancelRequest,
  listRequests,
};
