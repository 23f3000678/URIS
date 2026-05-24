/**
 * Audit log service — fetch paginated audit trail from the backend.
 * Admin-only endpoint; the API interceptor attaches the JWT automatically.
 */
import api from './api'

export interface AuditLog {
  id:              string
  userId:          string | null
  userName:        string | null   // email (for backward compat)
  userEmail:       string | null   // explicit email field
  userDisplayName: string | null   // human name
  action:          string
  entity:          string
  entityId:        string | null
  metadata:        Record<string, unknown> | null
  createdAt:       string
}

export interface AuditLogMeta {
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

export interface AuditLogFilters {
  action?: string
  entity?: string
  email?:  string   // filter by actor email
  from?:   string   // ISO date string
  to?:     string   // ISO date string
  page?:   number
  limit?:  number
}

export interface AuditLogResponse {
  logs: AuditLog[]
  meta: AuditLogMeta
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.entity) params.set('entity', filters.entity)
  if (filters.email)  params.set('email',  filters.email)
  if (filters.from)   params.set('from',   filters.from)
  if (filters.to)     params.set('to',     filters.to)
  if (filters.page)   params.set('page',   String(filters.page))
  if (filters.limit)  params.set('limit',  String(filters.limit))

  const res = await api.get<{ success: boolean; data: AuditLog[]; meta: AuditLogMeta }>(
    `/audit-logs?${params.toString()}`
  )
  return { logs: res.data.data, meta: res.data.meta }
}
