'use strict';

/**
 * upload.service.js
 * Validates and stores profile picture uploads.
 * Magic-byte MIME validation — never trusts Content-Type header.
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../../uploads/profile-pictures');

/**
 * Inspect first 12 bytes to determine MIME type.
 * Returns 'image/jpeg' | 'image/png' | 'image/webp' | null
 */
function readMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E &&
    buffer[3] === 0x47 && buffer.length >= 8 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return 'image/png';
  }
  // WebP: RIFF????WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
};

/**
 * Validate and store a profile picture buffer.
 * @param {Buffer} buffer
 * @param {string} originalname
 * @param {string|null} userId  — for audit logging
 * @returns {{ profilePictureUrl: string }}
 */
async function validateAndStore(buffer, originalname, userId = null) {
  // 1. MIME validation via magic bytes
  const mime = readMagicBytes(buffer);
  if (!mime) {
    void logAction(userId, AUDIT_ACTIONS.UPLOAD_REJECTED, AUDIT_ENTITIES.USER, userId, {
      reason: 'invalid_mime_type', originalname,
    });
    const err = new Error('File type not supported. Accepted formats: JPEG, PNG, WebP.');
    err.status = 422;
    throw err;
  }

  // 2. Size validation
  if (buffer.length > MAX_SIZE) {
    void logAction(userId, AUDIT_ACTIONS.UPLOAD_REJECTED, AUDIT_ENTITIES.USER, userId, {
      reason: 'file_too_large', size: buffer.length, originalname,
    });
    const err = new Error('File size exceeds the 5 MB limit.');
    err.status = 422;
    throw err;
  }

  // 3. Ensure directory exists
  ensureUploadDir();

  // 4. Write file
  const filename = `${randomUUID()}${EXT_MAP[mime]}`;
  const dest = path.join(UPLOAD_DIR, filename);

  try {
    fs.writeFileSync(dest, buffer);
  } catch (writeErr) {
    logger.error({ writeErr, dest }, 'Failed to write profile picture to disk');
    const err = new Error('Upload failed. Please try again.');
    err.status = 500;
    throw err;
  }

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
  const profilePictureUrl = `${baseUrl}/uploads/profile-pictures/${filename}`;
  return { profilePictureUrl };
}

module.exports = { validateAndStore, readMagicBytes };
