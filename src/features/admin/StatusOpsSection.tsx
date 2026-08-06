// src/features/admin/StatusOpsSection.tsx
//
// The "Status page" ops control — set a component's public state directly
// (instant, for quick maintenance toggles), or declare/update a proper
// incident with a timeline (for anything the public should see updates
// on). Rendered inside AdminOpsPanel.tsx.
import { useEffect, useState } from 'react'
import { AlertTriangle, Wrench, CheckCircle2, Radio } from 'lucide-react'
import { Row, SectionTitle } from '../settings/settingsShared'
import { Modal, fieldLabel, inputStyle } from './adminModal'
import {
  fetchStatusComponents, fetchRecentIncidents, adminSetStatusComponent, adminCreateIncident, adminUpdateIncident,
  type StatusComponent, type StatusIncident, type ComponentState, type IncidentSeverity, type IncidentStatus,
} from '../status/statusApi'

const STATE_LABEL: Record<ComponentState, string> = {
  operational: 'Operational', degraded: 'Degraded', partial_outage: 'Partial Outage',
  major_outage: 'Major Outage', maintenance: 'Maintenance',
}
// Hardcoded hex (not var(--green) etc.) so the `${color}22` alpha-suffix
// trick used below actually produces valid CSS — see StatusPage.tsx for
// the same note.
const STATE_COLOR: Record<ComponentState, string> = {
  operational: '#3ecf8e', degraded: '#f5c542', partial_outage: '#f2994a',
  major_outage: '#ff4f4f', maintenance: '#4f8ef7',
}

// ── Quick state modal — instant, no incident record ─────────────────
function SetComponentModal({ component, onClose, onSaved }: {
  component: StatusComponent
  onClose: () => void
  onSaved: (state: ComponentState, message: string | null) => void
}) {
  const [state, setState] = useState<ComponentState>(component.state)
  const [message, setMessage] = useState(component.state_message ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const { error } = await adminSetStatusComponent(component.key, state, message.trim() || null)
    setSaving(false)
    if (error) { setError(error); return }
    onSaved(state, message.trim() || null)
    onClose()
  }

  return (
    <Modal title={`Set state — ${component.label}`} onClose={onClose}>
      <p style={fieldLabel}>State</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(Object.keys(STATE_LABEL) as ComponentState[]).map(s => (
          <button
            key={s}
            onClick={() => setState(s)}
            style={{
              padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${state === s ? STATE_COLOR[s] : 'var(--border)'}`,
              background: state === s ? `${STATE_COLOR[s]}22` : 'var(--surface2)',
              color: state === s ? STATE_COLOR[s] : 'var(--text-dim)',
            }}
          >
            {STATE_LABEL[s]}
          </button>
        ))}
      </div>
      <p style={fieldLabel}>Message shown on the status page (optional)</p>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="e.g. Scheduled maintenance until 2am WAT" style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
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

// ── Declare incident modal ────────────────────────────────────────────
function DeclareIncidentModal({ components, onClose, onSaved }: {
  components: StatusComponent[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [componentKey, setComponentKey] = useState<string>('')
  const [severity, setSeverity] = useState<IncidentSeverity>('degraded')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')
    const { error } = await adminCreateIncident(title.trim(), componentKey || null, severity, message.trim())
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
    onClose()
  }

  return (
    <Modal title="Declare incident" onClose={onClose} width={420}>
      <p style={fieldLabel}>Title</p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Slow payments on Mall checkout" style={{ ...inputStyle, marginBottom: 14 }} />

      <p style={fieldLabel}>Affected component</p>
      <select value={componentKey} onChange={e => setComponentKey(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
        <option value="">Sitewide (all of Chillverse)</option>
        {components.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      <p style={fieldLabel}>Severity</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(['maintenance', 'degraded', 'partial_outage', 'major_outage'] as IncidentSeverity[]).map(s => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            style={{
              padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${severity === s ? STATE_COLOR[s] : 'var(--border)'}`,
              background: severity === s ? `${STATE_COLOR[s]}22` : 'var(--surface2)',
              color: severity === s ? STATE_COLOR[s] : 'var(--text-dim)',
            }}
          >
            {STATE_LABEL[s]}
          </button>
        ))}
      </div>

      <p style={fieldLabel}>First update message</p>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="We are investigating this issue." style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />

      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Posting…' : 'Post incident'}
        </button>
      </div>
    </Modal>
  )
}

