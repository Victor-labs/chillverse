// src/features/support/feedback/NewFeedback.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { ripple } from '../../../shared/lib/ripple'
import Breadcrumbs from '../components/Breadcrumbs'
import { SupportDisplayHeading } from '../../../layout/SupportLayout'
import { fetchFeedbackTopics, submitFeedbackPost } from './api'
import { useAuth } from '../../auth/useAuth'
import type { SupportFeedbackTopic } from '../../../shared/types'

export default function NewFeedback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [topics, setTopics] = useState<SupportFeedbackTopic[]>([])
  const [topicId, setTopicId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchFeedbackTopics()
      .then(rows => {
        if (!active) return
        setTopics(rows)
        const preselected = rows.find(t => t.slug === searchParams.get('topic'))
        setTopicId(preselected?.id ?? rows[0]?.id ?? '')
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load topics.') })
    return () => { active = false }
  }, [searchParams])

  async function handleSubmit() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }

    const cleanTitle = title.trim()
    const cleanBody = body.trim()

    if (!topicId) { setError('Pick a topic first.'); return }
    if (cleanTitle.length < 3 || cleanTitle.length > 160) {
      setError('Title needs to be between 3 and 160 characters.')
      return
    }
    if (cleanBody.length < 10 || cleanBody.length > 8000) {
      setError('Details need to be between 10 and 8000 characters.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const created = await submitFeedbackPost(user.id, { topicId, title: cleanTitle, body: cleanBody })
      navigate(`/support/feedback/post/${created.id}`, { replace: true })
    } catch (err) {
      // The 5-per-hour DB trigger surfaces here as a plain message.
      setError((err as Error).message || 'Could not post your suggestion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Breadcrumbs items={[
          { label: 'Chillverse', onClick: () => navigate('/support') },
          { label: 'Feedback', onClick: () => navigate('/support/feedback') },
          { label: 'New post' },
        ]} />
      </div>

      <SupportDisplayHeading>New Post</SupportDisplayHeading>

      {!authLoading && !user && (
        <div style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: 'var(--text-dim)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 20,
        }}>
          You'll need to sign in to your Chillverse account before posting. Write
          your suggestion first if you like — we'll take you to sign in when you
          hit post, and bring you straight back.
        </div>
      )}

      <label style={labelStyle}>Topic</label>
      <select
        value={topicId}
        onChange={(e) => setTopicId(e.target.value)}
        style={{ ...fieldStyle, cursor: 'pointer', marginBottom: 18 }}
      >
        {topics.map(topic => (
          <option key={topic.id} value={topic.id}>{topic.name}</option>
        ))}
      </select>

      <label style={labelStyle}>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={160}
        placeholder="Sum up your idea in one line"
        style={{ ...fieldStyle, marginBottom: 18 }}
      />

      <label style={labelStyle}>Details</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={9}
        maxLength={8000}
        placeholder="What should we build, and what problem does it solve for you?"
        style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.65, marginBottom: 6 }}
      />
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 18 }}>
        {body.trim().length}/8000
      </div>

      {error && (
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--red, #ff5f56)', margin: '0 0 14px' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="ripple-wrap"
        onClick={(e) => { ripple(e); void handleSubmit() }}
        disabled={submitting}
        style={{
          width: '100%', cursor: submitting ? 'default' : 'pointer',
          fontSize: 14, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          border: 'none', borderRadius: 999, padding: '13px 22px',
        }}
      >
        {submitting ? 'Posting…' : 'Post suggestion'}
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 7,
}

const fieldStyle: React.CSSProperties = {
  width: '100%', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', border: '1px solid var(--border-strong)',
  borderRadius: 12, padding: '11px 14px',
}
