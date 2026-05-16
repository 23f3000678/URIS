const express = require('express');
const router  = express.Router();
const { getPublicPortfolio, updateMyPortfolio } = require('../controllers/portfolio.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public access
router.get('/:slug', getPublicPortfolio);

// Intern protected update
router.patch('/me', verifyToken, updateMyPortfolio);

module.exports = router;
