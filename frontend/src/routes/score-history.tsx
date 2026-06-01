import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Filter } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import api from '../services/api'
import { useAuthStore, selectToken } from '../store/authStore'
import { extractErrorMessage } from '../services/error'

interface ScoreHistory {
  id: string
  internId: string
  internName: string
  previousScore: number
  newScore: number
  reason: string
  changedBy: string
  changedAt: string
}

export default function ScoreHistoryPage() {
  const token = useAuthStore(selectToken)
  const nav = useNavigate()

  const [history, setHistory] = useState<ScoreHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIntern, setSelectedIntern] = useState('')
  const [interns, setInterns] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!token) {
      nav('/login')
      return
    }
    loadData()
  }, [token, nav])

  const loadData = async () => {
    try {
      setLoading(true)
      const [historyRes, internsRes] = await Promise.all([
        api.get('/score/history').catch(() => ({ data: [] })),
        api.get('/admin/interns').catch(() => ({ data: [] }))
      ])
      setHistory(historyRes.data || [])
      setInterns(internsRes.data || [])
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load score history'))
    } finally {
      setLoading(false)
    }
  }

  const filteredHistory = selectedIntern
    ? history.filter(h => h.internId === selectedIntern)
    : history

  const getSortedHistory = () => {
    return [...filteredHistory].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    )
  }

  const getScoreTrend = (change: number) => {
    if (change > 0) return 'up'
    if (change < 0) return 'down'
    return 'neutral'
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">ANALYTICS</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">Score History</h1>
            <div className="gold-rule w-14 mt-2" />
            <p className="font-body text-sm text-ice/40 mt-3">
              Track all score changes and reasons for each intern
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card rounded-sm p-6 mb-6">

            <div className="flex items-center gap-3 mb-4">
              <Filter size={16} className="text-gold" />
              <p className="nav-label text-[0.6rem] text-gold/60">FILTER BY INTERN</p>
            </div>

            <select
              value={selectedIntern}
              onChange={(e) => setSelectedIntern(e.target.value)}
              className="uris-input w-full"
            >
              <option value="">All Interns</option>
              {interns.map(intern => (
                <option key={intern.id} value={intern.id}>
                  {intern.name}
                </option>
              ))}
            </select>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-card rounded-sm p-6">

            <div className="mb-4">
              <p className="nav-label text-[0.6rem] text-gold/60">SCORE CHANGES ({filteredHistory.length})</p>
            </div>

            {loading ? (
              <p className="text-sm text-ice/40">Loading score history...</p>
            ) : error ? (
              <div className="flex items-center gap-2 p-3 rounded-sm bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-[0.55rem] text-red-400/70">{error}</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <p className="text-sm text-ice/40">No score changes found</p>
            ) : (
              <div className="space-y-3">
                {getSortedHistory().map(item => {
                  const change = item.newScore - item.previousScore
                  const trend = getScoreTrend(change)
                  const trendColor = trend === 'up' ? 'text-signal' : trend === 'down' ? 'text-red-400' : 'text-ice/40'
                  const trendBg = trend === 'up' ? 'bg-signal/10' : trend === 'down' ? 'bg-red-500/10' : 'bg-gold/10'

                  return (
                    <div key={item.id} className="flex items-start justify-between rounded-sm border border-gold/10 bg-navy-900/40 p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-body font-semibold text-ice">{item.internName}</p>
                          <span className={`text-[0.5rem] font-mono font-semibold px-2 py-1 rounded ${trendBg} ${trendColor}`}>
                            {change > 0 ? '+' : ''}{change.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[0.55rem] text-ice/60 mb-2">{item.reason}</p>
                        <div className="flex gap-4 text-[0.5rem] text-ice/40">
                          <span>Previous: {item.previousScore.toFixed(2)}</span>
                          <span>→</span>
                          <span>New: {item.newScore.toFixed(2)}</span>
                          <span className="text-ice/30">by {item.changedBy}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-[0.55rem] text-ice/40">
                          {new Date(item.changedAt).toLocaleDateString()}
                        </p>
                        <p className="text-[0.5rem] text-ice/30">
                          {new Date(item.changedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
