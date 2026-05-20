/**
 * Frontend RBAC role constants — Phase 8 updated.
 *
 * These match the lowercase role strings returned by the backend login API.
 * The backend stores uppercase enum values; the login service lowercases them.
 *
 * Adding a new role:
 *   1. Add it here
 *   2. Add to UserRole union type in authStore.ts
 *   3. Update ADMIN_ROLES if the new role has admin-level access
 *   4. Add to ROLE_PERMISSIONS in utils/permissions.ts
 *
 * Never use raw role strings in components — always import from here.
 */

export const ROLES = Object.freeze({
  // ── Admin / Lead roles ────────────────────────────────────────────────────
  CORE_ADMIN:                 'core_admin',
  TECHNICAL_LEAD:             'technical_lead',
  OPERATIONS_LEAD:            'operations_lead',
  RESEARCH_LEAD:              'research_lead',
  OPERATIONS_PROGRAM_MANAGER: 'operations_program_manager',
  OBSERVER_TEAM_LEAD:         'observer_team_lead',
  COLLABORATOR_LEAD:          'collaborator_lead',

  // ── Intern roles ──────────────────────────────────────────────────────────
  TECHNICAL_INTERN:           'technical_intern',
  OPERATIONS_INTERN:          'operations_intern',
  RESEARCH_INTERN:            'research_intern',
  ORENDA_MEMBER:              'orenda_member',

  // ── Special roles ─────────────────────────────────────────────────────────
  PAST_EMPLOYEE:              'past_employee',

  // ── Legacy aliases (backward compat with persisted sessions) ─────────────
  ADMIN:  'admin',
  INTERN: 'intern',
} as const)

/** Union type of all valid frontend role strings. */
export type Role = typeof ROLES[keyof typeof ROLES]

/**
 * Roles that have admin-level access.
 * Used by isAdmin() in authStore and ADMIN_ROLE_SET.
 */
export const ADMIN_ROLES: Role[] = [
  ROLES.CORE_ADMIN,
  ROLES.TECHNICAL_LEAD,
  ROLES.OPERATIONS_LEAD,
  ROLES.RESEARCH_LEAD,
  ROLES.OPERATIONS_PROGRAM_MANAGER,
  ROLES.OBSERVER_TEAM_LEAD,
  ROLES.COLLABORATOR_LEAD,
]

/**
 * Named permission constants — mirrors backend constants/permissions.js.
 * Used with usePermission() hook for permission-aware rendering.
 */
export const PERMISSIONS = Object.freeze({
  CAN_ASSIGN_TASKS:          'CAN_ASSIGN_TASKS',
  CAN_CREATE_TASKS:          'CAN_CREATE_TASKS',
  CAN_DELETE_TASKS:          'CAN_DELETE_TASKS',
  CAN_UPDATE_TASK_STATUS:    'CAN_UPDATE_TASK_STATUS',
  CAN_OVERRIDE_SCORE:        'CAN_OVERRIDE_SCORE',
  CAN_SUBMIT_REVIEW:         'CAN_SUBMIT_REVIEW',
  CAN_ARCHIVE_USERS:         'CAN_ARCHIVE_USERS',
  CAN_RESTORE_USERS:         'CAN_RESTORE_USERS',
  CAN_FINISH_INTERNSHIP:     'CAN_FINISH_INTERNSHIP',
  CAN_CHANGE_USER_ROLE:      'CAN_CHANGE_USER_ROLE',
  CAN_APPROVE_USERS:         'CAN_APPROVE_USERS',
  CAN_MANAGE_IP_BLOCKS:      'CAN_MANAGE_IP_BLOCKS',
  CAN_VIEW_LOGIN_LOGS:       'CAN_VIEW_LOGIN_LOGS',
  CAN_VIEW_ANALYTICS:        'CAN_VIEW_ANALYTICS',
  CAN_MANAGE_APPROVALS:      'CAN_MANAGE_APPROVALS',
  CAN_VIEW_AUDIT_LOGS:       'CAN_VIEW_AUDIT_LOGS',
  CAN_MANAGE_SUPPORT:        'CAN_MANAGE_SUPPORT',
  CAN_VIEW_NOTES:            'CAN_VIEW_NOTES',
  CAN_VIEW_ALL_INTERNS:      'CAN_VIEW_ALL_INTERNS',
  CAN_VIEW_TEAM_INTERNS:     'CAN_VIEW_TEAM_INTERNS',
} as const)

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
