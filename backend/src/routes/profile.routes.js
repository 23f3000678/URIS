'use strict';

const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const { verifyToken }    = require('../middleware/auth.middleware');
const { validate }       = require('../middleware/validate.middleware');
const { schemas }        = require('../validation/schemas');
const profileController  = require('../controllers/profile.controller');

// Multer: memory storage, 5 MB + 1 byte limit (so we can detect exact boundary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 + 1 },
});

// GET  /profile/me
router.get('/me', verifyToken, profileController.getMyProfile);

// PATCH /profile/me
router.patch('/me', verifyToken, validate(schemas.updateProfile), profileController.updateMyProfile);

// POST /profile/picture
router.post('/picture', verifyToken, upload.single('profilePicture'), profileController.uploadProfilePicture);

module.exports = router;
