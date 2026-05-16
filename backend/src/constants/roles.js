/**
 * RBAC role constants.
 *
 * These are the canonical role strings used everywhere in the system:
 *   - Prisma enum values (stored in the database)
 *   - JWT payload `role` field
 *   - checkRole() / requireRole() middleware arguments
 *
 * Adding a new role:
 *   1. Add it here:          ROLES.TEAM_LEAD = 'TEAM_LEAD'
 *   2. Add to Prisma schema: enum Role { INTERN ADMIN TEAM_LEAD }
 *   3. Run:                  npx prisma migrate dev
 *   4. Add to normalizeRole() map if the frontend sends a different string
 *   5. Apply requireRole() to the relevant routes
 *
 * Never use raw role strings anywhere else — always import from this file.
 */

/** @type {Object.<string, string>} */
const ROLES = Object.freeze({
  CORE_ADMIN:                 'CORE_ADMIN',
  TECHNICAL_LEAD:             'TECHNICAL_LEAD',
  OPERATIONS_LEAD:            'OPERATIONS_LEAD',
  RESEARCH_LEAD:              'RESEARCH_LEAD',
  OPERATIONS_PROGRAM_MANAGER: 'OPERATIONS_PROGRAM_MANAGER',
  TECHNICAL_INTERN:           'TECHNICAL_INTERN',
  OPERATIONS_INTERN:          'OPERATIONS_INTERN',
  RESEARCH_INTERN:            'RESEARCH_INTERN',
  OBSERVER_TEAM_LEAD:         'OBSERVER_TEAM_LEAD',
  COLLABORATOR_LEAD:          'COLLABORATOR_LEAD',
  ORENDA_MEMBER:              'ORENDA_MEMBER',
  PAST_EMPLOYEE:              'PAST_EMPLOYEE',
});

/**
 * All valid role values as a Set for O(1) membership checks.
 * @type {Set<string>}
 */
const VALID_ROLES = new Set(Object.values(ROLES));

/**
 * Maps any incoming role string (from API requests or UI) to a valid
 * Prisma Role enum value. Case-insensitive.
 *
 * Returns null for unrecognised values.
 *
 * @param {string} role
 * @returns {string | null}
 */
function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const input = role.toLowerCase().trim();
  
  const map = {
    'core_admin':                 ROLES.CORE_ADMIN,
    'admin':                      ROLES.CORE_ADMIN,
    'technical_lead':             ROLES.TECHNICAL_LEAD,
    'operations_lead':            ROLES.OPERATIONS_LEAD,
    'research_lead':              ROLES.RESEARCH_LEAD,
    'operations_program_manager': ROLES.OPERATIONS_PROGRAM_MANAGER,
    'program_manager':            ROLES.OPERATIONS_PROGRAM_MANAGER,
    'technical_intern':           ROLES.TECHNICAL_INTERN,
    'intern':                     ROLES.TECHNICAL_INTERN,
    'operations_intern':          ROLES.OPERATIONS_INTERN,
    'research_intern':            ROLES.RESEARCH_INTERN,
    'observer_team_lead':         ROLES.OBSERVER_TEAM_LEAD,
    'observer':                   ROLES.OBSERVER_TEAM_LEAD,
    'collaborator_lead':          ROLES.COLLABORATOR_LEAD,
    'collaborator':               ROLES.COLLABORATOR_LEAD,
    'orenda_member':              ROLES.ORENDA_MEMBER,
    'past_employee':              ROLES.PAST_EMPLOYEE,
    'alumni':                     ROLES.PAST_EMPLOYEE,
  };
  
  return map[input] ?? null;
}

module.exports = { ROLES, VALID_ROLES, normalizeRole };
