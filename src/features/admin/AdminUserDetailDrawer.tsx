// src/features/admin/AdminUserDetailDrawer.tsx
// Nested "shell inside a shell" — opens on top of AdminUsersDrawer when a
// row is selected. Shows everything an admin is allowed to see about one
// user — identity, diamonds, XP/level, games played, wallet ledger, and
// role/ban status — plus the admin actions to act on it (ban/unban, set
// role), reusing the same mod_* RPCs already wired up in ModerationPanel
// so both surfaces stay behaviorally identical. Styled as a dark glass
// profile sheet with a suspicious-balance banner when the wallet exceeds
// the 3,000 diamond threshold flagged server-side in admin_get_user_detail().
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, Crown, ShieldCheck, ShieldBan, Gem, Gamepad2,
  ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon, Calendar, Users,
  Zap, Flame, TrendingUp, Ban, ShieldAlert,
} from 'lucide-react'
import AdminDrawer from './AdminDrawer'
import Avatar from '../../shared/components/Avatar'
import { getGameMeta } from '../games/games'
import { banUser, unbanUser, setUserRole, type StaffRole } from '../moderation/moderation'
import { fetchAdminUserDetail, type AdminUserDetail } from './adminStats'

interface AdminUserDetailDrawerProps {
  userId: string | null
  onClose: () => void
  onBack: () => void
}

