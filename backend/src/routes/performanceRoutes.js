const express = require('express');
const router = express.Router();
const { getPerformance } = require('../controllers/performance.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }    = require('../middleware/validate.middleware');
const { schemas }     = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];
const INTERN_ROLES = [ROLES.TECHNICAL_INTERN, ROLES.OPERATIONS_INTERN, ROLES.RESEARCH_INTERN];

// Admin — can fetch any intern's performance by ID
router.get('/get/:internId', verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.getPerformance), getPerformance);

// Intern — can only fetch their own performance (internId resolved from JWT in controller)
router.get('/mine', verifyToken, requireRole(...INTERN_ROLES), getPerformance);

module.exports = router;
