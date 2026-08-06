// src/features/support/admin/SupportFeedbackTab.tsx
// Moderation view for the feedback board: set a post's roadmap status, or
// hide it. Both fields are staff-only at the database level (a trigger
// resets them for anyone else), so this tab is the only way they change.
import { useEffect, useState } from 'react'
import { EyeOff, Eye, ExternalLink } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { rowStyle, iconButtonStyle, inputStyle, errorBoxStyle } from '../../blog/admin/styles'
import { fetchFeedbackForModeration, setFeedbackStatus, setFeedbackHidden, type ModeratedFeedbackPost } from './api'
import { fetchFeedbackTopics } from '../feedback/api'
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUS_COLORS, relativeTime } from '../feedback/constants'
import type { SupportFeedbackStatus, SupportFeedbackTopic } from '../../../shared/types'

const STATUSES = Object.keys(FEEDBACK_STATUS_LABELS) as SupportFeedbackStatus[]

export default function SupportFeedbackTab({ canDelete: _canDelete }: { canDelete: boolean }) {
  const [posts, setPosts] = useState<ModeratedFeedbackPost[]>([])
  const [topics, setTopics] = useState<SupportFeedbackTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([fetchFeedbackForModeration({ includeHidden: true }), fetchFeedbackTopics()])
      .then(([rows, topicRows]) => {
        if (!active) return
        setPosts(rows)
        setTopics(topicRows)
        setError(null)
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load feedback.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  const topicName = (id: string) => topics.find(t => t.id === id)?.name ?? 'Unknown topic'

  async function changeStatus(post: ModeratedFeedbackPost, status: SupportFeedbackStatus) {
    setBusyId(post.id)
    try {
      await setFeedbackStatus(post.id, status)
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, status } : p)))
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Could not update that post.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleHidden(post: ModeratedFeedbackPost) {
    setBusyId(post.id)
    try {
      await setFeedbackHidden(post.id, !post.is_hidden)
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, is_hidden: !p.is_hidden } : p)))
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Could not update that post.')
    } finally {
      setBusyId(null)
    }
  }

  const visible = showHidden ? posts : posts.filter(p => !p.is_hidden)
  const hiddenCount = posts.filter(p => p.is_hidden).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {posts.length} post{posts.length === 1 ? '' : 's'} · {hiddenCount} hidden
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden posts
        </label>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>}
      {!loading && visible.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>No feedback posts yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(post => (
          <div key={post.id} style={{ ...rowStyle, opacity: post.is_hidden ? 0.55 : 1, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{post.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: FEEDBACK_STATUS_COLORS[post.status],
                  background: `color-mix(in srgb, ${FEEDBACK_STATUS_COLORS[post.status]} 14%, transparent)`,
                  borderRadius: 999, padding: '3px 8px',
                }}>
                  {FEEDBACK_STATUS_LABELS[post.status]}
                </span>
                {post.is_hidden && (
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--red, #ff5f56)' }}>
                    Hidden
                  </span>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
                {post.author?.username ?? 'Deleted user'} · {topicName(post.topic_id)} · {relativeTime(post.created_at)} · {post.vote_count} vote{post.vote_count === 1 ? '' : 's'}
              </div>

              <select
                value={post.status}
                disabled={busyId === post.id}
                onChange={(e) => void changeStatus(post, e.target.value as SupportFeedbackStatus)}
                style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontSize: 12, padding: '6px 10px' }}
              >
                {STATUSES.map(s => <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <a
                href={`/support/feedback/post/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open post"
                style={{ ...iconButtonStyle, color: 'var(--text-dim)', textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
              </a>
              <button
                type="button"
                title={post.is_hidden ? 'Unhide' : 'Hide from the board'}
                disabled={busyId === post.id}
                onClick={(e) => { ripple(e); void toggleHidden(post) }}
                style={{ ...iconButtonStyle, color: post.is_hidden ? 'var(--green, #35c46a)' : 'var(--text-dim)' }}
              >
                {post.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 14 }}>
        Hiding a post removes it from the public board and from vote totals' visibility, but keeps it and its votes in the database. Only admins can delete outright, and only from the database.
      </p>
    </div>
  )
}
