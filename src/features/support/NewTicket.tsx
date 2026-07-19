// src/features/support/NewTicket.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchSupportCategories, submitSupportTicket } from './api'
import type { SupportCategory } from '../../shared/types'

const SUBJECT_MAX = 120
const MESSAGE_MAX = 2000
const MESSAGE_MIN = 20

export default function NewTicket() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSupportCategories().then(setCategories).catch(() => { /* non-fatal — category is optional */ })
  }, [])

  useEffect(() => {
    if (user?.email) setContactEmail(user.email)
  }, [user])

  const subjectValid = subject.trim().length > 0 && subject.trim().length <= SUBJECT_MAX
  const messageValid = message.trim().length >= MESSAGE_MIN && message.trim().length <= MESSAGE_MAX
  const canSubmit = subjectValid && messageValid && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setError('You need to be logged in to submit a ticket.')
      return
    }
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      await submitSupportTicket(user.id, {
        categoryId: categoryId || null,
        subject,
        message,
        contactEmail: contactEmail.trim() || null,
      })
      setSuccess(true)
      setTimeout(() => navigate('/support/tickets'), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/support')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 18, padding: 0,
        }}
      >
        <ArrowLeft size={15} /> Back to Help Center
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Contact support</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 22 }}>
        Tell us what's going on and our team will get back to you.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
          padding: 22, display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: 'var(--elev-raise-sm)',
        }}
      >
        <Field label="Topic (optional)">
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Choose a topic…</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Subject" hint={`${subject.length}/${SUBJECT_MAX}`}>
          <input
            type="text"
            value={subject}
            maxLength={SUBJECT_MAX}
            onChange={e => setSubject(e.target.value)}
            placeholder="A short summary of your issue"
            style={inputStyle}
          />
        </Field>

        <Field label="Message" hint={`${message.length}/${MESSAGE_MAX}`}>
          <textarea
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe what happened, including any steps to reproduce it…"
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          {message.length > 0 && message.trim().length < MESSAGE_MIN && (
            <div style={{ fontSize: 11.5, color: 'var(--gold)', marginTop: 6 }}>
              Please add a little more detail (at least {MESSAGE_MIN} characters).
            </div>
          )}
        </Field>

        <Field label="Contact email">
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </Field>

        {error && <div style={errorBoxStyle}>{error}</div>}
        {success && <div style={successBoxStyle}>Ticket submitted — redirecting you to My Tickets…</div>}

        <button
          type="submit"
          onClick={ripple}
          disabled={!canSubmit}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 700, color: '#fff', padding: '13px 20px', borderRadius: 12,
            border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface3)',
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          <Send size={15} /> {submitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
        {label}
        {hint && <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 13px', color: 'var(--text)', fontSize: 13.5, outline: 'none',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13,
}

const successBoxStyle: React.CSSProperties = {
  background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.25)', borderRadius: 12,
  padding: '12px 16px', color: 'var(--green)', fontSize: 13,
}
