/**
 * RoleGuard — conditionally renders children based on the user's role.
 *
 * Unlike ProtectedRoute, RoleGuard does NOT redirect — it simply shows or
 * hides content. Use it inside pages to conditionally render UI sections.
 *
 * Props:
 *   allow    — a single role or array of roles that may see the content
 *   fallback — optional element to render when access is denied
 *   children — content to show when access is granted
 */

import { useAuthStore } from '../store/authStore'
import type { Role } from '../constants/roles'

interface RoleGuardProps {
  allow:     Role | Role[]
  fallback?: React.ReactNode
  children:  React.ReactNode
}

export default function RoleGuard({ allow, fallback = null, children }: RoleGuardProps) {
  const user = useAuthStore(s => s.user)

  if (!user) return <>{fallback}</>

  const userRole  = user.role?.toLowerCase() as Role
  const allowList = (Array.isArray(allow) ? allow : [allow]).map(r => r.toLowerCase())

  if (!allowList.includes(userRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
