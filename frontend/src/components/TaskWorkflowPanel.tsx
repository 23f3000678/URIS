/**
 * TaskWorkflowPanel — Phase 9 Workflow & Collaboration Layer
 *
 * Renders inside the expanded task row in Tasks.tsx.
 * Shows: Notes tab, Escalations tab, Timeline tab.
 * Visibility is role-aware — interns only see non-internal notes.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, AlertOctagon, Clock, Send,
  Loader2, Trash2,
} from 'lucide-react'
import { useAuthStore, selectUser } from '../store/authStore'
import {
  getTaskNotes, addTaskNote, deleteTaskNote,
  getTaskEscalations, raiseEscalation, acknowledgeEscalation, resolveEscalation,
  getTaskTimeline,
  type TaskNote, type TaskEscalation, type WorkflowEvent, type EscalateTo,
} from '../services/workflow.service'
import { extractErrorMessage } from '../services/error'

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD    = '#c9a84c'
const ICE_DIM = 'rgba(184,212,240,0.25)'
const GREEN   = '#4ade80'
const AMBER   = '#f59e0b'
const RED     = '#f87171'
const BLUE    = '#60a5fa'

type PanelTab = 'notes' | 'escalations' | 'timeline'

// ── Event type labels ─────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  TASK_CREATED:            { label: 'Task created',          color: GREEN },
  TASK_ASSIGNED:           { label: 'Task assigned',         color: BLUE },
  TASK_STATUS_CHANGED:     { label: 'Status changed',        color: GOLD },
  PROGRESS_UPDATED:        { label: 'Progress updated',      color: GOLD },
  BLOCKER_REPORTED:        { label: 'Blocker reported',      color: RED },
  BLOCKER_CLEARED:         { label: 'Blocker cleared',       color: GREEN },
  NOTE_ADDED:              { label: 'Note added',            color: BLUE },
  NOTE_UPDATED:            { label: 'Note updated',          color: BLUE },
  NOTE_DELETED:            { label: 'Note deleted',          color: ICE_DIM },
  ESCALATION_RAISED:       { label: 'Escalation raised',     color: RED },
  ESCALATION_ACKNOWLEDGED: { label: 'Escalation acknowledged', color: AMBER },
  ESCALATION_RESOLVED:     { label: 'Escalation resolved',   color: GREEN },
  REVIEW_SUBMITTED:        { label: 'Review submitted',      color: GREEN },
  TASK_PAUSED:             { label: 'Task paused',           color: AMBER },
  TASK_RESUMED:            { label: 'Task resumed',          color: GREEN },
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ taskId, isAdmin }: { taskId: string; isAdmin: boolean }) {
  const user = useAuthStore(selectUser)
  const [notes, setNotes]       = useState<TaskNote[]>([])
  const [loading, setLoading]   = useState(true)
  const [content, setContent]   = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg]           = useState('')

  useEffect(() => {
    getTaskNotes(taskId)
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setMsg('')
    try {
      const note = await addTaskNote(taskId, content, isAdmin ? isInternal : false)
      setNotes(prev => [...prev, note])
      setContent('')
    } catch (err) {
      setMsg(extractErrorMessage(err, 'Failed to add note.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await deleteTaskNote(noteId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (err) {
      setMsg(extractErrorMessage(err, 'Failed to delete note.'))
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: GOLD }} /></div>

  return (
    <div className="space-y-3">
      {notes.length === 0 && (
        <p className="font-body text-xs text-center py-4" style={{ color: ICE_DIM }}>No notes yet.</p>
      )}
      {notes.map(n => (
        <div key={n.id} className="p-3 rounded-sm"
          style={{ background: n.isInternal ? 'rgba(201,168,76,0.05)' : 'rgba(96,165,250,0.05)', border: `1px solid ${n.isInternal ? 'rgba(201,168,76,0.15)' : 'rgba(96,165,250,0.15)'}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm text-frost/80">{n.content}</p>
              <p className="nav-label text-[0.5rem] mt-1" style={{ color: ICE_DIM }}>
                {n.author?.name ?? 'Unknown'} · {new Date(n.createdAt).toLocaleDateString('en-GB')}
                {n.isInternal && <span className="ml-2 px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(201,168,76,0.12)', color: GOLD }}>INTERNAL</span>}
              </p>
            </div>
            {isAdmin && n.authorId === user?.id && (
              <button onClick={() => handleDelete(n.id)} className="flex-shrink-0 p-1 rounded-sm transition-colors"
                style={{ color: ICE_DIM }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      ))}

      {isAdmin && (
        <form onSubmit={handleAdd} className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
          <textarea rows={2} maxLength={1000} placeholder="Add a note..."
            value={content} onChange={e => setContent(e.target.value)}
            className="uris-input w-full resize-none text-sm" style={{ minHeight: '56px' }} />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                className="rounded" style={{ accentColor: GOLD }} />
              <span className="nav-label text-[0.5rem]" style={{ color: ICE_DIM }}>Internal only</span>
            </label>
            <motion.button type="submit" disabled={submitting || !content.trim()}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm nav-label text-[0.55rem] disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.12)', border: `1px solid rgba(201,168,76,0.3)`, color: GOLD }}>
              {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              ADD NOTE
            </motion.button>
          </div>
          {msg && <p className="font-body text-xs" style={{ color: RED }}>{msg}</p>}
        </form>
      )}
    </div>
  )
}

// ── Escalations tab ───────────────────────────────────────────────────────────

function EscalationsTab({ taskId, isAdmin }: { taskId: string; isAdmin: boolean }) {
  const [escalations, setEscalations] = useState<TaskEscalation[]>([])
  const [loading, setLoading]         = useState(true)
  const [escalateTo, setEscalateTo]   = useState<EscalateTo>('lead')
  const [reason, setReason]           = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [actionId, setActionId]       = useState<string | null>(null)
  const [msg, setMsg]                 = useState('')

  useEffect(() => {
    getTaskEscalations(taskId)
      .then(d => setEscalations(d.escalations))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  async function handleRaise(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    setMsg('')
    try {
      const esc = await raiseEscalation(taskId, escalateTo, reason)
      setEscalations(prev => [esc, ...prev])
      setReason('')
    } catch (err) {
      setMsg(extractErrorMessage(err, 'Failed to raise escalation.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAck(id: string) {
    setActionId(id)
    try {
      const updated = await acknowledgeEscalation(id)
      setEscalations(prev => prev.map(e => e.id === id ? updated : e))
    } catch (err) {
      setMsg(extractErrorMessage(err, 'Failed.'))
    } finally {
      setActionId(null)
    }
  }

  async function handleResolve(id: string) {
    setActionId(id)
    try {
      const updated = await resolveEscalation(id)
      setEscalations(prev => prev.map(e => e.id === id ? updated : e))
    } catch (err) {
      setMsg(extractErrorMessage(err, 'Failed.'))
    } finally {
      setActionId(null)
    }
  }

  const statusColor = (s: string) =>
    s === 'open' ? RED : s === 'acknowledged' ? AMBER : GREEN

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: GOLD }} /></div>

  return (
    <div className="space-y-3">
      {escalations.length === 0 && (
        <p className="font-body text-xs text-center py-4" style={{ color: ICE_DIM }}>No escalations.</p>
      )}
      {escalations.map(esc => (
        <div key={esc.id} className="p-3 rounded-sm"
          style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="nav-label text-[0.5rem] px-2 py-0.5 rounded-full"
                  style={{ background: `${statusColor(esc.status)}18`, color: statusColor(esc.status) }}>
                  {esc.status.toUpperCase()}
                </span>
                <span className="nav-label text-[0.5rem]" style={{ color: BLUE }}>
                  → {esc.escalateTo.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="font-body text-sm text-frost/80">{esc.reason}</p>
              <p className="nav-label text-[0.5rem] mt-1" style={{ color: ICE_DIM }}>
                By {esc.requester?.name ?? esc.requestedById} · {new Date(esc.createdAt).toLocaleDateString('en-GB')}
              </p>
              {esc.resolvedNote && (
                <p className="font-body text-xs mt-1 italic" style={{ color: ICE_DIM }}>"{esc.resolvedNote}"</p>
              )}
            </div>
            {isAdmin && esc.status !== 'resolved' && (
              <div className="flex gap-1.5 flex-shrink-0">
                {esc.status === 'open' && (
                  <button disabled={actionId === esc.id} onClick={() => handleAck(esc.id)}
                    className="nav-label text-[0.5rem] px-2 py-1 rounded-sm disabled:opacity-50"
                    style={{ background: 'rgba(245,158,11,0.12)', color: AMBER }}>
                    {actionId === esc.id ? <Loader2 size={9} className="animate-spin" /> : 'ACK'}
                  </button>
                )}
                <button disabled={actionId === esc.id} onClick={() => handleResolve(esc.id)}
                  className="nav-label text-[0.5rem] px-2 py-1 rounded-sm disabled:opacity-50"
                  style={{ background: 'rgba(74,222,128,0.12)', color: GREEN }}>
                  {actionId === esc.id ? <Loader2 size={9} className="animate-spin" /> : 'RESOLVE'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Raise escalation form */}
      <form onSubmit={handleRaise} className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <div className="flex gap-2">
          <select value={escalateTo} onChange={e => setEscalateTo(e.target.value as EscalateTo)}
            className="uris-input text-xs flex-shrink-0" style={{ width: '140px' }}>
            <option value="lead">Escalate to Lead</option>
            <option value="operations">Escalate to Operations</option>
            <option value="core_admin">Escalate to Core Admin</option>
          </select>
          <textarea rows={1} maxLength={500} placeholder="Reason for escalation..."
            value={reason} onChange={e => setReason(e.target.value)}
            className="uris-input flex-1 resize-none text-sm" style={{ minHeight: '36px' }} />
        </div>
        {msg && <p className="font-body text-xs" style={{ color: RED }}>{msg}</p>}
        <motion.button type="submit" disabled={submitting || !reason.trim()}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm nav-label text-[0.55rem] disabled:opacity-50"
          style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: RED }}>
          {submitting ? <Loader2 size={11} className="animate-spin" /> : <AlertOctagon size={11} />}
          RAISE ESCALATION
        </motion.button>
      </form>
    </div>
  )
}

