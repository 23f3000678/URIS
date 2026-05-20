const express = require('express');
const router = express.Router();
const { submitAvailability, getAvailability } = require('../controllers/availability.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }    = require('../middleware/validate.middleware');
const { schemas }     = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

// Any authenticated user may submit their own availability.
// Reading another intern's availability is restricted to leads/admin.
const CAN_VIEW_AVAILABILITY = [
  ROLES.CORE_ADMIN,
  ROLES.TECHNICAL_LEAD,
  ROLES.OPERATIONS_LEAD,
  ROLES.RESEARCH_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD,
  ROLES.COLLABORATOR_LEAD,
];

router.post('/submit',              verifyToken, validate(schemas.submitAvailability), submitAvailability);
router.get('/:internId/:weekStart', verifyToken, requireRole(...CAN_VIEW_AVAILABILITY), validate(schemas.getAvailability), getAvailability);

module.exports = router;
