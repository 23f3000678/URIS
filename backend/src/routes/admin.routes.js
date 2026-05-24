const express = require('express');
const router  = express.Router();
const {
  overrideScore,
  updateTaskStatus,
  getAdminOverview,
  getPendingUsers,
  approveUser,
  getAvailabilityDeadline,
  setAvailabilityDeadline,
  finishInternship,
  blockIP,
  unblockIP,
  listBlockedIPs,
  getLoginLogs,
  changeUserRole,
  getAllUsers,
  deleteIntern,
  updateIntern,
} = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [
  ROLES.CORE_ADMIN, 
  ROLES.TECHNICAL_LEAD, 
  ROLES.OPERATIONS_LEAD, 
  ROLES.RESEARCH_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD,
  ROLES.COLLABORATOR_LEAD
];

router.post('/override-score',          verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.overrideScore),    overrideScore);
router.post('/task/status',             verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.updateTaskStatus), updateTaskStatus);
router.get('/overview',                 verifyToken, requireRole(...ADMIN_ROLES),                                     getAdminOverview);
router.get('/pending-users',            verifyToken, requireRole(...ADMIN_ROLES),                                     getPendingUsers);
router.post('/approve-user',            verifyToken, requireRole(...ADMIN_ROLES),                                     approveUser);
router.get('/availability-deadline',    verifyToken,                                                                   getAvailabilityDeadline);
router.post('/availability-deadline',   verifyToken, requireRole(...ADMIN_ROLES),                                     setAvailabilityDeadline);
router.post('/finish-internship',       verifyToken, requireRole(...ADMIN_ROLES),                                     finishInternship);
router.delete('/interns/:internId',     verifyToken, requireRole(ROLES.CORE_ADMIN),                                   deleteIntern);
router.patch('/interns/:internId',      verifyToken, requireRole(...ADMIN_ROLES),                                     updateIntern);

// ── Phase 2: Security & Governance (also exposed via /operational) ────────────
router.post('/block-ip',                verifyToken, requireRole(ROLES.CORE_ADMIN),                                   blockIP);
router.delete('/block-ip',              verifyToken, requireRole(ROLES.CORE_ADMIN),                                   unblockIP);
router.get('/blocked-ips',              verifyToken, requireRole(ROLES.CORE_ADMIN),                                   listBlockedIPs);
router.get('/login-logs',               verifyToken, requireRole(ROLES.CORE_ADMIN),                                   getLoginLogs);
router.post('/change-role',             verifyToken, requireRole(ROLES.CORE_ADMIN),                                   changeUserRole);
router.get('/users',                    verifyToken, requireRole(ROLES.CORE_ADMIN),                                   getAllUsers);

module.exports = router;
