/**
 * workflow.service.ts — Phase 9 Workflow & Collaboration Layer
 */
import api from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskNote {
  id:         string
  taskId:     string
  authorId:   string
  content:    string
  isInternal: boolean
  createdAt:  string
  updatedAt:  string
  author:     { id: string; name: string; email: string } | null
}

export type EscalationStatus = 'open' | 'acknowledged' | 'resolved'
export type EscalateTo = 'lead' | 'operations' | 'core_admin'

export interface TaskEscalation {
  id:            string
  taskId:        string
  requestedById: string
  escalateTo:    EscalateTo
  reason:        string
  status:        EscalationStatus
  resolvedById:  string | null
  resolvedNote:  string | null
  createdAt:     string
  updatedAt:     string
  requester:     { id: string; name: string; email: string } | null
  resolver:      { id: string; name: string; email: string } | null
}

export interface WorkflowEvent {
  id:        string
  taskId:    string
  actorId:   string | null
  eventType: string
  payload:   Record<string, unknown> | null
  createdAt: string
  actor:     { id: string; name: string; email: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrap<T>(p: Promise<{ data: { success: boolean; data: T } }>): Promise<T> {
  return p.then(r => r.data.data)
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export const getTaskNotes   = (taskId: string): Promise<TaskNote[]> =>
  wrap(api.get(`/workflow/tasks/${taskId}/notes`))

export const addTaskNote    = (taskId: string, content: string, isInternal = true): Promise<TaskNote> =>
  wrap(api.post(`/workflow/tasks/${taskId}/notes`, { content, isInternal }))

export const updateTaskNote = (noteId: string, content: string): Promise<TaskNote> =>
  wrap(api.patch(`/workflow/notes/${noteId}`, { content }))

export const deleteTaskNote = (noteId: string): Promise<void> =>
  wrap(api.delete(`/workflow/notes/${noteId}`))

// ── Escalations ───────────────────────────────────────────────────────────────

export const getTaskEscalations = (taskId: string): Promise<{ escalations: TaskEscalation[] }> =>
  wrap(api.get(`/workflow/tasks/${taskId}/escalations`))

export const getAllEscalations  = (params?: { status?: EscalationStatus }): Promise<{ escalations: TaskEscalation[] }> =>
  wrap(api.get('/workflow/escalations', { params }))

export const raiseEscalation    = (taskId: string, escalateTo: EscalateTo, reason: string): Promise<TaskEscalation> =>
  wrap(api.post(`/workflow/tasks/${taskId}/escalations`, { escalateTo, reason }))

export const acknowledgeEscalation = (escalationId: string): Promise<TaskEscalation> =>
  wrap(api.post(`/workflow/escalations/${escalationId}/acknowledge`))

export const resolveEscalation  = (escalationId: string, resolvedNote?: string): Promise<TaskEscalation> =>
  wrap(api.post(`/workflow/escalations/${escalationId}/resolve`, { resolvedNote }))

// ── Timeline ──────────────────────────────────────────────────────────────────

export const getTaskTimeline = (taskId: string): Promise<WorkflowEvent[]> =>
  wrap(api.get(`/workflow/tasks/${taskId}/timeline`))
