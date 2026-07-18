// src/features/moderation/ModerationPanel.tsx
import { useEffect, useState } from 'react'
import { ShieldAlert, Flag, Users as UsersIcon, ScrollText, Search, Ban, ShieldCheck, Trash2, Bell, Eye, BadgeCheck } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useModRole } from './useModRole'
import {
  fetchOpenReports, getReportContext, reviewReport, searchUserByUsername,
  banUser, unbanUser, setUserRole, setVerified, deleteMessage, deletePost, deleteComment,
  fetchModerationLog, fetchStrikes, fetchUnresolvedAlerts, resolveAlert, unhideContent,
  type ContentReport, type ModerationLogEntry, type StaffRole, type Strike, type StaffAlert,
} from './moderation'
import { REPORT_REASON_LABELS, SYSTEM_REPORT_REASON_LABEL } from '../safety/reports'
import { getAllBadges, getPlayerBadges, grantManualBadge, revokeManualBadge, BADGE_RARITY_COLOR, type BadgeDef } from '../badges/badges'
import { BadgeIcon } from '../badges/badgeIcons'

type Tab = 'alerts' | 'reports' | 'users' | 'log'

const REASON_COLORS: Record<ContentReport['status'], string> = {
  open: '#ff9a3c',
  reviewed: '#5b9cff',
  actioned: '#4fd18a',
  dismissed: 'var(--text-muted)',
}

export default function ModerationPanel() {
  const { role, isStaff, isAdmin, isModOrAdmin, loading } = useModRole()
  const [tab, setTab] = useState<Tab>('alerts')
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    if (!isStaff) return
    fetchUnresolvedAlerts().then(({ data }) => setAlertCount(data.length))
  }, [isStaff])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (!isStaff) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <ShieldAlert size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Staff only</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>This page is for moderators and admins.</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof Flag }[] = [
    { key: 'alerts', label: 'Alerts', icon: Bell },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'users', label: 'Users', icon: UsersIcon },
    { key: 'log', label: 'Audit log', icon: ScrollText },
  ]

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <ShieldCheck size={22} color="var(--accent)" />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Moderation</h1>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(255,107,0,0.12)',
          border: '1px solid rgba(255,107,0,0.3)', borderRadius: 999, padding: '3px 10px', marginLeft: 2,
        }}>
          {isAdmin ? 'Admin' : role === 'staff' ? 'Staff' : 'Moderator'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={(e) => { ripple(e); setTab(t.key) }}
              className="ripple-wrap"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, fontWeight: 700,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--text)' : 'var(--text-dim)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <Icon size={14} /> {t.label}
              {t.key === 'alerts' && alertCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--red)',
                  borderRadius: 999, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'alerts' && <AlertsTab onResolved={() => setAlertCount(c => Math.max(0, c - 1))} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'users' && <UsersTab isAdmin={isAdmin} isModOrAdmin={isModOrAdmin} />}
      {tab === 'log' && <LogTab />}
    </div>
  )
}

// ── Alerts ──────────────────────────────────────────────────────────────

const STRIKE_CATEGORY_LABELS: Record<string, string> = {
  hate_speech: 'Hate speech',
  threat_of_violence: 'Threat of violence',
  self_harm_directed: 'Self-harm language directed at someone',
  doxxing: 'Doxxing',
  illegal_activity: 'Illegal activity solicitation',
  phishing_scam: 'Phishing or scam content',
  profanity: 'Profanity',
  personal_info_exposure: 'Personal info exposure (phone/email/key)',
}

