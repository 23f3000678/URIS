/**
 * RoleGuard — conditionally renders children based on the user's role.
 *
 * Unlike ProtectedRoute (which redirects), RoleGuard simply hides content
 * that the current user's role doesn't permit. Use it for conditional UI
 * sections inside a page that is already behind a ProtectedRoute.
 *
 * Usage
 * ─────
 *  import { ROLES } from '../constants/roles'
 *
 *  // Only admins see this block
 *  <RoleGuard allow={ROLES.ADMIN}>
 *    <AssignTaskButton />
 *  </RoleGuard>
 *
 *  // Only interns see this block
 *  <RoleGuard allow={ROLES.INTERN}>
 *    <SubmitAvailabilityPrompt />
 *  </RoleGuard>
 *
 *  // Multiple roles (any of these may see the content)
 *  <RoleGuard allow={[ROLES.ADMIN, ROLES.INTERN]}>
 *    <SharedWidget />
 *  </RoleGuard>
 *
 *  // With a fallback for the other role
 *  <RoleGuard allow={ROLES.ADMIN} fallback={<p>Admins only.</p>}>
 *    <AdminPanel />
 *  </RoleGuard>
 */

import { useAuthStore, selectUser } from '../store/authStore'
import { type Role } from '../constants/roles'

interface RoleGuardProps {
  /** Role or roles that are allowed to see the children. */
  allow:     Role | Role[]
  children:  React.ReactNode
  /** Optional content to render when the role check fails. */
  fallback?: React.ReactNode
}

export default function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const user     = useAuthStore(selectUser)
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const userRole = user?.role || ''

  const checkAllowed = (r: Role) => {
    if (r === 'admin') return isAdmin
    if (r === 'intern') return userRole.includes('intern') || userRole === 'orenda_member'
    return userRole === r
  }

  const allowed = Array.isArray(allow)
    ? allow.some(checkAllowed)
    : checkAllowed(allow)

  return allowed ? <>{children}</> : <>{fallback}</>
}
