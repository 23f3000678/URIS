'use strict';

/**
 * workflowEvents.js — Phase 9 Workflow & Collaboration Layer
 *
 * Every event type that can appear in the WorkflowEvent timeline.
 * Used by workflowService.js to record events and by the frontend to render them.
 */

const WORKFLOW_EVENT_TYPES = Object.freeze({
  // Task lifecycle
  TASK_CREATED:        'TASK_CREATED',
  TASK_ASSIGNED:       'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_DELETED:        'TASK_DELETED',

  // Progress
  PROGRESS_UPDATED:    'PROGRESS_UPDATED',

  // Blockers
  BLOCKER_REPORTED:    'BLOCKER_REPORTED',
  BLOCKER_CLEARED:     'BLOCKER_CLEARED',

  // Notes
  NOTE_ADDED:          'NOTE_ADDED',
  NOTE_UPDATED:        'NOTE_UPDATED',
  NOTE_DELETED:        'NOTE_DELETED',

  // Escalations
  ESCALATION_RAISED:   'ESCALATION_RAISED',
  ESCALATION_ACKNOWLEDGED: 'ESCALATION_ACKNOWLEDGED',
  ESCALATION_RESOLVED: 'ESCALATION_RESOLVED',

  // Reviews
  REVIEW_SUBMITTED:    'REVIEW_SUBMITTED',

  // Admin actions
  TASK_PAUSED:         'TASK_PAUSED',
  TASK_RESUMED:        'TASK_RESUMED',
  SCORE_OVERRIDDEN:    'SCORE_OVERRIDDEN',
});

module.exports = { WORKFLOW_EVENT_TYPES };
