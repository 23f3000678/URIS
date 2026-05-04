const prisma = require('../utils/prisma');
const { ok, notFound, forbidden } = require('../utils/respond');

async function getScoreHistory(req, res, next) {
  try {
    // Parse to integer — req.params values are always strings, intern.id is an integer
    const internId = parseInt(req.params.internId, 10);
    if (isNaN(internId)) {
      return forbidden(res, 'Invalid internId');
    }

    if (req.user.role !== 'ADMIN') {
      const intern = await prisma.intern.findUnique({ where: { userId: req.user.id } });
      if (!intern) {
        return notFound(res, 'Intern not found');
      }
      // Both sides are now integers — comparison is type-safe
      if (intern.id !== internId) {
        return forbidden(res, 'Access denied');
      }
    }

    const take = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.offset, 10) || 0;

    const history = await prisma.scoreHistory.findMany({
      where:   { internId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return ok(res, history);
  } catch (err) {
    next(err);
  }
}

module.exports = { getScoreHistory };
