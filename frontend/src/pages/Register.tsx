import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Diamond, ArrowLeft, Camera, User } from 'lucide-react'
import Starfield from '../components/Starfield'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { extractErrorMessage } from '../services/error'

const GDOC_PREFIX = 'https://docs.google.com/document/d/'
const INTERN_ROLES = new Set(['TECHNICAL_INTERN', 'RESEARCH_INTERN'])

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'TECHNICAL_INTERN',
    dateOfBirth: '',
    joiningDate: '',
    gdocUrl: '',
  })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [picturePreview, setPicturePreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<{ name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be under 5 MB.')
      return
    }
    setProfilePicture(file)
    setPicturePreview(URL.createObjectURL(file))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')

    // Validate profile picture required
    if (!profilePicture) {
      setError('A profile picture is required.')
      return
    }

    // Validate DOB is in the past
    if (form.dateOfBirth) {
      const dob = new Date(form.dateOfBirth)
      if (dob >= new Date()) {
        setError('Date of birth must be in the past.')
        return
      }
    }

    // Validate GDoc URL for intern roles
    if (INTERN_ROLES.has(form.role) && form.gdocUrl) {
      if (!form.gdocUrl.startsWith(GDOC_PREFIX)) {
        setError('Google Docs URL must begin with https://docs.google.com/document/d/')
        return
      }
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('email', form.email)
      formData.append('password', form.password)
      formData.append('role', form.role)
      if (form.dateOfBirth) formData.append('dateOfBirth', form.dateOfBirth)
      if (form.joiningDate) formData.append('joiningDate', form.joiningDate)
      if (INTERN_ROLES.has(form.role) && form.gdocUrl) formData.append('gdocUrl', form.gdocUrl)
      formData.append('profilePicture', profilePicture)

      const res = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data.data as { pending?: boolean; token?: string; user: Parameters<typeof login>[1] & { name: string } }

      if (data.pending) {
        setPendingApproval({ name: data.user.name || form.name })
        return
      }

      login(data.token!, data.user)
      navigate(data.user.role.includes('intern') ? '/availability' : '/dashboard')
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Pending approval screen ───────────────────────────────────────────────
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
        <Starfield />
        <Link to="/"
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 nav-label text-[0.6rem] text-ice/40 hover:text-gold transition-colors">
          <ArrowLeft size={12} />
          BACK TO HOME
        </Link>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md">
          <div className="glass-card rounded-sm p-10 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}>
              <Diamond size={24} className="text-gold" />
            </motion.div>
            <h2 className="font-display font-black text-2xl text-ice-gradient mb-3">Access Requested</h2>
            <div className="gold-rule w-16 mx-auto mb-4" />
            <p className="font-body text-sm text-ice/50 mb-2">
              Welcome, {pendingApproval.name}. Your account is pending approval.
            </p>
            <p className="font-body text-sm text-ice/40 mb-8">
              An admin or lead will review your request. You'll be able to log in once approved.
            </p>
            <Link to="/login">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="btn-outline px-8 py-3 rounded-sm text-sm">
                BACK TO LOGIN
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
      <Starfield />
      <Link to="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 nav-label text-[0.6rem] text-ice/40 hover:text-gold transition-colors">
        <ArrowLeft size={12} />
        BACK TO HOME
      </Link>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)' }} />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }} className="relative z-10 w-full max-w-md my-8">
        <div className="text-center mb-10">
          <div className="signal-badge inline-flex mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow" />
            <Diamond size={8} className="text-gold" />
            <span className="nav-label text-[0.6rem] text-ice/60">NEW REGISTRATION</span>
          </div>
          <h1 className="font-display font-black text-5xl text-ice-gradient mb-2">URIS</h1>
          <div className="gold-rule w-20 mx-auto my-3" />
          <p className="nav-label text-[0.65rem] text-ice/40 tracking-widest">CREATE YOUR ACCOUNT</p>
        </div>

        <div className="glass-card rounded-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full Name */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">FULL NAME</label>
              <input type="text" className="uris-input" placeholder="Your full name"
                value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>

            {/* Email */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">EMAIL ADDRESS</label>
              <input type="email" className="uris-input" placeholder="you@company.com"
                value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>

            {/* Password */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">PASSWORD</label>
              <input type="password" className="uris-input" placeholder="Min. 6 characters"
                value={form.password} onChange={e => update('password', e.target.value)}
                minLength={6} required />
            </div>

            {/* Role — restricted to TECHNICAL_INTERN and RESEARCH_INTERN */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">ROLE</label>
              <select className="uris-input w-full" value={form.role}
                onChange={e => update('role', e.target.value)}>
                <option value="TECHNICAL_INTERN">Technical Intern</option>
                <option value="RESEARCH_INTERN">Research Intern</option>
              </select>
              <p className="nav-label text-[0.5rem] text-ice/25 mt-1.5">
                Admin and lead accounts are created internally by Core Admin.
              </p>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">DATE OF BIRTH</label>
              <input type="date" className="uris-input"
                value={form.dateOfBirth}
                onChange={e => update('dateOfBirth', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Joining Date */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">JOINING DATE</label>
              <input type="date" className="uris-input"
                value={form.joiningDate}
                onChange={e => update('joiningDate', e.target.value)}
              />
            </div>

            {/* GDoc URL — only for intern roles */}
            {INTERN_ROLES.has(form.role) && (
              <div>
                <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">GOOGLE DOCS WORK LOG URL</label>
                <input type="url" className="uris-input"
                  placeholder="https://docs.google.com/document/d/..."
                  value={form.gdocUrl}
                  onChange={e => update('gdocUrl', e.target.value)}
                />
                <p className="nav-label text-[0.5rem] text-ice/25 mt-1.5">
                  Link to your Google Docs work log document.
                </p>
              </div>
            )}

            {/* Profile Picture — required */}
            <div>
              <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">
                PROFILE PICTURE <span className="text-red-400/70">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  {picturePreview ? (
                    <img src={picturePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-gold/30" />
                  )}
                </div>
                <div className="flex-1">
                  <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 btn-outline px-4 py-2 rounded-sm text-sm w-full justify-center">
                    <Camera size={13} />
                    {profilePicture ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
                  </motion.button>
                  <p className="nav-label text-[0.5rem] text-ice/25 mt-1.5 text-center">
                    JPEG, PNG, WebP · Max 5 MB · Required
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="font-body text-sm text-red-400/80 text-center py-2 rounded-sm"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                {error}
              </motion.p>
            )}

            <motion.button type="submit" disabled={loading}
              whileHover={!loading ? { scale: 1.02, boxShadow: '0 8px 28px rgba(201,168,76,0.3)' } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="btn-gold w-full py-3 rounded-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? 'REGISTERING...' : 'CREATE ACCOUNT'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-body text-sm text-ice/30">
              Already have access?{' '}
              <Link to="/login" className="text-gold/70 hover:text-gold transition-colors no-underline">Sign in</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
