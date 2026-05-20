'use strict';

/**
 * workflow.controller.js — Phase 9 Workflow & Collaboration Layer
 */

const {
  addNote, updateNote, deleteNote, listNotes,
  raiseEscalation, acknowledgeEscalation, resolveEscalation, listEscalations,
  getTimeline,
} = require('../services/workflowService');
const { ok, created, validationError, notFound } = require('../utils/respond');
const { isUUID } = require('../utils/validate');

// ── Notes ─────────────────────────────────────────────────────────────────────

async function getNotes(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!isUUID(taskId)) return validationError(res, 'Invalid taskId');
    const notes = await listNotes(taskId, req.user.role);
    return ok(res, notes, 'Notes fetched.');
  } catch (err) { next(err); }
}

async function createNote(req, res, next) {
  try {
    const { taskId } = req.params;
    const { content, isInternal = true } = req.body;
    if (!isUUID(taskId)) return validationError(res, 'Invalid taskId');
    if (!content || typeof content !== 'string' || !content.trim()) {
      return validationError(res, 'content is required');
    }
    const note = await addNote(taskId, req.user.id, content, Boolean(isInternal));
    return created(res, note, 'Note added.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

async function editNote(req, res, next) {
  try {
    const { noteId } = req.params;
    const { content } = req.body;
    if (!isUUID(noteId)) return validationError(res, 'Invalid noteId');
    if (!content || typeof content !== 'string' || !content.trim()) {
      return validationError(res, 'content is required');
    }
    const note = await updateNote(noteId, req.user.id, content);
    return ok(res, note, 'Note updated.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

async function removeNote(req, res, next) {
  try {
    const { noteId } = req.params;
    if (!isUUID(noteId)) return validationError(res, 'Invalid noteId');
    await deleteNote(noteId, req.user.id, req.user.role);
    return ok(res, null, 'Note deleted.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

// ── Escalations ───────────────────────────────────────────────────────────────

async function getEscalations(req, res, next) {
  try {
    const { status } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const data  = await listEscalations({ status, page, limit });
    return ok(res, data, 'Escalations fetched.');
  } catch (err) { next(err); }
}

async function getTaskEscalations(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!isUUID(taskId)) return validationError(res, 'Invalid taskId');
    const data = await listEscalations({ taskId });
    return ok(res, data, 'Task escalations fetched.');
  } catch (err) { next(err); }
}

async function createEscalation(req, res, next) {
  try {
    const { taskId } = req.params;
    const { escalateTo, reason } = req.body;
    if (!isUUID(taskId)) return validationError(res, 'Invalid taskId');
    if (!escalateTo) return validationError(res, 'escalateTo is required');
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return validationError(res, 'reason is required');
    }
    const esc = await raiseEscalation(taskId, req.user.id, escalateTo, reason);
    return created(res, esc, 'Escalation raised.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

async function acknowledgeEsc(req, res, next) {
  try {
    const { escalationId } = req.params;
    if (!isUUID(escalationId)) return validationError(res, 'Invalid escalationId');
    const esc = await acknowledgeEscalation(escalationId, req.user.id);
    return ok(res, esc, 'Escalation acknowledged.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

async function resolveEsc(req, res, next) {
  try {
    const { escalationId } = req.params;
    const { resolvedNote } = req.body;
    if (!isUUID(escalationId)) return validationError(res, 'Invalid escalationId');
    const esc = await resolveEscalation(escalationId, req.user.id, resolvedNote ?? null);
    return ok(res, esc, 'Escalation resolved.');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message, data: null });
    next(err);
  }
}

// ── Timeline ──────────────────────────────────────────────────────────────────

async function getTaskTimeline(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!isUUID(taskId)) return validationError(res, 'Invalid taskId');
    const events = await getTimeline(taskId);
    return ok(res, events, 'Timeline fetched.');
  } catch (err) { next(err); }
}

module.exports = {
  getNotes, createNote, editNote, removeNote,
  getEscalations, getTaskEscalations, createEscalation, acknowledgeEsc, resolveEsc,
  getTaskTimeline,
};
