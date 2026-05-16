const express = require('express');
const router = express.Router();
const { runDemo } = require('../controllers/demo.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

router.post('/run', verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.runDemo), runDemo);

module.exports = router;
