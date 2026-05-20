/**
 * ProtectedRoute — wraps any page that requires authentication and
 * optionally enforces role-based access.
 *
 * Behaviour
 * ─────────
 *  • Not authenticated              → redirect to /login
 *  • Authenticated, role not allowed → redirect to /dashboard
 *  • Authenticated, role allowed     → render children
 *
 * Props
 * ─────
 *  allowRoles  — array of roles that may access this route.
 *                If omitted, any authenticated user is allowed.
 *  adminOnly   — shorthand for allowRoles={[ROLES.ADMIN]}.
 *                Kept for backward compatibility.
 *
 * Usage
 * ─────
 *  // Any authenticated user
 *  <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
 *
 *  // Admin only (shorthand)
 *  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminOverview /></ProtectedRoute>} />
 *
 *  // Explicit role list (scalable — add ROLES.TEAM_LEAD when ready)
 *  <Route path="/reports" element={
 *    <ProtectedRoute allowRoles={[ROLES.ADMIN]}>
 *      <Reports />
 *    </ProtectedRoute>
 *  } />
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore, selectIsAuthenticated, selectUser } from '../store/authStore'
import { type Role } from '../constants/roles'

interface ProtectedRouteProps {
  children:    React.ReactNode
  /**
   * Explicit list of roles that may access this route.
   * Takes precedence over adminOnly.
   */
  allowRoles?: Role[]
  /**
   * Shorthand for allowRoles={[ROLES.ADMIN]}.
   * @deprecated Prefer allowRoles for clarity.
   */
  adminOnly?:  boolean
}

export default function ProtectedRoute({
  children,
  allowRoles,
  adminOnly = false,
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const user            = useAuthStore(selectUser)
  const token           = useAuthStore(s => s.token)
  const isAdmin         = useAuthStore(s => s.isAdmin())

  // Not logged in → send to login
  // Check both isAuthenticated and token directly to handle the Zustand
  // persist rehydration race: login() sets token synchronously but
  // isAuthenticated may lag one render cycle on initial hydration.
  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />
  }

  // If adminOnly restriction is set, check if the user is an admin
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // If a specific list of roles is allowed, enforce it
  if (allowRoles && allowRoles.length > 0) {
    const userRole = user?.role || ''
    const isAllowed = allowRoles.some(r => {
      if (r === 'admin') return isAdmin
      if (r === 'intern') return userRole.includes('intern') || userRole === 'orenda_member'
      return userRole === r
    })
    if (!isAllowed) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
