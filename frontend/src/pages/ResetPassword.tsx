import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Diamond, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react'
import Starfield from '../components/Starfield'
import { resetPassword } from '../services/password.service'
import { extractErrorMessage } from '../services/error'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      navigate('/forgot-password', { replace: true })
    }
  }, [token, navigate])

  // Auto-redirect to login after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate('/login'), 3000)
      return () => clearTimeout(timer)
    }
  }, [success, navigate])

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordMismatch) return
    if (!token) return

    setLoading(true)
    setError('')
    try {
      await resetPassword({ token, newPassword, confirmPassword })
      setSuccess(true)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Reset failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
      <Starfield />
      <Link to="/login"
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 nav-label text-[0.6rem] text-ice/40 hover:text-gold transition-colors">
        <ArrowLeft size={12} />
        BACK TO LOGIN
      </Link>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)' }} />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }} className="relative z-10 w-full max-w-md">

        <div className="text-center mb-10">
          <div className="signal-badge inline-flex mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow" />
            <Diamond size={8} className="text-gold" />
            <span className="nav-label text-[0.6rem] text-ice/60">SET NEW PASSWORD</span>
          </div>
          <h1 className="font-display font-black text-4xl text-ice-gradient mb-2">URIS</h1>
          <div className="gold-rule w-20 mx-auto my-3" />
          <p className="nav-label text-[0.65rem] text-ice/40 tracking-widest">RESET YOUR PASSWORD</p>
        </div>

        <div className="glass-card rounded-sm p-8">
          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>
                <Check size={22} className="text-signal" />
              </motion.div>
              <h2 className="font-display font-black text-xl text-ice-gradient mb-3">Password Reset</h2>
              <div className="gold-rule w-12 mx-auto mb-4" />
              <p className="font-body text-sm text-ice/50 mb-2">Your password has been reset successfully.</p>
              <p className="font-body text-sm text-ice/30 mb-6">Redirecting to login in 3 seconds...</p>
              <Link to="/login">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-gold px-8 py-3 rounded-sm text-sm">
                  GO TO LOGIN
                </motion.button>
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <p className="nav-label text-[0.65rem] text-ice/40 text-center tracking-widest">ENTER YOUR NEW PASSWORD</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="uris-input pr-10"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ice/30 hover:text-gold transition-colors">
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">CONFIRM NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className={`uris-input pr-10 ${passwordMismatch ? 'border-red-400/50' : ''}`}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ice/30 hover:text-gold transition-colors">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {passwordMismatch && (
                    <p className="font-body text-xs text-red-400/80 mt-1">Passwords do not match.</p>
                  )}
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="font-body text-sm text-red-400/80 text-center py-2 rounded-sm"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <p>{error}</p>
                    <Link to="/forgot-password" className="text-gold/70 hover:text-gold text-xs mt-1 inline-block">
                      Request a new reset link
                    </Link>
                  </motion.div>
                )}

                <motion.button type="submit" disabled={loading || passwordMismatch}
                  whileHover={!loading && !passwordMismatch ? { scale: 1.02, boxShadow: '0 8px 28px rgba(201,168,76,0.3)' } : {}}
                  whileTap={!loading && !passwordMismatch ? { scale: 0.98 } : {}}
                  className="btn-gold w-full py-3 rounded-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'RESETTING...' : 'RESET PASSWORD'}
                </motion.button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
