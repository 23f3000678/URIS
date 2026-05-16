const express = require('express');
const router  = express.Router();
const {
  createTeamHandler,
  listTeamsHandler,
  getTeamHandler,
  joinTeamHandler,
  leaveTeamHandler,
  getMyTeamsHandler,
  getMyTeamHistoryHandler,
  getContributionHandler,
} = require('../controllers/team.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

// ── Public to all authenticated users ────────────────────────────────────────
router.get('/',               verifyToken,                                                          listTeamsHandler);
router.get('/my',             verifyToken,                                                          getMyTeamsHandler);
router.get('/my/history',     verifyToken,                                                          getMyTeamHistoryHandler);
router.get('/:teamId',        verifyToken, validate(schemas.teamIdParam),                           getTeamHandler);
router.post('/:teamId/join',  verifyToken, validate(schemas.joinTeam),                              joinTeamHandler);
router.post('/:teamId/leave', verifyToken, validate(schemas.teamIdParam),                           leaveTeamHandler);
router.get('/:teamId/contribution', verifyToken, validate(schemas.teamIdParam),                     getContributionHandler);

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

// ── Admin only ────────────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.createTeam), createTeamHandler);

module.exports = router;
