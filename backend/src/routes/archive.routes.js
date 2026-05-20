/**
 * archive.routes.js — Phase 6
 *
 * User lifecycle management routes — CORE_ADMIN only.
 * All operations are non-destructive (no permanent deletes).
 *
 * GET   /archive              — list archived/inactive/removed users (ArchivedUser table)
 * GET   /archive/users        — list ALL users for lifecycle management
 * POST  /archive/deactivate   — ACTIVE → INACTIVE
 * POST  /archive/archive      — any    → ARCHIVED (snapshot written)
 * POST  /archive/restore      — INACTIVE/ARCHIVED → ACTIVE
 * POST  /archive/remove       — ARCHIVED → REMOVED (compliance hold)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const {
  deactivate,
  archive,
  restore,
  remove,
  listArchived,
  listAllUsers,
} = require('../controllers/archive.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');

router.get('/',              verifyToken, requireRole(ROLES.CORE_ADMIN), listArchived);
router.get('/users',         verifyToken, requireRole(ROLES.CORE_ADMIN), listAllUsers);
router.post('/deactivate',   verifyToken, requireRole(ROLES.CORE_ADMIN), deactivate);
router.post('/archive',      verifyToken, requireRole(ROLES.CORE_ADMIN), archive);
router.post('/restore',      verifyToken, requireRole(ROLES.CORE_ADMIN), restore);
router.post('/remove',       verifyToken, requireRole(ROLES.CORE_ADMIN), remove);

module.exports = router;
