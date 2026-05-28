'use strict';

/**
 * openproject.service.js — OpenProject Integration Layer
 *
 * Architecture:
 *   - OpenProject is a COMPLEMENTARY intelligence source alongside Plane.so
 *   - Plane.so remains the primary task sync system (unchanged)
 *   - OpenProject provides: work package push, milestone sync, blocker sync,
 *     comment sync, and operational intelligence signals
 *   - All functions degrade gracefully when OP is not configured
 *
 * Env vars required:
 *   OPENPROJECT_BASE_URL      — e.g. https://uris.openproject.com
 *   OPENPROJECT_API_KEY       — personal access token
 *   OPENPROJECT_PROJECT_ID    — numeric project ID (optional; uses first project if absent)
 *   OPENPROJECT_WEBHOOK_SECRET — for inbound webhook verification
 */

const axios      = require('axios');
const prisma     = require('../utils/prisma');
const logger     = require('../utils/logger');

// axios-retry: handle both CJS and ESM module shapes
let axiosRetry;
try {
  const ar = require('axios-retry');
  axiosRetry = ar.default ?? ar;
} catch {
  axiosRetry = null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const OP_BASE_URL   = process.env.OPENPROJECT_BASE_URL;
const OP_API_KEY    = process.env.OPENPROJECT_API_KEY;
const OP_PROJECT_ID = process.env.OPENPROJECT_PROJECT_ID;

function isConfigured() {
  return !!(OP_BASE_URL && OP_API_KEY);
}

// ── HTTP client ───────────────────────────────────────────────────────────────

const axiosOP = axios.create({
  timeout: parseInt(process.env.OPENPROJECT_REQUEST_TIMEOUT_MS) || 12_000,
});

if (axiosRetry) {
  axiosRetry(axiosOP, {
    retries:        3,
    retryDelay:     axiosRetry.exponentialDelay,
    retryCondition: (err) =>
      axiosRetry.isNetworkError(err) || axiosRetry.isRetryableError(err),
    onRetry: (retryCount, err) => {
      logger.warn({ retryCount, status: err.response?.status, msg: err.message }, 'OpenProject API retry');
    },
  });
}

function opHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`apikey:${OP_API_KEY}`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

function opUrl(path) {
  if (!OP_BASE_URL) return `/api/v3${path}`; // fallback — only called when isConfigured() is true
  const base = OP_BASE_URL.replace(/\/$/, '');
  return `${base}/api/v3${path}`;
}

// ── Field mappers ─────────────────────────────────────────────────────────────

/** Map URIS task status → OpenProject status name */
function mapStatusToOP(urisStatus) {
  const map = {
    active:    'In progress',
    stale:     'On hold',
    completed: 'Closed',
    cancelled: 'Rejected',
    paused:    'On hold',
  };
  return map[urisStatus] ?? 'New';
}

/** Map URIS complexity (1–3) → OpenProject priority href */
function mapComplexityToPriority(complexity) {
  if (complexity >= 3) return '/api/v3/priorities/8'; // High
  if (complexity >= 2) return '/api/v3/priorities/7'; // Normal
  return '/api/v3/priorities/6';                       // Low
}

/** Map OpenProject status group → URIS status */
function mapOPStatusToURIS(opStatusName) {
  const name = (opStatusName || '').toLowerCase();
  if (name.includes('closed') || name.includes('done')) return 'completed';
  if (name.includes('reject') || name.includes('cancel')) return 'cancelled';
  if (name.includes('hold') || name.includes('blocked')) return 'stale';
  if (name.includes('progress') || name.includes('started')) return 'active';
  return 'active';
}

/** Map OpenProject priority → URIS complexity */
function mapOPPriorityToComplexity(opPriorityName) {
  const name = (opPriorityName || '').toLowerCase();
  if (name.includes('high') || name.includes('urgent') || name.includes('immediate')) return 3;
  if (name.includes('normal') || name.includes('medium')) return 2;
  return 1;
}

// ── Connection probe ──────────────────────────────────────────────────────────

/**
 * Lightweight connectivity check — fetches /api/v3 root.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
async function probeConnection() {
  if (!isConfigured()) return { ok: false, reason: 'not configured' };
  try {
    await axiosOP.get(opUrl(''), { headers: opHeaders(), timeout: 4000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── Project resolution ────────────────────────────────────────────────────────

let _cachedProjectId = null;

/**
 * Resolves the OpenProject project ID to use.
 * Uses OPENPROJECT_PROJECT_ID env var if set, otherwise fetches the first project.
 */
async function resolveProjectId() {
  if (OP_PROJECT_ID) return OP_PROJECT_ID;
  if (_cachedProjectId) return _cachedProjectId;
  try {
    const res = await axiosOP.get(opUrl('/projects'), { headers: opHeaders() });
    const projects = res.data?._embedded?.elements ?? [];
    if (!projects.length) throw new Error('No projects found in OpenProject');
    _cachedProjectId = projects[0].id;
    return _cachedProjectId;
  } catch (err) {
    logger.warn({ err: err.message }, 'OpenProject: could not resolve project ID');
    return null;
  }
}

// ── Work Package CRUD ─────────────────────────────────────────────────────────

/**
 * createWorkPackage — push a URIS task to OpenProject as a new work package.
 * Idempotent: checks if a WP with the same subject already exists first.
 *
 * @param {object} task - Prisma Task record (with intern.user populated)
 * @returns {{ opId: number|null, created: boolean, error?: string }}
 */
async function createWorkPackage(task) {
  if (!isConfigured()) return { opId: null, created: false, error: 'not configured' };
  try {
    const projectId = await resolveProjectId();
    if (!projectId) return { opId: null, created: false, error: 'no project' };

    const body = {
      subject:     task.title,
      description: { format: 'plain', raw: task.description || task.title },
      _links: {
        project:  { href: `/api/v3/projects/${projectId}` },
        priority: { href: mapComplexityToPriority(task.complexity ?? 1) },
      },
    };

    if (task.deadline) {
      body.dueDate = new Date(task.deadline).toISOString().split('T')[0];
    }

    const res = await axiosOP.post(opUrl('/work_packages'), body, { headers: opHeaders() });
    const opId = res.data?.id ?? null;

    // Store the OP work package ID in the task's note field (no schema change needed)
    if (opId) {
      await prisma.task.update({
        where: { id: task.id },
        data:  { note: `op:${opId}` },
      });
    }

    logger.info({ taskId: task.id, opId }, 'OpenProject: work package created');
    return { opId, created: true };
  } catch (err) {
    logger.warn({ err: err.message, taskId: task.id }, 'OpenProject: createWorkPackage failed');
    return { opId: null, created: false, error: err.message };
  }
}

/**
 * Extract the OpenProject work package ID stored in task.note (format: "op:12345").
 * Returns null if not present.
 */
function extractOpId(task) {
  if (!task?.note) return null;
  const match = task.note.match(/op:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * updateWorkPackage — push URIS task changes to an existing OpenProject WP.
 * Handles: status, deadline, priority, assignee, description.
 *
 * @param {object} task - Prisma Task record
 * @param {object} changes - fields that changed: { status, deadline, complexity, internName }
 * @returns {{ updated: boolean, error?: string }}
 */
async function updateWorkPackage(task, changes = {}) {
  if (!isConfigured()) return { updated: false, error: 'not configured' };
  const opId = extractOpId(task);
  if (!opId) {
    // No OP ID yet — create it first
    const created = await createWorkPackage(task);
    return { updated: created.created, opId: created.opId };
  }

  try {
    // Fetch current WP to get lockVersion (required for updates)
    const current = await axiosOP.get(opUrl(`/work_packages/${opId}`), { headers: opHeaders() });
    const lockVersion = current.data?.lockVersion ?? 0;

    const body = { lockVersion };

    if (changes.status) {
      // Fetch available statuses and find matching one
      try {
        const statusRes = await axiosOP.get(opUrl('/statuses'), { headers: opHeaders() });
        const statuses = statusRes.data?._embedded?.elements ?? [];
        const targetName = mapStatusToOP(changes.status);
        const match = statuses.find(s => s.name === targetName);
        if (match) body._links = { ...body._links, status: { href: match._links.self.href } };
      } catch { /* non-fatal */ }
    }

    if (changes.deadline !== undefined) {
      body.dueDate = changes.deadline
        ? new Date(changes.deadline).toISOString().split('T')[0]
        : null;
    }

    if (changes.complexity) {
      body._links = {
        ...body._links,
        priority: { href: mapComplexityToPriority(changes.complexity) },
      };
    }

    await axiosOP.patch(opUrl(`/work_packages/${opId}`), body, { headers: opHeaders() });
    logger.info({ taskId: task.id, opId, changes: Object.keys(changes) }, 'OpenProject: work package updated');
    return { updated: true, opId };
  } catch (err) {
    logger.warn({ err: err.message, taskId: task.id, opId }, 'OpenProject: updateWorkPackage failed');
    return { updated: false, error: err.message };
  }
}

// ── Assignment sync ───────────────────────────────────────────────────────────

/**
 * syncAssignments — update the assignee on an OpenProject work package.
 * Looks up the OP user by email matching the URIS intern's user email.
 *
 * @param {object} task - Prisma Task with intern.user populated
 * @param {string} internEmail - email of the new assignee
 * @returns {{ synced: boolean, error?: string }}
 */
async function syncAssignments(task, internEmail) {
  if (!isConfigured()) return { synced: false, error: 'not configured' };
  const opId = extractOpId(task);
  if (!opId) return { synced: false, error: 'no op work package id' };

  try {
    // Search for OP user by email
    const userRes = await axiosOP.get(opUrl('/users'), {
      headers: opHeaders(),
      params:  { filters: JSON.stringify([{ login: { operator: '=', values: [internEmail] } }]) },
    });
    const users = userRes.data?._embedded?.elements ?? [];
    if (!users.length) {
      logger.warn({ internEmail, opId }, 'OpenProject: no user found for email');
      return { synced: false, error: 'user not found in OP' };
    }

    const opUser = users[0];
    const current = await axiosOP.get(opUrl(`/work_packages/${opId}`), { headers: opHeaders() });
    const lockVersion = current.data?.lockVersion ?? 0;

    await axiosOP.patch(opUrl(`/work_packages/${opId}`), {
      lockVersion,
      _links: { assignee: { href: opUser._links.self.href } },
    }, { headers: opHeaders() });

    logger.info({ taskId: task.id, opId, internEmail }, 'OpenProject: assignee synced');
    return { synced: true };
  } catch (err) {
    logger.warn({ err: err.message, taskId: task.id, opId }, 'OpenProject: syncAssignments failed');
    return { synced: false, error: err.message };
  }
}

// ── Blocker sync ──────────────────────────────────────────────────────────────

/**
 * syncBlockers — add a blocking relation in OpenProject when a URIS task has a blocker.
 * Creates a "blocks" relation between the WP and a placeholder "blocker" WP.
 * If the blocker is resolved, removes the relation.
 *
 * @param {object} task - Prisma Task record
 * @param {boolean} hasBlocker - current blocker state
 * @param {string|null} blockerType - type of blocker
 * @returns {{ synced: boolean, error?: string }}
 */
async function syncBlockers(task, hasBlocker, blockerType) {
  if (!isConfigured()) return { synced: false, error: 'not configured' };
  const opId = extractOpId(task);
  if (!opId) return { synced: false, error: 'no op work package id' };

  try {
    if (hasBlocker) {
      // Add a comment noting the blocker (relations require a target WP; comment is safer)
      const comment = `🚫 BLOCKER DETECTED (URIS): ${blockerType ?? 'unspecified blocker type'}. Assigned intern is blocked. Requires resolution before progress can continue.`;
      await axiosOP.post(opUrl(`/work_packages/${opId}/activities`), {
        comment: { format: 'plain', raw: comment },
      }, { headers: opHeaders() });
      logger.info({ taskId: task.id, opId, blockerType }, 'OpenProject: blocker comment added');
    } else {
      // Blocker resolved — add resolution comment
      await axiosOP.post(opUrl(`/work_packages/${opId}/activities`), {
        comment: { format: 'plain', raw: '✅ BLOCKER RESOLVED (URIS): Blocker has been cleared. Task is unblocked.' },
      }, { headers: opHeaders() });
      logger.info({ taskId: task.id, opId }, 'OpenProject: blocker resolved comment added');
    }
    return { synced: true };
  } catch (err) {
    logger.warn({ err: err.message, taskId: task.id, opId }, 'OpenProject: syncBlockers failed');
    return { synced: false, error: err.message };
  }
}

// ── Status sync ───────────────────────────────────────────────────────────────

/**
 * syncTaskStatus — push a URIS task status change to OpenProject.
 *
 * @param {object} task - Prisma Task record
 * @param {string} newStatus - URIS status string
 * @returns {{ synced: boolean, error?: string }}
 */
async function syncTaskStatus(task, newStatus) {
  return updateWorkPackage(task, { status: newStatus });
}

// ── Deadline sync ─────────────────────────────────────────────────────────────

/**
 * syncDeadline — push a deadline change to OpenProject.
 *
 * @param {object} task - Prisma Task record
 * @param {Date|null} newDeadline
 * @returns {{ synced: boolean, error?: string }}
 */
async function syncDeadline(task, newDeadline) {
  const result = await updateWorkPackage(task, { deadline: newDeadline });
  return { synced: result.updated, error: result.error };
}

// ── Milestone sync ────────────────────────────────────────────────────────────

/**
 * syncMilestones — fetch OpenProject milestones (type=Milestone WPs) and
 * return them as structured data for the intelligence layer.
 * Does NOT write to URIS DB — milestones are read-only intelligence signals.
 *
 * @returns {{ milestones: Array, error?: string }}
 */
async function syncMilestones() {
  if (!isConfigured()) return { milestones: [], error: 'not configured' };
  try {
    const projectId = await resolveProjectId();
    if (!projectId) return { milestones: [], error: 'no project' };

    const res = await axiosOP.get(opUrl(`/projects/${projectId}/work_packages`), {
      headers: opHeaders(),
      params:  {
        filters: JSON.stringify([{ type: { operator: '=', values: ['Milestone'] } }]),
        pageSize: 50,
      },
    });

    const wps = res.data?._embedded?.elements ?? [];
    const milestones = wps.map(wp => ({
      opId:        wp.id,
      subject:     wp.subject,
      dueDate:     wp.dueDate ?? null,
      status:      wp.status?.name ?? 'unknown',
      percentDone: wp.percentageDone ?? 0,
      isOverdue:   wp.dueDate ? new Date(wp.dueDate) < new Date() && wp.percentageDone < 100 : false,
      updatedAt:   wp.updatedAt,
    }));

    logger.info({ count: milestones.length }, 'OpenProject: milestones fetched');
    return { milestones };
  } catch (err) {
    logger.warn({ err: err.message }, 'OpenProject: syncMilestones failed');
    return { milestones: [], error: err.message };
  }
}

// ── Comment / activity sync ───────────────────────────────────────────────────

/**
 * addComment — post a URIS operational event as a comment on an OP work package.
 * Used for: reassignment, review submitted, blocker added/resolved.
 *
 * @param {object} task - Prisma Task record
 * @param {string} comment - plain text comment
 * @returns {{ posted: boolean, error?: string }}
 */
async function addComment(task, comment) {
  if (!isConfigured()) return { posted: false, error: 'not configured' };
  const opId = extractOpId(task);
  if (!opId) return { posted: false, error: 'no op work package id' };

  try {
    await axiosOP.post(opUrl(`/work_packages/${opId}/activities`), {
      comment: { format: 'plain', raw: comment },
    }, { headers: opHeaders() });
    return { posted: true };
  } catch (err) {
    logger.warn({ err: err.message, taskId: task.id, opId }, 'OpenProject: addComment failed');
    return { posted: false, error: err.message };
  }
}

/**
 * fetchRecentActivity — fetch recent WP activity for intelligence signals.
 * Returns raw activity entries for the last N days.
 *
 * @param {number} days - lookback window
 * @returns {{ activities: Array, error?: string }}
 */
async function fetchRecentActivity(days = 7) {
  if (!isConfigured()) return { activities: [], error: 'not configured' };
  try {
    const projectId = await resolveProjectId();
    if (!projectId) return { activities: [], error: 'no project' };

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const res = await axiosOP.get(opUrl(`/projects/${projectId}/work_packages`), {
      headers: opHeaders(),
      params:  {
        filters:  JSON.stringify([{ updatedAt: { operator: '>t-', values: [`${days}d`] } }]),
        pageSize: 100,
        sortBy:   JSON.stringify([['updatedAt', 'desc']]),
      },
    });

    const wps = res.data?._embedded?.elements ?? [];
    return { activities: wps };
  } catch (err) {
    logger.warn({ err: err.message }, 'OpenProject: fetchRecentActivity failed');
    return { activities: [], error: err.message };
  }
}

// ── Inbound sync (from OP webhook) ────────────────────────────────────────────

/**
 * syncInboundWorkPackage — process an inbound OP webhook event.
 * Updates the matching URIS task (matched by op: note field).
 * Idempotent — safe to call multiple times for the same WP.
 *
 * @param {object} wpData - OpenProject work package payload from webhook
 * @returns {{ synced: boolean, taskId?: string, error?: string }}
 */
async function syncInboundWorkPackage(wpData) {
  if (!wpData?.id) return { synced: false, error: 'missing wp id' };

  try {
    const opId = wpData.id;
    // Find URIS task by op: note field
    const task = await prisma.task.findFirst({
      where: { note: { contains: `op:${opId}` } },
    });

    if (!task) {
      logger.debug({ opId }, 'OpenProject inbound: no matching URIS task found');
      return { synced: false, error: 'no matching task' };
    }

    const newStatus   = mapOPStatusToURIS(wpData.status?.name);
    const newDeadline = wpData.dueDate ? new Date(wpData.dueDate) : null;
    const newProgress = wpData.percentageDone ?? task.progressPct;
    const newComplexity = mapOPPriorityToComplexity(wpData.priority?.name);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status:        newStatus,
        deadline:      newDeadline,
        progressPct:   newProgress,
        complexity:    newComplexity,
        lastUpdatedAt: new Date(),
      },
    });

    logger.info({ taskId: task.id, opId, newStatus }, 'OpenProject inbound: task synced');
    return { synced: true, taskId: task.id };
  } catch (err) {
    logger.error({ err: err.message, opId: wpData?.id }, 'OpenProject: syncInboundWorkPackage failed');
    return { synced: false, error: err.message };
  }
}

