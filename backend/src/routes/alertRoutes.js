const express = require('express');
const router  = express.Router();
const { getAlerts, resolveAlertById, resolveMyAlertById, getMyAnomalyAlerts } = require('../controllers/alerts.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

// Admin — all active alerts
router.get('/',              verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.getAlerts),    getAlerts);
router.patch('/:id/resolve', verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.resolveAlert), resolveAlertById);

// Intern — their own alerts
router.get('/my',                verifyToken, validate(schemas.getAlerts),    getMyAnomalyAlerts);
router.patch('/my/:id/resolve',  verifyToken, validate(schemas.resolveAlert), resolveMyAlertById);

module.exports = router;
