// src/features/blog/BlogPostPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ImageOff, Languages } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { fetchBlogPostBySlug, fetchRelatedPosts, fetchTranslationCounterpart } from './api'
import { getBlogCategoryMeta, getSeriesLabel, BLOG_LOCALES, BLOG_LOCALE_STORAGE_KEY } from './constants'
import BlogPostCard from './BlogPostCard'
import type { BlogPost } from '../../shared/types'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [related, setRelated] = useState<BlogPost[]>([])
  const [translation, setTranslation] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    setError(null)

    fetchBlogPostBySlug(slug)
      .then(async found => {
        if (!active) return
        if (!found) {
          setError('This post could not be found.')
          return
        }
        setPost(found)

        const relatedPromise = fetchRelatedPosts(found, 3)
        const translationPromise = found.translation_group_id
          ? fetchTranslationCounterpart(
              found.translation_group_id,
              found.locale === 'en' ? 'pcm' : 'en',
              found.id
            )
          : Promise.resolve(null)

        const [relatedPosts, translationPost] = await Promise.all([relatedPromise, translationPromise])
        if (!active) return
        setRelated(relatedPosts)
        setTranslation(translationPost)
      })
      .catch((err: Error) => {
        if (!active) return
        setError(err.message || 'This post could not be found.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [slug])

  function goToTranslation() {
    if (!translation) return
    localStorage.setItem(BLOG_LOCALE_STORAGE_KEY, translation.locale)
    navigate(`/blog/${translation.slug}`)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (error || !post) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <BackLink />
        <div style={errorBoxStyle}>{error || 'This post could not be found.'}</div>
      </div>
    )
  }

  const meta = getBlogCategoryMeta(post.category)
  const Icon = meta.icon
  const paragraphs = post.content.split(/\n\s*\n/).filter(Boolean)
  const publishedLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <BackLink />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate(`/blog?category=${post.category}`) }}
          className="ripple-wrap"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
            borderRadius: 999, padding: '4px 10px',
          }}
        >
          <Icon size={11} /> {meta.label}
        </button>
        {post.series && (
          <button
            type="button"
            onClick={(e) => { ripple(e); navigate(`/blog/series/${post.series}`) }}
            className="ripple-wrap"
            style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer',
              background: 'var(--surface2)', borderRadius: 999, padding: '4px 10px',
            }}
          >
            {getSeriesLabel(post.series)}
          </button>
        )}
        {translation && (
          <button
            type="button"
            onClick={(e) => { ripple(e); goToTranslation() }}
            className="ripple-wrap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)',
              background: 'var(--surface2)', borderRadius: 999, padding: '4px 10px',
            }}
          >
            <Languages size={11} />
            {BLOG_LOCALES.find(l => l.code === translation.locale)?.label ?? 'Translation'}
          </button>
        )}
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.25, marginBottom: 8 }}>
        {post.title}
      </h1>
      {publishedLabel && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{publishedLabel}</div>
      )}

      <div style={{
        width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', marginBottom: 22,
        background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {post.hero_image_url ? (
          <img src={post.hero_image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageOff size={28} color="var(--text-muted)" />
        )}
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        padding: '22px 24px', marginBottom: 24, boxShadow: 'var(--elev-raise-sm)',
      }}>
        {paragraphs.map((para, i) => (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: i === paragraphs.length - 1 ? 0 : 16 }}>
            {para}
          </p>
        ))}
      </div>

      {post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '4px 10px',
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 14 }}>
            Explore Further
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {related.map(r => <BlogPostCard key={r.id} post={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
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
  )
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13,
}
