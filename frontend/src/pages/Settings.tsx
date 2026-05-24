import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Check, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import { changePassword } from '../services/password.service'
import { extractErrorMessage } from '../services/error'

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emailNotice, setEmailNotice] = useState(false)
  const [error, setError] = useState('')

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordMismatch) return

    setLoading(true)
    setError('')
    setSuccess(false)
    setEmailNotice(false)

    try {
      const result = await changePassword({ currentPassword, newPassword, confirmPassword })
      setSuccess(true)
      if (result && result.emailSent === false) setEmailNotice(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to change password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost relative overflow-hidden">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="max-w-xl mx-auto px-4 md:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">ACCOUNT MANAGEMENT</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">Settings</h1>
            <div className="gold-rule w-14 mt-2" />
          </motion.div>

          {/* Change Password Section */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="glass-card rounded-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center"
                style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <ShieldCheck size={14} className="text-gold" />
              </div>
              <div>
                <p className="nav-label text-[0.6rem] text-gold/60">SECURITY</p>
                <p className="font-display font-bold text-sm text-frost/80">Change Password</p>
              </div>
            </div>

            {success && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-sm mb-5"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                <Check size={16} className="text-signal mt-0.5 shrink-0" />
                <div>
                  <p className="font-body text-sm text-signal">Password changed successfully.</p>
                  {emailNotice && (
                    <p className="font-body text-xs text-ice/40 mt-1">
                      Confirmation email could not be sent — your password is still updated.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div>
                <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">CURRENT PASSWORD</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="uris-input pr-10"
                    placeholder="Your current password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ice/30 hover:text-gold transition-colors">
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
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

              {/* Confirm New Password */}
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
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="font-body text-sm text-red-400/80 text-center py-2 rounded-sm"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </motion.p>
              )}

              <motion.button type="submit" disabled={loading || passwordMismatch}
                whileHover={!loading && !passwordMismatch ? { scale: 1.02, boxShadow: '0 8px 28px rgba(201,168,76,0.25)' } : {}}
                whileTap={!loading && !passwordMismatch ? { scale: 0.98 } : {}}
                className="btn-gold w-full py-3 rounded-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
