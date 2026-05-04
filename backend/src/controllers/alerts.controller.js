const { resolveAlert } = require('../services/alertService');
const { ok, notFound } = require('../utils/respond');
const prisma = require('../utils/prisma');

async function getAlerts(req, res, next) {
  try {
    const { type, severity } = req.query;
    const take = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.offset, 10) || 0;

    const where = { resolved: false };
    if (type)     where.type     = type;
    if (severity) where.severity = severity;

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return ok(res, alerts, `${alerts.length} active alert(s).`);
  } catch (err) {
    next(err);
  }
}

async function resolveAlertById(req, res, next) {
  const { id } = req.params;
  try {
    const updated = await resolveAlert(id);
    return ok(res, updated, 'Alert resolved.');
  } catch (err) {
    next(err);
  }
}

async function getMyAnomalyAlerts(req, res, next) {
  try {
    const intern = await prisma.intern.findUnique({ where: { userId: req.user.id } });
    if (!intern) {
      return notFound(res, 'Intern not found');
    }
    const internId = intern.id;

    const { type, severity } = req.query;

    const where = {
      internId,
      resolved: false,
      type:     type ? type : { in: ['low_performance', 'spike'] },
    };
    if (severity) where.severity = severity;

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    return ok(res, alerts);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAlerts, resolveAlertById, getMyAnomalyAlerts };
