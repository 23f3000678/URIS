'use strict';

/**
 * logger.js — centralised structured logger.
 *
 * Uses pino for JSON-formatted, levelled output suitable for log aggregation
 * (Datadog, CloudWatch, Loki, etc.).
 *
 * Transport selection (in priority order):
 *   1. PINO_TRANSPORT env var — production log shipping target.
 *      Set to a pino-compatible transport package name:
 *        PINO_TRANSPORT=pino-datadog-transport
 *        PINO_TRANSPORT=pino-cloudwatch
 *        PINO_TRANSPORT=pino-loki
 *      The transport package must be installed separately.
 *      Additional options can be passed via PINO_TRANSPORT_OPTIONS (JSON string).
 *
 *   2. pino-pretty — used in development (NODE_ENV !== 'production') when
 *      PINO_TRANSPORT is not set. Falls back to plain JSON if not installed.
 *
 *   3. Plain JSON stdout — production default when PINO_TRANSPORT is not set.
 *
 * Log levels (lowest → highest):
 *   trace | debug | info | warn | error | fatal
 *
 * The minimum level is controlled by the LOG_LEVEL environment variable
 * (default: 'info' in production, 'debug' in development).
 */

const pino = require('pino');

const isDev        = process.env.NODE_ENV !== 'production';
const defaultLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// ── Transport ─────────────────────────────────────────────────────────────────

let transport;

if (process.env.PINO_TRANSPORT) {
  // Production log shipping — e.g. Datadog, CloudWatch, Loki
  // The transport package must be installed: npm install <PINO_TRANSPORT>
  let transportOptions = {};
  if (process.env.PINO_TRANSPORT_OPTIONS) {
    try {
      transportOptions = JSON.parse(process.env.PINO_TRANSPORT_OPTIONS);
    } catch {
      // Malformed JSON — proceed with empty options; the transport may still work
    }
  }
  transport = pino.transport({
    target:  process.env.PINO_TRANSPORT,
    options: transportOptions,
  });
} else if (isDev) {
  try {
    // pino-pretty makes logs human-readable in local development.
    // If it is not installed the logger falls back to plain JSON silently.
    require.resolve('pino-pretty');
    transport = pino.transport({
      target:  'pino-pretty',
      options: {
        colorize:      true,
        translateTime: 'SYS:HH:MM:ss',
        ignore:        'pid,hostname',
        messageFormat: '{msg}',
      },
    });
  } catch {
    // pino-pretty not available — use plain JSON
  }
}
// In production without PINO_TRANSPORT: plain JSON to stdout (default pino behaviour)

// ── Logger instance ───────────────────────────────────────────────────────────

const logger = pino(
  {
    level: defaultLevel,
    base:  { service: 'uris-backend' },
    // Redact sensitive fields that should never appear in logs
    redact: {
      paths:  ['*.password', '*.token', '*.authorization', '*.secret'],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  transport,
);

module.exports = logger;
