// src/components/Sidebar.tsx
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Trophy, Home, Flame, Gamepad2, ShoppingBag, Gift,
  User, Settings, Zap, X, ChevronLeft, ChevronRight,
  Package, ChevronDown, Wallet, GamepadIcon, Compass, Layers, ShieldCheck, LayoutDashboard,
} from 'lucide-react'
import { ripple } from '../shared/lib/ripple'
import { useModRole } from '../features/moderation/useModRole'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  badge?: number | null
  children?: { label: string; to: string; icon: LucideIcon }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/dashboard',   icon: Home,        badge: null },
  { label: 'Streak',       to: '/streak',       icon: Flame,       badge: null },
  {
    label: 'Games',
    to: '/games',
    icon: Gamepad2,
    badge: null,
    children: [
      { label: 'Play Games',    to: '/games',        icon: GamepadIcon },
      { label: 'Leaderboards',  to: '/leaderboards', icon: Trophy      },
      { label: 'Exploration',   to: '/exploration',  icon: Compass     },
    ],
  },
  {
    label: 'Mall',
    to: '/mall',
    icon: ShoppingBag,
    badge: null,
    children: [
      { label: 'Shop',      to: '/mall',       icon: ShoppingBag },
      { label: 'Inventory', to: '/inventory',  icon: Package     },
    ],
  },
  { label: 'Gift',         to: '/gift',         icon: Gift,        badge: null },
  { label: 'Ranks',        to: '/ranks',        icon: Trophy,      badge: null },
  { label: 'Achievements', to: '/achievements', icon: Zap,         badge: null },
  {
    label: 'Profile',
    to: '/profile',
    icon: User,
    badge: null,
    children: [
      { label: 'Profile',  to: '/profile',  icon: User   },
      { label: 'Wallet',   to: '/wallet',   icon: Wallet },
    ],
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    badge: null,
    children: [
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Version',  to: '/version',  icon: Layers   },
    ],
  },
]

function isGroupActive(item: NavItem, pathname: string): boolean {
  if (item.children) return item.children.some(c => pathname === c.to)
  return pathname === item.to
}

interface SidebarProps {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useModRole()

  const items: NavItem[] = [
    ...NAV_ITEMS,
    ...(isStaff ? [{ label: 'Moderation', to: '/moderation', icon: ShieldCheck, badge: null }] : []),
    ...(isAdmin ? [{ label: 'Admin', to: '/admin', icon: LayoutDashboard, badge: null }] : []),
  ]

