// src/features/blog/admin/BlogDashboardTab.tsx
import { useEffect, useState } from 'react'
import { FileText, CheckCircle2, PenLine, CalendarClock, Plus } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { fetchBlogDashboardStats, type BlogDashboardStats } from '../api'
import type { BlogPost } from '../../../shared/types'
import { statusBadgeStyle, statusMeta } from './styles'

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof FileText; label: string; value: number; tint: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${tint}22`, color: tint, flexShrink: 0,
        }}>
          <Icon size={14} />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

export default function BlogDashboardTab({ onCreate, onOpenPost }: { onCreate: () => void; onOpenPost: (post: BlogPost) => void }) {
  const [stats, setStats] = useState<BlogDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBlogDashboardStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message || 'Could not load dashboard stats.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: '#ff8080', fontSize: 13.5 }}>{error}</div>
  if (!stats) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Overview</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 0' }}>What's happening across the blog.</p>
        </div>
        <button
          type="button"
          onClick={(e) => { ripple(e); onCreate() }}
          className="ripple-wrap"
          style={{
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 16px',
          }}
        >
          <Plus size={14} /> Create Article
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 26 }}>
        <StatCard icon={FileText} label="Total articles" value={stats.total} tint="var(--accent)" />
        <StatCard icon={CheckCircle2} label="Published" value={stats.published} tint="var(--green)" />
        <StatCard icon={PenLine} label="Drafts" value={stats.drafts} tint="var(--text-muted)" />
        <StatCard icon={CalendarClock} label="Scheduled" value={stats.scheduled} tint="#4C8EF5" />
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>Recently edited</h3>
      {stats.recentlyEdited.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No articles yet — create your first one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.recentlyEdited.map(post => (
            <button
              key={post.id}
              type="button"
              onClick={(e) => { ripple(e); onOpenPost(post) }}
              className="ripple-wrap"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px',
              }}
            >
              {post.hero_image_url ? (
                <img src={post.hero_image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '2px 0 0' }}>
                  Edited {new Date(post.updated_at).toLocaleDateString()} · {statusMeta(post.status).label}
                </p>
              </div>
              <span style={statusBadgeStyle(post.status)}>{statusMeta(post.status).label}</span>
            </button>
          ))}
        </div>
      )}

      {(stats.scheduled > 0 || stats.archived > 0) && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 16 }}>
          {stats.archived} archived {stats.archived === 1 ? 'article' : 'articles'} — head to Articles and filter by "Archived" to restore one.
        </p>
      )}
    </div>
  )
}
