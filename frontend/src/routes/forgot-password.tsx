import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, AlertTriangle, Check, Loader2 } from 'lucide-react'
import Starfield from '../components/Starfield'
import api from '../services/api'
import { useAuthStore, selectToken } from '../store/authStore'
import { extractErrorMessage } from '../services/error'

export default function ForgotPasswordPage() {
  const token = useAuthStore(selectToken)
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [token2, setToken2] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (token) {
      nav('/dashboard')
    }
  }, [token, nav])

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    if (pwd.length < 8) errors.push('At least 8 characters')
    if (!/[A-Z]{2,}/.test(pwd)) errors.push('At least 2 uppercase letters')
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errors.push('At least 1 special character')
    return errors
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email')
      return
    }

    try {
      setLoading(true)
      setError('')
      await api.post('/password/request-reset', { email })
      setSuccess('Reset link sent to your email')
      setStep('reset')
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send reset email'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const pwdErrors = validatePassword(newPassword)
    if (pwdErrors.length > 0) {
      setError(`Password must have: ${pwdErrors.join(', ')}`)
      return
    }

    try {
      setLoading(true)
      setError('')
      await api.post('/password/reset', {
        token: token2,
        newPassword
      })
      setSuccess('Password reset successfully! Redirecting to login...')
      setTimeout(() => nav('/login'), 2000)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost flex items-center justify-center">
      <Starfield />
      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-sm p-8"
        >
          <div className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-2">SECURITY</p>
            <h1 className="font-display font-black text-2xl text-ice-gradient">Reset Password</h1>
            <div className="gold-rule w-8 mt-2" />
          </div>

          {step === 'email' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="font-body text-sm text-ice/60 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div className="space-y-2">
                <label className="nav-label text-[0.55rem] text-gold/40">EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="uris-input w-full"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-sm bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400" />
                  <p className="text-[0.55rem] text-red-400/70">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-sm bg-signal/10 border border-signal/20">
                  <Check size={14} className="text-signal" />
                  <p className="text-[0.55rem] text-signal/70">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-2 rounded-sm text-[0.6rem] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Mail size={12} />
                    SEND RESET LINK
                  </>
                )}
              </button>

              <p className="text-center text-[0.55rem] text-ice/40 mt-4">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => nav('/login')}
                  className="text-gold/80 hover:text-gold transition-colors"
                >
                  Back to login
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="nav-label text-[0.55rem] text-gold/40">RESET TOKEN</label>
                <input
                  type="text"
                  placeholder="Paste token from your email"
                  value={token2}
                  onChange={(e) => setToken2(e.target.value)}
                  className="uris-input w-full"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="nav-label text-[0.55rem] text-gold/40">NEW PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="uris-input w-full"
                  disabled={loading}
                />
                {newPassword && (
                  <p className="text-[0.5rem] text-ice/40">
                    Requirements: 8+ chars, 2+ caps, 1+ special char
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="nav-label text-[0.55rem] text-gold/40">CONFIRM PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="uris-input w-full"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 py-2 px-3 rounded-sm bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[0.55rem] text-red-400/70">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-sm bg-signal/10 border border-signal/20">
                  <Check size={14} className="text-signal" />
                  <p className="text-[0.55rem] text-signal/70">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-2 rounded-sm text-[0.6rem] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    RESETTING...
                  </>
                ) : (
                  'RESET PASSWORD'
                )}
              </button>

              <p className="text-center text-[0.55rem] text-ice/40 mt-4">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setSuccess('') }}
                  className="text-gold/80 hover:text-gold transition-colors"
                >
                  Start over
                </button>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
