'use strict';

/**
 * notification.service.js
 * Single entry point for all outbound notifications.
 * Controllers call this — never email.service directly.
 */

const { sendEmail } = require('./email.service');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const INTERN_ROLES = ['TECHNICAL_INTERN', 'OPERATIONS_INTERN', 'RESEARCH_INTERN'];

async function notifyPasswordReset(email, resetUrl) {
  return sendEmail({
    to: email,
    templateName: 'password-reset',
    templateData: { resetUrl, expiresInMinutes: 60 },
  });
}

async function notifyPasswordChanged(email, name) {
  return sendEmail({
    to: email,
    templateName: 'password-changed',
    templateData: { name },
  });
}

async function notifyAccountApproved(email, name) {
  return sendEmail({
    to: email,
    templateName: 'account-approved',
    templateData: { name },
  });
}

async function notifyTaskAssigned(email, name, taskTitle) {
  return sendEmail({
    to: email,
    templateName: 'task-assigned',
    templateData: { name, taskTitle },
  });
}

async function notifyGdocReminder(email, name, gdocUrl) {
  return sendEmail({
    to: email,
    templateName: 'gdoc-reminder',
    templateData: { name, gdocUrl },
  });
}

async function notifyOperationalAlert(email, alertMessage) {
  return sendEmail({
    to: email,
    templateName: 'operational-alert',
    templateData: { alertMessage },
  });
}

/**
 * Send GDoc work-log reminders to all active interns.
 * Called by the GDoc reminder cron job.
 * Per-intern errors do NOT abort the remaining sends.
 */
async function sendGdocReminders() {
  const interns = await prisma.user.findMany({
    where: {
      status: 'active',
      role:   { in: INTERN_ROLES },
    },
    include: { intern: { select: { id: true, gdocUrl: true } } },
  });

  let sent = 0;
  let errors = 0;

  for (const user of interns) {
    try {
      await notifyGdocReminder(user.email, user.name, user.intern?.gdocUrl || '');
      if (user.intern?.id) {
        await prisma.intern.update({
          where: { id: user.intern.id },
          data:  { lastGdocReminderSentAt: new Date() },
        });
      }
      sent++;
    } catch (err) {
      logger.error({ err, userId: user.id, email: user.email }, 'Failed to send GDoc reminder');
      errors++;
    }
  }

  return { sent, errors };
}

module.exports = {
  notifyPasswordReset,
  notifyPasswordChanged,
  notifyAccountApproved,
  notifyTaskAssigned,
  notifyGdocReminder,
  notifyOperationalAlert,
  sendGdocReminders,
};