const ROLES: StaffRole[] = ['user', 'staff', 'moderator', 'admin']
const BAN_DURATIONS: { label: string; hours: number | null }[] = [
  { label: 'Permanent', hours: null },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
]

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function gameName(dbKey: string): string {
  return getGameMeta(dbKey)?.name ?? dbKey
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tint }: { icon: typeof Gem; label: string; value: string; tint: string }) {
  return (
    <div className="neu-inset" style={{ borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${tint}1c`, color: tint,
      }}>
        <Icon size={12.5} />
      </div>
      <div>
        <p style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Gem; children: ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 9,
      textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon size={12} /> {children}
    </p>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'neutral' }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger' | 'accent'
}) {
  const colors = {
    neutral: { text: 'var(--text-dim)', border: 'rgba(255,255,255,0.07)', bg: 'rgba(255,255,255,0.03)' },
    danger: { text: 'var(--red)', border: 'rgba(255,79,79,0.35)', bg: 'rgba(255,79,79,0.08)' },
    accent: { text: 'var(--purple)', border: 'rgba(255,107,0,0.45)', bg: 'rgba(108,80,255,0.12)' },
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
        color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`,
        borderRadius: 9, padding: '7px 11px', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export default function AdminUserDetailDrawer({ userId, onClose, onBack }: AdminUserDetailDrawerProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Admin actions state
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState<number | null>(null)

  // Tracks the most recently requested userId so a slow response for a
  // previously selected user can't clobber the state after the admin has
  // already clicked through to a different row.
  const latestUserId = useRef<string | null>(null)

  function load() {
    if (!userId) return
    const requestedId = userId
    latestUserId.current = requestedId
    setLoading(true)
    setError('')
    fetchAdminUserDetail(requestedId).then(({ data, error }) => {
      if (latestUserId.current !== requestedId) return // superseded by a newer selection
      setError(error ?? '')
      setDetail(data)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (!userId) return
    setDetail(null)
    setActionError('')
    setBanReason('')
    setBanHours(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleBan() {
    if (!userId) return
    if (!banReason.trim()) { setActionError('Please enter a reason.'); return }
    setActionBusy(true)
    setActionError('')
    const { error } = await banUser(userId, banReason.trim(), banHours)
    setActionBusy(false)
    if (error) { setActionError(error); return }
    setBanReason('')
    setBanHours(null)
    load()
  }

  async function handleUnban() {
    if (!userId) return
    setActionBusy(true)
    setActionError('')
    const { error } = await unbanUser(userId)
    setActionBusy(false)
    if (error) { setActionError(error); return }
    load()
  }

  async function handleSetRole(role: StaffRole) {
    if (!userId) return
    setActionBusy(true)
    setActionError('')
    const { error } = await setUserRole(userId, role)
    setActionBusy(false)
    if (error) { setActionError(error); return }
    load()
  }

  return (
    <AdminDrawer
      open={!!userId}
      onClose={onClose}
      onBack={onBack}
      depth={1}
      title={detail ? (detail.display_name || detail.username) : 'User detail'}
      subtitle={detail ? `@${detail.username}` : undefined}
    >
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', padding: '32px 0' }}>{error}</p>
      ) : detail ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Identity header */}
          <div className="flex items-center gap-3">
            <Avatar src={detail.avatar} name={detail.display_name || detail.username} size={58}
              ring={detail.is_banned ? 'var(--red)' : detail.is_pro ? 'var(--gold)' : 'rgba(255,107,0,0.45)'} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-1.5">
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {detail.display_name || detail.username}
                </p>
                {detail.staff_role && detail.staff_role !== 'user' && <ShieldCheck size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />}
                {detail.is_pro && <Crown size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                {detail.is_banned && <ShieldBan size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detail.email}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'monospace' }}>{detail.id}</p>
            </div>
          </div>

          {detail.wallet.balance_flagged && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,79,79,0.10)', border: '1px solid rgba(255,79,79,0.3)',
            }}>
              <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <p style={{ fontSize: 11.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
                Balance exceeds the 3,000 diamond threshold — review for anomalous crediting.
              </p>
            </div>
          )}

          {detail.is_banned && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,79,79,0.06)', border: '1px solid rgba(255,79,79,0.2)' }}>
              <p style={{ fontSize: 11.5, color: 'var(--red)', margin: 0, fontWeight: 700 }}>
                Banned{detail.banned_until ? ` until ${formatDateTime(detail.banned_until)}` : ' (indefinitely)'}
              </p>
              {detail.ban_reason && <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>{detail.ban_reason}</p>}
            </div>
          )}

          {/* KPI grid — diamonds, XP, level, streak, games, referrals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Kpi icon={Gem} label="Diamonds" value={detail.wallet.gem_balance.toLocaleString()} tint={detail.wallet.balance_flagged ? 'var(--red)' : 'var(--gold)'} />
            <Kpi icon={Zap} label="Total XP" value={detail.xp.toLocaleString()} tint="var(--purple)" />
            <Kpi icon={TrendingUp} label="Level" value={String(detail.level)} tint="var(--blue)" />
            <Kpi icon={Flame} label="Streak" value={`${detail.streak}d`} tint="var(--pink)" />
            <Kpi icon={Gamepad2} label="Games played" value={detail.games.total_sessions.toLocaleString()} tint="var(--green)" />
            <Kpi icon={Users} label="Referrals" value={String(detail.referral_count)} tint="var(--purple)" />
          </div>

          {/* Wallet breakdown */}
          <div>
            <SectionLabel icon={WalletIcon}>Wallet</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <Kpi icon={ArrowDownToLine} label="Total purchased" value={detail.wallet.total_purchased.toLocaleString()} tint="var(--blue)" />
              <Kpi icon={ArrowUpFromLine} label="Total earned" value={detail.wallet.total_earned_ledger.toLocaleString()} tint="var(--green)" />
              <Kpi icon={ArrowDownToLine} label="Total spent" value={detail.wallet.total_spent_ledger.toLocaleString()} tint="var(--text-dim)" />
              <Kpi icon={Gem} label="Current balance" value={detail.wallet.gem_balance.toLocaleString()} tint="var(--gold)" />
            </div>
          </div>

          {/* Recent wallet activity */}
          <div>
            <SectionLabel icon={Gem}>Recent wallet activity</SectionLabel>
            {detail.recent_wallet_activity.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No wallet activity yet.</p>
            ) : (
              <div className="neu-inset" style={{ borderRadius: 12, padding: 4 }}>
                {detail.recent_wallet_activity.map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{ padding: '9px 10px', borderBottom: i < detail.recent_wallet_activity.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.label}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>{formatDateTime(tx.created_at)}</p>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: tx.amount >= 0 ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0, marginLeft: 10 }}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Games */}
          <div>
            <SectionLabel icon={Gamepad2}>Games</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              <Kpi icon={Gamepad2} label="Sessions (7d)" value={detail.games.sessions_7d.toLocaleString()} tint="var(--green)" />
              <Kpi icon={Zap} label="XP from games" value={detail.games.total_xp_from_games.toLocaleString()} tint="var(--purple)" />
              <Kpi icon={Gamepad2} label="Total sessions" value={detail.games.total_sessions.toLocaleString()} tint="var(--blue)" />
            </div>

            {detail.games.top_games.length > 0 && (
              <div className="neu-inset" style={{ borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Most played
                </p>
                {(() => {
                  const max = Math.max(...detail.games.top_games.map(g => g.sessions), 1)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.games.top_games.map(g => (
                        <div key={g.game}>
                          <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{gameName(g.game)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{g.sessions}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                            <div style={{ width: `${(g.sessions / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {detail.games.recent_sessions.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No games played yet.</p>
            ) : (
              <div className="neu-inset" style={{ borderRadius: 12, padding: 4 }}>
                {detail.games.recent_sessions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{ padding: '9px 10px', borderBottom: i < detail.games.recent_sessions.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0 }}>{gameName(s.game)}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                        Score {s.score.toLocaleString()} · {formatDateTime(s.played_at)}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--purple)', flexShrink: 0, marginLeft: 10 }}>
                      +{s.xp_earned} XP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile details */}
          <div>
            <SectionLabel icon={Users}>Profile</SectionLabel>
            <InfoRow label="Country" value={detail.country || '—'} />
            <InfoRow label="Pro status" value={detail.is_pro ? (detail.pro_tier ? `${detail.pro_tier} (expires ${formatDate(detail.pro_expires_at)})` : 'Pro') : 'Not subscribed'} />
            <InfoRow label="Staff role" value={detail.staff_role && detail.staff_role !== 'user' ? detail.staff_role : 'None'} />
          </div>

          {/* Timeline */}
          <div>
            <SectionLabel icon={Calendar}>Timeline</SectionLabel>
            <InfoRow label="Joined" value={formatDate(detail.created_at)} />
            <InfoRow label="Last login" value={formatDateTime(detail.last_login_at)} />
            <InfoRow label="Last seen" value={formatDateTime(detail.last_seen_at)} />
          </div>

          {/* ── Admin actions ─────────────────────────────────────── */}
          <div style={{
            borderRadius: 14, padding: 14, background: 'rgba(255,79,79,0.04)', border: '1px solid rgba(255,79,79,0.18)',
          }}>
            <p style={{
              fontSize: 11, fontWeight: 800, color: 'var(--red)', marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ShieldAlert size={12} /> Admin actions
            </p>

            {actionError && (
              <div style={{
                fontSize: 11.5, color: 'var(--red)', marginBottom: 10, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,79,79,0.1)', border: '1px solid rgba(255,79,79,0.25)',
              }}>
                {actionError}
              </div>
            )}

            {/* Ban / unban */}
            {detail.is_banned ? (
              <ActionButton onClick={handleUnban} disabled={actionBusy} tone="accent">
                <ShieldCheck size={12} /> {actionBusy ? 'Working…' : 'Unban user'}
              </ActionButton>
            ) : (
              <div>
                <input
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Ban reason (required)"
                  style={{
                    width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)',
                    background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, marginBottom: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={banHours ?? ''}
                    onChange={e => setBanHours(e.target.value === '' ? null : Number(e.target.value))}
                    style={{
                      padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)',
                      background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
                    }}
                  >
                    {BAN_DURATIONS.map(d => (
                      <option key={d.label} value={d.hours ?? ''}>{d.label}</option>
                    ))}
                  </select>
                  <ActionButton onClick={handleBan} disabled={actionBusy} tone="danger">
                    <Ban size={12} /> {actionBusy ? 'Applying…' : 'Ban user'}
                  </ActionButton>
                </div>
              </div>
            )}

            {/* Staff role */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,79,79,0.15)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Staff role</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ROLES.map(r => (
                  <ActionButton key={r} onClick={() => handleSetRole(r)} disabled={actionBusy || detail.staff_role === r} tone={detail.staff_role === r ? 'accent' : 'neutral'}>
                    {r === 'user' ? 'Reset to user' : `Make ${r}`}
                  </ActionButton>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminDrawer>
  )
}
