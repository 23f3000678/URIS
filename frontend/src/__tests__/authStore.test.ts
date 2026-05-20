/**
 * Unit tests — authStore
 *
 * Verifies the auth store's state transitions, isAdmin() helper,
 * and backward-compat aliases without hitting the network.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../store/authStore'

const adminUser: AuthUser = {
  id:     'admin-uuid',
  name:   'Admin User',
  email:  'admin@test.local',
  role:   'core_admin',
  teamId: null,
}

const internUser: AuthUser = {
  id:     'intern-uuid',
  name:   'Intern User',
  email:  'intern@test.local',
  role:   'technical_intern',
  teamId: null,
}

// Reset store state before each test
beforeEach(() => {
  useAuthStore.setState({
    token:           null,
    user:            null,
    isAuthenticated: false,
  })
})

describe('authStore — login / logout', () => {
  test('login() sets token, user, and isAuthenticated', () => {
    useAuthStore.getState().login('test-token', adminUser)
    const state = useAuthStore.getState()
    expect(state.token).toBe('test-token')
    expect(state.user).toEqual(adminUser)
    expect(state.isAuthenticated).toBe(true)
  })

  test('logout() clears all auth state', () => {
    useAuthStore.getState().login('test-token', adminUser)
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  test('setUser() patches user without changing token', () => {
    useAuthStore.getState().login('test-token', adminUser)
    const updated = { ...adminUser, name: 'Updated Name' }
    useAuthStore.getState().setUser(updated)
    expect(useAuthStore.getState().user?.name).toBe('Updated Name')
    expect(useAuthStore.getState().token).toBe('test-token')
  })
})

describe('authStore — isAdmin()', () => {
  test('returns true for core_admin role', () => {
    useAuthStore.getState().login('t', adminUser)
    expect(useAuthStore.getState().isAdmin()).toBe(true)
  })

  test('returns true for legacy "admin" role (backward compat)', () => {
    useAuthStore.getState().login('t', { ...adminUser, role: 'admin' })
    expect(useAuthStore.getState().isAdmin()).toBe(true)
  })

  test('returns true for technical_lead role', () => {
    useAuthStore.getState().login('t', { ...adminUser, role: 'technical_lead' })
    expect(useAuthStore.getState().isAdmin()).toBe(true)
  })

  test('returns false for technical_intern role', () => {
    useAuthStore.getState().login('t', internUser)
    expect(useAuthStore.getState().isAdmin()).toBe(false)
  })

  test('returns false when not logged in', () => {
    expect(useAuthStore.getState().isAdmin()).toBe(false)
  })

  test('uses explicit set check — not substring matching', () => {
    // "core_admin_extra" should NOT match
    useAuthStore.getState().login('t', { ...adminUser, role: 'core_admin_extra' as any })
    expect(useAuthStore.getState().isAdmin()).toBe(false)
  })
})

describe('authStore — backward-compat aliases', () => {
  test('setAuth() is an alias for login()', () => {
    useAuthStore.getState().setAuth('alias-token', adminUser)
    expect(useAuthStore.getState().token).toBe('alias-token')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  test('clearAuth() is an alias for logout()', () => {
    useAuthStore.getState().login('t', adminUser)
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
