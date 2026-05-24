'use strict';

const profileService = require('../services/profile.service');
const uploadService  = require('../services/upload.service');
const { ok } = require('../utils/respond');

async function getMyProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.id);
    return ok(res, profile, 'Profile retrieved.');
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const updated = await profileService.updateProfile(req.user.id, req.body);
    return ok(res, updated, 'Profile updated.');
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePicture(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const { profilePictureUrl } = await uploadService.validateAndStore(
      req.file.buffer,
      req.file.originalname,
      req.user.id
    );
    await profileService.updateProfilePictureUrl(req.user.id, profilePictureUrl);
    return ok(res, { profilePictureUrl }, 'Profile picture updated.');
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, updateMyProfile, uploadProfilePicture };