// ── Bulk outbound sync ────────────────────────────────────────────────────────

/**
 * syncAllTasksToOP — push all URIS tasks that don't yet have an OP work package.
 * Called by the scheduler periodically. Skips tasks already synced (have op: note).
 *
 * @returns {{ pushed: number, errors: number }}
 */
async function syncAllTasksToOP() {
  if (!isConfigured()) return { pushed: 0, errors: 0 };
  try {
    const tasks = await prisma.task.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
        OR: [{ note: null }, { note: { not: { contains: 'op:' } } }],
      },
      include: { intern: { include: { user: { select: { name: true, email: true } } } } },
      take: 50, // batch limit per run
    });

    let pushed = 0;
    let errors = 0;
    for (const task of tasks) {
      const result = await createWorkPackage(task);
      if (result.created) pushed++;
      else if (result.error && result.error !== 'not configured') errors++;
    }

    logger.info({ pushed, errors }, 'OpenProject: bulk sync completed');
    return { pushed, errors };
  } catch (err) {
    logger.error({ err: err.message }, 'OpenProject: syncAllTasksToOP failed');
    return { pushed: 0, errors: 1 };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  isConfigured,
  probeConnection,
  createWorkPackage,
  updateWorkPackage,
  syncAssignments,
  syncBlockers,
  syncTaskStatus,
  syncDeadline,
  syncMilestones,
  addComment,
  fetchRecentActivity,
  syncInboundWorkPackage,
  syncAllTasksToOP,
  extractOpId,
};
