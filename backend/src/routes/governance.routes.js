'use strict';

/**
 * governance.routes.js — Phase 8 Enterprise Governance Layer
 */

const express = require('express');
const router  = express.Router();
const {
  list,
  request,
  approve,
  reject,
  cancel,
  getMyPermissions,
  getPermissionsForRoleEndpoint,
  getAllUsers,
  getRoleHistory,
  getAccessMatrix,
  getSecurityOverview,
} = require('../controllers/approval.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { requirePermission }        = require('../middleware/permission.middleware');
const { PERMISSIONS }              = require('../constants/permissions');
const { ROLES }                    = require('../constants/roles');

const adminOnly = [verifyToken, requireRole(ROLES.CORE_ADMIN)];

// ── Approval workflows ────────────────────────────────────────────────────────
router.get('/approvals',                verifyToken, requirePermission(PERMISSIONS.CAN_MANAGE_APPROVALS), list);
router.post('/approvals',               verifyToken, requirePermission(PERMISSIONS.CAN_MANAGE_APPROVALS), request);
router.post('/approvals/:id/approve',   ...adminOnly, approve);
router.post('/approvals/:id/reject',    ...adminOnly, reject);
router.post('/approvals/:id/cancel',    verifyToken, requirePermission(PERMISSIONS.CAN_MANAGE_APPROVALS), cancel);

// ── Permission introspection ──────────────────────────────────────────────────
router.get('/permissions/me',           verifyToken, getMyPermissions);
router.get('/permissions/:role',        verifyToken, requireRole(ROLES.CORE_ADMIN), getPermissionsForRoleEndpoint);

// ── User management ───────────────────────────────────────────────────────────
router.get('/users',                    ...adminOnly, getAllUsers);
router.get('/role-history',             ...adminOnly, getRoleHistory);

// ── Access matrix ─────────────────────────────────────────────────────────────
router.get('/access-matrix',            verifyToken, requireRole(ROLES.CORE_ADMIN), getAccessMatrix);

// ── Security oversight ────────────────────────────────────────────────────────
router.get('/security',                 ...adminOnly, getSecurityOverview);

module.exports = router;
