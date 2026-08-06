// src/features/support/feedback/FeedbackHome.tsx
// Topic index for the feedback board — the equivalent of
// support.discord.com/hc/en-us/community/topics.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquarePlus } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import Breadcrumbs from '../components/Breadcrumbs'
import { SupportDisplayHeading } from '../../../layout/SupportLayout'
import { fetchFeedbackTopics } from './api'
import type { SupportFeedbackTopic } from '../../../shared/types'

export default function FeedbackHome() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<SupportFeedbackTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchFeedbackTopics()
      .then(rows => { if (active) { setTopics(rows); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load feedback topics.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Breadcrumbs items={[
          { label: 'Chillverse', onClick: () => navigate('/support') },
          { label: 'Feedback' },
        ]} />
      </div>

      <SupportDisplayHeading>Feedback</SupportDisplayHeading>

      <p style={{
        textAlign: 'center', maxWidth: 560, margin: '-8px auto 28px',
        fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-dim)',
      }}>
        Tell us what Chillverse should build next. Browse what other people have
        suggested, upvote the ones you want, or post your own idea.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <button
          type="button"
          className="ripple-wrap"
          onClick={(e) => { ripple(e); navigate('/support/feedback/new') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 700, color: '#fff',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            border: 'none', borderRadius: 999, padding: '11px 22px',
          }}
        >
          <MessageSquarePlus size={15} /> Make a suggestion
        </button>
      </div>

      {loading && <StatusLine>Loading topics…</StatusLine>}
      {error && <StatusLine tone="error">{error}</StatusLine>}

      {!loading && !error && (
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}>
          {topics.map(topic => (
            <button
              key={topic.id}
              type="button"
              className="ripple-wrap"
              onClick={(e) => { ripple(e); navigate(`/support/feedback/${topic.slug}`) }}
              style={{
                cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, minHeight: 150, padding: '28px 20px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 18, color: 'var(--text)',
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {topic.name}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                {topic.post_count} {topic.post_count === 1 ? 'post' : 'posts'}
                {' · '}
                {topic.follower_count} {topic.follower_count === 1 ? 'contributor' : 'contributors'}
              </span>
              {topic.description && (
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-dim)' }}>
                  {topic.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusLine({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <p style={{
      textAlign: 'center', fontSize: 13.5, fontWeight: 600, padding: '32px 0',
      color: tone === 'error' ? 'var(--red, #ff5f56)' : 'var(--text-muted)',
    }}>
      {children}
    </p>
  )
}
