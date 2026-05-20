const express = require('express');
const router  = express.Router();
const { submitReview, getMyReviews, getReviewForTask, getReviewedTaskIds } = require('../controllers/review.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { validate }                 = require('../middleware/validate.middleware');
const { schemas }                  = require('../validation/schemas');
const { ROLES } = require('../constants/roles');

const CAN_REVIEW = [
  ROLES.CORE_ADMIN, 
  ROLES.TECHNICAL_LEAD, 
  ROLES.RESEARCH_LEAD, 
  ROLES.COLLABORATOR_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER
];
const INTERN_ROLES = [ROLES.TECHNICAL_INTERN, ROLES.OPERATIONS_INTERN, ROLES.RESEARCH_INTERN];

// Admin — submit a review for a completed task
router.post('/submit',        verifyToken, requireRole(...CAN_REVIEW), validate(schemas.submitReview), submitReview);
// Admin — get all reviewed task IDs (for filtering the dropdown)
router.get('/all-task-ids',   verifyToken, requireRole(...CAN_REVIEW), getReviewedTaskIds);

// Intern — view all their own reviews
router.get('/mine',           verifyToken, requireRole(...INTERN_ROLES), getMyReviews);
// Intern — view review for a specific task
router.get('/task/:taskId',   verifyToken, requireRole(...INTERN_ROLES, ...CAN_REVIEW), getReviewForTask);

module.exports = router;
