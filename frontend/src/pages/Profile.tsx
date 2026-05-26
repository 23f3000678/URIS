import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { User, Camera, Save, X, ExternalLink, Loader2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import { getMyProfile, updateMyProfile, uploadProfilePicture, type ProfileData } from '../services/profile.service'
import { extractErrorMessage } from '../services/error'
import GoogleConnectButton from '../components/GoogleConnectButton'
import GoogleWorklogPanel from '../components/GoogleWorklogPanel'
import GoogleCalendarPanel from '../components/GoogleCalendarPanel'
import { useAuthStore, selectUser } from '../store/authStore'

const GDOC_PREFIX = 'https://docs.google.com/document/d/'

function isValidGdocUrl(url: string) {
  return url.startsWith(GDOC_PREFIX) && url.slice(GDOC_PREFIX.length).trim().length > 0
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = useAuthStore(selectUser)
  const isIntern = user?.role?.toLowerCase().includes('intern') ?? false

  // Edit state
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGdocUrl, setEditGdocUrl] = useState('')
  const [gdocError, setGdocError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMyProfile()
      .then(p => {
        setProfile(p)
        setEditName(p.name)
        setEditGdocUrl(p.intern?.gdocUrl || '')
      })
      .catch(err => setError(extractErrorMessage(err, 'Failed to load profile.')))
      .finally(() => setLoading(false))
  }, [])

  const handleEditStart = () => {
    if (!profile) return
    setEditName(profile.name)
    setEditGdocUrl(profile.intern?.gdocUrl || '')
    setGdocError('')
    setSaveError('')
    setEditMode(true)
  }

  const handleEditCancel = () => {
    setEditMode(false)
    setGdocError('')
    setSaveError('')
  }

  const handleGdocBlur = () => {
    if (editGdocUrl && !isValidGdocUrl(editGdocUrl)) {
      setGdocError('Must begin with https://docs.google.com/document/d/')
    } else {
      setGdocError('')
    }
  }

  const handleSave = async () => {
    if (gdocError) return
    setSaving(true)
    setSaveError('')
    try {
      const updates: Record<string, string> = {}
      if (editName !== profile?.name) updates.name = editName
      if (editGdocUrl !== (profile?.intern?.gdocUrl || '')) updates.gdocUrl = editGdocUrl
      if (Object.keys(updates).length === 0) { setEditMode(false); return }
      const updated = await updateMyProfile(updates)
      setProfile(updated)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(extractErrorMessage(err, 'Failed to save changes.'))
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side size check
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5 MB.')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      const { profilePictureUrl } = await uploadProfilePicture(file)
      setProfile(prev => prev ? { ...prev, profilePictureUrl } : prev)
    } catch (err: unknown) {
      setUploadError(extractErrorMessage(err, 'Upload failed. Please try again.'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const roleLabel = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 text-frost relative overflow-hidden">
        <Starfield />
        <Sidebar />
        <main className="md:ml-52 pt-14 min-h-screen relative z-10 flex items-center justify-center">
          <Loader2 size={24} className="text-gold animate-spin" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost relative overflow-hidden">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">ACCOUNT</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">My Profile</h1>
            <div className="gold-rule w-14 mt-2" />
          </motion.div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-body text-sm text-red-400/80 text-center py-3 rounded-sm mb-6"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              {error}
            </motion.p>
          )}

          {profile && (
            <div className="space-y-5">
              {/* Profile Picture Card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }} className="glass-card rounded-sm p-6">
                <p className="nav-label text-[0.6rem] text-gold/60 mb-4">PROFILE PICTURE</p>
                <div className="flex items-center gap-6">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.25)' }}>
                      {profile.profilePictureUrl ? (
                        <img
                          src={profile.profilePictureUrl}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style') }}
                        />
                      ) : null}
                      <User size={32} className="text-gold/40" style={profile.profilePictureUrl ? { display: 'none' } : {}} />
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(7,8,15,0.7)' }}>
                        <Loader2 size={18} className="text-gold animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <motion.button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      whileHover={!uploading ? { scale: 1.02 } : {}}
                      whileTap={!uploading ? { scale: 0.98 } : {}}
                      className="flex items-center gap-2 btn-outline px-4 py-2 rounded-sm text-sm disabled:opacity-50">
                      <Camera size={13} />
                      {uploading ? 'UPLOADING...' : 'CHANGE PHOTO'}
                    </motion.button>
                    <p className="nav-label text-[0.5rem] text-ice/25 mt-2">JPEG, PNG, WebP · Max 5 MB</p>
                    {uploadError && (
                      <p className="font-body text-xs text-red-400/80 mt-1">{uploadError}</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Profile Info Card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }} className="glass-card rounded-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="nav-label text-[0.6rem] text-gold/60">PROFILE INFORMATION</p>
                  {!editMode ? (
                    <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={handleEditStart}
                      className="nav-label text-[0.6rem] text-gold/60 hover:text-gold transition-colors flex items-center gap-1">
                      EDIT
                    </motion.button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={handleEditCancel}
                        className="nav-label text-[0.6rem] text-ice/40 hover:text-ice/70 transition-colors flex items-center gap-1">
                        <X size={11} /> CANCEL
                      </motion.button>
                      <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={handleSave} disabled={saving || !!gdocError}
                        className="nav-label text-[0.6rem] text-gold/70 hover:text-gold transition-colors flex items-center gap-1 disabled:opacity-40">
                        {saving
                          ? <><Loader2 size={11} className="animate-spin" /> SAVING...</>
                          : <><Save size={11} /> SAVE</>}
                      </motion.button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <p className="nav-label text-[0.5rem] text-ice/30 mb-1">FULL NAME</p>
                    {editMode ? (
                      <input
                        type="text"
                        className="uris-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        maxLength={100}
                        placeholder="Your full name"
                      />
                    ) : (
                      <p className="font-body text-sm text-frost/80">{profile.name || '—'}</p>
                    )}
                  </div>

                  {/* Email — always read-only */}
                  <div>
                    <p className="nav-label text-[0.5rem] text-ice/30 mb-1">EMAIL ADDRESS</p>
                    <p className="font-body text-sm text-frost/60">{profile.email}</p>
                  </div>

                  {/* Role — always read-only */}
                  <div>
                    <p className="nav-label text-[0.5rem] text-ice/30 mb-1">ROLE</p>
                    <p className="font-body text-sm text-frost/60">{roleLabel(profile.role)}</p>
                  </div>

                  {/* Joining Date — always read-only */}
                  <div>
                    <p className="nav-label text-[0.5rem] text-ice/30 mb-1">JOINING DATE</p>
                    <p className="font-body text-sm text-frost/60">{formatDate(profile.joiningDate)}</p>
                  </div>

                  {/* GDoc URL */}
                  <div>
                    <p className="nav-label text-[0.5rem] text-ice/30 mb-1">GOOGLE DOCS WORK LOG</p>
                    {editMode ? (
                      <>
                        <input
                          type="url"
                          className={`uris-input ${gdocError ? 'border-red-400/50' : ''}`}
                          value={editGdocUrl}
                          onChange={e => setEditGdocUrl(e.target.value)}
                          onBlur={handleGdocBlur}
                          placeholder="https://docs.google.com/document/d/..."
                          maxLength={2048}
                        />
                        {gdocError && (
                          <p className="font-body text-xs text-red-400/80 mt-1">{gdocError}</p>
                        )}
                      </>
                    ) : (
                      profile.intern?.gdocUrl ? (
                        <a
                          href={profile.intern.gdocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 font-body text-sm text-gold/70 hover:text-gold transition-colors">
                          Open Work Log <ExternalLink size={12} />
                        </a>
                      ) : (
                        <p className="font-body text-sm text-frost/30">Not set</p>
                      )
                    )}
                  </div>
                </div>

                {saveError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="font-body text-sm text-red-400/80 text-center py-2 rounded-sm mt-4"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    {saveError}
                  </motion.p>
                )}
              </motion.div>

              {/* Google Integration Card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }} className="glass-card rounded-sm p-6 space-y-4">
                <p className="nav-label text-[0.6rem] text-gold/60">GOOGLE INTEGRATION</p>
                <GoogleConnectButton />
              </motion.div>

              {/* Work Log Status — interns only */}
              {isIntern && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}>
                  <GoogleWorklogPanel />
                </motion.div>
              )}

              {/* Calendar Availability */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}>
                <GoogleCalendarPanel />
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
