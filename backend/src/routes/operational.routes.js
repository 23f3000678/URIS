/**
 * operational.routes.js — Phase 2
 *
 * Security & governance endpoints — CORE_ADMIN only.
 *
 * POST   /operational/block-ip          — add an IP to the block list
 * DELETE /operational/block-ip          — remove an IP from the block list
 * GET    /operational/blocked-ips       — list all blocked IPs
 * GET    /operational/login-logs        — paginated login attempt log
 * POST   /operational/change-role       — change a user's role (with history)
 *
 * NOTE: blockIP, unblockIP, listBlockedIPs, getLoginLogs, and changeUserRole
 * require the BlockedIP, LoginLog, and UserRoleHistory Prisma models.
 * Until those migrations are applied the endpoints return 503.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const {
  blockIP,
  unblockIP,
  listBlockedIPs,
  getLoginLogs,
  changeUserRole,
} = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');

router.post('/block-ip',    verifyToken, requireRole(ROLES.CORE_ADMIN), blockIP);
router.delete('/block-ip',  verifyToken, requireRole(ROLES.CORE_ADMIN), unblockIP);
router.get('/blocked-ips',  verifyToken, requireRole(ROLES.CORE_ADMIN), listBlockedIPs);
router.get('/login-logs',   verifyToken, requireRole(ROLES.CORE_ADMIN), getLoginLogs);
router.post('/change-role', verifyToken, requireRole(ROLES.CORE_ADMIN), changeUserRole);

module.exports = router;
