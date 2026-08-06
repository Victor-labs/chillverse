// src/features/status/StatusPage.tsx
//
// Public status page — chillverse.com.ng/status. No auth required, no
// backend/infra details exposed anywhere in this file: component labels
// are generic user-facing names, and the response-time chart is labeled
// "Server Response Time" with no vendor name attached.
import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Activity } from 'lucide-react'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import {
  fetchStatusComponents, fetchRecentIncidents, fetchStatusMetrics,
  type StatusComponent, type StatusIncident, type StatusMetricPoint, type ComponentState,
} from './statusApi'

const UPTIME_DAYS = 60

// Hardcoded hex, not var(--green) etc. — these four tokens are fixed
// constants (not per-theme) in index.css, and hex is required here since
// we alpha-suffix these colors below (e.g. `${color}1a`) for translucent
// fills; you can't append a hex alpha suffix to a var() reference.
const STATE_META: Record<ComponentState, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  operational:     { label: 'Operational',        color: '#3ecf8e',  icon: CheckCircle2 },
  degraded:        { label: 'Degraded Performance', color: '#f5c542', icon: AlertTriangle },
  partial_outage:  { label: 'Partial Outage',      color: '#f2994a',  icon: AlertTriangle },
  major_outage:    { label: 'Major Outage',        color: '#ff4f4f',  icon: AlertOctagon },
  maintenance:     { label: 'Under Maintenance',   color: '#4f8ef7',  icon: Wrench },
}

function overallState(components: StatusComponent[]): ComponentState {
  const order: ComponentState[] = ['major_outage', 'partial_outage', 'degraded', 'maintenance', 'operational']
  for (const s of order) {
    if (components.some(c => c.state === s)) return s
  }
  return 'operational'
}

/** Buckets incidents into a per-day worst-state array for the uptime bar row. */
function buildDayBuckets(component: StatusComponent, incidents: StatusIncident[]): { date: Date; state: ComponentState }[] {
  const days: { date: Date; state: ComponentState }[] = []
  const relevant = incidents.filter(i => i.component_key === component.key || i.component_key === null)
  const severityRank: Record<string, number> = { major_outage: 4, partial_outage: 3, degraded: 2, maintenance: 1 }

  for (let i = UPTIME_DAYS - 1; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    let worst: ComponentState = 'operational'
    for (const inc of relevant) {
      const start = new Date(inc.started_at)
      const end = inc.resolved_at ? new Date(inc.resolved_at) : new Date()
      if (start < dayEnd && end > dayStart) {
        if (!worst || severityRank[inc.severity] > (severityRank[worst] ?? 0)) worst = inc.severity as ComponentState
      }
    }
    days.push({ date: dayStart, state: worst })
  }
  return days
}

