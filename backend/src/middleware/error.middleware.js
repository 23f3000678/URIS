/**
 * Global error handler.
 *
 * Security rules:
 *  - 4xx errors return the error's own message — intentional, safe messages
 *    set by service/controller code.
 *  - 5xx errors return a generic message — internal details (stack traces,
 *    DB errors, etc.) are logged server-side only, never sent to the client.
 *
 * Response shape matches the standardised error format:
 *   { success: false, error: ERROR_CODE, message: string, data: null }
 */

const { ERROR_CODES } = require('../utils/respond');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const isClientError = status >= 400 && status < 500;

  // Always log the full error server-side for debugging.
  // 4xx are info-level (expected client mistakes); 5xx are error-level (unexpected).
  const logPayload = { method: req.method, path: req.path, status, err };
  if (isClientError) {
    logger.info(logPayload, 'client error');
  } else {
    logger.error(logPayload, 'server error');
  }

  const message = isClientError
    ? (err.message || 'Bad request.')
    : 'An unexpected error occurred. Please try again later.';

  // Map HTTP status to a machine-readable error code
  const errorCode =
    status === 400 ? ERROR_CODES.VALIDATION_ERROR :
    status === 401 ? ERROR_CODES.AUTH_ERROR :
    status === 403 ? ERROR_CODES.FORBIDDEN :
    status === 404 ? ERROR_CODES.NOT_FOUND :
    status === 409 ? ERROR_CODES.CONFLICT :
    status === 422 ? ERROR_CODES.UNPROCESSABLE :
    ERROR_CODES.SERVER_ERROR;

  return res.status(status).json({
    success: false,
    error:   errorCode,
    message,
    data:    null,
  });
}

module.exports = { errorHandler };
