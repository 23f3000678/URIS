const express = require('express');
const router  = express.Router();
const { getShortlist, assignTask } = require('../controllers/assignment.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const CAN_ASSIGN = [
  ROLES.CORE_ADMIN, 
  ROLES.OPERATIONS_LEAD, 
  ROLES.TECHNICAL_LEAD, 
  ROLES.RESEARCH_LEAD, 
  ROLES.OPERATIONS_PROGRAM_MANAGER, 
  ROLES.COLLABORATOR_LEAD
];

router.post('/shortlist',   verifyToken, requireRole(...CAN_ASSIGN), validate(schemas.getShortlist), getShortlist);
router.post('/assign-task', verifyToken, requireRole(...CAN_ASSIGN), validate(schemas.assignTask),   assignTask);

module.exports = router;
