/**
 * Admin service — score overrides, task assignment, task status updates.
 */
import api from './api'

export interface OverrideScorePayload {
  internId: string
  score: number
  reason?: string
}

export interface AssignTaskPayload {
  internId: string
  taskId: string
}

export async function overrideScore(payload: OverrideScorePayload): Promise<void> {
  // Backend field is `overrideScore`, not `score`
  await api.post('/admin/override-score', {
    internId: payload.internId,
    overrideScore: payload.score,
    reason: payload.reason,
  })
}

export async function assignTask(payload: AssignTaskPayload): Promise<void> {
  await api.post('/assign/assign-task', payload)
}

export interface AvailabilityDeadline {
  day:    number  // 0=Sun, 1=Mon, ..., 6=Sat
  hour:   number  // 0–23
  minute: number  // 0–59
}

export async function getAvailabilityDeadline(): Promise<AvailabilityDeadline> {
  const res = await api.get<{ success: boolean; data: AvailabilityDeadline }>('/admin/availability-deadline')
  return res.data.data
}

export async function setAvailabilityDeadline(payload: AvailabilityDeadline): Promise<void> {
  await api.post('/admin/availability-deadline', payload)
}

export interface PendingUser {
  id:        string
  email:     string
  role:      string
  createdAt: string
}

export async function getPendingUsers(): Promise<PendingUser[]> {
  const res = await api.get<{ success: boolean; data: PendingUser[] }>('/admin/pending-users')
  return res.data.data
}

export async function approveUser(userId: string): Promise<void> {
  await api.post('/admin/approve-user', { userId })
}