// ── Update incident modal ─────────────────────────────────────────────
function UpdateIncidentModal({ incident, onClose, onSaved }: {
  incident: StatusIncident
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<IncidentStatus>(
    incident.status === 'investigating' ? 'identified' : incident.status === 'identified' ? 'monitoring' : 'resolved'
  )
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const { error } = await adminUpdateIncident(incident.id, status, message.trim())
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
    onClose()
  }

  return (
    <Modal title={incident.title} onClose={onClose}>
      <p style={fieldLabel}>New status</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(['investigating', 'identified', 'monitoring', 'resolved'] as IncidentStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              border: `1px solid ${status === s ? 'var(--accent)' : 'var(--border)'}`,
              background: status === s ? 'var(--active)' : 'var(--surface2)',
              color: status === s ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <p style={fieldLabel}>Update message</p>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="What's the latest?" style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
      {status === 'resolved' && (
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 14 }}>
          Resolving will flip the affected component back to Operational, if no other open incidents remain on it.
        </p>
      )}
      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main section ────────────────────────────────────────────────────
export default function StatusOpsSection() {
  const [components, setComponents] = useState<StatusComponent[]>([])
  const [incidents, setIncidents] = useState<StatusIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [editingComponent, setEditingComponent] = useState<StatusComponent | null>(null)
  const [declaring, setDeclaring] = useState(false)
  const [editingIncident, setEditingIncident] = useState<StatusIncident | null>(null)

  async function reload() {
    const [c, i] = await Promise.all([fetchStatusComponents(), fetchRecentIncidents(14)])
    setComponents(c.data)
    setIncidents(i.data)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const openIncidents = incidents.filter(i => i.status !== 'resolved')

  if (loading) return null

  return (
    <>
      <SectionTitle>Status page</SectionTitle>

      <Row
        icon={<Radio size={15} />}
        iconBg="rgba(108,80,255,0.14)"
        iconColor="var(--accent)"
        label="Declare incident"
        sub="Posts to chillverse.com.ng/status with a live timeline"
        onClick={() => setDeclaring(true)}
      />

      {openIncidents.map(inc => (
        <Row
          key={inc.id}
          icon={<AlertTriangle size={15} />}
          iconBg="rgba(240,177,0,0.14)"
          iconColor="var(--gold)"
          label={inc.title}
          sub={`${inc.status} · tap to update`}
          onClick={() => setEditingIncident(inc)}
        />
      ))}

      {components.map(c => (
        <Row
          key={c.key}
          icon={c.state === 'operational' ? <CheckCircle2 size={15} /> : <Wrench size={15} />}
          iconBg={`${STATE_COLOR[c.state]}22`}
          iconColor={STATE_COLOR[c.state]}
          label={c.label}
          sub={STATE_LABEL[c.state]}
          onClick={() => setEditingComponent(c)}
        />
      ))}

      {editingComponent && (
        <SetComponentModal
          component={editingComponent}
          onClose={() => setEditingComponent(null)}
          onSaved={() => reload()}
        />
      )}
      {declaring && (
        <DeclareIncidentModal
          components={components}
          onClose={() => setDeclaring(false)}
          onSaved={() => reload()}
        />
      )}
      {editingIncident && (
        <UpdateIncidentModal
          incident={editingIncident}
          onClose={() => setEditingIncident(null)}
          onSaved={() => reload()}
        />
      )}
    </>
  )
}
