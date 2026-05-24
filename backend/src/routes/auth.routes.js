const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { registerUser, loginUser, logoutUser, recordActivity } = require('../controllers/auth.controller');
const { changePassword, forgotPassword, resetPassword }       = require('../controllers/password.controller');
const { verifyToken }                    = require('../middleware/auth.middleware');
const { validate }                       = require('../middleware/validate.middleware');
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middleware/rateLimit.middleware');
const { schemas }                        = require('../validation/schemas');

// Multer for multipart registration (profile picture)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 + 1 },
});

router.post('/register', registerLimiter, upload.single('profilePicture'), validate(schemas.register), registerUser);
router.post('/login',    loginLimiter,    validate(schemas.login),             loginUser);
router.post('/logout',   verifyToken,                                          logoutUser);
router.post('/activity', verifyToken,     validate(schemas.recordActivity),    recordActivity);

// Password management
router.post('/change-password', verifyToken,           validate(schemas.changePassword), changePassword);
router.post('/forgot-password', forgotPasswordLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password',                         validate(schemas.resetPassword),  resetPassword);

module.exports = router;
