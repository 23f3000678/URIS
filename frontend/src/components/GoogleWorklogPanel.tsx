import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, AlertTriangle, Check, Clock, RefreshCw, ExternalLink, Loader2 } from 'lucide-react'
import {
  getWorklogStatus,
  type WorklogStatus,
} from '../services/google.service'

interface Props {
  compact?: boolean
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Unknown'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Recently'
}

export default function GoogleWorklogPanel({ compact = false }: Props) {
  const [status, setStatus] = useState<WorklogStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorklogStatus()
      .then(s => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={13} className="text-gold/40 animate-spin" />
        <span className="nav-label text-[0.5rem] text-ice/30">Loading work log...</span>
      </div>
    )
  }

  if (!status?.gdocUrl) {
    return (
      <div className="flex items-center gap-2 py-2">
        <FileText size={13} className="text-ice/25" />
        <span className="font-body text-xs text-ice/30">No work log URL set.</span>
      </div>
    )
  }

  const isStale = status.isStale
  const lastMod = status.lastModified

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isStale
          ? <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
          : <Check size={11} className="text-signal flex-shrink-0" />}
        <span className="nav-label text-[0.5rem]" style={{ color: isStale ? '#f59e0b' : '#4ade80' }}>
          {isStale ? 'STALE' : 'ACTIVE'} · {timeAgo(lastMod)}
        </span>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-gold/60" />
          <p className="nav-label text-[0.6rem] text-gold/60">WORK LOG</p>
        </div>
        <a href={status.gdocUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 nav-label text-[0.5rem] text-ice/30 hover:text-gold transition-colors">
          OPEN <ExternalLink size={9} />
        </a>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {isStale ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={10} className="text-amber-400" />
            <span className="nav-label text-[0.55rem] text-amber-400">STALE — not updated recently</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <Check size={10} className="text-signal" />
            <span className="nav-label text-[0.55rem] text-signal">ACTIVE</span>
          </div>
        )}
      </div>

      {/* Last modified */}
      <div className="flex items-center gap-1.5">
        <Clock size={10} className="text-ice/30" />
        <span className="font-body text-xs text-ice/50">
          Last updated: <span className="text-frost/70">{timeAgo(lastMod)}</span>
          {lastMod && (
            <span className="text-ice/30 ml-1">
              ({new Date(lastMod).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})
            </span>
          )}
        </span>
      </div>

      {/* Recent activity */}
      {status.connected && status.recentActivity.length > 0 && (
        <div>
          <p className="nav-label text-[0.5rem] text-ice/30 mb-1.5 flex items-center gap-1">
            <RefreshCw size={8} />RECENT ACTIVITY
          </p>
          <div className="space-y-1">
            {status.recentActivity.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-gold/40 flex-shrink-0" />
                <span className="font-body text-xs text-ice/40">
                  {a.actions.join(', ') || 'Edit'} · {a.timestamp ? timeAgo(a.timestamp) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not connected notice */}
      {!status.connected && (
        <p className="font-body text-xs text-ice/25 italic">
          Connect Google to see live activity data.
        </p>
      )}
    </motion.div>
  )
}
