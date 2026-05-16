import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Linkedin, Mail, Phone, ExternalLink, Award, Code2, Calendar } from 'lucide-react'
import Starfield from '../components/Starfield'
import api from '../services/api'
import { extractErrorMessage } from '../services/error'

interface PublicPortfolio {
  name: string
  email: string
  role: string
  bio: string
  profilePic: string
  contactNumber: string
  linkedinUrl: string
  skills: string[]
  completedTasks: Array<{
    id: string
    title: string
    complexity: number
    skills: string[]
    deadline: string
  }>
}

export default function Portfolio() {
  const { slug } = useParams()
  const [data, setData] = useState<PublicPortfolio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const res = await api.get(`/portfolio/${slug}`)
        if (res.data.success) {
          setData(res.data.data)
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Portfolio not found.'))
      } finally {
        setLoading(false)
      }
    }
    void fetchPublicData()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-10 text-center">
        <Starfield />
        <h1 className="font-display text-4xl text-ice-gradient mb-4">404</h1>
        <p className="font-body text-ice/40">{error || 'This portfolio does not exist.'}</p>
        <div className="gold-rule w-20 mt-8 opacity-20" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 text-frost selection:bg-gold/30">
      <Starfield />
      
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gold/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 mb-20">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="w-40 h-40 md:w-52 md:h-52 rounded-2xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/10 p-1 bg-navy-900/50 backdrop-blur-xl">
            {data.profilePic ? (
              <img src={data.profilePic} alt={data.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-navy-800 text-gold/20">
                <Code2 size={64} />
              </div>
            )}
          </motion.div>

          <div className="flex-1 text-center md:text-left pt-2">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <p className="nav-label text-[0.6rem] text-gold tracking-widest mb-2">VERIFIED STEMONEF ALUMNI</p>
              <h1 className="font-display font-black text-5xl md:text-6xl text-white mb-4 tracking-tight uppercase">
                {data.name}
              </h1>
              <p className="font-display text-xl text-ice/60 mb-8 max-w-2xl leading-relaxed">
                {data.bio || `Specialized in ${data.role.replace(/_/g, ' ')} during their internship at STEMONEF.`}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center md:justify-start gap-4">
              {data.linkedinUrl && (
                <a href={data.linkedinUrl} target="_blank" rel="noopener" className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all text-sm font-bold">
                  <Linkedin size={16} /> LINKEDIN
                </a>
              )}
              <a href={`mailto:${data.email}`} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all text-sm font-bold">
                <Mail size={16} /> CONTACT ME
              </a>
              {data.contactNumber && (
                <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-ice/60 text-sm font-bold">
                  <Phone size={16} /> {data.contactNumber}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {/* Sidebar Info */}
          <div className="space-y-12">
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3 className="nav-label text-[0.6rem] text-gold/40 tracking-ultra mb-6 uppercase">Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {data.skills.map(skill => (
                  <span key={skill} className="px-3 py-1.5 rounded-sm bg-gold/5 border border-gold/10 text-gold/80 text-[0.65rem] font-bold">
                    {skill.toUpperCase()}
                  </span>
                ))}
                {data.skills.length === 0 && <p className="text-ice/20 text-xs italic">No skills listed</p>}
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <h3 className="nav-label text-[0.6rem] text-gold/40 tracking-ultra mb-6 uppercase">Program details</h3>
              <div className="glass-card rounded-xl p-6 space-y-6">
                <div>
                  <p className="nav-label text-[0.5rem] text-gold/30 mb-1">ROLE</p>
                  <p className="font-display text-sm text-frost">{data.role.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="nav-label text-[0.5rem] text-gold/30 mb-1">INSTITUTION</p>
                  <p className="font-display text-sm text-frost">STEMONEF INTELLIGENCE</p>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-green-400">
                    <Award size={14} />
                    <span className="font-ui font-black text-[0.6rem] tracking-widest">VERIFIED INTERNSHIP</span>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Experience Timeline */}
          <div className="md:col-span-2 space-y-12">
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <h3 className="nav-label text-[0.6rem] text-gold/40 tracking-ultra mb-8 uppercase">Key Accomplishments</h3>
              <div className="space-y-4">
                {data.completedTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + (idx * 0.1) }}
                    className="glass-card rounded-xl p-6 border-l-2 border-l-gold hover:translate-x-1 transition-all group">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h4 className="font-display text-lg text-white group-hover:text-gold transition-colors">{task.title}</h4>
                      <div className="flex gap-0.5 pt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className="w-1.5 h-1.5 rounded-full" 
                            style={{ background: n <= task.complexity ? 'rgba(201,168,76,0.8)' : 'rgba(255,255,255,0.05)' }} />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {task.skills.map(s => (
                        <span key={s} className="text-[0.6rem] font-bold text-ice/40 bg-white/5 px-2 py-0.5 rounded-sm">
                          {s.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-ice/30">
                      <div className="flex items-center gap-1 text-[0.6rem] font-bold">
                        <Calendar size={10} /> COMPLETED {task.deadline || '—'}
                      </div>
                      <div className="h-1 w-1 rounded-full bg-white/10" />
                      <div className="flex items-center gap-1 text-[0.6rem] font-bold text-gold/50">
                        <ExternalLink size={10} /> VERIFIED BY STEMONEF
                      </div>
                    </div>
                  </motion.div>
                ))}
                {data.completedTasks.length === 0 && (
                  <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                    <p className="font-body text-ice/20 text-sm">No completed tasks recorded yet.</p>
                  </div>
                )}
              </div>
            </motion.section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-32 pt-16 border-t border-white/5 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-[1px] bg-gold/20" />
            <span className="font-display font-black text-xs tracking-[0.4em] text-ice-gradient">STEMONEF</span>
            <div className="w-10 h-[1px] bg-gold/20" />
          </div>
          <p className="font-body text-[0.65rem] text-ice/30 uppercase tracking-[0.2em]">Certified Professional Network</p>
        </footer>
      </div>
    </div>
  )
}
