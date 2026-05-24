import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, TrendingUp, X, Check, UserCheck, AlertTriangle, Loader2, Clock, ShieldCheck, Trash2, Edit2, Users } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import { getAdminOverview, type InternRow } from '../services/dashboard.service'
import { getAllTasks, type Task } from '../services/tasks.service'
import { overrideScore, assignTask, getAvailabilityDeadline, setAvailabilityDeadline, getPendingUsers, approveUser, deleteIntern, updateIntern, type AvailabilityDeadline, type PendingUser, type UpdateInternPayload } from '../services/admin.service'
import { updateTaskStatus } from '../services/tasks.service'
import { extractErrorMessage } from '../services/error'
import RoleManagementModal from '../components/RoleManagementModal'

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function AdminOverview() {
  const [interns, setInterns]     = useState<InternRow[]>([])
  const [tasks, setTasks]         = useState<Task[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState('')
  const [activeTab, setActiveTab] = useState<'override' | 'assign' | 'status' | 'deadline' | 'approvals' | 'roles' | 'interns'>('assign')

  // Override score form
  const [overrideInternId, setOverrideInternId] = useState('')
  const [overrideScoreVal, setOverrideScoreVal] = useState('')
  const [overrideReason, setOverrideReason]     = useState('')
  const [overrideLoading, setOverrideLoading]   = useState(false)
  const [overrideMsg, setOverrideMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Assign task form
  const [assignInternId, setAssignInternId] = useState('')
  const [assignTaskId, setAssignTaskId]     = useState('')
  const [assignLoading, setAssignLoading]   = useState(false)
  const [assignMsg, setAssignMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Update task status form
  const [statusTaskId, setStatusTaskId]       = useState('')
  const [statusValue, setStatusValue]         = useState('in_progress_early')
  const [statusProgress, setStatusProgress]   = useState('25')
  const [statusLoading, setStatusLoading]     = useState(false)
  const [statusMsg, setStatusMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  // Availability deadline form
  const [deadlineDay, setDeadlineDay]       = useState(1)
  const [deadlineHour, setDeadlineHour]     = useState(11)
  const [deadlineMinute, setDeadlineMinute] = useState(0)
  const [deadlineLoading, setDeadlineLoading] = useState(false)
  const [deadlineMsg, setDeadlineMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  // Pending approvals
  const [pendingUsers, setPendingUsers]         = useState<PendingUser[]>([])
  const [approvingId, setApprovingId]           = useState<string | null>(null)
  const [approvalMsg, setApprovalMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Role management modal
  const [showRoleModal, setShowRoleModal] = useState(false)

  // Intern management
  const [internMgmtMsg, setInternMgmtMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [deletingId, setDeletingId]           = useState<string | null>(null)
  const [editingIntern, setEditingIntern]     = useState<InternRow | null>(null)
  const [editForm, setEditForm]               = useState<UpdateInternPayload>({})
  const [editLoading, setEditLoading]         = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [overview, taskList] = await Promise.all([getAdminOverview(), getAllTasks()])
        setInterns(overview.interns)
        setTasks(taskList)
      } catch (err) {
        setDataError(extractErrorMessage(err, 'Failed to load admin data. Ensure the backend is running.'))
      } finally {
        setLoadingData(false)
      }
    }
    void load()
  }, [])

  // Load current availability deadline
  useEffect(() => {
    getAvailabilityDeadline()
      .then((dl: AvailabilityDeadline) => {
        setDeadlineDay(dl.day)
        setDeadlineHour(dl.hour)
        setDeadlineMinute(dl.minute)
      })
      .catch(() => {/* use defaults */})
  }, [])

  // Load pending users
  useEffect(() => {
    getPendingUsers().then(setPendingUsers).catch(() => {})
  }, [])

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    setOverrideLoading(true)
    setOverrideMsg(null)
    try {
      await overrideScore({ internId: overrideInternId, score: Number(overrideScoreVal), reason: overrideReason })
      setOverrideMsg({ ok: true, text: 'Score override applied successfully.' })
      setOverrideInternId('')
      setOverrideScoreVal('')
      setOverrideReason('')
    } catch (err: unknown) {
      setOverrideMsg({ ok: false, text: extractErrorMessage(err, 'Override failed.') })
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssignLoading(true)
    setAssignMsg(null)
    try {
      await assignTask({ internId: assignInternId, taskId: assignTaskId })
      setAssignMsg({ ok: true, text: `Task assigned successfully.` })
      setAssignInternId('')
      setAssignTaskId('')
    } catch (err: unknown) {
      setAssignMsg({ ok: false, text: extractErrorMessage(err, 'Assignment failed.') })
    } finally {
      setAssignLoading(false)
    }
  }

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusLoading(true)
    setStatusMsg(null)
    try {
      await updateTaskStatus({ taskId: statusTaskId, status: statusValue, progress: Number(statusProgress) })
      setStatusMsg({ ok: true, text: `Task updated to ${statusValue}.` })
      setStatusTaskId('')
      setStatusProgress('25')
    } catch (err: unknown) {
      setStatusMsg({ ok: false, text: extractErrorMessage(err, 'Status update failed.') })
    } finally {
      setStatusLoading(false)
    }
  }

  const handleDeadline = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeadlineLoading(true)
    setDeadlineMsg(null)
    try {
      await setAvailabilityDeadline({ day: deadlineDay, hour: deadlineHour, minute: deadlineMinute })
      setDeadlineMsg({ ok: true, text: 'Availability deadline updated successfully.' })
    } catch (err: unknown) {
      setDeadlineMsg({ ok: false, text: extractErrorMessage(err, 'Failed to update deadline.') })
    } finally {
      setDeadlineLoading(false)
    }
  }

  const handleApprove = async (userId: string, email: string) => {
    setApprovingId(userId)
    setApprovalMsg(null)
    try {
      await approveUser(userId)
      setPendingUsers(prev => prev.filter(u => u.id !== userId))
      setApprovalMsg({ ok: true, text: `${email} approved and can now log in.` })
    } catch (err: unknown) {
      setApprovalMsg({ ok: false, text: extractErrorMessage(err, 'Approval failed.') })
    } finally {
      setApprovingId(null)
    }
  }

  const tabs = [
    { key: 'assign',    label: 'ASSIGN TASK',    icon: UserCheck },
    { key: 'override',  label: 'SCORE OVERRIDE', icon: Shield },
    { key: 'status',    label: 'UPDATE STATUS',  icon: TrendingUp },
    { key: 'deadline',  label: 'DEADLINE',        icon: Clock },
    { key: 'approvals', label: 'APPROVALS',       icon: UserCheck, badge: pendingUsers.length },
    { key: 'roles',     label: 'ROLES',           icon: ShieldCheck },
    { key: 'interns',   label: 'INTERNS',         icon: Users },
  ] as const

  return (
    <div className="min-h-screen bg-navy-950 text-frost">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="px-4 md:px-8 py-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">ADMIN CONTROLS</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">Admin Overview</h1>
            <div className="gold-rule w-14 mt-2" />
            <p className="font-body text-sm text-ice/40 mt-2">Assignment engine · Score override · Task status management</p>
          </motion.div>

          {/* Loading / error states */}
          {loadingData && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-gold animate-spin" />
            </div>
          )}

          {!loadingData && dataError && (
            <div className="glass-card rounded-sm p-8 text-center max-w-md mx-auto">
              <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
              <p className="font-body text-sm text-ice/50">{dataError}</p>
            </div>
          )}

          {!loadingData && !dataError && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Left — ASL shortlist */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }} className="glass-card rounded-sm xl:col-span-2">
                <div className="flex items-center justify-between px-6 py-4"
                  style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                  <div>
                    <p className="nav-label text-[0.55rem] text-gold/40 mb-0.5">ASL TRIAD SHORTLIST</p>
                    <h2 className="font-display text-lg text-frost">Ranked by Capacity Score</h2>
                  </div>
                  <span className="nav-label text-[0.55rem] text-ice/30">AVAILABILITY → SKILL → LOAD</span>
                </div>

                {interns.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="font-body text-sm text-ice/30">No intern data available.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="uris-table w-full">
                      <thead>
                        <tr>
                          <th className="text-left">Rank</th>
                          <th className="text-left">Intern</th>
                          <th className="text-center">Availability</th>
                          <th className="text-center">Capacity</th>
                          <th className="text-center">TLI</th>
                          <th className="text-center">RPI</th>
                          <th className="text-center">Cred.</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...interns]
                          .filter(i => i.availability !== 'Occupied' && i.capacityScore >= 20)
                          .sort((a, b) => b.capacityScore - a.capacityScore)
                          .map((intern, idx) => (
                            <motion.tr key={intern.id}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + idx * 0.07 }}>
                              <td>
                                <span className="font-display font-black text-sm"
                                  style={{ color: idx === 0 ? '#c9a84c' : 'rgba(184,212,240,0.3)' }}>
                                  #{idx + 1}
                                </span>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span className={`status-dot ${intern.capacityScore < 0 ? 'animate-pulse' : ''}`} style={{
                                    background: intern.capacityScore < 0 ? '#ff4d4d' : intern.capacityScore > 70 ? '#4ade80' : '#f59e0b',
                                    boxShadow: `0 0 ${intern.capacityScore < 0 ? '8px' : '5px'} ${intern.capacityScore < 0 ? '#ff4d4d88' : intern.capacityScore > 70 ? '#4ade8055' : '#f59e0b55'}`
                                  }} />
                                  <span className="font-body text-sm text-frost/80">{intern.name}</span>
                                </div>
                              </td>
                              <td className="text-center">
                                <span className="nav-label text-[0.5rem] px-2 py-0.5 rounded-full"
                                  style={{
                                    background: intern.availability === 'Available' ? 'rgba(74,222,128,0.12)' : 'rgba(245,158,11,0.12)',
                                    color: intern.availability === 'Available' ? '#4ade80' : '#f59e0b',
                                  }}>{intern.availability}</span>
                              </td>
                              <td className="text-center font-mono text-sm">
                                <span className={`px-2 py-0.5 rounded-sm ${intern.capacityScore < 0 ? 'bg-red-500/20 text-red-400 font-bold' : ''}`}
                                  style={{ color: intern.capacityScore > 70 ? '#4ade80' : intern.capacityScore > 40 ? '#f59e0b' : intern.capacityScore < 0 ? '#ff4d4d' : '#f87171' }}>
                                  {intern.capacityScore}
                                  {intern.capacityScore === -30 && <span className="text-[0.5rem] block leading-none">EXAM WEEK</span>}
                                </span>
                              </td>
                              <td className="text-center font-mono text-sm text-ice/60">{intern.tli?.toFixed(1)}</td>
                              <td className="text-center font-mono text-sm text-ice/60">{intern.rpi?.toFixed(1)}</td>
                              <td className="text-center">
                                <span className="font-mono text-sm"
                                  style={{ color: intern.credibilityScore >= 50 ? 'rgba(184,212,240,0.6)' : '#f87171' }}>
                                  {intern.credibilityScore}
                                  {intern.credibilityScore < 50 && <span className="text-[0.5rem] ml-1">⚠</span>}
                                </span>
                              </td>
                              <td className="text-center">
                                <motion.button
                                  whileHover={{ scale: 1.08 }}
                                  onClick={() => setAssignInternId(intern.id)}
                                  className="nav-label text-[0.55rem] px-3 py-1 rounded-sm transition-colors"
                                  style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#c9a84c' }}>
                                  SELECT
                                </motion.button>
                              </td>
                            </motion.tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Do Not Assign section */}
                {interns.filter(i => i.capacityScore < 20 || i.availability === 'Occupied').length > 0 && (
                  <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(248,113,113,0.1)' }}>
                    <p className="nav-label text-[0.55rem] text-red-400/50 mb-2">DO NOT ASSIGN — CAPACITY BELOW THRESHOLD</p>
                    <div className="flex flex-wrap gap-2">
                      {interns.filter(i => i.capacityScore < 20 || i.availability === 'Occupied').map(i => (
                        <span key={i.id} className="nav-label text-[0.55rem] px-2 py-1 rounded-sm"
                          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                          {i.name} · {i.capacityScore}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Right — Action panel */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }} className="glass-card rounded-sm">

                {/* Tabs */}
                <div className="flex flex-wrap" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                      className="flex-1 py-3 nav-label text-[0.55rem] transition-all duration-200 flex flex-col items-center gap-1 relative"
                      style={{
                        background: activeTab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent',
                        borderBottom: activeTab === t.key ? '2px solid #c9a84c' : '2px solid transparent',
                        color: activeTab === t.key ? '#c9a84c' : 'rgba(184,212,240,0.35)',
                      }}>
                      <t.icon size={12} />
                      {t.label}
                      {'badge' in t && t.badge > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center nav-label text-[0.45rem]"
                          style={{ background: '#f87171', color: '#fff' }}>
                          {t.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  <AnimatePresence mode="wait">

                    {/* ASSIGN TASK */}
                    {activeTab === 'assign' && (
                      <motion.form key="assign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} onSubmit={handleAssign} className="space-y-4">
                        <p className="nav-label text-[0.55rem] text-gold/40 mb-3">ASSIGN TASK TO INTERN</p>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">SELECT INTERN</label>
                          <select className="uris-input" value={assignInternId}
                            onChange={e => setAssignInternId(e.target.value)} required>
                            <option value="">Choose intern...</option>
                            {interns.map(i => (
                              <option key={i.id} value={i.id}>{i.name} (Cap: {i.capacityScore})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">SELECT TASK</label>
                          <select className="uris-input" value={assignTaskId}
                            onChange={e => setAssignTaskId(e.target.value)} required>
                            <option value="">Choose task...</option>
                            {tasks.map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </div>
                        {assignMsg && <FeedbackBanner ok={assignMsg.ok} text={assignMsg.text} />}
                        <ActionButton loading={assignLoading} label="CONFIRM ASSIGNMENT" loadingLabel="ASSIGNING..." />
                      </motion.form>
                    )}

                    {/* SCORE OVERRIDE */}
                    {activeTab === 'override' && (
                      <motion.form key="override" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} onSubmit={handleOverride} className="space-y-4">
                        <p className="nav-label text-[0.55rem] text-gold/40 mb-3">MANUAL SCORE OVERRIDE</p>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">SELECT INTERN</label>
                          <select className="uris-input" value={overrideInternId}
                            onChange={e => setOverrideInternId(e.target.value)} required>
                            <option value="">Choose intern...</option>
                            {interns.map(i => (
                              <option key={i.id} value={i.id}>{i.name} (Current: {i.capacityScore})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">NEW SCORE (0–100)</label>
                          <input type="number" min="0" max="100" className="uris-input"
                            placeholder="e.g. 65" value={overrideScoreVal}
                            onChange={e => setOverrideScoreVal(e.target.value)} required />
                        </div>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">REASON (OPTIONAL)</label>
                          <textarea className="uris-input resize-none" rows={2}
                            placeholder="Justification for manual override..."
                            value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
                        </div>
                        {overrideMsg && <FeedbackBanner ok={overrideMsg.ok} text={overrideMsg.text} />}
                        <ActionButton loading={overrideLoading} label="APPLY OVERRIDE" loadingLabel="APPLYING..." />
                      </motion.form>
                    )}

                    {/* UPDATE TASK STATUS */}
                    {activeTab === 'status' && (
                      <motion.form key="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} onSubmit={handleStatusUpdate} className="space-y-4">
                        <p className="nav-label text-[0.55rem] text-gold/40 mb-3">UPDATE TASK STATUS</p>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">SELECT TASK</label>
                          <select className="uris-input" value={statusTaskId}
                            onChange={e => setStatusTaskId(e.target.value)} required>
                            <option value="">Choose task...</option>
                            {tasks.map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">NEW STATUS</label>
                          <select className="uris-input" value={statusValue}
                            onChange={e => setStatusValue(e.target.value)} required>
                            <option value="backlog">Backlog (0%)</option>
                            <option value="in_progress_early">In Progress — Early (25%)</option>
                            <option value="in_progress_mid">In Progress — Mid (50%)</option>
                            <option value="under_review">Under Review (75%)</option>
                            <option value="completed">Completed (100%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">PROGRESS %</label>
                          <input type="number" min="0" max="100" className="uris-input"
                            value={statusProgress} onChange={e => setStatusProgress(e.target.value)} required />
                        </div>
                        {statusMsg && <FeedbackBanner ok={statusMsg.ok} text={statusMsg.text} />}
                        <ActionButton loading={statusLoading} label="UPDATE STATUS" loadingLabel="UPDATING..." />
                      </motion.form>
                    )}

                    {/* PENDING APPROVALS */}
                    {activeTab === 'approvals' && (
                      <motion.div key="approvals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} className="space-y-4">
                        <div className="mb-3">
                          <p className="nav-label text-[0.55rem] text-gold/40">PENDING ADMIN APPROVALS</p>
                          <p className="font-body text-xs text-ice/30 mt-1">
                            Users who registered as admin and are awaiting access.
                          </p>
                        </div>

                        {approvalMsg && <FeedbackBanner ok={approvalMsg.ok} text={approvalMsg.text} />}

                        {pendingUsers.length === 0 ? (
                          <div className="py-8 text-center">
                            <Check size={20} className="text-signal mx-auto mb-2 opacity-40" />
                            <p className="font-body text-sm text-ice/30">No pending approvals.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {pendingUsers.map(u => (
                              <motion.div key={u.id}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-3 rounded-sm"
                                style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}>
                                <div className="min-w-0 flex-1">
                                  <p className="font-body text-sm text-frost/90 truncate font-medium">
                                    {u.name || u.email.split('@')[0]}
                                  </p>
                                  <p className="font-body text-xs text-ice/50 truncate">{u.email}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="nav-label text-[0.5rem] px-1.5 py-0.5 rounded-sm"
                                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                                      {u.role.replace(/_/g, ' ')}
                                    </span>
                                    <span className="nav-label text-[0.45rem] text-ice/30">
                                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  disabled={approvingId === u.id}
                                  onClick={() => handleApprove(u.id, u.email)}
                                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-sm nav-label text-[0.55rem] disabled:opacity-50 flex-shrink-0"
                                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                                  {approvingId === u.id
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <Check size={11} />}
                                  APPROVE
                                </motion.button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* AVAILABILITY DEADLINE */}
                    {activeTab === 'deadline' && (
                      <motion.form key="deadline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} onSubmit={handleDeadline} className="space-y-4">
                        <div className="mb-3">
                          <p className="nav-label text-[0.55rem] text-gold/40">AVAILABILITY SUBMISSION DEADLINE</p>
                          <p className="font-body text-xs text-ice/30 mt-1">
                            Sets the weekly cutoff shown on the intern availability form.
                          </p>
                        </div>

                        {/* Day picker */}
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">DAY OF WEEK</label>
                          <div className="grid grid-cols-7 gap-1">
                            {DAY_OPTIONS.map(d => (
                              <motion.button key={d.value} type="button"
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setDeadlineDay(d.value)}
                                className="py-2 rounded-sm flex flex-col items-center gap-0.5 transition-all duration-200"
                                style={{
                                  background: deadlineDay === d.value ? 'rgba(201,168,76,0.15)' : 'rgba(13,15,28,0.6)',
                                  border: `1px solid ${deadlineDay === d.value ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.1)'}`,
                                }}>
                                <span className="nav-label text-[0.5rem]"
                                  style={{ color: deadlineDay === d.value ? '#c9a84c' : 'rgba(184,212,240,0.3)' }}>
                                  {d.label.slice(0, 3).toUpperCase()}
                                </span>
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Time picker */}
                        <div>
                          <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">TIME</label>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="nav-label text-[0.5rem] text-ice/30 mb-1">HOUR (0–23)</p>
                              <input
                                type="number" min={0} max={23} className="uris-input text-center font-display font-black text-lg"
                                value={deadlineHour}
                                onChange={e => setDeadlineHour(Math.min(23, Math.max(0, Number(e.target.value))))}
                              />
                            </div>
                            <span className="font-display font-black text-2xl text-gold/40 mt-4">:</span>
                            <div className="flex-1">
                              <p className="nav-label text-[0.5rem] text-ice/30 mb-1">MINUTE (0–59)</p>
                              <input
                                type="number" min={0} max={59} className="uris-input text-center font-display font-black text-lg"
                                value={deadlineMinute}
                                onChange={e => setDeadlineMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="p-3 rounded-sm" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}>
                          <p className="nav-label text-[0.5rem] text-gold/40 mb-1">PREVIEW</p>
                          <p className="font-body text-sm text-frost/70">
                            {DAY_OPTIONS[deadlineDay]?.label}{' '}
                            {deadlineHour % 12 === 0 ? 12 : deadlineHour % 12}:{String(deadlineMinute).padStart(2, '0')}{' '}
                            {deadlineHour < 12 ? 'AM' : 'PM'}
                          </p>
                        </div>

                        {deadlineMsg && <FeedbackBanner ok={deadlineMsg.ok} text={deadlineMsg.text} />}
                        <ActionButton loading={deadlineLoading} label="SAVE DEADLINE" loadingLabel="SAVING..." />
                      </motion.form>
                    )}

                    {/* ROLES */}
                    {activeTab === 'roles' && (
                      <motion.div key="roles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} className="space-y-4">
                        <div className="mb-3">
                          <p className="nav-label text-[0.55rem] text-gold/40">ROLE MANAGEMENT</p>
                          <p className="font-body text-xs text-ice/30 mt-1">
                            Change user roles across the organisation.
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => setShowRoleModal(true)}
                          className="btn-gold w-full py-3 rounded-sm flex items-center justify-center gap-2 text-sm">
                          <ShieldCheck size={14} />
                          OPEN ROLE MANAGER
                        </motion.button>
                      </motion.div>
                    )}

                    {/* INTERNS */}
                    {activeTab === 'interns' && (
                      <motion.div key="interns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} className="space-y-4">
                        <p className="nav-label text-[0.55rem] text-gold/40 mb-3">INTERN MANAGEMENT</p>

                        {internMgmtMsg && <FeedbackBanner ok={internMgmtMsg.ok} text={internMgmtMsg.text} />}

                        {/* Edit form */}
                        {editingIntern && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-sm space-y-3"
                            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="nav-label text-[0.55rem] text-gold/60">EDITING: {editingIntern.name}</p>
                              <button onClick={() => { setEditingIntern(null); setEditForm({}) }}
                                className="text-ice/30 hover:text-frost transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                            <div>
                              <label className="nav-label text-[0.55rem] text-gold/50 block mb-1">FULL NAME</label>
                              <input type="text" className="uris-input" placeholder={editingIntern.name}
                                value={editForm.name ?? ''}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="nav-label text-[0.55rem] text-gold/50 block mb-1">GDOC URL</label>
                              <input type="url" className="uris-input" placeholder="https://docs.google.com/document/d/..."
                                value={editForm.gdocUrl ?? ''}
                                onChange={e => setEditForm(f => ({ ...f, gdocUrl: e.target.value }))} />
                            </div>
                            <div>
                              <label className="nav-label text-[0.55rem] text-gold/50 block mb-1">JOINING DATE</label>
                              <input type="date" className="uris-input"
                                value={editForm.joiningDate ?? ''}
                                onChange={e => setEditForm(f => ({ ...f, joiningDate: e.target.value }))} />
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              disabled={editLoading}
                              onClick={async () => {
                                setEditLoading(true)
                                setInternMgmtMsg(null)
                                try {
                                  await updateIntern(editingIntern.id, editForm)
                                  setInternMgmtMsg({ ok: true, text: `${editingIntern.name} updated successfully.` })
                                  setInterns(prev => prev.map(i => i.id === editingIntern.id
                                    ? { ...i, name: editForm.name || i.name }
                                    : i))
                                  setEditingIntern(null)
                                  setEditForm({})
                                } catch (err: unknown) {
                                  setInternMgmtMsg({ ok: false, text: extractErrorMessage(err, 'Update failed.') })
                                } finally {
                                  setEditLoading(false)
                                }
                              }}
                              className="btn-gold w-full py-2 rounded-sm flex items-center justify-center gap-2 text-xs disabled:opacity-50">
                              {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              SAVE CHANGES
                            </motion.button>
                          </motion.div>
                        )}

                        {/* Intern list */}
                        {interns.length === 0 ? (
                          <div className="py-8 text-center">
                            <p className="font-body text-sm text-ice/30">No interns found.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {interns.map(intern => (
                              <motion.div key={intern.id}
                                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-3 rounded-sm"
                                style={{ background: 'rgba(13,15,28,0.6)', border: '1px solid rgba(201,168,76,0.1)' }}>
                                <div className="min-w-0 flex-1">
                                  <p className="font-body text-sm text-frost/90 truncate">{intern.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="nav-label text-[0.45rem]"
                                      style={{ color: intern.capacityScore > 60 ? '#4ade80' : intern.capacityScore > 30 ? '#f59e0b' : '#f87171' }}>
                                      CAP {intern.capacityScore}
                                    </span>
                                    <span className="nav-label text-[0.45rem] text-ice/25">·</span>
                                    <span className="nav-label text-[0.45rem] text-ice/30">{intern.activeTasks ?? 0} ACTIVE</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { setEditingIntern(intern); setEditForm({ name: intern.name }); setInternMgmtMsg(null) }}
                                    className="p-1.5 rounded-sm transition-colors"
                                    style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
                                    title="Edit intern">
                                    <Edit2 size={11} className="text-gold" />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    disabled={deletingId === intern.id}
                                    onClick={async () => {
                                      if (!window.confirm(`Delete ${intern.name}? This cannot be undone.`)) return
                                      setDeletingId(intern.id)
                                      setInternMgmtMsg(null)
                                      try {
                                        await deleteIntern(intern.id)
                                        setInterns(prev => prev.filter(i => i.id !== intern.id))
                                        setInternMgmtMsg({ ok: true, text: `${intern.name} deleted.` })
                                      } catch (err: unknown) {
                                        setInternMgmtMsg({ ok: false, text: extractErrorMessage(err, 'Delete failed.') })
                                      } finally {
                                        setDeletingId(null)
                                      }
                                    }}
                                    className="p-1.5 rounded-sm transition-colors disabled:opacity-40"
                                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
                                    title="Delete intern">
                                    {deletingId === intern.id
                                      ? <Loader2 size={11} className="text-red-400 animate-spin" />
                                      : <Trash2 size={11} className="text-red-400" />}
                                  </motion.button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>

      {/* Role Management Modal */}
      <AnimatePresence>
        {showRoleModal && (
          <RoleManagementModal onClose={() => setShowRoleModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FeedbackBanner({ ok, text }: { ok: boolean; text: string }) {
  const c = ok ? 'rgba(74,222,128' : 'rgba(248,113,113'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-2 p-3 rounded-sm"
      style={{ background: `${c},0.08)`, border: `1px solid ${c},0.25)` }}>
      {ok
        ? <Check size={13} className="text-signal flex-shrink-0" />
        : <X size={13} className="text-red-400 flex-shrink-0" />}
      <p className="font-body text-sm" style={{ color: ok ? '#4ade80' : '#f87171' }}>{text}</p>
    </motion.div>
  )
}

function ActionButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <motion.button type="submit" disabled={loading}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className="btn-gold w-full py-3 rounded-sm disabled:opacity-50 flex items-center justify-center gap-2">
      {loading && <Loader2 size={13} className="animate-spin" />}
      {loading ? loadingLabel : label}
    </motion.button>
  )
}
