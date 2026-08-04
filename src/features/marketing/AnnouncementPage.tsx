// src/features/marketing/AnnouncementPage.tsx
// Public reader for a single staff announcement, linked from the
// /editorial-room "Updates & Announcements" cards. Lives under the same
// public BlogLayout chrome as /blog — reachable and readable by anyone,
// signed in or not, same as a blog post. Announcements normally only ever
// show up inside the app's Feed (behind auth); this page is what lets an
// anonymous visitor tap one from the Editorial Room and actually read it,
// instead of getting bounced to a login wall.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ImageOff, Sparkles, ChevronDown } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchPostById } from '../posts/posts'
import PostBody from '../posts/PostBody'
import { summarizeAnnouncement } from './announcementSummary'
import type { Post } from '../posts/types'

export default function AnnouncementPage() {
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => {
    if (!postId) return
    let active = true
    setLoading(true)
    setNotFound(false)
    setShowSummary(false)

    fetchPostById(postId, user?.id ?? null)
      .then(found => {
        if (!active) return
        // Only staff announcements belong on this public reader — a random
        // user post id shouldn't be viewable here even if guessed.
        if (!found || !['admin', 'system'].includes(found.author_type)) {
          setNotFound(true)
          return
        }
        setPost(found)
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [postId, user?.id])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (notFound || !post) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <BackLink />
        <div style={errorBoxStyle}>This announcement could not be found.</div>
      </div>
    )
  }

  const publishedLabel = new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const { isFullBody, summary } = summarizeAnnouncement(post.body)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <BackLink />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
          borderRadius: 999, padding: '4px 10px',
        }}>
          Announcement
        </span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>
        {/* Prefer the real headline (migration 0101); falls back to a body
            slice for older announcements posted before titles existed. */}
        {post.title || (post.body.length > 90 ? `${post.body.slice(0, 90).trim()}…` : post.body)}
      </h1>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{publishedLabel}</div>

      <div style={{
        width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', marginBottom: 22,
        background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {post.media_url ? (
          <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageOff size={28} color="var(--text-muted)" />
        )}
      </div>

      {/* Quick summary — auto-generated from the announcement text itself
          (see announcementSummary.ts), collapsed behind a button rather
          than always shown, since not every reader wants the condensed
          version before the real thing. Skipped entirely when the post is
          already short (the summary would just repeat the full body). */}
      {!isFullBody && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); setShowSummary(s => !s) }}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: showSummary ? '16px 16px 0 0' : 16, padding: '14px 20px', cursor: 'pointer',
            }}
          >
            <Sparkles size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--text)', flex: 1, textAlign: 'left',
            }}>
              Quick summary
            </span>
            <ChevronDown
              size={16}
              color="var(--text-muted)"
              style={{ transform: showSummary ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
            />
          </button>
          {showSummary && (
            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderTop: 'none',
              borderRadius: '0 0 16px 16px', padding: '4px 20px 18px',
            }}>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{summary}</p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
          Full announcement
        </div>
        <PostBody body={post.body} />
      </div>
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate('/editorial-room') }}
      className="ripple-wrap"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
        fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 18,
        background: 'transparent', border: 'none', padding: 0,
      }}
    >
      <ChevronLeft size={15} /> Editorial Room
    </button>
  )
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 24,
}
