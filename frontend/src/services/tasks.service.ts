/**
 * Tasks service — fetch, create, and update tasks.
 */
import api from './api'

export interface Task {
  id: string
  title: string
  assignee?: string
  internId?: string
  status: string
  complexity: number
  deadline?: string
  blocker?: string | null
  progress?: number
  progressPct?: number
  planeTaskId?: string
  skill?: string
  skills?: string[]
  note?: string
  isStale?: boolean
  hasBlocker?: boolean
  blockerType?: string | null
}

export interface CreateTaskPayload {
  title: string
  internId: string
  planeTaskId?: string
  complexity: number
  status: string
}

export interface UpdateStatusPayload {
  taskId: string
  status: string
  progress: number
}

export interface UpdateProgressPayload {
  progressPct: number
  note?: string
  hasBlocker?: boolean
  blockerType?: string | null
}

export interface AdminTaskControlPayload {
  taskId: string
  status: string
  progress?: number
  hasBlocker?: boolean
  blockerType?: string | null
  pauseReason?: string
}

export async function getAllTasks(): Promise<Task[]> {
  const res = await api.get<{ success: boolean; data: Task[] }>('/tasks')
  return res.data.data
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const res = await api.post<{ success: boolean; data: Task }>('/tasks/create', payload)
  return res.data.data
}

export async function updateTaskStatus(payload: UpdateStatusPayload): Promise<void> {
  await api.post('/admin/task/status', payload)
}

export async function adminControlTask(payload: AdminTaskControlPayload): Promise<void> {
  await api.post('/admin/task/status', payload)
}

export async function updateTaskProgress(taskId: string, payload: UpdateProgressPayload): Promise<void> {
  await api.patch(`/tasks/${taskId}/progress`, payload)
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await api.delete(`/tasks/${taskId}`)
  if (!res.data.success) throw new Error(res.data.message)
}

export interface TaskReview {
  id:         string
  taskId:     string
  quality:    number
  timeliness: number
  initiative: number
  complexity: number
  pps:        number
  createdAt:  string
}

export async function getReviewForTask(taskId: string): Promise<TaskReview | null> {
  const res = await api.get<{ success: boolean; data: TaskReview | null }>(`/review/task/${taskId}`)
  return res.data.data
}
