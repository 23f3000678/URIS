'use strict';

/**
 * profile.service.js
 * Profile reads and updates. Role is never editable via this service.
 */

const prisma = require('../utils/prisma');
const { logAction } = require('../utils/auditLogger');
const { AUDIT_ACTIONS, AUDIT_ENTITIES } = require('../constants/auditActions');

const GDOC_PREFIX = 'https://docs.google.com/document/d/';

function isValidGdocUrl(url) {
  if (typeof url !== 'string') return false;
  if (url.length > 2048) return false;
  return url.startsWith(GDOC_PREFIX) && url.slice(GDOC_PREFIX.length).trim().length > 0;
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:                true,
      name:              true,
      email:             true,
      role:              true,
      status:            true,
      profilePictureUrl: true,
      dateOfBirth:       true,
      joiningDate:       true,
      createdAt:         true,
      intern: {
        select: {
          gdocUrl:                true,
          lastGdocReminderSentAt: true,
        },
      },
    },
  });

  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  return user;
}

async function updateProfile(userId, updates) {
  const { name, profilePictureUrl, gdocUrl } = updates;
  const changed = {};

  // Validate name
  if (name !== undefined && name !== null) {
    const trimmed = String(name).trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      const err = new Error('Name must be between 1 and 100 characters.');
      err.status = 422;
      throw err;
    }
    changed.name = trimmed;
  }

  // Validate profilePictureUrl
  if (profilePictureUrl !== undefined && profilePictureUrl !== null && profilePictureUrl !== '') {
    if (String(profilePictureUrl).length > 2048) {
      const err = new Error('Profile picture URL must not exceed 2048 characters.');
      err.status = 422;
      throw err;
    }
    changed.profilePictureUrl = profilePictureUrl;
  }

  // Validate gdocUrl
  if (gdocUrl !== undefined && gdocUrl !== null && gdocUrl !== '') {
    if (!isValidGdocUrl(gdocUrl)) {
      const err = new Error('Google Docs URL must begin with https://docs.google.com/document/d/ followed by the document ID.');
      err.status = 422;
      throw err;
    }
    changed.gdocUrl = gdocUrl;
  }

  if (Object.keys(changed).length === 0) {
    const err = new Error('No valid fields to update.');
    err.status = 400;
    throw err;
  }

  // Separate user fields from intern fields
  const userFields  = {};
  const internFields = {};
  if (changed.name)              userFields.name              = changed.name;
  if (changed.profilePictureUrl) userFields.profilePictureUrl = changed.profilePictureUrl;
  if (changed.gdocUrl)           internFields.gdocUrl         = changed.gdocUrl;

  if (Object.keys(userFields).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userFields });
  }

  if (Object.keys(internFields).length > 0) {
    // Upsert intern record in case it doesn't exist yet
    await prisma.intern.upsert({
      where:  { userId },
      update: internFields,
      create: { userId, ...internFields },
    });
  }

  void logAction(userId, AUDIT_ACTIONS.PROFILE_UPDATE, AUDIT_ENTITIES.USER, userId, changed);

  return getProfile(userId);
}

async function updateProfilePictureUrl(userId, url) {
  await prisma.user.update({
    where: { id: userId },
    data:  { profilePictureUrl: url },
  });
  void logAction(userId, AUDIT_ACTIONS.PROFILE_UPDATE, AUDIT_ENTITIES.USER, userId, { profilePictureUrl: url });
  return getProfile(userId);
}

module.exports = { getProfile, updateProfile, updateProfilePictureUrl, isValidGdocUrl };
