const express = require('express');
const router  = express.Router();
const { getCredibility, getMyCredibility } = require('../controllers/credibility.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

router.get('/get',  verifyToken, requireRole(...ADMIN_ROLES), validate(schemas.getCredibility), getCredibility);
router.get('/mine', verifyToken,                                                              getMyCredibility);

module.exports = router;
