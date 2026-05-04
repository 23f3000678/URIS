const axios      = require('axios');
const axiosRetry = require('axios-retry').default;
const prisma     = require('../utils/prisma');
const logger     = require('../utils/logger');

// ── Nextcloud HTTP client ─────────────────────────────────────────────────────
// Dedicated axios instance with:
//   - 15 s timeout (WebDAV PUT can be slow for large payloads)
//   - 2 retries with exponential backoff on network errors and 5xx only
//   - No retry on 401/403 — auth failures won't self-heal
const axiosNextcloud = axios.create({
  timeout: parseInt(process.env.NEXTCLOUD_REQUEST_TIMEOUT_MS) || 15_000,
});

axiosRetry(axiosNextcloud, {
  retries:        2,
  retryDelay:     axiosRetry.exponentialDelay,   // 1 s, 2 s
  retryCondition: (err) => {
    const status = err.response?.status;
    // Never retry auth failures — they won't self-heal
    if (status === 401 || status === 403) return false;
    return axiosRetry.isNetworkError(err) || axiosRetry.isRetryableError(err);
  },
  onRetry: (retryCount, err) => {
    logger.warn({ retryCount, status: err.response?.status, message: err.message }, 'Nextcloud upload retry');
  },
});

// ---------------------------------------------------------------------------
// Nextcloud WebDAV provider
// ---------------------------------------------------------------------------

/**
 * Upload JSON data as a file to Nextcloud via WebDAV PUT.
 * Retries automatically via axiosNextcloud (2 retries, exponential backoff).
 * Tracks result in SyncLog.
 *
 * @param {string}  filename
 * @param {Object}  data
 * @param {string}  [internId] - Optional, used for sync log association
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
async function uploadToNextcloud(filename, data, internId = null) {
  const NEXTCLOUD_URL      = process.env.NEXTCLOUD_URL;
  const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME;
  const NEXTCLOUD_PASSWORD = process.env.NEXTCLOUD_PASSWORD;

  if (!NEXTCLOUD_URL || !NEXTCLOUD_USERNAME || !NEXTCLOUD_PASSWORD) {
    const message = 'Missing Nextcloud environment variables';
    logger.error({ filename }, 'Nextcloud sync failed — missing env vars');
    await _logSync(internId, filename, 'FAILED', message);
    return { success: false, message };
  }

  const baseUrl    = NEXTCLOUD_URL.endsWith('/') ? NEXTCLOUD_URL : `${NEXTCLOUD_URL}/`;
  const url        = `${baseUrl}${filename}`;
  const authHeader = 'Basic ' + Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_PASSWORD}`).toString('base64');

  if (process.env.DEBUG === 'true') {
    logger.debug({ username: NEXTCLOUD_USERNAME, url, filename }, 'Nextcloud upload debug info');
  }

  try {
    await axiosNextcloud.put(url, JSON.stringify(data), {
      headers: {
        'Authorization': authHeader,
        'Content-Type':  'application/json',
      },
    });

    logger.info({ filename }, 'Nextcloud sync success');
    await _logSync(internId, filename, 'SUCCESS', null);
    return { success: true };
  } catch (err) {
    const status  = err.response?.status;
    let   message = err.message ?? 'Unknown error';

    if (status === 403) message = 'Nextcloud permission denied (403 Forbidden)';
    else if (status === 401) message = 'Nextcloud authentication failed (401 Unauthorized)';

    logger.error({ filename, status, message }, 'Nextcloud sync failed after retries');
    await _logSync(internId, filename, 'FAILED', message);
    return { success: false, message };
  }
}

async function _logSync(internId, filename, status, error) {
  try {
    await prisma.syncLog.create({ 
      data: { 
        internId, 
        filename, 
        status, 
        error 
      } 
    });
  } catch (err) {
    logger.error({ err, filename }, 'Failed to write sync log');
  }
}

// ---------------------------------------------------------------------------
// Active provider — swap this to change the integration
// ---------------------------------------------------------------------------
const provider = {
  async uploadAvailability(data, internId) {
    return uploadToNextcloud('availability.json', data, internId);
  },
  async uploadPerformance(data, internId) {
    return uploadToNextcloud('performance.json', data, internId);
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function syncAvailability(data, internId) {
  return provider.uploadAvailability(data, internId);
}

async function syncPerformance(data, internId) {
  return provider.uploadPerformance(data, internId);
}

module.exports = { syncAvailability, syncPerformance, uploadToNextcloud };
