// src/features/admin/AdminDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ShieldAlert, Users, UserPlus, Crown, ShieldBan, Gem,
  ShoppingBag, Gamepad2, Swords, Sparkles, Flag, LifeBuoy, RefreshCw,
} from 'lucide-react'
import { useModRole } from '../moderation/useModRole'
import { ripple } from '../../shared/lib/ripple'
import { fetchAdminDashboardStats, type AdminDashboardStats } from './adminStats'

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string | number; tint?: string }) {
  return (
    <div className="neu-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div className="flex items-center gap-2">
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${tint ?? 'var(--accent)'}22`, color: tint ?? 'var(--accent)', flexShrink: 0,
        }}>
          <Icon size={14} />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: '22px 0 10px' }}>{title}</h2>
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

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useModRole()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

        {loading && !stats ? (
          <div className="neu-card" style={{ padding: 24, marginTop: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
            Loading dashboard…
          </div>
        ) : stats && (
          <>
            <SectionHeader title="Overview" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard icon={Users} label="Total users" value={stats.overview.total_users} />
              <StatCard icon={UserPlus} label="New (7d)" value={stats.overview.new_users_7d} tint="var(--gold)" />
              <StatCard icon={UserPlus} label="New (30d)" value={stats.overview.new_users_30d} tint="var(--gold)" />
              <StatCard icon={Users} label="Active (7d)" value={stats.overview.active_7d} tint="var(--blue)" />
              <StatCard icon={Crown} label="Pro subscribers" value={stats.overview.pro_subscribers} tint="var(--purple)" />
              <StatCard icon={ShieldAlert} label="Staff members" value={stats.overview.staff_count} />
              <StatCard icon={ShieldBan} label="Banned users" value={stats.overview.banned_users} tint="var(--red)" />
            </div>

            <SectionHeader title="Economy" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Gem} label="Diamonds in circulation" value={stats.economy.diamonds_in_circulation.toLocaleString()} tint="var(--blue)" />
              <StatCard icon={Gem} label="Diamonds credited (30d)" value={stats.economy.diamonds_credited_30d.toLocaleString()} tint="var(--gold)" />
              <StatCard icon={ShoppingBag} label="Purchases (30d)" value={stats.economy.purchase_tx_30d} />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Top Mall items (by owners)</p>
              <RankedList rows={stats.economy.top_mall_items} primaryKey="name" countKey="owners" secondaryKey="category" />
            </div>

            <SectionHeader title="Games" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Gamepad2} label="Total sessions" value={stats.games.total_sessions} />
              <StatCard icon={Gamepad2} label="Sessions (7d)" value={stats.games.sessions_7d} tint="var(--gold)" />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Most played (30d)</p>
              <RankedList rows={stats.games.top_games} primaryKey="game" countKey="sessions" />
            </div>

            <SectionHeader title="Multiplayer" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard icon={Swords} label="Active rooms" value={stats.multiplayer.active_rooms} tint="var(--blue)" />
              <StatCard icon={Swords} label="Rooms created (7d)" value={stats.multiplayer.rooms_7d} />
            </div>
            <div className="neu-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>Rooms by game (30d)</p>
              <RankedList rows={stats.multiplayer.top_multiplayer_games} primaryKey="game_id" countKey="rooms" />
            </div>

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

            <SectionHeader title="Moderation & Support" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard icon={Flag} label="Open reports" value={stats.moderation.open_reports} tint="var(--red)" />
              <StatCard icon={ShieldAlert} label="Mod actions (7d)" value={stats.moderation.actions_7d} />
              <StatCard icon={ShieldBan} label="Currently banned" value={stats.moderation.currently_banned} tint="var(--red)" />
              <StatCard icon={LifeBuoy} label="Open tickets" value={stats.support.open_tickets} tint="var(--gold)" />
              <StatCard icon={LifeBuoy} label="Tickets (7d)" value={stats.support.tickets_7d} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
