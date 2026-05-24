'use strict';

const {
  addCollaborator, removeCollaborator, getCollaborators,
  addObserver, removeObserver, getObservers,
} = require('../services/collaborationService');
const { ok, notFound } = require('../utils/respond');

// ── Collaborators ─────────────────────────────────────────────────────────────

async function listCollaborators(req, res, next) {
  try {
    const data = await getCollaborators(req.params.taskId);
    return ok(res, data, 'Collaborators fetched.');
  } catch (err) { next(err); }
}

async function addCollaboratorHandler(req, res, next) {
  try {
    const { teamId } = req.body;
    const data = await addCollaborator(req.params.taskId, teamId, req.user.id);
    return ok(res, data, 'Collaborator team added.');
  } catch (err) { next(err); }
}

async function removeCollaboratorHandler(req, res, next) {
  try {
    await removeCollaborator(req.params.taskId, req.params.teamId, req.user.id);
    return ok(res, null, 'Collaborator team removed.');
  } catch (err) { next(err); }
}

// ── Observers ─────────────────────────────────────────────────────────────────

async function listObservers(req, res, next) {
  try {
    const data = await getObservers(req.params.taskId);
    return ok(res, data, 'Observers fetched.');
  } catch (err) { next(err); }
}

async function addObserverHandler(req, res, next) {
  try {
    const { userId } = req.body;
    const data = await addObserver(req.params.taskId, userId, req.user.id);
    return ok(res, data, 'Observer added.');
  } catch (err) { next(err); }
}

async function removeObserverHandler(req, res, next) {
  try {
    await removeObserver(req.params.taskId, req.params.userId, req.user.id);
    return ok(res, null, 'Observer removed.');
  } catch (err) { next(err); }
}

module.exports = {
  listCollaborators, addCollaboratorHandler, removeCollaboratorHandler,
  listObservers, addObserverHandler, removeObserverHandler,
};
