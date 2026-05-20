/**
 * usePermission — Phase 8 Enterprise Governance Layer
 *
 * Returns a function that checks whether the current user holds a named
 * permission. Uses the same role → permission mapping as the backend.
 *
 * Usage:
 *   const can = usePermission()
 *   if (can(PERMISSIONS.CAN_ASSIGN_TASKS)) { ... }
 *
 * The mapping is kept client-side for instant UI rendering without a network
 * round-trip. The backend enforces the same rules — client checks are UI-only.
 */

import { useAuthStore, selectUser } from '../store/authStore'
import { PERMISSIONS, type Permission } from '../constants/roles'

// ── Role → Permission map (mirrors backend constants/permissions.js) ──────────

const ROLE_PERMISSION_MAP: Record<string, Set<Permission>> = {
  core_admin: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_SUBMIT_REVIEW,
    PERMISSIONS.CAN_ARCHIVE_USERS,
    PERMISSIONS.CAN_RESTORE_USERS,
    PERMISSIONS.CAN_FINISH_INTERNSHIP,
    PERMISSIONS.CAN_CHANGE_USER_ROLE,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_MANAGE_IP_BLOCKS,
    PERMISSIONS.CAN_VIEW_LOGIN_LOGS,
    PERMISSIONS.CAN_VIEW_ANALYTICS,
    PERMISSIONS.CAN_MANAGE_APPROVALS,
    PERMISSIONS.CAN_VIEW_AUDIT_LOGS,
    PERMISSIONS.CAN_MANAGE_SUPPORT,
    PERMISSIONS.CAN_VIEW_NOTES,
    PERMISSIONS.CAN_VIEW_ALL_INTERNS,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  technical_lead: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_SUBMIT_REVIEW,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_ANALYTICS,
    PERMISSIONS.CAN_VIEW_NOTES,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  operations_lead: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_FINISH_INTERNSHIP,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_ANALYTICS,
    PERMISSIONS.CAN_MANAGE_SUPPORT,
    PERMISSIONS.CAN_VIEW_ALL_INTERNS,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  research_lead: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_SUBMIT_REVIEW,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_ANALYTICS,
    PERMISSIONS.CAN_VIEW_NOTES,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  operations_program_manager: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_SUBMIT_REVIEW,
    PERMISSIONS.CAN_FINISH_INTERNSHIP,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_ANALYTICS,
    PERMISSIONS.CAN_MANAGE_SUPPORT,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  observer_team_lead: new Set([
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_NOTES,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  collaborator_lead: new Set([
    PERMISSIONS.CAN_ASSIGN_TASKS,
    PERMISSIONS.CAN_CREATE_TASKS,
    PERMISSIONS.CAN_DELETE_TASKS,
    PERMISSIONS.CAN_UPDATE_TASK_STATUS,
    PERMISSIONS.CAN_OVERRIDE_SCORE,
    PERMISSIONS.CAN_SUBMIT_REVIEW,
    PERMISSIONS.CAN_APPROVE_USERS,
    PERMISSIONS.CAN_VIEW_NOTES,
    PERMISSIONS.CAN_VIEW_TEAM_INTERNS,
  ]),
  // Interns and other roles have no permissions in this map → empty set
}

// Legacy aliases
ROLE_PERMISSION_MAP['admin']  = ROLE_PERMISSION_MAP['core_admin']
ROLE_PERMISSION_MAP['intern'] = new Set()

/**
 * Returns a permission-check function for the current user.
 *
 * @returns {(permission: Permission) => boolean}
 */
export function usePermission(): (permission: Permission) => boolean {
  const user = useAuthStore(selectUser)
  const role = user?.role ?? ''
  const permSet = ROLE_PERMISSION_MAP[role] ?? new Set()
  return (permission: Permission) => permSet.has(permission)
}

/**
 * Returns all permissions held by the current user.
 */
export function useAllPermissions(): Permission[] {
  const user = useAuthStore(selectUser)
  const role = user?.role ?? ''
  const permSet = ROLE_PERMISSION_MAP[role] ?? new Set<Permission>()
  return [...permSet]
}
