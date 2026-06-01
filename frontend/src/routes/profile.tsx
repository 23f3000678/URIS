import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Lock, LogOut, AlertTriangle, Check, Loader2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import GoogleConnectButton from '../components/GoogleConnectButton'
import api from '../services/api'
import { useAuthStore, selectToken } from '../store/authStore'
import { extractErrorMessage } from '../services/error'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  googleConnected?: boolean
}

export default function ProfilePage() {
  const token = useAuthStore(selectToken)
  const nav = useNavigate()
  const logout = useAuthStore(s => s.logout)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingName, setUpdatingName] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newName, setNewName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    if (!token) {
      nav('/login')
      return
    }
    loadProfile()
  }, [token, nav])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get('/profile/me')
      setProfile(res.data)
      setNewName(res.data.name || '')
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load profile'))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setError('Name cannot be empty')
      return
    }

    try {
      setUpdatingName(true)
      setError('')
      await api.patch('/profile/name', { name: newName })
      setSuccess('Name updated successfully')
      await loadProfile()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update name'))
    } finally {
      setUpdatingName(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    if (!/[A-Z]{2,}/.test(newPassword)) {
      setError('New password must have at least 2 uppercase letters')
      return
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setError('New password must have at least 1 special character')
      return
    }

    try {
      setUpdatingPassword(true)
      setError('')
      await api.patch('/profile/password', {
        currentPassword,
        newPassword
      })
      setSuccess('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update password'))
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleLogout = () => {
    logout()
    nav('/login')
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">ACCOUNT</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">My Profile</h1>
            <div className="gold-rule w-14 mt-2" />
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-gold animate-spin" />
            </div>
          ) : profile ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Info */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="lg:col-span-1 glass-card rounded-sm p-6">
                <p className="nav-label text-[0.6rem] text-gold/60 mb-4">PROFILE INFO</p>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-sm bg-navy-900/40 border border-gold/10">
                    <User size={16} className="text-gold" />
                    <div>
                      <p className="text-[0.5rem] text-ice/40">NAME</p>
                      <p className="text-sm font-semibold text-ice">{profile.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-sm bg-navy-900/40 border border-gold/10">
                    <Mail size={16} className="text-gold" />
                    <div>
                      <p className="text-[0.5rem] text-ice/40">EMAIL</p>
                      <p className="text-sm font-semibold text-ice">{profile.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="btn-outline w-full px-3 py-2 rounded-sm text-[0.55rem] flex items-center justify-center gap-2 mt-4"
                  >
                    <LogOut size={12} />
                    SIGN OUT
                  </button>
                </div>
              </motion.div>

              {/* Settings */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="lg:col-span-2 space-y-6">

                {/* Update Name */}
                <div className="glass-card rounded-sm p-6">
                  <p className="nav-label text-[0.6rem] text-gold/60 mb-4">UPDATE NAME</p>

                  <form onSubmit={handleUpdateName} className="space-y-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="uris-input w-full"
                      disabled={updatingName}
                      placeholder="Enter your name"
                    />

                    <button
                      type="submit"
                      disabled={updatingName}
                      className="btn-gold px-4 py-2 rounded-sm text-[0.6rem] disabled:opacity-50"
                    >
                      {updatingName ? 'UPDATING...' : 'UPDATE NAME'}
                    </button>
                  </form>
                </div>

                {/* Google Connect */}
                <div className="glass-card rounded-sm p-6">
                  <p className="nav-label text-[0.6rem] text-gold/60 mb-4">GOOGLE CALENDAR</p>
                  <p className="font-body text-sm text-ice/60 mb-4">
                    {profile.googleConnected
                      ? 'Your Google account is connected'
                      : 'Connect your Google account to sync calendar events'}
                  </p>
                  <GoogleConnectButton />
                </div>

                {/* Change Password */}
                <div className="glass-card rounded-sm p-6">
                  <p className="nav-label text-[0.6rem] text-gold/60 mb-4">CHANGE PASSWORD</p>

                  {!showPasswordForm ? (
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="btn-outline px-4 py-2 rounded-sm text-[0.55rem] flex items-center gap-2"
                    >
                      <Lock size={12} />
                      CHANGE PASSWORD
                    </button>
                  ) : (
                    <form onSubmit={handleUpdatePassword} className="space-y-3">
                      <div>
                        <label className="nav-label text-[0.5rem] text-gold/40 block mb-1">CURRENT PASSWORD</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="uris-input w-full"
                          disabled={updatingPassword}
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="nav-label text-[0.5rem] text-gold/40 block mb-1">NEW PASSWORD</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="uris-input w-full"
                          disabled={updatingPassword}
                          placeholder="••••••••"
                        />
                        {newPassword && (
                          <p className="text-[0.5rem] text-ice/40 mt-1">
                            Requirements: 8+ chars, 2+ caps, 1+ special
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="nav-label text-[0.5rem] text-gold/40 block mb-1">CONFIRM PASSWORD</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="uris-input w-full"
                          disabled={updatingPassword}
                          placeholder="••••••••"
                        />
                      </div>

                      {error && (
                        <div className="flex items-start gap-2 p-2 rounded-sm bg-red-500/10 border border-red-500/20">
                          <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[0.5rem] text-red-400/70">{error}</p>
                        </div>
                      )}

                      {success && (
                        <div className="flex items-center gap-2 p-2 rounded-sm bg-signal/10 border border-signal/20">
                          <Check size={12} className="text-signal" />
                          <p className="text-[0.5rem] text-signal/70">{success}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={updatingPassword}
                          className="btn-gold flex-1 px-3 py-2 rounded-sm text-[0.55rem] disabled:opacity-50"
                        >
                          UPDATE PASSWORD
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false)
                            setError('')
                            setSuccess('')
                            setCurrentPassword('')
                            setNewPassword('')
                            setConfirmPassword('')
                          }}
                          className="btn-outline flex-1 px-3 py-2 rounded-sm text-[0.55rem]"
                        >
                          CANCEL
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
