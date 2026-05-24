import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { getCalendarData, type CalendarData } from '../services/google.service'

interface Props {
  compact?: boolean
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function GoogleCalendarPanel({ compact = false }: Props) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCalendarData(7)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={13} className="text-gold/40 animate-spin" />
        <span className="nav-label text-[0.5rem] text-ice/30">Loading calendar...</span>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Calendar size={13} className="text-ice/25" />
        <span className="font-body text-xs text-ice/30">Connect Google to see calendar availability.</span>
      </div>
    )
  }

  const busyCount = data.busySlots.length
  const upcomingCount = data.events.length

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Calendar size={11} className="text-gold/50" />
        <span className="nav-label text-[0.5rem] text-ice/50">
          {busyCount > 0
            ? <span style={{ color: '#f59e0b' }}>{busyCount} BUSY SLOT{busyCount !== 1 ? 'S' : ''}</span>
            : <span style={{ color: '#4ade80' }}>FREE THIS WEEK</span>}
        </span>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar size={13} className="text-gold/60" />
        <p className="nav-label text-[0.6rem] text-gold/60">CALENDAR AVAILABILITY</p>
        <span className="nav-label text-[0.5rem] text-ice/30 ml-auto">NEXT 7 DAYS</span>
      </div>

      {/* Busy slots summary */}
      {busyCount > 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
          <p className="font-body text-xs text-amber-300/80">
            {busyCount} busy period{busyCount !== 1 ? 's' : ''} detected this week
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <Clock size={11} className="text-signal flex-shrink-0" />
          <p className="font-body text-xs text-signal/80">No busy periods detected this week</p>
        </div>
      )}

      {/* Upcoming events */}
      {upcomingCount > 0 && (
        <div>
          <p className="nav-label text-[0.5rem] text-ice/30 mb-2">UPCOMING EVENTS</p>
          <div className="space-y-2">
            {data.events.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-start gap-2 py-1.5 px-2 rounded-sm"
                style={{ background: 'rgba(184,212,240,0.04)', border: '1px solid rgba(184,212,240,0.06)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-gold/40 flex-shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <p className="font-body text-xs text-frost/80 truncate">{e.summary}</p>
                  <p className="nav-label text-[0.48rem] text-ice/30 mt-0.5">
                    {e.allDay ? formatDate(e.start) : formatTime(e.start)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
