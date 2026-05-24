'use strict';

const passwordService = require('../services/password.service');
const { ok } = require('../utils/respond');

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await passwordService.changePassword(req.user.id, { currentPassword, newPassword });
    return ok(res, { emailSent: result.emailSent }, 'Password changed successfully.');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await passwordService.requestPasswordReset(email);
    return ok(res, null, result.message);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    await passwordService.resetPassword(token, newPassword);
    return ok(res, null, 'Password reset successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = { changePassword, forgotPassword, resetPassword };