function UptimeBar({ component, incidents }: { component: StatusComponent; incidents: StatusIncident[] }) {
  const days = buildDayBuckets(component, incidents)
  const upDays = days.filter(d => d.state === 'operational').length
  const pct = ((upDays / days.length) * 100).toFixed(2)
  const meta = STATE_META[component.state]
  const Icon = meta.icon

  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-[15px] text-body">{component.label}</div>
          {component.description && <div className="text-[12px] text-muted mt-0.5">{component.description}</div>}
          {component.state_message && component.state !== 'operational' && (
            <div className="text-[12px] mt-1" style={{ color: meta.color }}>{component.state_message}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[13px] font-semibold" style={{ color: meta.color }}>
          <Icon size={15} />
          {meta.label}
        </div>
      </div>

      <div className="flex gap-[2px] h-8">
        {days.map((d, i) => (
          <div
            key={i}
            title={`${d.date.toLocaleDateString()}: ${STATE_META[d.state].label}`}
            className="flex-1 rounded-[2px]"
            style={{ background: STATE_META[d.state].color, opacity: d.state === 'operational' ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-1.5">
        <span>{UPTIME_DAYS} days ago</span>
        <span>{pct}% uptime</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function ResponseTimeChart({ points }: { points: StatusMetricPoint[] }) {
  const ok = points.filter(p => p.ok && p.latency_ms != null)
  if (ok.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-8 text-center text-[13px] text-muted">
        Collecting response-time data — check back shortly.
      </div>
    )
  }

  const latencies = ok.map(p => p.latency_ms as number)
  const max = Math.max(...latencies, 50)
  const w = 100, h = 100
  const step = w / (ok.length - 1)
  const pathD = ok.map((p, i) => {
    const x = i * step
    const y = h - ((p.latency_ms as number) / max) * h * 0.9
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  const latest = latencies[latencies.length - 1]
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)

  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-body">
          <Activity size={14} /> Server Response Time
        </div>
        <div className="text-[13px] text-secondary">
          <span className="font-semibold text-body">{latest}ms</span> now · {avg}ms avg
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-24">
        <path d={pathD} fill="none" stroke="var(--accent, #6c50ff)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function IncidentCard({ incident }: { incident: StatusIncident }) {
  const meta = STATE_META[(incident.severity as ComponentState) ?? 'degraded']
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-[14px] text-body">{incident.title}</div>
        <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
          {incident.status === 'resolved' ? 'Resolved' : meta.label}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {(incident.updates ?? []).slice().reverse().map(u => (
          <div key={u.id} className="text-[13px] text-secondary">
            <span className="font-semibold text-body capitalize">{u.status}</span> — {u.message}
            <div className="text-[11px] text-muted mt-0.5">{new Date(u.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatusPage() {
  const [components, setComponents] = useState<StatusComponent[]>([])
  const [incidents, setIncidents] = useState<StatusIncident[]>([])
  const [metrics, setMetrics] = useState<StatusMetricPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, i, m] = await Promise.all([
        fetchStatusComponents(),
        fetchRecentIncidents(UPTIME_DAYS),
        fetchStatusMetrics(24),
      ])
      if (cancelled) return
      setComponents(c.data)
      setIncidents(i.data)
      setMetrics(m.data)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60_000) // light auto-refresh, no realtime channel needed for a status page
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const active = incidents.filter(i => i.status !== 'resolved')
  const past = incidents.filter(i => i.status === 'resolved')
  const overall = overallState(components)
  const overallMeta = STATE_META[overall]

  return (
    <div data-theme="midnight">
      <Seo
        title="Chillverse Status"
        description="Live status for Chillverse — purchases, chat & multiplayer, push notifications, marketing pages, and the core app."
        path="/status"
      />
      <Nav />

      <div className="max-w-3xl mx-auto px-5 md:px-10 pt-28 pb-20">
        <div className="mb-8">
          <div className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-accent mb-3">Status</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">Chillverse Status</h1>
          <p className="text-[15px] text-secondary">Live status of Chillverse services.</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Loading status…</div>
        ) : (
          <>
            <div
              className="rounded-2xl px-6 py-5 mb-8 flex items-center gap-3 font-semibold text-[15px]"
              style={{ background: `${overallMeta.color}1f`, color: overallMeta.color, border: `1px solid ${overallMeta.color}44` }}
            >
              <overallMeta.icon size={20} />
              {overall === 'operational' ? 'All Systems Operational' : overallMeta.label}
            </div>

            {active.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-body mb-3">Active incidents</h2>
                {active.map(inc => <IncidentCard key={inc.id} incident={inc} />)}
              </div>
            )}

            <div className="mb-8">
              {components.map(c => <UptimeBar key={c.key} component={c} incidents={incidents} />)}
            </div>

            <div className="mb-8">
              <ResponseTimeChart points={metrics} />
            </div>

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-body mb-3">Past incidents</h2>
                {past.slice(0, 10).map(inc => <IncidentCard key={inc.id} incident={inc} />)}
              </div>
            )}

            {active.length === 0 && past.length === 0 && (
              <p className="text-center text-[13px] text-muted py-6">No incidents reported in the last {UPTIME_DAYS} days.</p>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
