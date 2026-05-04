const express = require('express');
const router  = express.Router();
const { overrideScore, updateTaskStatus, getAdminOverview, getPendingUsers, approveUser, getAvailabilityDeadline, setAvailabilityDeadline } = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

router.post('/override-score',          verifyToken, requireRole(ROLES.ADMIN), validate(schemas.overrideScore),    overrideScore);
router.post('/task/status',             verifyToken, requireRole(ROLES.ADMIN), validate(schemas.updateTaskStatus), updateTaskStatus);
router.get('/overview',                 verifyToken, requireRole(ROLES.ADMIN),                                     getAdminOverview);
router.get('/pending-users',            verifyToken, requireRole(ROLES.ADMIN),                                     getPendingUsers);
router.post('/approve-user',            verifyToken, requireRole(ROLES.ADMIN),                                     approveUser);
router.get('/availability-deadline',    verifyToken,                                                               getAvailabilityDeadline);
router.post('/availability-deadline',   verifyToken, requireRole(ROLES.ADMIN),                                     setAvailabilityDeadline);

module.exports = router;
