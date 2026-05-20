/**
 * Smoke tests — RoleGuard
 *
 * Verifies that RoleGuard shows/hides content based on the user's role
 * without redirecting (unlike ProtectedRoute).
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RoleGuard from '../routes/RoleGuard'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'

const adminUser: AuthUser = {
  id: 'a', name: 'Admin', email: 'a@a.com', role: 'core_admin', teamId: null,
}
const internUser: AuthUser = {
  id: 'b', name: 'Intern', email: 'b@b.com', role: 'technical_intern', teamId: null,
}

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null, isAuthenticated: false })
})

describe('RoleGuard', () => {
  test('renders children when role matches single allow value', () => {
    useAuthStore.setState({ token: 't', user: adminUser, isAuthenticated: true })
    render(<RoleGuard allow={'core_admin' as any}><div>Admin Content</div></RoleGuard>)
    expect(screen.getByText('Admin Content')).toBeDefined()
  })

  test('hides children when role does not match', () => {
    useAuthStore.setState({ token: 't', user: internUser, isAuthenticated: true })
    render(<RoleGuard allow={'core_admin' as any}><div>Admin Content</div></RoleGuard>)
    expect(screen.queryByText('Admin Content')).toBeNull()
  })

  test('renders fallback when role does not match', () => {
    useAuthStore.setState({ token: 't', user: internUser, isAuthenticated: true })
    render(
      <RoleGuard allow={'core_admin' as any} fallback={<div>No Access</div>}>
        <div>Admin Content</div>
      </RoleGuard>
    )
    expect(screen.getByText('No Access')).toBeDefined()
    expect(screen.queryByText('Admin Content')).toBeNull()
  })

  test('renders children when role is in allow array', () => {
    useAuthStore.setState({ token: 't', user: internUser, isAuthenticated: true })
    render(
      <RoleGuard allow={['core_admin', 'technical_intern'] as any}>
        <div>Shared Content</div>
      </RoleGuard>
    )
    expect(screen.getByText('Shared Content')).toBeDefined()
  })

  test('hides children when not logged in', () => {
    render(<RoleGuard allow={'core_admin' as any}><div>Admin Content</div></RoleGuard>)
    expect(screen.queryByText('Admin Content')).toBeNull()
  })
})
