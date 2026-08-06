// src/features/support/feedback/FeedbackTopic.tsx
// One topic's post list — the equivalent of a Discord community topic page,
// with the votes column pulled out to the right of each row.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MessageSquarePlus } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import Breadcrumbs from '../components/Breadcrumbs'
import { SupportDisplayHeading } from '../../../layout/SupportLayout'
import VoteButton from './VoteButton'
import { fetchFeedbackPosts, fetchFeedbackTopics } from './api'
import { FEEDBACK_SORT_LABELS, FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, relativeTime } from './constants'
import type {
  SupportFeedbackPost,
  SupportFeedbackSort,
  SupportFeedbackStatus,
  SupportFeedbackTopic as TopicRow,
} from '../../../shared/types'

const PAGE_SIZE = 20

function parseSort(raw: string | null): SupportFeedbackSort {
  return raw === 'top' || raw === 'oldest' ? raw : 'newest'
}

function parseStatus(raw: string | null): SupportFeedbackStatus | null {
  const allowed: SupportFeedbackStatus[] = ['open', 'planned', 'in_progress', 'completed', 'declined']
  return allowed.includes(raw as SupportFeedbackStatus) ? (raw as SupportFeedbackStatus) : null
}

export default function FeedbackTopic() {
  const { topicSlug } = useParams<{ topicSlug: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const sort = parseSort(searchParams.get('sort'))
  const status = parseStatus(searchParams.get('status'))

  const [topic, setTopic] = useState<TopicRow | null>(null)
  const [posts, setPosts] = useState<SupportFeedbackPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The topic list is small and cached-ish; fetching all of them is cheaper
  // than adding a dedicated by-slug RPC for the header's name/description.
  useEffect(() => {
    let active = true
    fetchFeedbackTopics()
      .then(rows => {
        if (!active) return
        setTopic(rows.find(t => t.slug === topicSlug) ?? null)
      })
      .catch(() => { /* header degrades to the slug; the list below is what matters */ })
    return () => { active = false }
  }, [topicSlug])

  useEffect(() => {
    if (!topicSlug) return
    let active = true
    setLoading(true)
    setReachedEnd(false)

    fetchFeedbackPosts({ topicSlug, sort, status, limit: PAGE_SIZE, offset: 0 })
      .then(rows => {
        if (!active) return
        setPosts(rows)
        setReachedEnd(rows.length < PAGE_SIZE)
        setError(null)
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load this topic.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [topicSlug, sort, status])

  const loadMore = useCallback(() => {
    if (!topicSlug || loadingMore || reachedEnd) return
    setLoadingMore(true)
    fetchFeedbackPosts({ topicSlug, sort, status, limit: PAGE_SIZE, offset: posts.length })
      .then(rows => {
        setPosts(prev => [...prev, ...rows])
        if (rows.length < PAGE_SIZE) setReachedEnd(true)
      })
      .catch(() => setReachedEnd(true))
      .finally(() => setLoadingMore(false))
  }, [topicSlug, sort, status, posts.length, loadingMore, reachedEnd])

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Breadcrumbs items={[
          { label: 'Chillverse', onClick: () => navigate('/support') },
          { label: 'Feedback', onClick: () => navigate('/support/feedback') },
          { label: topic?.name ?? topicSlug ?? 'Topic' },
        ]} />
      </div>

      <SupportDisplayHeading>{topic?.name ?? topicSlug}</SupportDisplayHeading>

      {topic?.description && (
        <p style={{
          textAlign: 'center', maxWidth: 520, margin: '-8px auto 24px',
          fontSize: 14, lineHeight: 1.6, color: 'var(--text-dim)',
        }}>
          {topic.description}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          aria-label="Sort posts"
          style={selectStyle}
        >
          {(Object.keys(FEEDBACK_SORT_LABELS) as SupportFeedbackSort[]).map(key => (
            <option key={key} value={key}>{FEEDBACK_SORT_LABELS[key]}</option>
          ))}
        </select>

        <select
          value={status ?? ''}
          onChange={(e) => updateParam('status', e.target.value || null)}
          aria-label="Filter by status"
          style={selectStyle}
        >
          <option value="">Show all</option>
          {(Object.keys(FEEDBACK_STATUS_LABELS) as SupportFeedbackStatus[]).map(key => (
            <option key={key} value={key}>{FEEDBACK_STATUS_LABELS[key]}</option>
          ))}
        </select>

        <button
          type="button"
          className="ripple-wrap"
          onClick={(e) => { ripple(e); navigate(`/support/feedback/new?topic=${topicSlug ?? ''}`) }}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, color: '#fff',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            border: 'none', borderRadius: 999, padding: '9px 18px',
          }}
        >
          <MessageSquarePlus size={14} /> New post
        </button>
      </div>

      {loading && <StatusLine>Loading posts…</StatusLine>}
      {error && <StatusLine tone="error">{error}</StatusLine>}
      {!loading && !error && posts.length === 0 && (
        <StatusLine>No suggestions here yet — be the first to post one.</StatusLine>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {posts.map(post => (
          <div
            key={post.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/support/feedback/post/${post.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/support/feedback/post/${post.id}`) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              padding: '16px 4px', borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4,
              }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {post.title}
                </span>
                {post.status !== 'open' && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: FEEDBACK_STATUS_COLORS[post.status],
                    border: `1px solid ${FEEDBACK_STATUS_COLORS[post.status]}`,
                    borderRadius: 999, padding: '2px 8px',
                  }}>
                    {FEEDBACK_STATUS_LABELS[post.status]}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                {post.author_username ?? 'Deleted user'} · {relativeTime(post.created_at)}
                {post.edited_at ? ' · Edited' : ''}
              </span>
            </div>

            <VoteButton
              postId={post.id}
              voteCount={post.vote_count}
              hasVoted={post.has_voted}
            />
          </div>
        ))}
      </div>

      {!loading && !reachedEnd && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button
            type="button"
            className="ripple-wrap"
            onClick={(e) => { ripple(e); loadMore() }}
            disabled={loadingMore}
            style={{
              cursor: loadingMore ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 700,
              color: 'var(--text)', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 999, padding: '10px 22px',
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 999, padding: '9px 14px', cursor: 'pointer',
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
