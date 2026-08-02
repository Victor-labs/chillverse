// src/features/blog/BlogPostCard.tsx
import { useNavigate } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { getBlogCategoryMeta, getSeriesLabel } from './constants'
import type { BlogPost, BlogSearchResult } from '../../shared/types'

export default function BlogPostCard({ post }: { post: BlogPost | BlogSearchResult }) {
  const navigate = useNavigate()
  const meta = getBlogCategoryMeta(post.category)

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/blog/${post.slug}`) }}
      className="ripple-wrap"
      style={{
        display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer',
        background: 'transparent', border: 'none', padding: 0, width: '100%',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '16 / 9', borderRadius: 14, background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{meta.label}</span>
        {post.series && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{getSeriesLabel(post.series)}</span>
          </>
        )}
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, margin: 0 }}>
        {post.title}
      </h3>
    </button>
  )
}
