'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true }); // mergeParams to get :taskId from parent
const {
  listCollaborators, addCollaboratorHandler, removeCollaboratorHandler,
  listObservers, addObserverHandler, removeObserverHandler,
} = require('../controllers/collaboration.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');

const LEAD_ROLES = [
  ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD,
  ROLES.RESEARCH_LEAD, ROLES.OPERATIONS_PROGRAM_MANAGER, ROLES.COLLABORATOR_LEAD,
];

// ── Collaborator teams ────────────────────────────────────────────────────────
router.get('/collaborators',                verifyToken, listCollaborators);
router.post('/collaborators',               verifyToken, requireRole(...LEAD_ROLES), addCollaboratorHandler);
router.delete('/collaborators/:teamId',     verifyToken, requireRole(...LEAD_ROLES), removeCollaboratorHandler);

// ── Observers ─────────────────────────────────────────────────────────────────
router.get('/observers',                    verifyToken, listObservers);
router.post('/observers',                   verifyToken, requireRole(...LEAD_ROLES), addObserverHandler);
router.delete('/observers/:userId',         verifyToken, requireRole(...LEAD_ROLES), removeObserverHandler);

module.exports = router;
