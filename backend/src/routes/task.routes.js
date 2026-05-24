const express = require('express');
const router  = express.Router();
const { getTasksOverview, getTasks, createTask, internUpdateTask, deleteTask, getTaskById, updateTaskDescription } = require('../controllers/tasks.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');
const collaborationRoutes = require('./collaboration.routes');

const ADMIN_ROLES = [
  ROLES.CORE_ADMIN, 
  ROLES.TECHNICAL_LEAD, 
  ROLES.OPERATIONS_LEAD, 
  ROLES.RESEARCH_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD,
  ROLES.COLLABORATOR_LEAD
];
const INTERN_ROLES = [ROLES.TECHNICAL_INTERN, ROLES.OPERATIONS_INTERN, ROLES.RESEARCH_INTERN];

router.get('/overview',        verifyToken, requireRole(...ADMIN_ROLES), getTasksOverview);
router.get('/',                verifyToken, validate(schemas.getTasks),                             getTasks);
router.get('/:taskId',         verifyToken, getTaskById);
router.post('/create',         verifyToken, requireRole(ROLES.CORE_ADMIN, ROLES.OPERATIONS_LEAD, ROLES.OPERATIONS_PROGRAM_MANAGER, ROLES.TECHNICAL_LEAD, ROLES.RESEARCH_LEAD, ROLES.COLLABORATOR_LEAD), validate(schemas.createTask), createTask);
router.patch('/:taskId/progress', verifyToken, requireRole(...INTERN_ROLES), validate(schemas.internUpdateTask), internUpdateTask);
router.patch('/:taskId/description', verifyToken, requireRole(...ADMIN_ROLES.filter(r => r !== ROLES.OBSERVER_TEAM_LEAD)), updateTaskDescription);
router.delete('/:taskId',      verifyToken, requireRole(ROLES.CORE_ADMIN, ROLES.OPERATIONS_LEAD, ROLES.OPERATIONS_PROGRAM_MANAGER, ROLES.TECHNICAL_LEAD, ROLES.RESEARCH_LEAD, ROLES.COLLABORATOR_LEAD), deleteTask);

// ── Collaboration sub-routes (/tasks/:taskId/collaborators, /tasks/:taskId/observers)
router.use('/:taskId', collaborationRoutes);

module.exports = router;
