import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, AlertTriangle, FileText } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Starfield from '../components/Starfield'
import api from '../services/api'
import { useAuthStore, selectToken } from '../store/authStore'
import { extractErrorMessage } from '../services/error'

interface DocumentSubmission {
  id: string
  internId: string
  internName: string
  fileName: string
  fileUrl: string
  submissionDay: 'MONDAY' | 'THURSDAY'
  submittedAt: string
}

export default function LeadDocumentsPage() {
  const token = useAuthStore(selectToken)
  const nav = useNavigate()

  const [documents, setDocuments] = useState<DocumentSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterDay, setFilterDay] = useState<'ALL' | 'MONDAY' | 'THURSDAY'>('ALL')

  useEffect(() => {
    if (!token) {
      nav('/login')
      return
    }
    loadDocuments()
  }, [token, nav])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const res = await api.get('/documents/all-submissions')
      setDocuments(res.data || [])
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load documents'))
    } finally {
      setLoading(false)
    }
  }

  const filteredDocuments = filterDay === 'ALL'
    ? documents
    : documents.filter(doc => doc.submissionDay === filterDay)

  return (
    <div className="min-h-screen bg-navy-950 text-frost">
      <Starfield />
      <Sidebar />
      <main className="md:ml-52 pt-14 min-h-screen relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="nav-label text-[0.55rem] text-gold/40 tracking-ultra mb-1">DOCUMENTATION</p>
            <h1 className="font-display font-black text-3xl text-ice-gradient">Intern Documents</h1>
            <div className="gold-rule w-14 mt-2" />
            <p className="font-body text-sm text-ice/40 mt-3">
              View and manage documents submitted by interns
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card rounded-sm p-6">

            <div className="flex items-center justify-between mb-6">
              <p className="nav-label text-[0.6rem] text-gold/60">FILTER BY DAY</p>
              <div className="flex gap-2">
                {(['ALL', 'MONDAY', 'THURSDAY'] as const).map(day => (
                  <button
                    key={day}
                    onClick={() => setFilterDay(day)}
                    className={`px-3 py-1.5 rounded-sm text-[0.55rem] transition-all ${
                      filterDay === day
                        ? 'bg-gold/20 border border-gold/40 text-gold'
                        : 'bg-navy-900/50 border border-gold/10 text-ice/50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-ice/40">Loading documents...</p>
            ) : error ? (
              <div className="flex items-center gap-2 py-3 px-4 rounded-sm bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-[0.55rem] text-red-400/70">{error}</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <p className="text-sm text-ice/40">No documents found</p>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between rounded-sm border border-gold/10 bg-navy-900/40 p-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-gold/10 text-gold flex-shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-ice truncate">{doc.internName}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[0.5rem] text-ice/40 truncate">{doc.fileName}</span>
                          <span className="text-[0.5rem] text-gold/50 flex-shrink-0">{doc.submissionDay}</span>
                          <span className="text-[0.5rem] text-ice/30 flex-shrink-0">{new Date(doc.submittedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      download
                      className="btn-outline px-3 py-1.5 rounded-sm text-[0.55rem] flex items-center gap-1 flex-shrink-0 ml-3"
                    >
                      <Download size={12} />
                      DOWNLOAD
                    </a>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
