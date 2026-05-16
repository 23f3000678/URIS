import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, CalendarDays, ClipboardList, Star, Users, Bell, LogOut, ChevronRight, ShieldCheck, ScrollText } from 'lucide-react'
import { useAuthStore, selectUser, selectIsAdmin } from '../store/authStore'
import { useAlertStore } from '../store/alertStore'
import TeamSwitcher from './TeamSwitcher'

const allItems = [
  { icon: LayoutDashboard, label: 'Overview',      to: '/dashboard',     adminOnly: false, internOnly: false },
  { icon: CalendarDays,    label: 'Availability',  to: '/availability',  adminOnly: false, internOnly: true  },
  { icon: ClipboardList,   label: 'Tasks',         to: '/tasks',         adminOnly: false, internOnly: false },
  { icon: Bell,            label: 'Notifications', to: '/notifications', adminOnly: false, internOnly: true  },
  { icon: Star,            label: 'Reviews',       to: '/review',        adminOnly: true,  internOnly: false },
  { icon: Users,           label: 'Team',          to: '/team',          adminOnly: true,  internOnly: false },
  { icon: Bell,            label: 'Alerts',        to: '/alerts',        adminOnly: true,  internOnly: false },
  { icon: ShieldCheck,     label: 'Admin',         to: '/admin',         adminOnly: true,  internOnly: false },
  { icon: ScrollText,      label: 'Audit Logs',    to: '/audit-logs',    adminOnly: true,  internOnly: false },
  { icon: LayoutDashboard, label: 'Portfolio',     to: '/portfolio-edit', adminOnly: false, internOnly: true  },
]

export default function Sidebar() {
  const loc     = useLocation()
  const user    = useAuthStore(selectUser)
  const isAdmin = useAuthStore(selectIsAdmin)
  const logout  = useAuthStore(s => s.logout)
  const nav     = useNavigate()

  // Read unread count from shared store — no local fetch
  const unread = useAlertStore(s => s.unread)

  const items = allItems.filter(i => {
    if (i.adminOnly && !isAdmin) return false
    if (i.internOnly && isAdmin) return false
    return true
  })

  return (
    <motion.aside
      initial={{ x: -56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="fixed left-0 top-[49px] bottom-0 z-40 w-[200px] hidden md:flex flex-col justify-between py-5"
      style={{ background: 'rgba(7,8,15,0.9)', borderRight: '1px solid rgba(201,168,76,0.09)', backdropFilter: 'blur(16px)' }}
    >
      <div>
        <div className="px-5 mb-3">
          <p className="nav-label text-[0.5rem]" style={{ color: 'rgba(201,168,76,0.32)', letterSpacing: '0.45em' }}>NAVIGATION</p>
        </div>
        <nav className="px-2 space-y-0.5">
          {items.map((item, i) => {
            const active     = loc.pathname === item.to
            const showBadge  = (item.to === '/notifications' && !isAdmin && unread > 0)
                            || (item.to === '/alerts' && isAdmin && unread > 0)
            return (
              <motion.div key={item.to} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.12 + i * 0.05 }}>
                <Link to={item.to} className={`sidebar-item ${active ? 'active' : ''}`}>
                  <item.icon size={13} />
                  {item.label}
                  {showBadge && (
                    <motion.span
                      key={unread}
                      initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                      className="ml-auto flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full font-bold text-[0.46rem]"
                      style={{ background: '#f87171', color: '#fff', boxShadow: '0 0 6px #f8717166' }}>
                      {unread > 9 ? '9+' : unread}
                    </motion.span>
                  )}
                  {active && !showBadge && (
                    <ChevronRight size={9} style={{ marginLeft: 'auto', color: 'rgba(201,168,76,0.5)' }} />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>
      </div>

      <div className="px-2">
        <div className="gold-rule mb-3 mx-2" />
        <TeamSwitcher />
        <div className="px-3 mb-3">
          <p className="nav-label text-[0.5rem] mb-0.5" style={{ color: 'rgba(184,212,240,0.25)' }}>SIGNED IN AS</p>
          <p className="font-display text-sm" style={{ color: 'rgba(232,240,251,0.8)' }}>{user?.name || 'User'}</p>
          <p className="nav-label text-[0.5rem] mt-0.5" style={{ color: 'rgba(201,168,76,0.45)' }}>
            {isAdmin ? 'ADMIN · FULL ACCESS' : 'INTERN · LIMITED'}
          </p>
        </div>
        <button onClick={() => { logout(); nav('/login') }} className="sidebar-item w-full" style={{ color: 'rgba(248,113,113,0.5)' }}>
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
