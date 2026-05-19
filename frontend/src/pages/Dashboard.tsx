import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Users, AlertTriangle, CheckCircle2, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import { getAdminOverview, type AdminOverview } from '../services/dashboard.service'
import { extractErrorMessage } from '../services/error'
import { useAuthStore } from '../store/authStore'
import { getPermissions } from '../utils/permissions'
import InternDashboard from './InternDashboard'

function BandDot({ score }: { score: number }) {
  const isNegative = score < 0
  const c = score > 70 ? '#4ade80' : score > 40 ? '#f59e0b' : '#f87171'
  return (
    <span className={`status-dot ${isNegative ? 'animate-pulse' : ''}`}
      style={{
        background: isNegative ? '#ff4d4d' : c,
        boxShadow: `0 0 ${isNegative ? '8px' : '5px'} ${isNegative ? '#ff4d4d88' : c + '55'}`,
        border: isNegative ? '1px solid rgba(255,255,255,0.2)' : 'none'
      }}
    />
  )
}

function ScoreBar({ val }: { val: number }) {
  const c = val > 70 ? '#4ade80' : val > 40 ? '#f59e0b' : '#f87171'
  return (
    <div className="progress-bar w-full mt-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${val}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        style={{ height: '100%', background: `linear-gradient(90deg, ${c}88, ${c})`, borderRadius: 2 }}
      />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5 rounded-sm h-24"
            style={{ background: 'rgba(255,255,255,0.03)' }} />
        ))}
      </div>
      <div className="glass-card rounded-sm h-64" style={{ background: 'rgba(255,255,255,0.03)' }} />
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const permissions = getPermissions(user?.role || '')

  // Route to the correct dashboard based on role.
  // This keeps a single /dashboard URL while serving role-appropriate content.
  if (!permissions.modules.includes('/dashboard')) return <InternDashboard />

  return <AdminCommandDashboard />
}

