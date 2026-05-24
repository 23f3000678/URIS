'use strict';

/**
 * googleIntelligence.service.js
 *
 * Aggregates Google-sourced data (worklog staleness, calendar availability)
 * into operational intelligence insights for the admin Intelligence dashboard.
 *
 * All queries are read-only and graceful — never throws to callers.
 */

const prisma  = require('../utils/prisma');
const logger  = require('../utils/logger');

const STALE_DAYS = parseInt(process.env.GDOC_STALE_DAYS) || 3;

/**
 * Returns Google-sourced operational intelligence:
 *   - staleWorklogs: interns whose GDoc hasn't been updated in STALE_DAYS
 *   - inactiveInterns: interns with no Google connection at all
 *   - calendarConflicts: interns with busy calendar slots (from GoogleToken presence + gdoc data)
 *   - summary counts
 */
async function getGoogleIntelligence() {
  try {
    const INTERN_ROLES = ['TECHNICAL_INTERN', 'OPERATIONS_INTERN', 'RESEARCH_INTERN'];
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

    const [interns, googleTokens] = await Promise.all([
      prisma.intern.findMany({
        where: {
          user: { status: 'active', role: { in: INTERN_ROLES } },
        },
        select: {
          id:                  true,
          gdocUrl:             true,
          gdocLastModified:    true,
          gdocIsStale:         true,
          gdocMetaRefreshedAt: true,
          userId:              true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.googleToken.findMany({
        select: { userId: true },
      }),
    ]);

    const connectedUserIds = new Set(googleTokens.map(t => t.userId));

    // Stale worklogs: has gdocUrl, gdocIsStale = true OR lastModified > STALE_DAYS ago
    const staleWorklogs = interns
      .filter(i => {
        if (!i.gdocUrl) return false;
        if (i.gdocIsStale) return true;
        if (i.gdocLastModified && new Date(i.gdocLastModified) < staleThreshold) return true;
        return false;
      })
      .map(i => ({
        internId:        i.id,
        name:            i.user?.name || i.user?.email?.split('@')[0] || i.id,
        gdocUrl:         i.gdocUrl,
        lastModified:    i.gdocLastModified,
        daysSinceUpdate: i.gdocLastModified
          ? Math.floor((Date.now() - new Date(i.gdocLastModified).getTime()) / (24 * 60 * 60 * 1000))
          : null,
        metaRefreshedAt: i.gdocMetaRefreshedAt,
        isConnected:     i.userId ? connectedUserIds.has(i.userId) : false,
      }));

    // No worklog set at all
    const noWorklog = interns
      .filter(i => !i.gdocUrl)
      .map(i => ({
        internId:    i.id,
        name:        i.user?.name || i.user?.email?.split('@')[0] || i.id,
        isConnected: i.userId ? connectedUserIds.has(i.userId) : false,
      }));

    // Not connected to Google
    const notConnected = interns
      .filter(i => i.userId && !connectedUserIds.has(i.userId))
      .map(i => ({
        internId: i.id,
        name:     i.user?.name || i.user?.email?.split('@')[0] || i.id,
        hasGdoc:  !!i.gdocUrl,
      }));

    // Active worklogs (connected + has gdoc + not stale)
    const activeWorklogs = interns
      .filter(i => {
        if (!i.gdocUrl) return false;
        if (!i.userId || !connectedUserIds.has(i.userId)) return false;
        if (i.gdocIsStale) return false;
        if (i.gdocLastModified && new Date(i.gdocLastModified) < staleThreshold) return false;
        return true;
      })
      .map(i => ({
        internId:     i.id,
        name:         i.user?.name || i.user?.email?.split('@')[0] || i.id,
        lastModified: i.gdocLastModified,
      }));

    return {
      staleWorklogs,
      noWorklog,
      notConnected,
      activeWorklogs,
      summary: {
        totalInterns:       interns.length,
        connectedToGoogle:  connectedUserIds.size,
        staleWorklogCount:  staleWorklogs.length,
        noWorklogCount:     noWorklog.length,
        notConnectedCount:  notConnected.length,
        activeWorklogCount: activeWorklogs.length,
        staleDaysThreshold: STALE_DAYS,
      },
    };
  } catch (err) {
    logger.error({ err }, 'getGoogleIntelligence failed');
    return {
      staleWorklogs:  [],
      noWorklog:      [],
      notConnected:   [],
      activeWorklogs: [],
      summary: {
        totalInterns: 0, connectedToGoogle: 0, staleWorklogCount: 0,
        noWorklogCount: 0, notConnectedCount: 0, activeWorklogCount: 0,
        staleDaysThreshold: STALE_DAYS,
      },
    };
  }
}

module.exports = { getGoogleIntelligence };
