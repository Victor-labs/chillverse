// src/features/careers/admin/CareersAdmin.tsx
// Staff-only CMS for the /work job listings — reachable at /work/admin.
// Lets staff toggle roles on/off, edit copy, add new roles, and delete
// old ones. Gated the same way AdminBlog/AdminDashboard are: render the
// page for anyone, but show an "admins only" state unless useModRole
// says they're staff — the real enforcement is RLS on job_openings itself
// (migration 0098), this is just UX.
import { useEffect, useState, type CSSProperties } from 'react'
import { ShieldAlert, Plus, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'
import { useModRole } from '../../moderation/useModRole'
import {
  fetchAllJobOpenings, createJobOpening, updateJobOpening, deleteJobOpening,
  slugify, type JobOpening, type JobOpeningInput, type JobCategory, type Compensation,
} from '../api'

const CATEGORIES: JobCategory[] = ['Community', 'Marketing', 'Design', 'Engineering', 'Quality Assurance', 'Editorial', 'Support']

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }
const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 16px',
}
const iconButtonStyle: CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-dim)',
}

const EMPTY_FORM: JobOpeningInput = {
  slug: '', title: '', category: 'Community', compensation: 'paid',
  summary: '', description: '', is_active: true, sort_order: 0,
}

export default function CareersAdmin() {
  const { isStaff, loading: roleLoading } = useModRole()
  const [jobs, setJobs] = useState<JobOpening[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<JobOpening | 'new' | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await fetchAllJobOpenings()
    if (error) setError(error)
    setJobs(data)
    setLoading(false)
  }

  useEffect(() => {
    if (roleLoading) return
    if (!isStaff) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isStaff])

  async function toggleActive(job: JobOpening) {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: !j.is_active } : j))
    const { error } = await updateJobOpening(job.id, { is_active: !job.is_active })
    if (error) { setError(error); load() }
  }

  async function handleDelete(job: JobOpening) {
    if (!window.confirm(`Delete "${job.title}"? This can't be undone.`)) return
    const { error } = await deleteJobOpening(job.id)
    if (error) { setError(error); return }
    setJobs(prev => prev.filter(j => j.id !== job.id))
  }

  if (roleLoading) return null

  if (!isStaff) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: 20 }}>
        <ShieldAlert size={32} style={{ color: 'var(--text-dim)', marginBottom: 10 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Staff only</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>
          This page is restricted to Chillverse staff.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Careers CMS</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 0' }}>Manage roles shown on /work</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff',
            background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
          }}
        >
          <Plus size={15} /> New role
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12, padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading roles…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map(job => (
            <div key={job.id} style={rowStyle}>
              <div style={{ minWidth: 0, opacity: job.is_active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{job.title}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {job.compensation === 'paid' ? 'Paid' : 'Voluntary'}
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>{job.category} · /work/{job.slug}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" style={iconButtonStyle} onClick={() => toggleActive(job)} title={job.is_active ? 'Deactivate' : 'Activate'}>
                  {job.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button type="button" style={iconButtonStyle} onClick={() => setEditing(job)} title="Edit">
                  <Pencil size={14} />
                </button>
                <button type="button" style={{ ...iconButtonStyle, color: '#ff8080' }} onClick={() => handleDelete(job)} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No roles yet — add one to get started.</p>}
        </div>
      )}

      {editing && (
        <JobEditorModal
          job={editing === 'new' ? null : editing}
          nextSortOrder={jobs.length}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setJobs(prev => {
              const exists = prev.some(j => j.id === saved.id)
              return exists ? prev.map(j => j.id === saved.id ? saved : j) : [...prev, saved]
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function JobEditorModal({
  job, nextSortOrder, onClose, onSaved,
}: {
  job: JobOpening | null
  nextSortOrder: number
  onClose: () => void
  onSaved: (job: JobOpening) => void
}) {
  const [form, setForm] = useState<JobOpeningInput>(
    job ? {
      slug: job.slug, title: job.title, category: job.category, compensation: job.compensation,
      summary: job.summary, description: job.description, is_active: job.is_active, sort_order: job.sort_order,
    } : { ...EMPTY_FORM, sort_order: nextSortOrder },
  )
  const [slugTouched, setSlugTouched] = useState(!!job)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof JobOpeningInput>(key: K, value: JobOpeningInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleTitleChange(title: string) {
    set('title', title)
    if (!slugTouched) set('slug', slugify(title))
  }

  const canSave = form.title.trim().length > 0 && form.slug.trim().length > 0 &&
    form.summary.trim().length > 0 && form.description.trim().length > 0

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    const result = job
      ? await updateJobOpening(job.id, form)
      : await createJobOpening(form)
    setSaving(false)
    if (result.error || !result.data) { setError(result.error ?? 'Something went wrong.'); return }
    onSaved(result.data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{job ? 'Edit role' : 'New role'}</h2>
          <button type="button" onClick={onClose} style={iconButtonStyle}><X size={14} /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12, padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. Frontend Developer" />
          </div>

          <div>
            <label style={labelStyle}>Slug (used in the URL: /work/…)</label>
            <input style={inputStyle} value={form.slug} onChange={e => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="frontend-developer" />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value as JobCategory)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Compensation</label>
              <select style={inputStyle} value={form.compensation} onChange={e => set('compensation', e.target.value as Compensation)}>
                <option value="paid">Paid</option>
                <option value="voluntary">Voluntary</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Card summary (one line, shown on /work)</label>
            <input style={inputStyle} value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="Short one-liner for the job card" />
          </div>

          <div>
            <label style={labelStyle}>Full description (shown on the role's page — separate paragraphs with a blank line)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Visible on /work
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none',
              borderRadius: 10, padding: '10px 18px', cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              opacity: canSave && !saving ? 1 : 0.6,
            }}
          >
            {saving ? 'Saving…' : 'Save role'}
          </button>
        </div>
      </div>
    </div>
  )
}
