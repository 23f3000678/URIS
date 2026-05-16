const express = require('express');
const router = express.Router();
const { uploadToNextcloud } = require('../services/storage.service');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

const ADMIN_ROLES = [ROLES.CORE_ADMIN, ROLES.TECHNICAL_LEAD, ROLES.OPERATIONS_LEAD, ROLES.RESEARCH_LEAD];

// Test route for Nextcloud integration — admin only
router.get('/test-nextcloud', verifyToken, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const sampleData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Nextcloud WebDAV test upload'
    };

    const result = await uploadToNextcloud('test-upload.json', sampleData);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Nextcloud upload successful',
        data: result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message || 'Nextcloud upload failed',
        data: null
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'test-nextcloud route failed');
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null
    });
  }
});

module.exports = router;
