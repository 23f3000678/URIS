'use strict';

/**
 * portfolio.controller.js
 *
 * Portfolio data is stored in the Config table as JSON keyed by intern ID.
 * This avoids requiring a schema migration for portfolio-specific fields.
 * The Config table already exists in the DB (used by configStore).
 *
 * Config key format: portfolio:{internId}
 * Config value: { bio, profilePic, contactNumber, linkedinUrl, skills, slug }
 */

const prisma = require('../utils/prisma');
const { ok: respond, notFound } = require('../utils/respond');

const PORTFOLIO_KEY = (internId) => `portfolio:${internId}`;

async function getPortfolioData(internId) {
  try {
    const config = await prisma.config.findUnique({
      where: { key: PORTFOLIO_KEY(internId) },
    });
    return config?.value ?? {};
  } catch {
    return {};
  }
}

async function setPortfolioData(internId, data) {
  await prisma.config.upsert({
    where:  { key: PORTFOLIO_KEY(internId) },
    update: { value: data },
    create: { key: PORTFOLIO_KEY(internId), value: data },
  });
}

// ── Public portfolio view ─────────────────────────────────────────────────────

async function getPublicPortfolio(req, res, next) {
  const { slug } = req.params;

  if (!slug || slug === 'undefined') {
    return notFound(res, 'Portfolio not found');
  }

  try {
    // Find intern by id (slug = internId for now)
    const intern = await prisma.intern.findFirst({
      where: { OR: [{ id: slug }] },
      include: {
        user: { select: { name: true, email: true, role: true, profilePictureUrl: true } },
        tasks: {
          where:  { status: 'completed' },
          select: { id: true, title: true, complexity: true, skills: true, deadline: true },
        },
      },
    });

    if (!intern) {
      return notFound(res, 'Portfolio not found');
    }

    const portfolioData = await getPortfolioData(intern.id);
    const portfolioUrl  = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portfolio/${intern.id}`;

    return respond(res, {
      name:           intern.user?.name  || '',
      email:          intern.user?.email || '',
      role:           intern.user?.role  || '',
      bio:            portfolioData.bio          || '',
      profilePic:     portfolioData.profilePic   || intern.user?.profilePictureUrl || '',
      contactNumber:  portfolioData.contactNumber || '',
      linkedinUrl:    portfolioData.linkedinUrl   || '',
      skills:         portfolioData.skills        ?? [],
      completedTasks: intern.tasks,
      portfolioUrl,
    });
  } catch (err) {
    next(err);
  }
}

// ── Get my portfolio (authenticated intern) ───────────────────────────────────

async function getMyPortfolio(req, res, next) {
  try {
    const intern = await prisma.intern.findUnique({
      where:   { userId: req.user.id },
      include: { user: { select: { name: true, email: true, profilePictureUrl: true } } },
    });

    if (!intern) return notFound(res, 'Intern record not found');

    const portfolioData = await getPortfolioData(intern.id);
    const slug = intern.id; // use intern ID as slug

    return respond(res, {
      slug,
      bio:           portfolioData.bio           || '',
      profilePic:    portfolioData.profilePic    || intern.user?.profilePictureUrl || '',
      contactNumber: portfolioData.contactNumber || '',
      linkedinUrl:   portfolioData.linkedinUrl   || '',
      skills:        portfolioData.skills        ?? [],
    });
  } catch (err) {
    next(err);
  }
}

// ── Update my portfolio ───────────────────────────────────────────────────────

async function updateMyPortfolio(req, res, next) {
  const { bio, profilePic, contactNumber, linkedinUrl, skills } = req.body;

  try {
    const intern = await prisma.intern.findUnique({ where: { userId: req.user.id } });
    if (!intern) return notFound(res, 'Intern record not found');

    // Load existing data and merge
    const existing = await getPortfolioData(intern.id);
    const updated = {
      ...existing,
      ...(bio           !== undefined ? { bio }           : {}),
      ...(profilePic    !== undefined ? { profilePic }    : {}),
      ...(contactNumber !== undefined ? { contactNumber } : {}),
      ...(linkedinUrl   !== undefined ? { linkedinUrl }   : {}),
      ...(Array.isArray(skills)       ? { skills }        : {}),
    };

    await setPortfolioData(intern.id, updated);

    return respond(res, {
      slug:          intern.id,
      bio:           updated.bio           || '',
      profilePic:    updated.profilePic    || '',
      contactNumber: updated.contactNumber || '',
      linkedinUrl:   updated.linkedinUrl   || '',
      skills:        updated.skills        ?? [],
    }, 'Portfolio updated successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicPortfolio, getMyPortfolio, updateMyPortfolio };
