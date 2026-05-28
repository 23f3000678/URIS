/**
 * ProtectedRoute — wraps a route to enforce authentication and optional role-based access.
 *
 * Props:
 *   children    — the page component to render when access is granted
 *   allowRoles  — optional array of roles that may access this route
 *   adminOnly   — shorthand for allowRoles={[ROLES.CORE_ADMIN]}
 *
 * Behaviour:
 *   - Unauthenticated → redirect to /login
 *   - Wrong role      → redirect to /dashboard
 *   - Authorised      → render children
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore, selectIsAuthenticated } from '../store/authStore'
import { ROLES } from '../constants/roles'
import type { Role } from '../constants/roles'

interface ProtectedRouteProps {
  children:    React.ReactNode
  allowRoles?: Role[]
  adminOnly?:  boolean
}

export default function ProtectedRoute({ children, allowRoles, adminOnly }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const user            = useAuthStore(s => s.user)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Resolve the effective role restriction
  const roles: Role[] | undefined = adminOnly
    ? [ROLES.CORE_ADMIN]
    : allowRoles

  if (roles && roles.length > 0) {
    const userRole = user.role?.toLowerCase() as Role
    const allowed  = roles.map(r => r.toLowerCase())
    if (!allowed.includes(userRole)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
