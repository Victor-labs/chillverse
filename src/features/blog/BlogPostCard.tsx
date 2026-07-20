// src/features/blog/BlogPostCard.tsx
import { useNavigate } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { getBlogCategoryMeta, getSeriesLabel } from './constants'
import type { BlogPost, BlogSearchResult } from '../../shared/types'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BlogPostCard({ post }: { post: BlogPost | BlogSearchResult }) {
  const navigate = useNavigate()
  const meta = getBlogCategoryMeta(post.category)
  const Icon = meta.icon

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/blog/${post.slug}`) }}
      className="ripple-wrap"
      style={{
        display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        overflow: 'hidden', boxShadow: 'var(--elev-raise-sm)', width: '100%', padding: 0,
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '16 / 9', background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {post.hero_image_url ? (
          <img
            src={post.hero_image_url}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <ImageOff size={22} color="var(--text-muted)" />
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
            borderRadius: 999, padding: '3px 8px',
          }}>
            <Icon size={11} /> {meta.label}
          </span>
          {post.series && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
              background: 'var(--surface2)', borderRadius: 999, padding: '3px 8px',
            }}>
              {getSeriesLabel(post.series)}
            </span>
          )}
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, margin: 0 }}>
          {post.title}
        </h3>

        {post.excerpt && (
          <p style={{
            fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.excerpt}
          </p>
        )}

        {'published_at' in post && post.published_at && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {formatDate(post.published_at)}
          </span>
        )}
      </div>
    </button>
  )
}
