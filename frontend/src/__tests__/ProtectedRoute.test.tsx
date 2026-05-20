/**
 * Smoke tests — ProtectedRoute
 *
 * Verifies that:
 *   - Unauthenticated users are redirected to /login
 *   - Authenticated users with wrong role are redirected to /dashboard
 *   - Authenticated users with correct role see the children
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../routes/ProtectedRoute'
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

function renderWithRouter(ui: React.ReactNode, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/login"     element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  test('redirects unauthenticated user to /login', () => {
    renderWithRouter(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    )
    expect(screen.getByText('Login Page')).toBeDefined()
    expect(screen.queryByText('Secret')).toBeNull()
  })

  test('renders children for authenticated user with no role restriction', () => {
    useAuthStore.setState({ token: 'tok', user: internUser, isAuthenticated: true })
    renderWithRouter(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    )
    expect(screen.getByText('Secret')).toBeDefined()
  })

  test('redirects to /dashboard when role is not in allowRoles', () => {
    useAuthStore.setState({ token: 'tok', user: internUser, isAuthenticated: true })
    renderWithRouter(
      <ProtectedRoute allowRoles={['core_admin' as any]}><div>Admin Only</div></ProtectedRoute>
    )
    expect(screen.getByText('Dashboard Page')).toBeDefined()
    expect(screen.queryByText('Admin Only')).toBeNull()
  })

  test('renders children when role matches allowRoles', () => {
    useAuthStore.setState({ token: 'tok', user: adminUser, isAuthenticated: true })
    renderWithRouter(
      <ProtectedRoute allowRoles={['core_admin' as any]}><div>Admin Only</div></ProtectedRoute>
    )
    expect(screen.getByText('Admin Only')).toBeDefined()
  })

  test('adminOnly shorthand redirects intern to /dashboard', () => {
    useAuthStore.setState({ token: 'tok', user: internUser, isAuthenticated: true })
    renderWithRouter(
      <ProtectedRoute adminOnly><div>Admin Only</div></ProtectedRoute>
    )
    expect(screen.getByText('Dashboard Page')).toBeDefined()
  })
})