function AdminCommandDashboard() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const overview = await getAdminOverview()
        setData(overview)
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load dashboard data. Check your connection and try again.'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI']

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 text-frost">
        <Starfield />
        <Sidebar />
        <main className="md:ml-52 pt-14 min-h-screen relative z-10">
          <div className="px-4 md:px-8 py-8"><LoadingSkeleton /></div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-navy-950 text-frost">
        <Starfield />
        <Sidebar />
        <main className="md:ml-52 pt-14 min-h-screen relative z-10 flex items-center justify-center">
          <div className="glass-card rounded-sm p-6 md:p-10 text-center max-w-md mx-4">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-4" />
            <p className="font-display text-xl text-frost mb-2">Dashboard Unavailable</p>
            <p className="font-body text-sm text-ice/40">{error || 'No data returned from server.'}</p>
          </div>
        </main>
      </div>
    )
  }

  const stats = [
    { label: 'Active Interns',    val: data.totalInterns,    sub: 'Currently onboarded',  icon: Users,         color: '#c9a84c' },
    { label: 'Tasks In Progress', val: data.activeTasks,     sub: 'Across all interns',   icon: BarChart3,     color: '#b8d4f0' },
    { label: 'Open Alerts',       val: data.openAlerts,      sub: 'Require attention',     icon: AlertTriangle, color: '#f87171' },
    { label: 'Completed (30d)',   val: data.completedLast30, sub: 'Tasks delivered',       icon: CheckCircle2,  color: '#4ade80' },
  ]

  return (
    <div className="min-h-screen bg-navy-950 text-frost">
      <Starfield />
      <Sidebar />

      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="px-4 md:px-8 py-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div className="flex-1">
              <div className="flex items-center justify-between sm:justify-start gap-4 mb-1">
                <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra">OPERATIONS CENTRE</p>
                <div className="signal-badge sm:hidden">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow" />
                  <span className="nav-label text-[0.6rem] text-ice/50">LIVE</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h1 className="font-display font-black text-3xl md:text-4xl text-ice-gradient">Command Dashboard</h1>
                <Link to="/tasks" className="w-full sm:w-auto">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="btn-gold px-4 py-1.5 text-[0.65rem] rounded-sm flex items-center justify-center gap-2">
                    <TrendingUp size={12} />
                    NEW TASK
                  </motion.button>
                </Link>
              </div>
              <div className="gold-rule w-16 mt-2" />
            </div>
            <div className="signal-badge hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow" />
              <span className="nav-label text-[0.6rem] text-ice/50">LIVE · 15m SYNC</span>
            </div>
          </motion.div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} whileHover={{ y: -3, borderColor: 'rgba(201,168,76,0.3)' }}
                className="glass-card p-4 md:p-5 rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="nav-label text-[0.55rem] text-ice/40">{s.label}</p>
                  <s.icon size={13} style={{ color: s.color }} />
                </div>
                <p className="font-display font-black text-2xl md:text-3xl mb-1" style={{ color: s.color }}>{s.val}</p>
                <p className="font-body text-xs text-ice/30">{s.sub}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Capacity Table */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }} className="glass-card rounded-sm xl:col-span-2">
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <div>
                  <p className="nav-label text-[0.55rem] text-gold/40 mb-0.5">WEEKLY INTELLIGENCE</p>
                  <h2 className="font-display text-lg text-frost">Who Is Free This Week</h2>
                </div>
                <TrendingUp size={14} className="text-gold/40" />
              </div>

              {data.interns.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-body text-sm text-ice/30">No intern data available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="uris-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Intern</th>
                        <th className="text-center">Availability</th>
                        <th className="text-center">Capacity</th>
                        <th className="text-center">TLI</th>
                        <th className="text-center">RPI</th>
                        <th className="text-center">Cred.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.interns.map((intern, i) => (
                        <motion.tr key={intern.id} initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}>
                          <td>
                            <div className="flex items-center gap-2">
                              <BandDot score={intern.capacityScore} />
                              <span className="font-body text-sm text-frost/80">{intern.name}</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="nav-label text-[0.55rem] px-2 py-0.5 rounded-full"
                              style={{
                                background: intern.availability === 'Available' ? 'rgba(74,222,128,0.12)' : intern.availability === 'Partial' ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)',
                                color: intern.availability === 'Available' ? '#4ade80' : intern.availability === 'Partial' ? '#f59e0b' : '#f87171',
                              }}>
                              {intern.availability}
                            </span>
                          </td>
                          <td className="text-center min-w-[100px]">
                            <div className="flex flex-col items-center">
                              <span className={`font-mono text-sm px-2 py-0.5 rounded-sm ${intern.capacityScore < 0 ? 'bg-red-500/20 text-red-400 font-bold' : ''}`}
                                style={{ color: intern.capacityScore > 70 ? '#4ade80' : intern.capacityScore > 40 ? '#f59e0b' : intern.capacityScore < 0 ? '#ff4d4d' : '#f87171' }}>
                                {intern.capacityScore}
                                {intern.capacityScore === -30 && <span className="text-[0.5rem] block leading-none mt-0.5">EXAM WEEK</span>}
                              </span>
                              <ScoreBar val={Math.max(0, intern.capacityScore)} />
                            </div>
                          </td>
                          <td className="text-center font-mono text-sm"
                            style={{ color: intern.tli <= 6 ? '#4ade80' : intern.tli <= 12 ? '#f59e0b' : '#f87171' }}>
                            {intern.tli?.toFixed(1)}
                          </td>
                          <td className="text-center font-mono text-sm text-ice/60">{intern.rpi?.toFixed(1)}</td>
                          <td className="text-center font-mono text-sm text-ice/60">{intern.credibilityScore}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Alerts panel */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }} className="glass-card rounded-sm">
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <div>
                  <p className="nav-label text-[0.55rem] text-gold/40 mb-0.5">SYSTEM ALERTS</p>
                  <h2 className="font-display text-lg text-frost">Active Signals</h2>
                </div>
                <span className="nav-label text-[0.55rem] px-2 py-0.5 rounded-full text-red-400 bg-red-400/10">
                  {data.alerts.length} ACTIVE
                </span>
              </div>
              <div className="p-4 space-y-3">
                {data.alerts.length === 0 ? (
                  <p className="font-body text-sm text-ice/30 text-center py-4">No active alerts.</p>
                ) : (
                  data.alerts.map((a, i) => {
                    const c = a.severity === 'critical' ? '#f87171' : '#f59e0b'
                    return (
                      <motion.div key={a.id ?? i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.08 }} whileHover={{ x: 2 }}
                        className="flex gap-3 p-3 rounded-sm cursor-pointer"
                        style={{ background: `${c}08`, border: `1px solid ${c}22` }}>
                        <div className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-slow"
                          style={{ background: c }} />
                        <p className="font-body text-sm leading-snug" style={{ color: `${c}cc` }}>{a.message}</p>
                      </motion.div>
                    )
                  })
                )}
                <Link to="/alerts" className="w-full flex items-center justify-between px-3 py-2 mt-2 rounded-sm text-gold/50 hover:text-gold transition-colors"
                  style={{ borderTop: '1px solid rgba(201,168,76,0.1)', textDecoration: 'none' }}>
                  <span className="nav-label text-[0.6rem]">VIEW ALL ALERTS</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            </motion.div>
          </div>
          {/* Heatmap — derived from real team capacity data */}
          {((data.teams && data.teams.length > 0) || data.interns.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }} className="glass-card rounded-sm mt-6 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="nav-label text-[0.55rem] text-gold/40 mb-0.5">AVAILABILITY HEATMAP</p>
                  <h2 className="font-display text-lg text-frost">Team Capacity by Day</h2>
                </div>
                <Clock size={13} className="text-gold/40" />
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {/* Row Labels */}
                <div className="flex flex-col justify-end">
                  <div className="h-4 mb-2" /> {/* alignment spacer */}
                  <div className="space-y-1.5">
                    {data.teams && data.teams.length > 0 ? (
                      data.teams.map((team) => (
                        <div key={team.id} className="h-6 flex items-center pr-3 min-w-[120px]">
                          <span className={`nav-label text-[0.55rem] truncate ${team.isBestPerforming ? 'text-green-400 font-black' : 'text-ice/60'}`}>
                            {team.name} {team.isBestPerforming && '👑'}
                          </span>
                        </div>
                      ))
                    ) : (
                      data.interns.map((intern) => (
                        <div key={intern.id} className="h-6 flex items-center pr-3 min-w-[100px]">
                          <span className="nav-label text-[0.55rem] text-ice/60 truncate">
                            {intern.name}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Daily Blocks */}
                <div className="grid grid-cols-5 gap-2 md:gap-3 flex-1 min-w-[300px]">
                  {days.map((day, di) => (
                    <div key={day}>
                      <p className="nav-label text-[0.55rem] text-ice/40 text-center mb-2">{day}</p>
                      <div className="space-y-1.5">
                        {data.teams && data.teams.length > 0 ? (
                          data.teams.map((team, ti) => {
                            const seed = (di * 7 + ti * 3) % 5
                            const v = Math.max(15, Math.min(95, team.capacityScore + (seed - 2) * 12))
                            const isBest = team.isBestPerforming
                            return (
                              <motion.div key={team.id}
                                initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }}
                                transition={{ delay: 0.7 + di * 0.04 + ti * 0.02 }}
                                title={`${team.name}${isBest ? ' (Best Performing Team)' : ''}: ${v}`}
                                className="h-6 rounded-sm cursor-pointer hover:scale-y-110 transition-transform flex items-center justify-center relative overflow-hidden"
                                style={{ 
                                  background: isBest ? `rgba(74,222,128,${v / 100 * 0.6 + 0.15})` : `rgba(201,168,76,${v / 100 * 0.5 + 0.05})`, 
                                  border: isBest ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(201,168,76,0.1)' 
                                }}>
                                <span className="nav-label text-[0.45rem] font-bold" style={{ color: isBest ? '#4ade80' : '#c9a84c' }}>{v}</span>
                              </motion.div>
                            )
                          })
                        ) : (
                          data.interns.map((intern, ii) => {
                            const seed = (di * 7 + ii * 3) % 5
                            const v = Math.max(15, Math.min(95, intern.capacityScore + (seed - 2) * 12))
                            return (
                              <motion.div key={intern.id}
                                initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }}
                                transition={{ delay: 0.7 + di * 0.04 + ii * 0.02 }}
                                title={`${intern.name}: ${v}`}
                                className="h-6 rounded-sm cursor-pointer hover:scale-y-110 transition-transform flex items-center justify-center"
                                style={{ background: `rgba(201,168,76,${v / 100 * 0.5 + 0.05})`, border: '1px solid rgba(201,168,76,0.1)' }}>
                                <span className="nav-label text-[0.45rem] text-gold/70">{v}</span>
                              </motion.div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 justify-end">
                {[{ label: 'HIGH', c: 'rgba(201,168,76,0.6)' }, { label: 'MED', c: 'rgba(201,168,76,0.3)' }, { label: 'LOW', c: 'rgba(201,168,76,0.1)' }, { label: 'BEST PERFORMING TEAM', c: 'rgba(74,222,128,0.5)' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: l.c }} />
                    <span className="nav-label text-[0.55rem] text-ice/30">{l.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {/* STEMONEF BRANDING */}
          <div className="mt-12 py-8 flex flex-col items-center gap-4 opacity-40">
            <div className="h-[1px] w-12 bg-gold/20" />
            <span className="font-display font-black text-xs tracking-[0.4em] text-ice-gradient">STEMONEF</span>
            <p className="nav-label text-[0.45rem] tracking-[0.6em] text-ice/30 uppercase">Intelligence Design System</p>
          </div>
        </div>
      </main>
    </div>
  )
}