  // Track which collapsible groups are open; default Mall open if active
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (pathname === '/mall' || pathname === '/inventory') s.add('Mall')
    if (pathname === '/profile' || pathname === '/wallet') s.add('Profile')
    if (pathname === '/games' || pathname === '/leaderboards' || pathname === '/exploration') s.add('Games')
    if (pathname === '/settings' || pathname === '/version') s.add('Settings')
    return s
  })

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function handleNavClick(e: React.MouseEvent<HTMLButtonElement>, to: string) {
    ripple(e)
    navigate(to)
    onClose()
  }

  const width = collapsed ? 72 : 280

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[340] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar-shell fixed top-0 left-0 z-[350] h-screen flex flex-col transition-all duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width,
          transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4" style={{ minHeight: 60 }}>
          {!collapsed && (
            <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>
              Chillverse
            </span>
          )}
          <button type="button" onClick={onClose} className="lg:hidden ml-auto"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} />
          </button>
          <button type="button" onClick={onToggleCollapse} className="hidden lg:flex"
            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: collapsed ? 'auto' : 0, marginRight: collapsed ? 'auto' : 0, flexShrink: 0 }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto overflow-x-hidden">
          {items.map((item) => {
            const groupActive = isGroupActive(item, pathname)
            const Icon = item.icon
            const hasChildren = !!item.children
            const isExpanded = openGroups.has(item.label)

            if (hasChildren && !collapsed) {
              // ── Collapsible group (expanded sidebar) ──
              return (
                <div key={item.label}>
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={(e) => { ripple(e); toggleGroup(item.label) }}
                    className={`ripple-wrap flex items-center cursor-pointer w-full border transition-all duration-200 gap-3 px-[13px] py-[11px] rounded-[12px] text-left ${
                      groupActive && !isExpanded ? 'nav-item-active' : 'border-transparent'
                    }`}
                    style={{
                      fontSize: 14, fontWeight: 500,
                      color: groupActive ? '#fff' : 'var(--text-dim)',
                      background: 'transparent', minWidth: 0,
                    }}
                    onMouseEnter={e => { if (!groupActive || isExpanded) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' } }}
                    onMouseLeave={e => { if (!groupActive || isExpanded) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = groupActive ? '#fff' : 'var(--text-dim)' } }}
                  >
                    <span className="nav-icon-wrap" style={{ flexShrink: 0 }}><Icon size={16} /></span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        transition: 'transform 0.22s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {/* Children */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: isExpanded ? `${item.children!.length * 48}px` : '0px',
                    transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    {item.children!.map(child => {
                      const childActive = pathname === child.to
                      const ChildIcon = child.icon
                      return (
                        <button
                          key={child.to}
                          type="button"
                          onClick={(e) => handleNavClick(e, child.to)}
                          className={`ripple-wrap flex items-center cursor-pointer w-full border transition-all duration-200 gap-3 pl-[36px] pr-[13px] py-[9px] rounded-[12px] text-left ${
                            childActive ? 'nav-item-active' : 'border-transparent'
                          }`}
                          style={{
                            fontSize: 13, fontWeight: 500,
                            color: childActive ? '#fff' : 'var(--text-dim)',
                            background: 'transparent', minWidth: 0, marginTop: 1,
                          }}
                          onMouseEnter={e => { if (!childActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' } }}
                          onMouseLeave={e => { if (!childActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' } }}
                        >
                          <ChildIcon size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
                          <span className="flex-1 truncate">{child.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            }

            if (hasChildren && collapsed) {
              // ── Collapsible group (collapsed sidebar) — expand sidebar + open group ──
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    ripple(e)
                    onToggleCollapse()
                    setOpenGroups(prev => new Set([...prev, item.label]))
                  }}
                  title={`${item.label} (expand)`}
                  className={`ripple-wrap flex items-center cursor-pointer w-full border transition-all duration-200 justify-center rounded-[12px] p-[11px] ${
                    groupActive ? 'nav-item-active' : 'border-transparent'
                  }`}
                  style={{ fontSize: 14, fontWeight: 500, color: groupActive ? '#fff' : 'var(--text-dim)', background: groupActive ? undefined : 'transparent', minWidth: 0, position: 'relative' }}
                >
                  <span className="nav-icon-wrap" style={{ flexShrink: 0 }}><Icon size={16} /></span>
                  <span style={{
                    position: 'absolute', bottom: 5, right: 5,
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--surface3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ChevronRight size={7} style={{ color: 'var(--text-muted)' }} />
                  </span>
                </button>
              )
            }

            // ── Regular item ──
            const active = pathname === item.to
            return (
              <button
                key={item.label}
                type="button"
                onClick={(e) => handleNavClick(e, item.to)}
                title={collapsed ? item.label : undefined}
                className={`ripple-wrap flex items-center cursor-pointer w-full border transition-all duration-200 ${
                  active ? 'nav-item-active' : 'border-transparent'
                } ${collapsed ? 'justify-center rounded-[12px] p-[11px]' : 'gap-3 px-[13px] py-[11px] rounded-[12px] text-left'}`}
                style={{ fontSize: 14, fontWeight: 500, color: active ? '#fff' : 'var(--text-dim)', background: active ? undefined : 'transparent', minWidth: 0 }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' } }}
              >
                <span className="nav-icon-wrap" style={{ flexShrink: 0 }}><Icon size={16} /></span>
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge != null && <span className="badge-orange">{item.badge}</span>}
                {collapsed && item.badge != null && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Premium box */}
        {!collapsed && (
          <div className="p-3 pb-5">
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/pro') }}
              className="ripple-wrap w-full text-left"
              style={{ background: 'linear-gradient(135deg, rgba(30,10,0,0.9), rgba(40,18,0,0.9))', border: '1px solid rgba(255,107,0,0.3)', borderRadius: 'var(--radius)', padding: 16, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                GO PREMIUM <Flame size={11} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Unlock All Features</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Get access to exclusive content and perks</div>
              <span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8 }}>
                <Zap size={11} /> Upgrade Now
              </span>
            </button>
          </div>
        )}

        {collapsed && (
          <div className="p-3 pb-5 flex justify-center">
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/pro') }}
              title="Go Premium"
              style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
            >
              <Zap size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
