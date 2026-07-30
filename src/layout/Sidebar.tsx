// src/components/Sidebar.tsx
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Trophy, Home, Flame, Gamepad2, ShoppingBag,
  Settings, Zap, X, ChevronLeft, ChevronRight,
  Package, ChevronDown, Wallet, GamepadIcon, Compass, Layers, ShieldCheck, LayoutDashboard,
} from 'lucide-react'
import { ripple } from '../shared/lib/ripple'
import { useModRole } from '../features/moderation/useModRole'
import Avatar from '../shared/components/Avatar'
import Logo from './Logo'
import type { Profile } from '../shared/types'

// Matches the presence values stored on profiles.presence (see Profile.tsx / Settings.tsx)
type Presence = 'online' | 'idle' | 'offline' | 'invisible'
const PRESENCE_COLORS: Record<Presence, string> = {
  online: '#3ecf8e',
  idle: '#f5c542',
  offline: '#888899',
  invisible: '#555566',
}

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
      { label: 'Wallet',    to: '/wallet',     icon: Wallet      },
    ],
  },
  { label: 'Ranks',        to: '/ranks',        icon: Trophy,      badge: null },
  { label: 'Achievements', to: '/achievements', icon: Zap,         badge: null },
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
  profile?: Profile | null
}

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse, profile }: SidebarProps) {
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
    if (pathname === '/mall' || pathname === '/inventory' || pathname === '/wallet') s.add('Mall')
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
            <Logo size={30} />
          )}
          <button type="button" onClick={onClose} className="lg:hidden ml-auto"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} />
          </button>
          <button type="button" onClick={onToggleCollapse} className="hidden lg:flex"
            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-dim)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: collapsed ? 'auto' : 0, marginRight: collapsed ? 'auto' : 0, flexShrink: 0 }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-2 overflow-y-auto overflow-x-hidden" style={{ flex: '0 1 auto', minHeight: 0 }}>
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

        {/* User panel — Discord-style; tap to open full profile */}
        <div className="px-2 pb-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          {!collapsed ? (
            <div
              className="ripple-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '8px', background: 'rgba(255,255,255,0.03)' }}
            >
              <button
                type="button"
                onClick={(e) => { ripple(e); navigate('/profile'); onClose() }}
                title="Open profile"
                className="ripple-wrap"
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                onMouseEnter={e => { e.currentTarget.parentElement!.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { e.currentTarget.parentElement!.style.background = 'rgba(255,255,255,0.03)' }}
              >
                <span style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar src={profile?.avatar} name={profile?.display_name || profile?.username || 'You'} size={34} disabled />
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%',
                    background: PRESENCE_COLORS[(profile?.presence as Presence) || 'online'],
                    border: '2px solid var(--surface, #17171c)',
                  }} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.display_name || profile?.username || 'You'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.bio?.trim() || (((profile?.presence as Presence) || 'online').replace(/^\w/, c => c.toUpperCase()))}
                  </div>
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => { ripple(e); navigate('/settings'); onClose() }}
                title="Settings"
                className="ripple-wrap"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
              >
                <Settings size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/profile'); onClose() }}
              title="Open profile"
              className="ripple-wrap"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px 0', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ position: 'relative' }}>
                <Avatar src={profile?.avatar} name={profile?.display_name || profile?.username || 'You'} size={36} disabled />
                <span style={{
                  position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%',
                  background: PRESENCE_COLORS[(profile?.presence as Presence) || 'online'],
                  border: '2px solid var(--surface, #17171c)',
                }} />
              </span>
            </button>
          )}
        </div>

        {/* Any leftover height goes here, below the account row, instead of
            pushing the account row itself far down away from the nav items. */}
        <div style={{ flex: 1, minHeight: 0 }} />
      </aside>
    </>
  )
}
