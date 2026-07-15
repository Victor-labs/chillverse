// src/features/admin/AdminDashboard.tsx
import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ShieldAlert, Users, UserPlus, Crown, ShieldBan, Gem,
  ShoppingBag, Gamepad2, Swords, Sparkles, Flag, LifeBuoy, RefreshCw, AlertTriangle, Search, ChevronRight,
} from 'lucide-react'
import { useModRole } from '../moderation/useModRole'
import { ripple } from '../../shared/lib/ripple'
import { fetchAdminDashboardStats, type AdminDashboardStats } from './adminStats'
import AdminUsersDrawer from './AdminUsersDrawer'

function StatCard({
  icon: Icon, label, value, tint, onClick,
}: {
  icon: typeof Users
  label: string
  value: string | number
  tint?: string
  /** When present, the card renders as a button — used for stats that open
   *  an AdminDrawer drill-down (e.g. "Total users" → AdminUsersDrawer). */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      className="neu-card"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() } : undefined}
      style={{
        padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
        cursor: onClick ? 'pointer' : 'default',
        border: onClick ? '1px solid rgba(124,102,255,0.3)' : undefined,
        boxShadow: onClick ? '0 0 0 1px rgba(124,102,255,0.08), 4px 4px 10px var(--neu-dark)' : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${tint ?? 'var(--accent)'}22`, color: tint ?? 'var(--accent)', flexShrink: 0,
          }}>
            <Icon size={14} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</p>
        </div>
        {onClick && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--violet-soft)', letterSpacing: '0.04em' }}>VIEW →</span>}
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function SectionHeader({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div style={{ margin: '22px 0 10px' }}>
      {kicker && <p style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>{kicker}</p>}
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</h2>
    </div>
  )
}

function RankedList({ rows, primaryKey, countKey, secondaryKey }: {
  rows: Record<string, string | number>[]
  primaryKey: string
  countKey: string
  secondaryKey?: string
}) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet.</p>
  }
  const max = Math.max(...rows.map(r => Number(r[countKey]) || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row, i) => {
        const count = Number(row[countKey]) || 0
        return (
          <div key={i}>
            <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                {String(row[primaryKey])}
                {secondaryKey && row[secondaryKey] ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {String(row[secondaryKey])}</span> : null}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700 }}>{count}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

type AdminSection = 'overview' | 'economy' | 'games' | 'multiplayer' | 'halo' | 'operations'

const ADMIN_SECTIONS: { key: AdminSection; label: string; description: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Atrium', description: 'Platform pulse and account growth', icon: Users },
  { key: 'economy', label: 'Mall economy', description: 'Diamonds, purchases, and item demand', icon: ShoppingBag },
  { key: 'games', label: 'Arcade', description: 'Sessions and most-played games', icon: Gamepad2 },
  { key: 'multiplayer', label: 'Arena', description: 'Rooms and multiplayer traffic', icon: Swords },
  { key: 'halo', label: 'Halo AI', description: 'Assistant usage and providers', icon: Sparkles },
  { key: 'operations', label: 'Support desk', description: 'Reports, bans, tickets, actions', icon: LifeBuoy },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useModRole()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<AdminSection>('overview')
  const activeMeta = useMemo(() => ADMIN_SECTIONS.find(s => s.key === activeSection) ?? ADMIN_SECTIONS[0], [activeSection])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await fetchAdminDashboardStats()
    if (error) setError(error)
    setStats(data)
    setLoading(false)
  }

  useEffect(() => {
    if (roleLoading) return
    if (!isAdmin) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isAdmin])

  if (roleLoading) return null

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: 20 }}>
        <ShieldAlert size={32} style={{ color: 'var(--text-dim)', marginBottom: 10 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Admins only</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>
          This dashboard is restricted to Chillverse admins.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 56 }}>
      <div className="flex items-center gap-3" style={{ padding: '4px 20px 0', marginBottom: 6 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/dashboard') }}
          style={{
            width: 38, height: 38, borderRadius: 11, background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)',
            color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
            {stats ? `Updated ${new Date(stats.generated_at).toLocaleTimeString()}` : 'Platform overview'}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { ripple(e); load() }}
          disabled={loading}
          style={{
            width: 38, height: 38, borderRadius: 11, background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ padding: '0 20px' }}>
        {error && (
          <div className="neu-card" style={{ padding: 16, marginTop: 16, color: 'var(--red)', fontSize: 12.5 }}>{error}</div>
        )}

        {stats && (
          <div className="neu-card" style={{ padding: 16, marginTop: 16 }}>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Admin mall map</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '3px 0 0' }}>Choose a wing; each tab opens its own statistics dashboard.</p>
              </div>
              <button type="button" onClick={(e) => { ripple(e); setUsersDrawerOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 12, padding: '10px 12px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', boxShadow: '3px 3px 8px var(--neu-dark)' }}>
                <Search size={14} /> Search user
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {ADMIN_SECTIONS.map(section => {
                const Icon = section.icon
                const active = activeSection === section.key
                return (
                  <button key={section.key} type="button" onClick={(e) => { ripple(e); setActiveSection(section.key) }} className={active ? 'neu-inset' : 'neu-card-sm'} style={{ border: active ? '1px solid rgba(255,107,0,0.35)' : '1px solid rgba(255,255,255,0.04)', padding: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="neu-icon" style={{ width: 34, height: 34, color: active ? 'var(--accent)' : 'var(--text-dim)', background: 'var(--surface2)', flexShrink: 0 }}><Icon size={16} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 900 }}>{section.label}</span>
                      <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.25 }}>{section.description}</span>
                    </span>
                    <ChevronRight size={14} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading && !stats ? (
          <div className="neu-card" style={{ padding: 24, marginTop: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
            Loading dashboard…
          </div>
        ) : stats && (
          <>
            <SectionHeader title={activeMeta.label} kicker="Selected dashboard" />
            {activeSection === 'overview' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard
                icon={Users}
                label="Total users"
                value={stats.overview.total_users}
                onClick={(e) => { ripple(e); setUsersDrawerOpen(true) }}
              />
              <StatCard icon={UserPlus} label="New (7d)" value={stats.overview.new_users_7d} tint="var(--gold)" />
              <StatCard icon={UserPlus} label="New (30d)" value={stats.overview.new_users_30d} tint="var(--gold)" />
              <StatCard icon={Users} label="Active (7d)" value={stats.overview.active_7d} tint="var(--blue)" />
              <StatCard icon={Crown} label="Pro subscribers" value={stats.overview.pro_subscribers} tint="var(--purple)" />
              <StatCard icon={ShieldAlert} label="Staff members" value={stats.overview.staff_count} />
              <StatCard icon={ShieldBan} label="Banned users" value={stats.overview.banned_users} tint="var(--red)" />
            </div>}

            {activeSection === 'economy' && <>
            <SectionHeader title="Economy" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Gem} label="Diamonds in circulation" value={stats.economy.diamonds_in_circulation.toLocaleString()} tint="var(--blue)" />
              <StatCard icon={Gem} label="Diamonds credited (30d)" value={stats.economy.diamonds_credited_30d.toLocaleString()} tint="var(--gold)" />
              <StatCard icon={ShoppingBag} label="Purchases (30d)" value={stats.economy.purchase_tx_30d} />
              <StatCard
                icon={AlertTriangle}
                label="Flagged balances (>3,000)"
                value={stats.economy.flagged_balance_count}
                tint="var(--red)"
                onClick={(e) => { ripple(e); setUsersDrawerOpen(true) }}
              />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Top Mall items (by owners)</p>
              <RankedList rows={stats.economy.top_mall_items} primaryKey="name" countKey="owners" secondaryKey="category" />
            </div>
            </>}

            {activeSection === 'games' && <>
            <SectionHeader title="Games" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Gamepad2} label="Total sessions" value={stats.games.total_sessions} />
              <StatCard icon={Gamepad2} label="Sessions (7d)" value={stats.games.sessions_7d} tint="var(--gold)" />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Most played (30d)</p>
              <RankedList rows={stats.games.top_games} primaryKey="game" countKey="sessions" />
            </div>
            </>}

            {activeSection === 'multiplayer' && <>
            <SectionHeader title="Multiplayer" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Swords} label="Active rooms" value={stats.multiplayer.active_rooms} tint="var(--blue)" />
              <StatCard icon={Swords} label="Rooms created (7d)" value={stats.multiplayer.rooms_7d} />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Rooms by game (30d)</p>
              <RankedList rows={stats.multiplayer.top_multiplayer_games} primaryKey="game_id" countKey="rooms" />
            </div>
            </>}

            {activeSection === 'halo' && <>
            <SectionHeader title="Halo AI" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Sparkles} label="Questions (7d)" value={stats.halo_ai.questions_7d} tint="var(--purple)" />
              <StatCard icon={Sparkles} label="Questions (30d)" value={stats.halo_ai.questions_30d} tint="var(--purple)" />
              <StatCard icon={Users} label="Active users (7d)" value={stats.halo_ai.active_users_7d} />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Provider split (30d)</p>
              {Object.keys(stats.halo_ai.provider_split_30d).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet.</p>
              ) : (
                <RankedList
                  rows={Object.entries(stats.halo_ai.provider_split_30d).map(([provider, uses]) => ({ provider, uses }))}
                  primaryKey="provider"
                  countKey="uses"
                />
              )}
            </div>
            </>}

            {activeSection === 'operations' && <>
            <SectionHeader title="Moderation & Support" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard icon={Flag} label="Open reports" value={stats.moderation.open_reports} tint="var(--red)" />
              <StatCard icon={ShieldAlert} label="Mod actions (7d)" value={stats.moderation.actions_7d} />
              <StatCard icon={ShieldBan} label="Currently banned" value={stats.moderation.currently_banned} tint="var(--red)" />
              <StatCard icon={LifeBuoy} label="Open tickets" value={stats.support.open_tickets} tint="var(--gold)" />
              <StatCard icon={LifeBuoy} label="Tickets (7d)" value={stats.support.tickets_7d} />
            </div>
            </>}
          </>
        )}
      </div>

      <AdminUsersDrawer open={usersDrawerOpen} onClose={() => setUsersDrawerOpen(false)} />
    </div>
  )
}
