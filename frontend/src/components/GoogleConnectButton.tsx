import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Check, X } from 'lucide-react'
import {
  getGoogleStatus,
  connectGoogle,
  disconnectGoogle,
} from '../services/google.service'
import { extractErrorMessage } from '../services/error'

interface Props {
  onStatusChange?: (connected: boolean) => void
}

// Google "G" SVG icon
function GoogleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function GoogleConnectButton({ onStatusChange }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check for callback result in URL params
    const params = new URLSearchParams(window.location.search)
    const googleParam = params.get('google')
    if (googleParam === 'connected') {
      setConnected(true)
      onStatusChange?.(true)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (googleParam === 'denied' || googleParam === 'error') {
      setError(googleParam === 'denied' ? 'Google connection was cancelled.' : 'Google connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    getGoogleStatus()
      .then(s => {
        setConnected(s.connected)
        onStatusChange?.(s.connected)
      })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false))
  }, [])

  async function handleDisconnect() {
    setActionLoading(true)
    setError('')
    try {
      await disconnectGoogle()
      setConnected(false)
      onStatusChange?.(false)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to disconnect.'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 size={12} className="text-gold/40 animate-spin" />
        <span className="nav-label text-[0.5rem] text-ice/30">Checking Google connection...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {connected ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <Check size={11} className="text-signal" />
            <GoogleIcon size={12} />
            <span className="nav-label text-[0.55rem] text-signal">GOOGLE CONNECTED</span>
          </div>
          <motion.button type="button" whileTap={{ scale: 0.97 }}
            onClick={handleDisconnect} disabled={actionLoading}
            className="flex items-center gap-1.5 nav-label text-[0.55rem] text-ice/30 hover:text-red-400 transition-colors disabled:opacity-40">
            {actionLoading ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
            DISCONNECT
          </motion.button>
        </div>
      ) : (
        <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={connectGoogle}
          className="flex items-center gap-2 px-4 py-2.5 rounded-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(232,240,251,0.8)',
          }}>
          <GoogleIcon size={14} />
          <span className="nav-label text-[0.6rem]">CONNECT GOOGLE ACCOUNT</span>
        </motion.button>
      )}
      {error && (
        <p className="font-body text-xs text-red-400/80">{error}</p>
      )}
      <p className="nav-label text-[0.48rem] text-ice/20">
        Enables work log tracking, Drive activity, and calendar availability sync.
      </p>
    </div>
  )
}
