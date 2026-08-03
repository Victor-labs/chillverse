// src/features/careers/admin/ApplicationsAdmin.tsx
// The "Applications" tab of the Careers CMS (/work/admin) — where staff
// review Phase 2 submissions from JobApplyForm. Files live in the private
// job-applications storage bucket; links here are short-lived signed URLs
// generated on demand rather than stored, since permanent public URLs
// would leak applicant PII (profile pics, CVs) to anyone with the link.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, MapPin, Calendar, Linkedin,
} from 'lucide-react'
import {
  fetchApplications, updateApplicationStatus, updateApplicationNotes, getApplicationFileUrl,
  type JobApplication, type ApplicationStatus,
} from '../api'

const STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted']

const STATUS_COLORS: Record<ApplicationStatus, { bg: string; border: string; text: string }> = {
  pending:     { bg: 'rgba(240,214,142,0.14)', border: 'rgba(240,214,142,0.3)', text: '#f0d68e' },
  reviewing:   { bg: 'rgba(124,102,255,0.14)', border: 'rgba(124,102,255,0.3)', text: '#a99bff' },
  shortlisted: { bg: 'rgba(62,207,142,0.14)',  border: 'rgba(62,207,142,0.3)',  text: '#8ef0c0' },
  accepted:    { bg: 'rgba(62,207,142,0.22)',  border: 'rgba(62,207,142,0.4)',  text: '#5df4a8' },
  rejected:    { bg: 'rgba(255,79,79,0.14)',   border: 'rgba(255,79,79,0.3)',   text: '#ff8080' },
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
}
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }
const valueStyle: CSSProperties = { fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5 }

export default function ApplicationsAdmin() {
  const [apps, setApps] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await fetchApplications()
    if (error) setError(error)
    setApps(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    const { error } = await updateApplicationStatus(id, status)
    if (error) { setError(error); load() }
  }

  const visible = filter === 'all' ? apps : apps.filter(a => a.status === filter)
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: apps.filter(a => a.status === s).length }), {} as Record<ApplicationStatus, number>)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <FilterChip label={`All (${apps.length})`} active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUSES.map(s => (
          <FilterChip key={s} label={`${capitalize(s)} (${counts[s] ?? 0})`} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12, padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading applications…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No applications here yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(app => (
            <ApplicationCard
              key={app.id}
              app={app}
              expanded={expandedId === app.id}
              onToggle={() => setExpandedId(prev => prev === app.id ? null : app.id)}
              onStatusChange={status => handleStatusChange(app.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
        border: '1px solid var(--border)',
        background: active ? 'var(--accent)' : 'var(--surface2)',
        color: active ? '#fff' : 'var(--text-dim)',
      }}
    >
      {label}
    </button>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ApplicationCard({
  app, expanded, onToggle, onStatusChange,
}: {
  app: JobApplication
  expanded: boolean
  onToggle: () => void
  onStatusChange: (status: ApplicationStatus) => void
}) {
  const colors = STATUS_COLORS[app.status]
  const fullName = [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ')

  return (
    <div style={cardStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{fullName}</p>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
            {app.job_title} · {new Date(app.created_at).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase',
              padding: '3px 9px', borderRadius: 999, color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`,
            }}
          >
            {app.status}
          </span>
          {expanded ? <ChevronUp size={16} color="var(--text-dim)" /> : <ChevronDown size={16} color="var(--text-dim)" />}
        </div>
      </button>

      {expanded && <ApplicationDetail app={app} onStatusChange={onStatusChange} />}
    </div>
  )
}

function ApplicationDetail({
  app, onStatusChange,
}: { app: JobApplication; onStatusChange: (status: ApplicationStatus) => void }) {
  const [notes, setNotes] = useState(app.staff_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  async function saveNotes() {
    setSavingNotes(true)
    await updateApplicationNotes(app.id, notes)
    setSavingNotes(false)
  }

  return (
    <div style={{ padding: '0 16px 18px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
        <InfoItem icon={<Mail size={13} />} value={app.email} href={`mailto:${app.email}`} />
        <InfoItem icon={<Phone size={13} />} value={app.phone} />
        <InfoItem icon={<MapPin size={13} />} value={`${app.city}, ${app.country}`} />
        <InfoItem icon={<Calendar size={13} />} value={`DOB ${app.date_of_birth}`} />
        {app.linkedin_url && <InfoItem icon={<Linkedin size={13} />} value="LinkedIn" href={app.linkedin_url} />}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <FileLink label="Profile picture" path={app.profile_pic_path} />
        <FileLink label="CV / résumé" path={app.cv_path} />
        <FileLink label="Portfolio" path={app.portfolio_path} />
        <FileLink label="Cover letter" path={app.cover_letter_path} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Why they want to work at Chillverse</label>
        <p style={valueStyle}>{app.why_chillverse}</p>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Familiarity with Chillverse / online platforms</label>
        <p style={valueStyle}>{app.familiarity}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <YesNoDisplay q="Available when needed?" v={app.available_when_needed} />
        <YesNoDisplay q="Communicates in English?" v={app.communicates_in_english} />
        <YesNoDisplay q="Understands no guarantee?" v={app.understands_no_guarantee} />
        <YesNoDisplay q="Agrees to Code of Conduct?" v={app.agrees_code_of_conduct} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Status</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map(s => {
            const active = app.status === s
            const c = STATUS_COLORS[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                style={{
                  fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${active ? c.border : 'var(--border)'}`,
                  background: active ? c.bg : 'var(--surface2)',
                  color: active ? c.text : 'var(--text-dim)',
                }}
              >
                {capitalize(s)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Staff notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Private notes, only visible to staff…"
          style={{
            width: '100%', minHeight: 70, padding: '9px 11px', borderRadius: 10, resize: 'vertical',
            background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
            fontSize: 12.5, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
          }}
        />
        <button
          type="button"
          onClick={saveNotes}
          disabled={savingNotes || notes === (app.staff_notes ?? '')}
          style={{
            marginTop: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none',
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            opacity: savingNotes || notes === (app.staff_notes ?? '') ? 0.55 : 1,
          }}
        >
          {savingNotes ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  )
}

function InfoItem({ icon, value, href }: { icon: ReactNode; value: string; href?: string }) {
  const content = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-dim)' }}>
      {icon} {value}
    </span>
  )
  return href
    ? <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{content}</a>
    : content
}

/** Fetches a fresh 10-minute signed URL on click rather than storing one,
 *  since a stored signed URL would eventually expire and/or leak PII if
 *  the admin page state were ever persisted or shared. */
function FileLink({ label, path }: { label: string; path: string | null }) {
  const [loading, setLoading] = useState(false)

  if (!path) {
    return (
      <span style={{
        fontSize: 11.5, color: 'var(--text-muted)', padding: '6px 11px', borderRadius: 8,
        border: '1px dashed var(--border)', background: 'var(--surface2)',
      }}>
        {label}: not provided
      </span>
    )
  }

  async function openFile() {
    setLoading(true)
    const { url, error } = await getApplicationFileUrl(path!)
    setLoading(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else if (error) window.alert(`Couldn't open file: ${error}`)
  }

  return (
    <button
      type="button"
      onClick={openFile}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        color: 'var(--text)', padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      {loading ? 'Opening…' : label} <ExternalLink size={11} />
    </button>
  )
}

function YesNoDisplay({ q, v }: { q: string; v: boolean }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 3px' }}>{q}</p>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: v ? '#8ef0c0' : '#ff8080', margin: 0 }}>{v ? 'Yes' : 'No'}</p>
    </div>
  )
}