// ── Timeline tab ──────────────────────────────────────────────────────────────

function TimelineTab({ taskId }: { taskId: string }) {
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTaskTimeline(taskId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: GOLD }} /></div>

  if (events.length === 0) return (
    <p className="font-body text-xs text-center py-4" style={{ color: ICE_DIM }}>No timeline events yet.</p>
  )

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: 'rgba(201,168,76,0.12)' }} />
      <div className="space-y-3 pl-8">
        {events.map(ev => {
          const meta = EVENT_LABELS[ev.eventType] ?? { label: ev.eventType.replace(/_/g, ' '), color: ICE_DIM }
          return (
            <div key={ev.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-5 top-1.5 w-2 h-2 rounded-full"
                style={{ background: meta.color, boxShadow: `0 0 4px ${meta.color}66` }} />
              <p className="nav-label text-[0.5rem] mb-0.5" style={{ color: meta.color }}>{meta.label}</p>
              <p className="nav-label text-[0.45rem]" style={{ color: ICE_DIM }}>
                {ev.actor?.name ?? 'System'} · {new Date(ev.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              {ev.payload && Object.keys(ev.payload).length > 0 && (
                <p className="font-mono text-[0.5rem] mt-0.5" style={{ color: ICE_DIM }}>
                  {Object.entries(ev.payload).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface TaskWorkflowPanelProps {
  taskId:  string
  isAdmin: boolean
}

export default function TaskWorkflowPanel({ taskId, isAdmin }: TaskWorkflowPanelProps) {
  const [tab, setTab] = useState<PanelTab>('notes')

  const TABS: { key: PanelTab; label: string; icon: React.ElementType }[] = [
    { key: 'notes',       label: 'NOTES',       icon: MessageSquare },
    { key: 'escalations', label: 'ESCALATIONS', icon: AlertOctagon },
    { key: 'timeline',    label: 'TIMELINE',    icon: Clock },
  ]

  return (
    <div className="mt-3 rounded-sm overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)', background: 'rgba(7,8,15,0.4)' }}>
      {/* Tab bar */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 nav-label text-[0.5rem] transition-all duration-200"
            style={{
              background:   tab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent',
              borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent',
              color:        tab === t.key ? GOLD : ICE_DIM,
            }}>
            <t.icon size={10} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {tab === 'notes'       && <NotesTab       taskId={taskId} isAdmin={isAdmin} />}
            {tab === 'escalations' && <EscalationsTab taskId={taskId} isAdmin={isAdmin} />}
            {tab === 'timeline'    && <TimelineTab    taskId={taskId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