function AlertsTab({ onResolved }: { onResolved: () => void }) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [strikes, setStrikes] = useState<Strike[]>([])
  const [strikesLoading, setStrikesLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banReason, setBanReason] = useState('')

  function load() {
    setLoading(true)
    fetchUnresolvedAlerts().then(({ data, error }) => {
      setAlerts(data)
      setError(error)
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function toggleExpand(alert: StaffAlert) {
    if (expanded === alert.id) { setExpanded(null); return }
    setExpanded(alert.id)
    setBanReason('')
    setStrikesLoading(true)
    const { data } = await fetchStrikes(alert.user_id)
    setStrikes(data)
    setStrikesLoading(false)
  }

  async function handleDismiss(alert: StaffAlert) {
    setBusy(true)
    const { error } = await resolveAlert(alert.id)
    setBusy(false)
    if (error) { setError(error); return }
    setAlerts(a => a.filter(x => x.id !== alert.id))
    onResolved()
  }

  async function handleBan(alert: StaffAlert, durationHours: number | null) {
    if (!banReason.trim()) { setError('Please enter a reason.'); return }
    setBusy(true)
    const { error } = await banUser(alert.user_id, banReason.trim(), durationHours)
    if (error) { setBusy(false); setError(error); return }
    const { error: resolveError } = await resolveAlert(alert.id)
    setBusy(false)
    if (resolveError) { setError(resolveError); return }
    setError(null)
    setAlerts(a => a.filter(x => x.id !== alert.id))
    onResolved()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
  if (error) return <div style={errorBox}>{error}</div>
  if (alerts.length === 0) return <EmptyState icon={Bell} text="No pending alerts — nobody has crossed the strike threshold." />

  return (
    <div>
      {alerts.map(a => (
        <div key={a.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>@{a.user?.username ?? 'unknown'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {a.strike_count} strikes · flagged {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
            <StatusPill label={`${a.strike_count} strikes`} color="var(--red)" />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <SmallButton onClick={() => toggleExpand(a)}>
              <Eye size={12} /> {expanded === a.id ? 'Hide history' : 'View strike history'}
            </SmallButton>
            <SmallButton onClick={() => handleDismiss(a)} disabled={busy}>Dismiss (no action)</SmallButton>
          </div>

          {expanded === a.id && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Strike history</div>
              {strikesLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {strikes.map(s => (
                    <div key={s.id} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {STRIKE_CATEGORY_LABELS[s.category] ?? s.category}
                      <span style={{ color: 'var(--text-muted)' }}> · {s.target_type} · {new Date(s.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Take action</div>
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Reason (required)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton danger onClick={() => handleBan(a, 168)} disabled={busy}>
                  <Ban size={12} /> Suspend 7 days
                </SmallButton>
                <SmallButton danger onClick={() => handleBan(a, null)} disabled={busy}>
                  <Ban size={12} /> Ban permanently
                </SmallButton>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Reports ─────────────────────────────────────────────────────────────

function ReportsTab() {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [context, setContext] = useState<Record<string, unknown> | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetchOpenReports().then(({ data, error }) => {
      setReports(data)
      setError(error)
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function toggleExpand(report: ContentReport) {
    if (expanded === report.id) { setExpanded(null); setContext(null); return }
    setExpanded(report.id)
    setContext(null)
    setContextLoading(true)
    const { data } = await getReportContext(report.id)
    setContext(data)
    setContextLoading(false)
  }

  async function handleReview(id: string, status: 'reviewed' | 'actioned' | 'dismissed') {
    const { error } = await reviewReport(id, status)
    if (error) { setActionMsg(error); return }
    setActionMsg(null)
    load()
  }

  async function handleDeleteTarget(report: ContentReport) {
    let result: { error: string | null }
    if (report.target_type === 'message') result = await deleteMessage(report.target_id, 'Deleted from report review')
    else if (report.target_type === 'post') result = await deletePost(report.target_id, 'Deleted from report review')
    else if (report.target_type === 'comment') result = await deleteComment(report.target_id, 'Deleted from report review')
    else { setActionMsg('User reports are actioned via the Users tab (ban).'); return }

    if (result.error) { setActionMsg(result.error); return }
    await handleReview(report.id, 'actioned')
  }

  async function handleUnhide(report: ContentReport) {
    if (report.target_type === 'user') return
    const { error } = await unhideContent(report.target_type, report.target_id)
    if (error) { setActionMsg(error); return }
    setActionMsg(null)
    await handleReview(report.id, 'dismissed')
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
  if (error) return <div style={errorBox}>{error}</div>
  if (reports.length === 0) return <EmptyState icon={Flag} text="No reports yet." />

  return (
    <div>
      {actionMsg && <div style={errorBox}>{actionMsg}</div>}
      {reports.map(r => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                {r.reason === 'auto_flagged' ? SYSTEM_REPORT_REASON_LABEL : (REPORT_REASON_LABELS[r.reason as keyof typeof REPORT_REASON_LABELS] ?? r.reason)}
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                  on a {r.target_type}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                Reported by {r.reporter?.username ?? (r.reason === 'auto_flagged' ? 'System (word filter)' : 'unknown')} · {new Date(r.created_at).toLocaleString()}
              </div>
              {r.details && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>{r.details}</div>}
            </div>
            <StatusPill label={r.status} color={REASON_COLORS[r.status]} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <SmallButton onClick={() => toggleExpand(r)}>{expanded === r.id ? 'Hide content' : 'View content'}</SmallButton>
            {r.target_type !== 'user' && (
              <SmallButton onClick={() => handleUnhide(r)}>
                <Eye size={12} /> Unhide
              </SmallButton>
            )}
            {r.status === 'open' && (
              <>
                <SmallButton onClick={() => handleReview(r.id, 'dismissed')}>Dismiss</SmallButton>
                <SmallButton danger onClick={() => handleDeleteTarget(r)}>
                  <Trash2 size={12} /> Delete & action
                </SmallButton>
              </>
            )}
          </div>

          {expanded === r.id && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface2)', fontSize: 12.5, color: 'var(--text-dim)' }}>
              {contextLoading ? 'Loading…' : (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                  {JSON.stringify(context, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Users ───────────────────────────────────────────────────────────────

function UsersTab({ isAdmin, isModOrAdmin }: { isAdmin: boolean; isModOrAdmin: boolean }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchUserByUsername>>['data']>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState<'' | number>('')
  const [busy, setBusy] = useState(false)
  const [manualBadges, setManualBadges] = useState<BadgeDef[]>([])
  const [ownedBadgeIds, setOwnedBadgeIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getAllBadges().then(all => setManualBadges(all.filter(b => b.grant_type === 'manual')))
  }, [])

  useEffect(() => {
    if (!result) { setOwnedBadgeIds(new Set()); return }
    getPlayerBadges(result.user_id).then(rows => setOwnedBadgeIds(new Set(rows.map(r => r.badge_id))))
  }, [result])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setResult(null)
    const { data, error } = await searchUserByUsername(query)
    setResult(data)
    setError(error)
    setSearching(false)
  }

  async function refresh() {
    if (!result) return
    const { data } = await searchUserByUsername(result.username)
    setResult(data)
  }

  async function handleBan() {
    if (!result) return
    if (!banReason.trim()) { setError('Please enter a reason.'); return }
    setBusy(true)
    const { error } = await banUser(result.user_id, banReason.trim(), banHours === '' ? null : Number(banHours))
    setBusy(false)
    if (error) { setError(error); return }
    setError(null)
    setBanReason('')
    setBanHours('')
    refresh()
  }

  async function handleUnban() {
    if (!result) return
    setBusy(true)
    const { error } = await unbanUser(result.user_id)
    setBusy(false)
    if (error) { setError(error); return }
    refresh()
  }

  async function handleSetRole(role: StaffRole) {
    if (!result) return
    setBusy(true)
    const { error } = await setUserRole(result.user_id, role)
    setBusy(false)
    if (error) { setError(error); return }
    refresh()
  }

  async function handleSetVerified(verified: boolean) {
    if (!result) return
    setBusy(true)
    const { error } = await setVerified(result.user_id, verified)
    setBusy(false)
    if (error) { setError(error); return }
    refresh()
  }

  async function handleGrantBadge(badgeId: string) {
    if (!result) return
    setBusy(true)
    const { error } = await grantManualBadge(result.user_id, badgeId)
    setBusy(false)
    if (error) { setError(error.message ?? 'Could not grant badge.'); return }
    setOwnedBadgeIds(prev => new Set(prev).add(badgeId))
  }

  async function handleRevokeBadge(badgeId: string) {
    if (!result) return
    setBusy(true)
    const { error } = await revokeManualBadge(result.user_id, badgeId)
    setBusy(false)
    if (error) { setError(error.message ?? 'Could not revoke badge.'); return }
    setOwnedBadgeIds(prev => { const next = new Set(prev); next.delete(badgeId); return next })
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by exact username…"
            style={{
              width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface2)', color: 'var(--text)', fontSize: 13,
            }}
          />
        </div>
        <SmallButton type="submit">{searching ? 'Searching…' : 'Search'}</SmallButton>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      {result && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{result.display_name || result.username}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{result.username}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <RoleBadge role={result.role} />
              {result.is_verified && <StatusPill label="verified" color="#5b9cff" />}
              {result.is_banned && <StatusPill label="banned" color="var(--red)" />}
            </div>
          </div>

          {result.is_banned && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-dim)' }}>
              Reason: {result.ban_reason || '—'}
              {result.banned_until && <> · Until {new Date(result.banned_until).toLocaleString()}</>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {result.is_banned ? (
              <SmallButton onClick={handleUnban} disabled={busy}>Unban</SmallButton>
            ) : null}
          </div>

          {!result.is_banned && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Suspend / ban this user</div>
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Reason (required)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={banHours}
                  onChange={e => setBanHours(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 }}
                >
                  <option value="">Permanent</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
                <SmallButton danger onClick={handleBan} disabled={busy}>
                  <Ban size={12} /> {busy ? 'Applying…' : 'Apply'}
                </SmallButton>
              </div>
            </div>
          )}

          {isAdmin && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Staff role</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['user', 'staff', 'moderator', 'admin'] as StaffRole[]).map(r => (
                  <SmallButton key={r} disabled={busy || result.role === r} onClick={() => handleSetRole(r)}>
                    Make {r}
                  </SmallButton>
                ))}
              </div>
            </div>
          )}

          {isModOrAdmin && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Verified badge</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {result.is_verified ? (
                  <SmallButton disabled={busy} onClick={() => handleSetVerified(false)}>
                    <BadgeCheck size={12} /> Revoke verified
                  </SmallButton>
                ) : (
                  <SmallButton disabled={busy} onClick={() => handleSetVerified(true)}>
                    <BadgeCheck size={12} /> Grant verified
                  </SmallButton>
                )}
              </div>
            </div>
          )}

          {manualBadges.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Badges (manually assigned)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {manualBadges.map(b => {
                  const owned = ownedBadgeIds.has(b.id)
                  const color = BADGE_RARITY_COLOR[b.rarity] ?? '#888899'
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '1c' }}>
                        <BadgeIcon iconKey={b.icon} size={13} color={color} />
                      </div>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{b.title}</span>
                      {owned ? (
                        <SmallButton danger disabled={busy} onClick={() => handleRevokeBadge(b.id)}>Revoke</SmallButton>
                      ) : (
                        <SmallButton disabled={busy} onClick={() => handleGrantBadge(b.id)}>Grant</SmallButton>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Audit log ──────────────────────────────────────────────────────────

function LogTab() {
  const [entries, setEntries] = useState<ModerationLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchModerationLog().then(({ data }) => { setEntries(data); setLoading(false) })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
  if (entries.length === 0) return <EmptyState icon={ScrollText} text="No moderation actions yet." />

  return (
    <div>
      {entries.map(e => (
        <div key={e.id} style={{ ...cardStyle, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {e.action.replace('_', ' ')} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {e.target_type}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(e.created_at).toLocaleString()}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            by {e.moderator?.username ?? 'unknown'}{e.reason ? ` — ${e.reason}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Small shared bits ─────────────────────────────────────────────────

function RoleBadge({ role }: { role: StaffRole }) {
  if (role === 'user') return null
  const color = role === 'admin' ? 'var(--accent)' : role === 'staff' ? '#4fd18a' : '#5b9cff'
  return <StatusPill label={role} color={color} />
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: `${color}1a`, border: `1px solid ${color}40`,
      borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      {label}
    </span>
  )
}

function SmallButton({ children, onClick, danger, disabled, type = 'button' }: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={(e) => { if (!disabled) { ripple(e); onClick?.() } }}
      disabled={disabled}
      className="ripple-wrap"
      style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
        padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)',
        background: danger ? 'rgba(255,79,79,0.1)' : 'var(--surface2)',
        color: danger ? 'var(--red)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function EmptyState({ icon: Icon, text }: { icon: typeof Flag; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 20px', textAlign: 'center' }}>
      <Icon size={28} color="var(--text-muted)" />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16,
  padding: '16px 18px', marginBottom: 12,
  boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 7px var(--neu-light)',
}

const errorBox: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16,
}
