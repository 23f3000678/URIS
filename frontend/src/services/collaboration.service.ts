import api from './api'

export interface CollaboratorTeam {
  id: string
  taskId: string
  teamId: string
  team: {
    id: string
    name: string
    members: Array<{
      user: { id: string; name: string; email: string; role: string }
    }>
  }
}

export interface TaskObserver {
  id: string
  taskId: string
  userId: string
  user: { id: string; name: string; email: string; role: string }
}

export interface TeamOption {
  id: string
  name: string
}

export interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

// ── Collaborators ─────────────────────────────────────────────────────────────

export async function getCollaborators(taskId: string): Promise<CollaboratorTeam[]> {
  const res = await api.get(`/tasks/${taskId}/collaborators`)
  return res.data.data
}

export async function addCollaborator(taskId: string, teamId: string): Promise<CollaboratorTeam> {
  const res = await api.post(`/tasks/${taskId}/collaborators`, { teamId })
  return res.data.data
}

export async function removeCollaborator(taskId: string, teamId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/collaborators/${teamId}`)
}

// ── Observers ─────────────────────────────────────────────────────────────────

export async function getObservers(taskId: string): Promise<TaskObserver[]> {
  const res = await api.get(`/tasks/${taskId}/observers`)
  return res.data.data
}

export async function addObserver(taskId: string, userId: string): Promise<TaskObserver> {
  const res = await api.post(`/tasks/${taskId}/observers`, { userId })
  return res.data.data
}

export async function removeObserver(taskId: string, userId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/observers/${userId}`)
}

// ── Task description ──────────────────────────────────────────────────────────

export async function updateTaskDescription(taskId: string, description: string): Promise<void> {
  await api.patch(`/tasks/${taskId}/description`, { description })
}

// ── Role management ───────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const res = await api.get('/admin/users')
  return res.data.data
}

export async function changeUserRole(userId: string, newRole: string, reason?: string): Promise<void> {
  await api.post('/admin/change-role', { userId, newRole, reason })
}
