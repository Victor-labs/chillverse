// src/features/support/feedback/FeedbackPost.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, X } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { renderLiteMarkdown } from '../../../shared/lib/markdownLite'
import Breadcrumbs from '../components/Breadcrumbs'
import VoteButton from './VoteButton'
import { fetchFeedbackPost, updateFeedbackPost } from './api'
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, relativeTime } from './constants'
import { useAuth } from '../../auth/useAuth'
import type { SupportFeedbackPostDetail } from '../../../shared/types'

export default function FeedbackPost() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [post, setPost] = useState<SupportFeedbackPostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!postId) return
    let active = true
    setLoading(true)

    fetchFeedbackPost(postId)
      .then(row => {
        if (!active) return
        setPost(row)
        setError(row ? null : 'This post no longer exists.')
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load this post.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [postId])

  const isAuthor = !!user && !!post && user.id === post.author_id

  function startEditing() {
    if (!post) return
    setDraftTitle(post.title)
    setDraftBody(post.body)
    setSaveError(null)
    setEditing(true)
  }

  async function saveEdit() {
    if (!post) return
    const title = draftTitle.trim()
    const body = draftBody.trim()

    // Mirrors the CHECK constraints on support_feedback_posts so people get a
    // useful message instead of a raw Postgres constraint violation.
    if (title.length < 3 || title.length > 160) {
      setSaveError('Title needs to be between 3 and 160 characters.')
      return
    }
    if (body.length < 10 || body.length > 8000) {
      setSaveError('Details need to be between 10 and 8000 characters.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await updateFeedbackPost(post.id, { title, body })
      setPost({ ...post, title, body, edited_at: new Date().toISOString() })
      setEditing(false)
    } catch (err) {
      setSaveError((err as Error).message || 'Could not save your changes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <CenteredNote>Loading…</CenteredNote>
  if (error || !post) return <CenteredNote tone="error">{error ?? 'Post not found.'}</CenteredNote>

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Breadcrumbs items={[
        { label: 'Chillverse', onClick: () => navigate('/support') },
        { label: 'Feedback', onClick: () => navigate('/support/feedback') },
        { label: post.topic_name, onClick: () => navigate(`/support/feedback/${post.topic_slug}`) },
        { label: post.title },
      ]} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <VoteButton
          postId={post.id}
          voteCount={post.vote_count}
          hasVoted={post.has_voted}
          size="lg"
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={160}
              style={{
                width: '100%', fontSize: 20, fontWeight: 800, color: 'var(--text)',
                background: 'var(--surface)', border: '1px solid var(--border-strong)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 10,
              }}
            />
          ) : (
            <h1 style={{
              margin: '0 0 8px', fontSize: 'clamp(1.4rem, 4vw, 2rem)', lineHeight: 1.2,
              fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)',
            }}>
              {post.title}
            </h1>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
              {post.author_username ?? 'Deleted user'} · {relativeTime(post.created_at)}
              {post.edited_at ? ' · Edited' : ''}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: FEEDBACK_STATUS_COLORS[post.status],
              border: `1px solid ${FEEDBACK_STATUS_COLORS[post.status]}`,
              borderRadius: 999, padding: '2px 8px',
            }}>
              {FEEDBACK_STATUS_LABELS[post.status]}
            </span>

            {isAuthor && !editing && (
              <button
                type="button"
                className="ripple-wrap"
                onClick={(e) => { ripple(e); startEditing() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '4px 12px',
                }}
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </div>

          {editing ? (
            <>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={10}
                maxLength={8000}
                style={{
                  width: '100%', resize: 'vertical', fontSize: 14.5, lineHeight: 1.65,
                  fontFamily: 'inherit', color: 'var(--text)',
                  background: 'var(--surface)', border: '1px solid var(--border-strong)',
                  borderRadius: 12, padding: '12px 14px',
                }}
              />
              {saveError && (
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--red, #ff5f56)', margin: '8px 0 0' }}>
                  {saveError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="ripple-wrap"
                  onClick={(e) => { ripple(e); void saveEdit() }}
                  disabled={saving}
                  style={{
                    cursor: saving ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 700, color: '#fff',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                    border: 'none', borderRadius: 999, padding: '9px 20px',
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="ripple-wrap"
                  onClick={(e) => { ripple(e); setEditing(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 999, padding: '9px 18px',
                  }}
                >
                  <X size={13} /> Cancel
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {renderLiteMarkdown(post.body)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CenteredNote({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <p style={{
      textAlign: 'center', fontSize: 13.5, fontWeight: 600, padding: '64px 0',
      color: tone === 'error' ? 'var(--red, #ff5f56)' : 'var(--text-muted)',
    }}>
      {children}
    </p>
  )
}
