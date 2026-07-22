// src/features/admin/AdminOpsPanel.tsx
//
// The "Ops console" wing of the Admin Dashboard, restyled to match how
// Settings.tsx is put together: a single scrollable page, grouped into
// SectionTitle + .settings-card blocks of compact Row/ToggleRow entries.
// Anything that needs a form (editing the maintenance message, composing
// a broadcast, flipping a whole category of flags) opens in a popover
// modal — the same pattern Settings uses for Log out / Microphone —
// instead of being sprawled inline as its own big card. Simple instant
// actions (a toggle, a CSV download) just happen right on the row, no
// modal needed, same as Settings' "Game sound" toggle or "Support" link.
import { useEffect, useState } from 'react'
import {
  Power, Megaphone, Download, Activity, AlertTriangle,
  Gamepad2, Map as MapIcon, Settings2, Clock, Send, X, MessageSquare,
  Copy, Check, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { Row, ToggleRow, SectionTitle } from '../settings/settingsShared'
import {
  fetchAppConfig, setMaintenanceMode, broadcastNotification,
  fetchFeatureFlags, setFeatureFlag, exportUsersCsv, exportTransactionsCsv,
  fetchSystemHealth, fetchRecentClientErrors,
  type FeatureFlag, type SystemHealth, type ClientErrorLogRow,
} from './adminOps'

// ── Shared modal shell (mirrors Settings.tsx's Log out / Microphone popovers) ──

function Modal({ title, onClose, children, width = 380 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }`}</style>
      <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 22, width: '100%', maxWidth: width, maxHeight: '82vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', animation: 'popIn 0.22s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 6px' }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none',
}

// ── Maintenance ─────────────────────────────────────────────────────

function MaintenanceMessageModal({ message, scheduledFor, onClose, onSaved }: {
  message: string
  scheduledFor: string
  onClose: () => void
  onSaved: (message: string, scheduledFor: string) => void
}) {
  const [text, setText] = useState(message)
  const [when, setWhen] = useState(scheduledFor)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    // Re-sends the current enabled state implicitly — this modal only
    // edits copy/schedule, the ToggleRow on the main page owns on/off.
    const { data } = await fetchAppConfig()
    const { error } = await setMaintenanceMode(data?.maintenance_enabled ?? false, text, when ? new Date(when).toISOString() : null)
    setSaving(false)
    if (error) { setError(error); return }
    onSaved(text, when)
    onClose()
  }

  return (
    <Modal title="Maintenance message" onClose={onClose}>
      <p style={fieldLabel}>Message shown to players</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
      <p style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Scheduled for (optional)</p>
      <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

function useMaintenance() {
  const [enabled, setEnabled] = useState(false)
  const [message, setMessage] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetchAppConfig().then(({ data }) => {
      if (data) {
        setEnabled(data.maintenance_enabled)
        setMessage(data.maintenance_message)
        setScheduledFor(data.maintenance_scheduled_for ? data.maintenance_scheduled_for.slice(0, 16) : '')
      }
      setLoading(false)
    })
  }, [])

  async function toggle() {
    setToggling(true)
    const next = !enabled
    const { error } = await setMaintenanceMode(next, message, scheduledFor ? new Date(scheduledFor).toISOString() : null)
    setToggling(false)
    if (!error) setEnabled(next)
    return error
  }

  return { enabled, message, scheduledFor, loading, toggling, toggle, setMessage, setScheduledFor }
}

// ── Broadcast ─────────────────────────────────────────────────────────

function BroadcastModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  async function send() {
    setSending(true)
    setError('')
    const { count, error } = await broadcastNotification(title.trim(), body.trim())
    setSending(false)
    setConfirming(false)
    if (error) { setError(error); return }
    setResult(`Sent to ${count.toLocaleString()} ${count === 1 ? 'user' : 'users'}.`)
    setTitle('')
    setBody('')
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0

  return (
    <Modal title="Broadcast notification" onClose={onClose}>
      <p style={fieldLabel}>Title</p>
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Scheduled maintenance tonight" style={{ ...inputStyle, marginBottom: 14 }} />
      <p style={fieldLabel}>Message</p>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={400} placeholder="What should everyone know?" style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />

      {result && <p style={{ fontSize: 12, color: '#4fd18a', fontWeight: 700, marginBottom: 12 }}>{result}</p>}
      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

      {!confirming ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Close</button>
          <button
            onClick={() => canSend && setConfirming(true)}
            disabled={!canSend}
            className="btn-primary"
            style={{ flex: 1, padding: '10px 0', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: canSend ? 1 : 0.5 }}
          >
            <Send size={12} /> Send to all
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 12, fontWeight: 600 }}>Send this to every user — sure?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirming(false)} disabled={sending} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
            <button onClick={send} disabled={sending} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13, background: 'var(--red)', opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Sending…' : 'Confirm send'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Feature flags ─────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: typeof Gamepad2; sub: string }> = {
  game: { label: 'Games', icon: Gamepad2, sub: 'Disabled games stop being newly playable for everyone.' },
  map: { label: 'Exploration maps', icon: MapIcon, sub: 'Disabled maps stop being newly enterable for everyone.' },
  system: { label: 'Systems', icon: Settings2, sub: 'Broad kill-switches for whole app areas.' },
}

function FlagCategoryModal({ category, flags, onClose, onChange }: {
  category: string
  flags: FeatureFlag[]
  onClose: () => void
  onChange: (key: string, enabled: boolean) => void
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const meta = CATEGORY_META[category] ?? { label: category, icon: Settings2, sub: '' }

  async function toggle(f: FeatureFlag) {
    setBusyKey(f.key)
    setError('')
    const next = !f.enabled
    const { error } = await setFeatureFlag(f.key, next)
    setBusyKey(null)
    if (error) { setError(error); return }
    onChange(f.key, next)
  }

  return (
    <Modal title={meta.label} onClose={onClose} width={420}>
      {meta.sub && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>{meta.sub}</p>}
      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
      <div className="settings-card" style={{ marginBottom: 0 }}>
        {flags.map(f => (
          <ToggleRow
            key={f.key}
            label={f.label}
            on={f.enabled}
            onToggle={() => toggle(f)}
            disabled={busyKey === f.key}
          />
        ))}
      </div>
    </Modal>
  )
}

// ── System health ────────────────────────────────────────────────────

function HealthStat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: warn ? 'var(--red)' : 'var(--text)', margin: 0 }}>{value}</p>
    </div>
  )
}

/** Best-effort clipboard copy — Clipboard API can throw in insecure or
 *  permission-denied contexts, so callers get a boolean back instead of
 *  a thrown error, and can decide what (if anything) to show. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatErrorRow(e: ClientErrorLogRow): string {
  const lines = [
    `[${formatTimestamp(e.created_at)}] ${e.message}`,
    `User: ${e.username ?? 'anonymous'}`,
    `Path: ${e.path ?? '—'}`,
  ]
  if (e.stack) lines.push('Stack:', e.stack)
  return lines.join('\n')
}

function formatHealthReport(health: SystemHealth, errors: ClientErrorLogRow[]): string {
  const lines = [
    `Chillverse system health — generated ${new Date(health.generated_at).toLocaleString()}`,
    '',
    `Client errors (24h): ${health.client_errors.errors_24h}`,
    `Client errors (7d): ${health.client_errors.errors_7d}`,
    `Open reports: ${health.moderation_backlog.open_reports}`,
    `Oldest open report: ${health.moderation_backlog.oldest_open_report_age_hours != null ? `${health.moderation_backlog.oldest_open_report_age_hours}h` : '—'}`,
    `Mod actions (24h): ${health.moderation_backlog.actions_24h}`,
    `Open support tickets: ${health.support_backlog.open_tickets}`,
    `Oldest open ticket: ${health.support_backlog.oldest_open_ticket_age_hours != null ? `${health.support_backlog.oldest_open_ticket_age_hours}h` : '—'}`,
    `Disabled flags: ${health.flags.disabled_count}`,
    `Maintenance mode: ${health.flags.maintenance_enabled ? 'ON' : 'off'}`,
  ]

  if (health.client_errors.top_messages_7d.length > 0) {
    lines.push('', 'Most common errors (7d):')
    for (const m of health.client_errors.top_messages_7d) lines.push(`  ${m.occurrences}× — ${m.message}`)
  }

  if (errors.length > 0) {
    lines.push('', `Recent errors (${errors.length}):`, '')
    errors.forEach((e, i) => { lines.push(formatErrorRow(e)); if (i < errors.length - 1) lines.push('') })
  }

  return lines.join('\n')
}

function ErrorLogRow({ err, copiedId, onCopy }: {
  err: ClientErrorLogRow
  copiedId: string | null
  onCopy: (id: string, text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasDetail = !!(err.stack || err.path)

  return (
    <div style={{ borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>{err.message}</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0' }}>
            {formatTimestamp(err.created_at)} · {err.username ?? 'anonymous'}{err.path ? ` · ${err.path}` : ''}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(err.id, formatErrorRow(err)) }}
          aria-label="Copy error"
          style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', color: copiedId === err.id ? '#4fd18a' : 'var(--text-dim)', cursor: 'pointer' }}
        >
          {copiedId === err.id ? <Check size={11} /> : <Copy size={11} />}
        </button>
        {hasDetail && (
          <div style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        )}
      </div>
      {open && hasDetail && (
        <div style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border)' }}>
          {err.path && (
            <p style={{ fontSize: 10.5, color: 'var(--text-dim)', margin: '8px 0 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Path:</span> {err.path}
            </p>
          )}
          {err.stack && (
            <pre
              className="font-mono"
              style={{
                fontSize: 10, lineHeight: 1.5, color: 'var(--text-dim)', margin: '8px 0 0',
                padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}
            >
              {err.stack}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function SystemHealthModal({ onClose }: { onClose: () => void }) {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [errors, setErrors] = useState<ClientErrorLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorsLoading, setErrorsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)

  const load = () => {
    setLoading(true)
    setErrorsLoading(true)
    setError('')
    fetchSystemHealth().then(({ data, error }) => {
      if (error) setError(error)
      setHealth(data)
      setLoading(false)
    })
    fetchRecentClientErrors(40).then(({ data }) => {
      setErrors(data)
      setErrorsLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  function handleCopyRow(id: string, text: string) {
    copyText(text).then(ok => {
      if (!ok) return
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1600)
    })
  }

  function handleCopyReport() {
    if (!health) return
    copyText(formatHealthReport(health, errors)).then(ok => {
      if (!ok) return
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 1600)
    })
  }

  return (
    <Modal title="System health" onClose={onClose} width={480}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Real signals only — client error volume and report/ticket backlog. No platform-level logs are available to this client.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={handleCopyReport}
          disabled={!health}
          className="btn-secondary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', fontSize: 12, opacity: health ? 1 : 0.5 }}
        >
          {copiedReport ? <Check size={12} /> : <Copy size={12} />} {copiedReport ? 'Copied' : 'Copy full report'}
        </button>
        <button
          onClick={load}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 11.5, color: 'var(--red)' }}>{error}</p>
      ) : health && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
            <HealthStat label="Client errors (24h)" value={health.client_errors.errors_24h} warn={health.client_errors.errors_24h > 0} />
            <HealthStat label="Client errors (7d)" value={health.client_errors.errors_7d} />
            <HealthStat label="Open reports" value={health.moderation_backlog.open_reports} warn={health.moderation_backlog.open_reports > 5} />
            <HealthStat
              label="Oldest open report"
              value={health.moderation_backlog.oldest_open_report_age_hours != null ? `${health.moderation_backlog.oldest_open_report_age_hours}h` : '—'}
            />
            <HealthStat label="Mod actions (24h)" value={health.moderation_backlog.actions_24h} />
            <HealthStat label="Open tickets" value={health.support_backlog.open_tickets} />
            <HealthStat
              label="Oldest open ticket"
              value={health.support_backlog.oldest_open_ticket_age_hours != null ? `${health.support_backlog.oldest_open_ticket_age_hours}h` : '—'}
            />
            <HealthStat label="Disabled flags" value={health.flags.disabled_count} warn={health.flags.disabled_count > 0} />
          </div>

          {health.flags.maintenance_enabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,79,79,0.1)', border: '1px solid rgba(255,79,79,0.3)', marginBottom: 14 }}>
              <AlertTriangle size={12} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--red)' }}>Maintenance mode is currently ON.</span>
            </div>
          )}

          {health.client_errors.top_messages_7d.length > 0 && (
            <>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 6px' }}>Most common errors (7d)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {health.client_errors.top_messages_7d.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
                    <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontWeight: 700 }}>{m.occurrences}×</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 6px' }}>
            Recent errors {errors.length > 0 ? `(${errors.length})` : ''}
          </p>
          {errorsLoading ? (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</p>
          ) : errors.length === 0 ? (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '8px 0' }}>No client errors logged recently.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {errors.map(e => (
                <ErrorLogRow key={e.id} err={e} copiedId={copiedId} onCopy={handleCopyRow} />
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ── Root ────────────────────────────────────────────────────────────────

type ModalKind = 'maintenance-message' | 'broadcast' | 'health' | { category: string } | null

export default function AdminOpsPanel() {
  const maint = useMaintenance()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [modal, setModal] = useState<ModalKind>(null)
  const [exportBusy, setExportBusy] = useState<'users' | 'transactions' | null>(null)
  const [pageError, setPageError] = useState('')

  useEffect(() => {
    fetchFeatureFlags().then(({ data }) => { setFlags(data); setFlagsLoading(false) })
  }, [])

  function updateFlag(key: string, enabled: boolean) {
    setFlags(prev => prev.map(f => (f.key === key ? { ...f, enabled } : f)))
  }

  async function runExport(kind: 'users' | 'transactions') {
    setExportBusy(kind)
    setPageError('')
    const { error } = kind === 'users' ? await exportUsersCsv() : await exportTransactionsCsv()
    setExportBusy(null)
    if (error) setPageError(error)
  }

  const categories = ['game', 'map', 'system']
  const flagsByCategory = (cat: string) => flags.filter(f => f.category === cat)
  const flagSummary = (cat: string) => {
    const cf = flagsByCategory(cat)
    const enabled = cf.filter(f => f.enabled).length
    return `${enabled}/${cf.length} on`
  }

  const maintenanceSub = maint.loading
    ? undefined
    : maint.enabled
      ? 'Blocking the app for everyone except staff'
      : 'App is live for everyone'

  return (
    <div>
      <style>{`
        .settings-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--elev-raise-sm);
          margin-bottom: 20px;
        }
        .settings-card > * {
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
          border: none !important;
          border-bottom: 1px solid var(--border) !important;
        }
        .settings-card > *:last-child { border-bottom: none !important; }
      `}</style>

      <SectionTitle>Availability</SectionTitle>
      <div className="settings-card">
        <ToggleRow
          icon={<Power size={15} />} iconBg="rgba(255,79,79,0.12)" iconColor="var(--red)"
          label="Maintenance mode" sub={maintenanceSub}
          on={maint.enabled}
          onToggle={async () => { const err = await maint.toggle(); if (err) setPageError(err) }}
          disabled={maint.loading || maint.toggling}
        />
        <Row
          icon={<MessageSquare size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
          label="Maintenance message" value={maint.loading ? undefined : (maint.message.length > 24 ? maint.message.slice(0, 24) + '…' : maint.message)}
          onClick={(e) => { ripple(e); setModal('maintenance-message') }}
        />
      </div>

      <SectionTitle>Announcements</SectionTitle>
      <div className="settings-card">
        <Row
          icon={<Megaphone size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
          label="Broadcast notification" sub="Notify every user in-app"
          onClick={(e) => { ripple(e); setModal('broadcast') }}
        />
      </div>

      <SectionTitle>Feature flags</SectionTitle>
      <div className="settings-card">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          return (
            <Row
              key={cat}
              icon={<Icon size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
              label={meta.label} value={flagsLoading ? undefined : flagSummary(cat)}
              onClick={(e) => { ripple(e); setModal({ category: cat }) }}
            />
          )
        })}
      </div>

      <SectionTitle>Data export</SectionTitle>
      <div className="settings-card">
        <Row
          icon={<Download size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label={exportBusy === 'users' ? 'Exporting…' : 'Export users'} value="CSV"
          onClick={(e) => { if (!exportBusy) { ripple(e); runExport('users') } }}
        />
        <Row
          icon={<Download size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label={exportBusy === 'transactions' ? 'Exporting…' : 'Export diamond transactions'} value="CSV"
          onClick={(e) => { if (!exportBusy) { ripple(e); runExport('transactions') } }}
        />
      </div>
      {pageError && <p style={{ fontSize: 11.5, color: 'var(--red)', margin: '-6px 0 16px 4px' }}>{pageError}</p>}

      <SectionTitle>System health</SectionTitle>
      <div className="settings-card">
        <Row
          icon={<Activity size={15} />} iconBg="rgba(245,197,66,0.12)" iconColor="var(--gold)"
          label="View system health" sub="Client errors, report & ticket backlog"
          onClick={(e) => { ripple(e); setModal('health') }}
        />
      </div>

      {modal === 'maintenance-message' && (
        <MaintenanceMessageModal
          message={maint.message}
          scheduledFor={maint.scheduledFor}
          onClose={() => setModal(null)}
          onSaved={(msg, sched) => { maint.setMessage(msg); maint.setScheduledFor(sched) }}
        />
      )}
      {modal === 'broadcast' && <BroadcastModal onClose={() => setModal(null)} />}
      {modal === 'health' && <SystemHealthModal onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && (
        <FlagCategoryModal
          category={modal.category}
          flags={flagsByCategory(modal.category)}
          onClose={() => setModal(null)}
          onChange={updateFlag}
        />
      )}
    </div>
  )
}
