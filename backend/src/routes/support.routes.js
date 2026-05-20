/**
 * support.routes.js — Phase 3
 *
 * POST  /support              — intern submits a support request
 * GET   /support              — admin lists all requests (filterable)
 * GET   /support/my           — intern lists their own requests
 * PATCH /support/:id/assign   — admin assigns a request to a handler
 * PATCH /support/:id/status   — admin updates request status
 * PATCH /support/:id/notes    — admin updates internal notes
 */

'use strict';

const express = require('express');
const router  = express.Router();
const {
  createRequest,
  listRequests,
  listMyRequests,
  assignRequest,
  updateStatus,
  updateNotes,
} = require('../controllers/support.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [
  ROLES.CORE_ADMIN,
  ROLES.OPERATIONS_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
];

// /support/my must be registered BEFORE /support/:id routes to avoid
// Express matching "my" as an :id parameter.
router.get('/my',             verifyToken,                              listMyRequests);
router.post('/',              verifyToken,                              createRequest);
router.get('/',               verifyToken, requireRole(...ADMIN_ROLES), listRequests);
router.patch('/:id/assign',   verifyToken, requireRole(...ADMIN_ROLES), assignRequest);
router.patch('/:id/status',   verifyToken, requireRole(...ADMIN_ROLES), updateStatus);
router.patch('/:id/notes',    verifyToken, requireRole(...ADMIN_ROLES), updateNotes);

module.exports = router;
