/**
 * SessionGuard
 *
 * Handles two session-ending scenarios:
 *
 * 1. Inactivity timeout — shows a warning modal 2 minutes before auto-logout.
 *    "Stay logged in" resets the timer; letting the countdown reach 0 logs out.
 *
 * 2. JWT hard expiry — decodes the token's `exp` claim on mount and on a
 *    60-second polling interval. If the token is within TOKEN_EXPIRY_WARN_S
 *    seconds of expiry, shows the same warning modal. If already expired,
 *    logs out immediately with no modal.
 *
 * Place this once inside the app — it is a no-op when not authenticated.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ShieldAlert } from 'lucide-react'
import { useAuthStore, selectIsAuthenticated, selectToken } from '../store/authStore'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { recordActivity } from '../services/activity.service'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Must match WARNING_BEFORE_MS in useSessionTimeout (seconds). */
const WARNING_DURATION_S = 2 * 60   // 2 minutes

/** Show the expiry warning this many seconds before the JWT expires. */
const TOKEN_EXPIRY_WARN_S = 5 * 60  // 5 minutes

/** How often to poll the token expiry (ms). */
const TOKEN_CHECK_INTERVAL_MS = 60_000  // 1 minute

// ── JWT decode helper ─────────────────────────────────────────────────────────

/**
 * Decode the `exp` claim from a JWT without a library.
 * Returns the expiry as a Unix timestamp in seconds, or null if unreadable.
 */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionGuard() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const token           = useAuthStore(selectToken)
  const logout          = useAuthStore(s => s.logout)
  const navigate        = useNavigate()

  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown]     = useState(WARNING_DURATION_S)
  const [warningReason, setWarningReason] = useState<'inactivity' | 'token_expiry'>('inactivity')
  const countdownRef                  = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenCheckRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Countdown ticker ───────────────────────────────────────────────────────

  const startCountdown = useCallback((durationS: number = WARNING_DURATION_S): void => {
    setCountdown(durationS)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1_000)
  }, [])

  const stopCountdown = useCallback((): void => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setCountdown(WARNING_DURATION_S)
  }, [])

  // ── Shared logout handler ──────────────────────────────────────────────────

  const handleExpireNow = useCallback((reason: string = 'session_expired'): void => {
    setShowWarning(false)
    stopCountdown()
    logout()
    navigate('/login', { replace: true, state: { reason } })
  }, [logout, navigate, stopCountdown])

  // ── Token expiry polling ───────────────────────────────────────────────────

  const checkTokenExpiry = useCallback((): void => {
    if (!token) return

    const exp = getTokenExpiry(token)
    if (exp === null) return

    const nowS        = Math.floor(Date.now() / 1_000)
    const secondsLeft = exp - nowS

    if (secondsLeft <= 0) {
      // Already expired — logout immediately, no modal
      handleExpireNow('token_expired')
      return
    }

    if (secondsLeft <= TOKEN_EXPIRY_WARN_S && !showWarning) {
      // Within warning window — show modal with actual seconds remaining
      setWarningReason('token_expiry')
      setShowWarning(true)
      startCountdown(Math.min(secondsLeft, WARNING_DURATION_S))
    }
  }, [token, showWarning, handleExpireNow, startCountdown])

  useEffect(() => {
    if (!isAuthenticated) return

    // Check immediately on mount (catches already-expired tokens from localStorage)
    checkTokenExpiry()

    tokenCheckRef.current = setInterval(checkTokenExpiry, TOKEN_CHECK_INTERVAL_MS)

    return () => {
      if (tokenCheckRef.current) clearInterval(tokenCheckRef.current)
    }
  }, [isAuthenticated, checkTokenExpiry])

  // ── Session timeout callbacks (inactivity) ─────────────────────────────────

  const handleWarn = useCallback((): void => {
    setWarningReason('inactivity')
    setShowWarning(true)
    startCountdown()
  }, [startCountdown])

  const handleWarnDismiss = useCallback((): void => {
    setShowWarning(false)
    stopCountdown()
    const idleSeconds = WARNING_DURATION_S
    void recordActivity('IDLE', idleSeconds).catch(() => { /* non-fatal */ })
  }, [stopCountdown])

  const handleExpire = useCallback((): void => {
    handleExpireNow('inactivity_timeout')
  }, [handleExpireNow])

  useSessionTimeout({
    onWarn:        handleWarn,
    onWarnDismiss: handleWarnDismiss,
    onExpire:      handleExpire,
  })

  // ── "Stay logged in" handler ───────────────────────────────────────────────

  const handleStayLoggedIn = useCallback((): void => {
    setShowWarning(false)
    stopCountdown()
  }, [stopCountdown])

  // ── Logout now handler ─────────────────────────────────────────────────────

  const handleLogoutNow = useCallback((): void => {
    handleExpireNow('user_initiated')
  }, [handleExpireNow])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => () => stopCountdown(), [stopCountdown])

  if (!isAuthenticated) return null

  // ── Format countdown ───────────────────────────────────────────────────────

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countdownLabel = `${mins}:${String(secs).padStart(2, '0')}`
  const urgency = countdown <= 30

  const warningMessage = warningReason === 'token_expiry'
    ? 'Your session token is about to expire.'
    : "You've been inactive. Your session will end in:"

  return (
    <AnimatePresence>
      {showWarning && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(7,8,15,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={handleStayLoggedIn}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: 24  }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-[101] flex items-center justify-center px-4 pointer-events-none"
          >
            <div
              className="glass-card rounded-sm p-8 w-full max-w-sm pointer-events-auto"
              style={{ border: `1px solid ${urgency ? 'rgba(248,113,113,0.35)' : 'rgba(201,168,76,0.25)'}` }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: urgency ? 'rgba(248,113,113,0.1)' : 'rgba(201,168,76,0.1)',
                    border:     urgency ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(201,168,76,0.25)',
                  }}>
                  {urgency
                    ? <ShieldAlert size={24} style={{ color: '#f87171' }} />
                    : <Clock      size={24} style={{ color: '#c9a84c' }} />}
                </div>
              </div>

              {/* Heading */}
              <h2 className="font-display font-black text-xl text-frost text-center mb-1">
                Session Expiring
              </h2>
              <p className="font-body text-sm text-ice/40 text-center mb-6">
                {warningMessage}
              </p>

              {/* Countdown */}
              <div className="flex justify-center mb-6">
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.15, opacity: 0.6 }}
                  animate={{ scale: 1,    opacity: 1   }}
                  className="font-display font-black text-5xl tabular-nums"
                  style={{ color: urgency ? '#f87171' : '#c9a84c' }}
                >
                  {countdownLabel}
                </motion.span>
              </div>

              {/* Progress bar */}
              <div className="progress-bar mb-6">
                <motion.div
                  animate={{ width: `${(countdown / WARNING_DURATION_S) * 100}%` }}
                  transition={{ duration: 0.9, ease: 'linear' }}
                  style={{
                    height:     '100%',
                    borderRadius: 2,
                    background: urgency
                      ? 'linear-gradient(90deg, #f8717155, #f87171)'
                      : 'linear-gradient(90deg, #c9a84c55, #c9a84c)',
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStayLoggedIn}
                  className="btn-gold flex-1 py-3 rounded-sm text-sm"
                >
                  STAY LOGGED IN
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogoutNow}
                  className="btn-outline px-5 rounded-sm text-sm"
                  style={{ color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)' }}
                >
                  LOG OUT
                </motion.button>
              </div>

              <p className="nav-label text-[0.5rem] text-ice/20 text-center mt-4">
                Any activity will keep your session active.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
