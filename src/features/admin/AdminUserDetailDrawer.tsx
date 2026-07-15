// src/features/admin/AdminUserDetailDrawer.tsx
// Nested "shell inside a shell" — opens on top of AdminUsersDrawer when a
// row is selected. Shows everything an admin is allowed to see about one
// user: identity, role/ban status, and a full wallet breakdown (current
// balance, lifetime purchased/earned/spent, and recent ledger activity),
// with a suspicious-balance banner when the wallet exceeds the 3,000
// diamond threshold flagged server-side in admin_get_user_detail().
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, Crown, ShieldCheck, ShieldBan, Gem,
  ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon, Calendar, Users,
} from 'lucide-react'
import AdminDrawer from './AdminDrawer'
import Avatar from '../../shared/components/Avatar'
import { fetchAdminUserDetail, type AdminUserDetail } from './adminStats'

interface AdminUserDetailDrawerProps {
  userId: string | null
  onClose: () => void
  onBack: () => void
}

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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function WalletStat({ icon: Icon, label, value, tint }: { icon: typeof Gem; label: string; value: string; tint?: string }) {
  return (
    <div className="neu-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: tint ?? 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

export default function AdminUserDetailDrawer({ userId, onClose, onBack }: AdminUserDetailDrawerProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)
    setError('')
    setDetail(null)
    fetchAdminUserDetail(userId).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error)
      setDetail(data)
      setLoading(false)
    })
    return () => { active = false }
  }, [userId])

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
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', padding: '20px 0' }}>{error}</p>
      ) : detail ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Identity header */}
          <div className="flex items-center gap-3">
            <Avatar src={detail.avatar} name={detail.display_name || detail.username} size={56} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-1.5">
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {detail.display_name || detail.username}
                </p>
                {detail.staff_role && detail.staff_role !== 'user' && <ShieldCheck size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />}
                {detail.is_pro && <Crown size={13} style={{ color: 'var(--purple)', flexShrink: 0 }} />}
                {detail.is_banned && <ShieldBan size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detail.email}
              </p>
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>ID: {detail.id}</p>
            </div>
          </div>

          {detail.wallet.balance_flagged && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,79,79,0.12)', border: '1px solid rgba(255,79,79,0.3)',
            }}>
              <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <p style={{ fontSize: 11.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
                Balance exceeds the 3,000 diamond threshold — review for anomalous crediting.
              </p>
            </div>
          )}

          {detail.is_banned && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.2)',
            }}>
              <p style={{ fontSize: 11.5, color: 'var(--red)', margin: 0, fontWeight: 700 }}>
                Banned{detail.banned_until ? ` until ${formatDateTime(detail.banned_until)}` : ' (indefinitely)'}
              </p>
              {detail.ban_reason && (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>{detail.ban_reason}</p>
              )}
            </div>
          )}

          {/* Wallet breakdown */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <WalletIcon size={13} /> Wallet
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <WalletStat
                icon={Gem}
                label="Current balance"
                value={detail.wallet.gem_balance.toLocaleString()}
                tint={detail.wallet.balance_flagged ? 'var(--red)' : 'var(--gold)'}
              />
              <WalletStat icon={ArrowDownToLine} label="Total purchased" value={detail.wallet.total_purchased.toLocaleString()} tint="var(--blue)" />
              <WalletStat icon={ArrowUpFromLine} label="Total earned" value={detail.wallet.total_earned_ledger.toLocaleString()} tint="var(--purple)" />
              <WalletStat icon={ArrowDownToLine} label="Total spent" value={detail.wallet.total_spent_ledger.toLocaleString()} />
            </div>
          </div>

          {/* Recent wallet activity */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Recent wallet activity</p>
            {detail.recent_wallet_activity.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No wallet activity yet.</p>
            ) : (
              <div className="neu-card" style={{ padding: 4 }}>
                {detail.recent_wallet_activity.map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{
                      padding: '9px 10px',
                      borderBottom: i < detail.recent_wallet_activity.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.label}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>{formatDateTime(tx.created_at)}</p>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: tx.amount >= 0 ? 'var(--purple)' : 'var(--text-dim)', flexShrink: 0, marginLeft: 10 }}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile details */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} /> Profile
            </p>
            <InfoRow label="Level" value={detail.level} />
            <InfoRow label="XP" value={detail.xp.toLocaleString()} />
            <InfoRow label="Streak" value={`${detail.streak} days`} />
            <InfoRow label="Country" value={detail.country || '—'} />
            <InfoRow label="Referrals" value={detail.referral_count} />
            <InfoRow label="Pro status" value={detail.is_pro ? (detail.pro_tier ? `${detail.pro_tier} (expires ${formatDate(detail.pro_expires_at)})` : 'Pro') : 'Not subscribed'} />
            <InfoRow label="Staff role" value={detail.staff_role && detail.staff_role !== 'user' ? detail.staff_role : 'None'} />
          </div>

          {/* Timeline */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> Timeline
            </p>
            <InfoRow label="Joined" value={formatDate(detail.created_at)} />
            <InfoRow label="Last login" value={formatDateTime(detail.last_login_at)} />
            <InfoRow label="Last seen" value={formatDateTime(detail.last_seen_at)} />
          </div>
        </div>
      ) : null}
    </AdminDrawer>
  )
}
