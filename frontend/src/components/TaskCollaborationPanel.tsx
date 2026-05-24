import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Eye, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  getCollaborators, addCollaborator, removeCollaborator,
  getObservers, addObserver, removeObserver,
  updateTaskDescription,
  type CollaboratorTeam, type TaskObserver,
} from '../services/collaboration.service'
import { extractErrorMessage } from '../services/error'
import api from '../services/api'

interface Props {
  taskId: string
  description?: string | null
  isAdmin: boolean
}

interface TeamOption { id: string; name: string }
interface UserOption { id: string; name: string; email: string; role: string }

export default function TaskCollaborationPanel({ taskId, description: initialDescription, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  // Description
  const [desc, setDesc] = useState(initialDescription ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [descError, setDescError] = useState('')

  // Collaborators
  const [collaborators, setCollaborators] = useState<CollaboratorTeam[]>([])
  const [loadingCollabs, setLoadingCollabs] = useState(false)
  const [allTeams, setAllTeams] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [addingCollab, setAddingCollab] = useState(false)
  const [collabError, setCollabError] = useState('')

  // Observers
  const [observers, setObservers] = useState<TaskObserver[]>([])
  const [loadingObs, setLoadingObs] = useState(false)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [addingObs, setAddingObs] = useState(false)
  const [obsError, setObsError] = useState('')

  useEffect(() => {
    if (!open) return
    void loadData()
  }, [open, taskId])

  async function loadData() {
    setLoadingCollabs(true)
    setLoadingObs(true)
    try {
      const [collabs, obs, teamsRes, usersRes] = await Promise.all([
        getCollaborators(taskId),
        getObservers(taskId),
        api.get('/teams'),
        api.get('/admin/users').catch(() => ({ data: { data: [] } })),
      ])
      setCollaborators(collabs)
      setObservers(obs)
      setAllTeams(teamsRes.data.data ?? [])
      setAllUsers(usersRes.data.data ?? [])
    } catch {
      // non-fatal
    } finally {
      setLoadingCollabs(false)
      setLoadingObs(false)
    }
  }

  // ── Description ──────────────────────────────────────────────────────────────

  async function handleSaveDesc() {
    setSavingDesc(true)
    setDescError('')
    try {
      await updateTaskDescription(taskId, desc)
      setEditingDesc(false)
    } catch (err: unknown) {
      setDescError(extractErrorMessage(err, 'Failed to save description.'))
    } finally {
      setSavingDesc(false)
    }
  }

  // ── Collaborators ─────────────────────────────────────────────────────────────

  async function handleAddCollab() {
    if (!selectedTeam) return
    setAddingCollab(true)
    setCollabError('')
    try {
      const c = await addCollaborator(taskId, selectedTeam)
      setCollaborators(prev => [...prev, c])
      setSelectedTeam('')
    } catch (err: unknown) {
      setCollabError(extractErrorMessage(err, 'Failed to add collaborator.'))
    } finally {
      setAddingCollab(false)
    }
  }

  async function handleRemoveCollab(teamId: string) {
    try {
      await removeCollaborator(taskId, teamId)
      setCollaborators(prev => prev.filter(c => c.teamId !== teamId))
    } catch {
      // non-fatal
    }
  }

  // ── Observers ─────────────────────────────────────────────────────────────────

  async function handleAddObserver() {
    if (!selectedUser) return
    setAddingObs(true)
    setObsError('')
    try {
      const o = await addObserver(taskId, selectedUser)
      setObservers(prev => [...prev, o])
      setSelectedUser('')
    } catch (err: unknown) {
      setObsError(extractErrorMessage(err, 'Failed to add observer.'))
    } finally {
      setAddingObs(false)
    }
  }

  async function handleRemoveObserver(userId: string) {
    try {
      await removeObserver(taskId, userId)
      setObservers(prev => prev.filter(o => o.userId !== userId))
    } catch {
      // non-fatal
    }
  }

  const existingCollabTeamIds = new Set(collaborators.map(c => c.teamId))
  const existingObserverUserIds = new Set(observers.map(o => o.userId))
  const availableTeams = allTeams.filter(t => !existingCollabTeamIds.has(t.id))
  const availableUsers = allUsers.filter(u => !existingObserverUserIds.has(u.id))

  return (
    <div style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
      {/* Toggle header */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <Users size={12} className="text-gold/50" />
          <span className="nav-label text-[0.6rem] text-gold/50">COLLABORATION</span>
          {(collaborators.length > 0 || observers.length > 0) && (
            <span className="nav-label text-[0.5rem] px-1.5 py-0.5 rounded-sm"
              style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>
              {collaborators.length + observers.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-ice/30" /> : <ChevronDown size={12} className="text-ice/30" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 space-y-5">

              {/* ── Description ─────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="nav-label text-[0.55rem] text-gold/50">TASK DESCRIPTION</p>
                  {isAdmin && !editingDesc && (
                    <button type="button" onClick={() => setEditingDesc(true)}
                      className="nav-label text-[0.55rem] text-gold/50 hover:text-gold transition-colors">
                      EDIT
                    </button>
                  )}
                </div>
                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      maxLength={2000}
                      className="uris-input w-full resize-none text-sm"
                      placeholder="Add a description for this task..."
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                    />
                    {descError && <p className="font-body text-xs text-red-400/80">{descError}</p>}
                    <div className="flex gap-2">
                      <motion.button type="button" whileTap={{ scale: 0.97 }}
                        onClick={handleSaveDesc} disabled={savingDesc}
                        className="btn-gold px-4 py-1.5 rounded-sm text-xs flex items-center gap-1.5 disabled:opacity-50">
                        {savingDesc ? <Loader2 size={10} className="animate-spin" /> : null}
                        {savingDesc ? 'SAVING...' : 'SAVE'}
                      </motion.button>
                      <motion.button type="button" whileTap={{ scale: 0.97 }}
                        onClick={() => { setEditingDesc(false); setDesc(initialDescription ?? ''); setDescError('') }}
                        className="btn-outline px-4 py-1.5 rounded-sm text-xs">
                        CANCEL
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <p className="font-body text-sm text-ice/50 whitespace-pre-wrap">
                    {desc || <span className="text-ice/25 italic">No description.</span>}
                  </p>
                )}
              </div>

              {/* ── Collaborator Teams ───────────────────────────────────────── */}
              <div>
                <p className="nav-label text-[0.55rem] text-gold/50 mb-2 flex items-center gap-1.5">
                  <Users size={10} />COLLABORATOR TEAMS
                </p>
                {loadingCollabs ? (
                  <Loader2 size={14} className="text-gold/40 animate-spin" />
                ) : (
                  <div className="space-y-2">
                    {collaborators.length === 0 && (
                      <p className="font-body text-xs text-ice/25">No collaborator teams.</p>
                    )}
                    {collaborators.map(c => (
                      <div key={c.teamId} className="flex items-center justify-between px-3 py-2 rounded-sm"
                        style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                        <div>
                          <p className="font-body text-sm text-frost/80">{c.team.name}</p>
                          <p className="nav-label text-[0.5rem] text-ice/30">
                            {c.team.members.length} member{c.team.members.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {isAdmin && (
                          <motion.button type="button" whileTap={{ scale: 0.95 }}
                            onClick={() => handleRemoveCollab(c.teamId)}
                            className="text-ice/30 hover:text-red-400 transition-colors p-1">
                            <X size={12} />
                          </motion.button>
                        )}
                      </div>
                    ))}
                    {isAdmin && availableTeams.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
                          className="uris-input flex-1 text-sm">
                          <option value="">Add collaborator team...</option>
                          {availableTeams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <motion.button type="button" whileTap={{ scale: 0.97 }}
                          onClick={handleAddCollab} disabled={!selectedTeam || addingCollab}
                          className="btn-gold px-3 py-1.5 rounded-sm text-xs flex items-center gap-1 disabled:opacity-40">
                          {addingCollab ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                          ADD
                        </motion.button>
                      </div>
                    )}
                    {collabError && <p className="font-body text-xs text-red-400/80">{collabError}</p>}
                  </div>
                )}
              </div>

              {/* ── Observers ────────────────────────────────────────────────── */}
              <div>
                <p className="nav-label text-[0.55rem] text-gold/50 mb-2 flex items-center gap-1.5">
                  <Eye size={10} />OBSERVERS
                </p>
                {loadingObs ? (
                  <Loader2 size={14} className="text-gold/40 animate-spin" />
                ) : (
                  <div className="space-y-2">
                    {observers.length === 0 && (
                      <p className="font-body text-xs text-ice/25">No observers.</p>
                    )}
                    {observers.map(o => (
                      <div key={o.userId} className="flex items-center justify-between px-3 py-2 rounded-sm"
                        style={{ background: 'rgba(184,212,240,0.04)', border: '1px solid rgba(184,212,240,0.08)' }}>
                        <div>
                          <p className="font-body text-sm text-frost/80">{o.user.name || o.user.email}</p>
                          <p className="nav-label text-[0.5rem] text-ice/30">
                            {o.user.role.replace(/_/g, ' ')} · VIEW ONLY
                          </p>
                        </div>
                        {isAdmin && (
                          <motion.button type="button" whileTap={{ scale: 0.95 }}
                            onClick={() => handleRemoveObserver(o.userId)}
                            className="text-ice/30 hover:text-red-400 transition-colors p-1">
                            <X size={12} />
                          </motion.button>
                        )}
                      </div>
                    ))}
                    {isAdmin && availableUsers.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                          className="uris-input flex-1 text-sm">
                          <option value="">Add observer...</option>
                          {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                          ))}
                        </select>
                        <motion.button type="button" whileTap={{ scale: 0.97 }}
                          onClick={handleAddObserver} disabled={!selectedUser || addingObs}
                          className="btn-gold px-3 py-1.5 rounded-sm text-xs flex items-center gap-1 disabled:opacity-40">
                          {addingObs ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                          ADD
                        </motion.button>
                      </div>
                    )}
                    {obsError && <p className="font-body text-xs text-red-400/80">{obsError}</p>}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
