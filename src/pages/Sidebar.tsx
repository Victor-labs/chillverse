// src/components/Sidebar.tsx
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Home, Flame, Gamepad2, ShoppingBag, Trophy,
  MessageCircle, User, Settings, Bell, X, Zap,
} from 'lucide-react'
import { ripple } from '../lib/ripple'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  badge?: number | null
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Streak',        to: '/streak',                            icon: Flame,        badge: null },
  { label: 'Dashboard',     to: '/dashboard',                         icon: Home,         badge: null },
  { label: 'Games',         to: '/games',                             icon: Gamepad2,     badge: null },
  { label: 'Mall',          to: '/coming-soon?feature=Mall',          icon: ShoppingBag,  badge: 3    },
  { label: 'Achievements',  to: '/coming-soon?feature=Achievements',  icon: Trophy,       badge: null },
  { label: 'Chat',          to: '/chat',                              icon: MessageCircle,badge: 5    },
  { label: 'Profile',       to: '/profile',                           icon: User,         badge: null },
  { label: 'Settings',      to: '/settings',                          icon: Settings,     badge: null },
  { label: 'Notifications', to: '/coming-soon?feature=Notifications', icon: Bell,         badge: 12   },
]

function isItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [path, query] = item.to.split('?')
  if (path !== pathname) return false
  if (!query) return true
  return search === `?${query}`
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  function handleNavClick(e: React.MouseEvent<HTMLButtonElement>, to: string) {
    ripple(e)
    navigate(to)
    onClose()
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[340] md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar-shell fixed top-0 left-0 z-[350] h-screen w-[280px] flex flex-col transition-transform duration-[350ms] md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <span style={{ fontSize:20, fontWeight:800, background:'linear-gradient(135deg, var(--accent), var(--accent2))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Chillverse
          </span>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden"
            style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1 px-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, pathname, search)
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={(e) => handleNavClick(e, item.to)}
                className={`ripple-wrap flex items-center gap-3 px-[13px] py-[11px] rounded-[12px] cursor-pointer w-full text-left border transition-all duration-200 ${
                  active ? 'nav-item-active' : 'border-transparent'
                }`}
                style={{ fontSize:14, fontWeight:500, color: active ? '#fff' : 'var(--text-dim)', background: active ? undefined : 'transparent' }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' } }}
              >
                <span className="nav-icon-wrap"><Icon size={16} /></span>
                <span className="flex-1">{item.label}</span>
                {item.badge != null && <span className="badge-orange">{item.badge}</span>}
              </button>
            )
          })}
        </nav>

        {/* Premium Box */}
        <div className="p-3 pb-5">
          <button
            type="button"
            onClick={(e) => { ripple(e); navigate('/coming-soon?feature=Go%20Premium') }}
            className="ripple-wrap w-full text-left"
            style={{ background:'linear-gradient(135deg, rgba(30,10,0,0.9), rgba(40,18,0,0.9))', border:'1px solid rgba(255,107,0,0.3)', borderRadius:'var(--radius)', padding:16, cursor:'pointer', transition:'border-color 0.2s, transform 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:4, color:'var(--accent)', fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>
              GO PREMIUM <Flame size={11} />
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Unlock All Features</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>Get access to exclusive content and perks</div>
            <span className="btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'6px 12px', borderRadius:8 }}>
              <Zap size={11} /> Upgrade Now
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
