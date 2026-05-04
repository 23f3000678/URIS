/**
 * anomalyDetector
 *
 * Compares an intern's latest score against their 7-day rolling average
 * and creates an Alert record when a significant anomaly is detected.
 *
 * Thresholds (configurable via env):
 *   DROP_THRESHOLD  — relative drop   > 20% → LOW_PERFORMANCE alert
 *   SPIKE_THRESHOLD — relative spike  > 30% → SPIKE alert
 *
 * Severity rules:
 *   drop  > 40%  → critical   (score collapsed)
 *   drop  > 20%  → warning    (notable decline)
 *   spike > 50%  → critical   (unusually large jump, may indicate data issue)
 *   spike > 30%  → warning    (positive but worth noting)
 *
 * Deduplication: if an unresolved alert of the same type already exists for
 * this intern, a new one is NOT created — avoids alert storms.
 *
 * Called fire-and-forget from scoreHistory.service.js after every score save.
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const DROP_THRESHOLD  = parseFloat(process.env.ANOMALY_DROP_THRESHOLD)  || 0.20;
const SPIKE_THRESHOLD = parseFloat(process.env.ANOMALY_SPIKE_THRESHOLD) || 0.30;

/**
 * @param {string} internId
 * @param {number} currentScore  — the score just saved (0–100 or 0–5 scale)
 * @param {'performance'|'credibility'|'capacity'} scoreType
 */
async function detectAnomaly(internId, currentScore, scoreType) {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    // Fetch the last 7 days of history for this intern + score type,
    // excluding the record we just saved (createdAt < now - 1s)
    const history = await prisma.scoreHistory.findMany({
      where: {
        internId,
        type:      scoreType,
        createdAt: {
          gte: since,
          lt:  new Date(Date.now() - 1_000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Need at least 2 prior data points to establish a baseline
    if (history.length < 2) return;

    const avg = history.reduce((sum, h) => sum + h.score, 0) / history.length;

    // Avoid division by zero for a zero baseline
    if (avg === 0) return;

    const delta    = currentScore - avg;
    const relDelta = delta / avg;   // positive = spike, negative = drop

    let alertType = null;
    let severity  = 'warning';
    let message   = '';

    if (relDelta < -DROP_THRESHOLD) {
      // Performance drop detected
      alertType = 'low_performance';
      const pct = Math.abs(Math.round(relDelta * 100));
      severity  = pct >= 40 ? 'critical' : 'warning';
      message   = `${scoreType.charAt(0).toUpperCase() + scoreType.slice(1)} score dropped ${pct}% ` +
                  `(from avg ${avg.toFixed(1)} → ${currentScore.toFixed(1)}). ` +
                  (severity === 'critical' ? 'Immediate review recommended.' : 'Monitor closely.');
    } else if (relDelta > SPIKE_THRESHOLD) {
      // Performance spike detected
      alertType = 'spike';
      const pct = Math.round(relDelta * 100);
      severity  = pct >= 50 ? 'critical' : 'warning';
      message   = `${scoreType.charAt(0).toUpperCase() + scoreType.slice(1)} score spiked ${pct}% ` +
                  `(from avg ${avg.toFixed(1)} → ${currentScore.toFixed(1)}). ` +
                  (severity === 'critical' ? 'Verify data integrity.' : 'Positive trend detected.');
    }

    if (!alertType) return;

    // Deduplication — skip if an identical unresolved alert already exists
    const existing = await prisma.alert.findFirst({
      where: { internId, type: alertType, resolved: false },
    });
    if (existing) return;

    await prisma.alert.create({
      data: { internId, type: alertType, severity, message },
    });

    logger.info({ internId, alertType, severity, scoreType }, 'Anomaly alert created');
  } catch (err) {
    // Non-fatal — anomaly detection must never break the main flow
    logger.error({ err, internId, scoreType }, 'Anomaly detection failed');
  }
}

module.exports = { detectAnomaly };
