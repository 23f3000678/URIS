'use strict';

/**
 * workflow.routes.js — Phase 9 Workflow & Collaboration Layer
 *
 * Notes:
 *   GET    /workflow/tasks/:taskId/notes          — list notes (intern sees non-internal only)
 *   POST   /workflow/tasks/:taskId/notes          — add a note
 *   PATCH  /workflow/notes/:noteId                — edit own note
 *   DELETE /workflow/notes/:noteId                — delete own note (or CORE_ADMIN)
 *
 * Escalations:
 *   GET    /workflow/escalations                  — list all (admin/lead)
 *   GET    /workflow/tasks/:taskId/escalations    — escalations for a task
 *   POST   /workflow/tasks/:taskId/escalations    — raise an escalation
 *   POST   /workflow/escalations/:id/acknowledge  — acknowledge
 *   POST   /workflow/escalations/:id/resolve      — resolve
 *
 * Timeline:
 *   GET    /workflow/tasks/:taskId/timeline       — full event timeline
 */

const express = require('express');
const router  = express.Router();
const {
  getNotes, createNote, editNote, removeNote,
  getEscalations, getTaskEscalations, createEscalation, acknowledgeEsc, resolveEsc,
  getTaskTimeline,
} = require('../controllers/workflow.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [
  ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD,
  ROLES.RESEARCH_LEAD, ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD, ROLES.COLLABORATOR_LEAD,
];
const ALL_ROLES = [...ADMIN_ROLES, ROLES.TECHNICAL_INTERN, ROLES.OPERATIONS_INTERN, ROLES.RESEARCH_INTERN, ROLES.ORENDA_MEMBER];

// ── Notes ─────────────────────────────────────────────────────────────────────
router.get('/tasks/:taskId/notes',       verifyToken, requireRole(...ALL_ROLES),   getNotes);
router.post('/tasks/:taskId/notes',      verifyToken, requireRole(...ADMIN_ROLES), createNote);
router.patch('/notes/:noteId',           verifyToken, requireRole(...ADMIN_ROLES), editNote);
router.delete('/notes/:noteId',          verifyToken, requireRole(...ADMIN_ROLES), removeNote);

// ── Escalations ───────────────────────────────────────────────────────────────
router.get('/escalations',                          verifyToken, requireRole(...ADMIN_ROLES), getEscalations);
router.get('/tasks/:taskId/escalations',            verifyToken, requireRole(...ALL_ROLES),   getTaskEscalations);
router.post('/tasks/:taskId/escalations',           verifyToken, requireRole(...ALL_ROLES),   createEscalation);
router.post('/escalations/:escalationId/acknowledge', verifyToken, requireRole(...ADMIN_ROLES), acknowledgeEsc);
router.post('/escalations/:escalationId/resolve',     verifyToken, requireRole(...ADMIN_ROLES), resolveEsc);

// ── Timeline ──────────────────────────────────────────────────────────────────
router.get('/tasks/:taskId/timeline',    verifyToken, requireRole(...ALL_ROLES),   getTaskTimeline);

module.exports = router;
