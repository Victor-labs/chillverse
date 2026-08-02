// src/features/marketing/EditorialRoom.tsx
// Public "Editorial room" hub — reachable by anyone, signed in or not,
// under the same public BlogLayout chrome as /blog (see App.tsx routing).
// Unlike /blog, nothing here is hand-authored: every section pulls live
// from existing data (staff announcements, published blog posts, and the
// public stats RPC) so the page updates itself as content is posted
// elsewhere in the app.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ImageOff } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import Seo from '../../shared/components/Seo'
import { fetchAnnouncements } from '../posts/staffPosts'
import { fetchBlogPosts } from '../blog/api'
import { fetchEditorialRoomStats, type EditorialRoomStats } from './editorialStats'
import BlogPostCard from '../blog/BlogPostCard'
import type { Post } from '../posts/types'
import type { BlogPost } from '../../shared/types'

const EDITORIAL_EMAIL = 'editorialroom@chillverse.com.ng'

// Same Supabase-hosted banner art used at the top of the landing page —
// two stacked images, mirroring how discord.com/newsroom opens with a
// trophy + a mascot flanking the page title.
const BANNER = {
  left: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Notes.png',
  right: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/2bbb3717-cfe0-43b1-b0de-47e090719790_20260801_152932_0000.png',
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M+`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K+`
  return `${n}`
}

export default function EditorialRoom() {
  const { session } = useAuth()

  const [announcements, setAnnouncements] = useState<Post[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [loadingBlog, setLoadingBlog] = useState(true)

  const [stats, setStats] = useState<EditorialRoomStats | null>(null)

  useEffect(() => {
    let active = true
    fetchAnnouncements(session?.user.id ?? null, 3)
      .then(posts => { if (active) setAnnouncements(posts) })
      .finally(() => { if (active) setLoadingAnnouncements(false) })
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    let active = true
    fetchBlogPosts({ locale: 'en', offset: 0, limit: 3 })
      .then(page => { if (active) setBlogPosts(page.posts) })
      .finally(() => { if (active) setLoadingBlog(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetchEditorialRoomStats().then(s => { if (active) setStats(s) })
    return () => { active = false }
  }, [])

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <Seo
        title="Editorial Room"
        description="See the latest announcements and updates from Chillverse."
        path="/editorial-room"
      />

      {/* ── Banner ── two images stacked at the top, Discord-newsroom style ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px, 4vw, 32px)', marginBottom: 8 }}>
        <img src={BANNER.left} alt="" style={{ width: 'clamp(64px, 14vw, 120px)', height: 'auto' }} />
        <img src={BANNER.right} alt="" style={{ width: 'clamp(64px, 14vw, 120px)', height: 'auto' }} />
      </div>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', maxWidth: 760, margin: '8px auto 56px' }}>
        <h1
          style={{
            fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 800, color: 'var(--text)',
            margin: '0 0 14px', letterSpacing: '0.02em', lineHeight: 1.05, textTransform: 'uppercase',
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          Editorial Room
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', margin: 0 }}>
          See the latest announcements and updates from Chillverse.
        </p>
      </div>

      {/* ── Updates & Announcements ── */}
      <SectionLabel>Updates &amp; Announcements</SectionLabel>
      {loadingAnnouncements ? (
        <EmptyState text="Loading announcements…" />
      ) : announcements.length === 0 ? (
        <EmptyState text="No announcements yet — check back soon." />
      ) : (
        <div className="editorial-grid" style={{ marginBottom: 72 }}>
          {announcements.map(post => <AnnouncementCard key={post.id} post={post} />)}
        </div>
      )}

      {/* ── The Stats ── */}
      <SectionLabel>The Stats</SectionLabel>
      <div className="editorial-stats-grid" style={{ marginBottom: 72 }}>
        <StatCard value={stats ? formatCompact(stats.activeUsers) : '—'} label="Active Users" />
        <StatCard value={stats ? formatCompact(stats.sessionsPlayed) : '—'} label="Sessions Played" />
        <StatCard value={stats ? formatCompact(stats.gamesPlayed) : '—'} label="Games Played" />
      </div>

      {/* ── Straight from Chillverse Blog ── */}
      <SectionLabel>Straight from Chillverse Blog</SectionLabel>
      {loadingBlog ? (
        <EmptyState text="Loading posts…" />
      ) : blogPosts.length === 0 ? (
        <EmptyState text="No posts here yet — check back soon." />
      ) : (
        <div className="editorial-grid" style={{ marginBottom: 72 }}>
          {blogPosts.map(post => <BlogPostCard key={post.id} post={post} />)}
        </div>
      )}

      {/* ── Reach out to us ── */}
      <div style={{
        textAlign: 'center', padding: '48px 24px', borderRadius: 24,
        background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>
          Reach out to us
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 24px' }}>
          Reach out to our Editorial team for any inquiries.
        </p>
        <a
          href={`mailto:${EDITORIAL_EMAIL}`}
          onClick={(e) => ripple(e)}
          className="ripple-wrap"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 700, color: '#fff', textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            border: 'none', borderRadius: 999, padding: '13px 28px',
          }}
        >
          <Mail size={15} /> Contact
        </a>
      </div>

      <style>{`
        .editorial-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
        }
        @media (min-width: 640px) {
          .editorial-grid { grid-template-columns: repeat(2, 1fr); gap: 32px 24px; }
        }
        @media (min-width: 1000px) {
          .editorial-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .editorial-stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .editorial-stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 22 }}>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 14, marginBottom: 72 }}>{text}</div>
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      borderRadius: 20, padding: '28px 24px',
      background: 'linear-gradient(180deg, var(--accent-soft), transparent)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 900, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function AnnouncementCard({ post }: { post: Post }) {
  const navigate = useNavigate()
  const publishedLabel = new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const excerpt = post.body.length > 140 ? `${post.body.slice(0, 140).trim()}…` : post.body

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/editorial-room/announcement/${post.id}`) }}
      className="ripple-wrap"
      style={{
        display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer',
        background: 'transparent', border: 'none', padding: 0, width: '100%',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '2 / 1', borderRadius: 14, background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14,
      }}>
        {post.media_url ? (
          <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <ImageOff size={22} color="var(--text-muted)" />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Announcement</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{publishedLabel}</span>
      </div>

      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
        {excerpt}
      </p>
    </button>
  )
}
