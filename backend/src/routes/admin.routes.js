const express = require('express');
const router  = express.Router();
const { overrideScore, updateTaskStatus, getAdminOverview, getPendingUsers, approveUser, getAvailabilityDeadline, setAvailabilityDeadline, finishInternship } = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

router.post('/override-score',          verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.overrideScore),    overrideScore);
router.post('/task/status',             verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.updateTaskStatus), updateTaskStatus);
router.get('/overview',                 verifyToken, requireRole(...ADMIN_ROLES),                                     getAdminOverview);
router.get('/pending-users',            verifyToken, requireRole(...ADMIN_ROLES),                                     getPendingUsers);
router.post('/approve-user',            verifyToken, requireRole(...ADMIN_ROLES),                                     approveUser);
router.get('/availability-deadline',    verifyToken,                                                                   getAvailabilityDeadline);
router.post('/availability-deadline',   verifyToken, requireRole(...ADMIN_ROLES),                                     setAvailabilityDeadline);
router.post('/finish-internship',       verifyToken, requireRole(...ADMIN_ROLES),                                     finishInternship);

module.exports = router;
