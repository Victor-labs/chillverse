// src/features/blog/BlogSeriesPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Layers } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { fetchPostsBySeries } from './api'
import { getBlogCategoryMeta, getSeriesLabel } from './constants'
import type { BlogPost } from '../../shared/types'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function BlogSeriesPage() {
  const { series } = useParams<{ series: string }>()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!series) return
    let active = true
    setLoading(true)
    fetchPostsBySeries(series)
      .then(rows => { if (active) { setPosts(rows); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load this series.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [series])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/blog') }}
        className="ripple-wrap"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 18,
        }}
      >
        <ChevronLeft size={15} /> Back to Blog
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface2)',
        }}>
          <Layers size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {series ? getSeriesLabel(series) : 'Series'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {posts.length} post{posts.length === 1 ? '' : 's'} in this series
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
          padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>
          No posts in this series yet.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 20 }}>
          <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
          {posts.map(post => {
            const meta = getBlogCategoryMeta(post.category)
            return (
              <button
                key={post.id}
                type="button"
                onClick={(e) => { ripple(e); navigate(`/blog/${post.slug}`) }}
                className="ripple-wrap"
                style={{
                  position: 'relative', display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                  padding: '14px 16px', marginBottom: 14, boxShadow: 'var(--elev-raise-sm)',
                }}
              >
                <div style={{
                  position: 'absolute', left: -20.5, top: 20, width: 11, height: 11, borderRadius: '50%',
                  background: meta.color, border: '2px solid var(--bg)',
                }} />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>{formatDate(post.published_at)}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{post.title}</div>
                {post.excerpt && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>{post.excerpt}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
