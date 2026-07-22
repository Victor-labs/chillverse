// src/features/blog/Blog.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Languages, Loader2, Settings2 } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useModRole } from '../moderation/useModRole'
import Seo from '../../shared/components/Seo'
import { fetchBlogPosts, searchBlogPosts, type BlogPostsPage } from './api'
import { BLOG_CATEGORIES, BLOG_LOCALES, BLOG_LOCALE_STORAGE_KEY, BLOG_PAGE_SIZE, getBlogCategoryMeta } from './constants'
import BlogPostCard from './BlogPostCard'
import type { BlogCategory, BlogLocale, BlogPost, BlogSearchResult } from '../../shared/types'

function readStoredLocale(): BlogLocale {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(BLOG_LOCALE_STORAGE_KEY)
  return stored === 'pcm' ? 'pcm' : 'en'
}

export default function Blog() {
  const navigate = useNavigate()
  const { isStaff } = useModRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = (searchParams.get('category') as BlogCategory | null) ?? null

  const [locale, setLocale] = useState<BlogLocale>(readStoredLocale)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BlogSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const isSearching = query.trim().length > 0

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchBlogPosts({ category: activeCategory, locale, offset: 0, limit: BLOG_PAGE_SIZE })
      .then((page: BlogPostsPage) => {
        if (!active) return
        setPosts(page.posts)
        setHasMore(page.hasMore)
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load posts.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeCategory, locale])

  function selectCategory(category: BlogCategory | null) {
    setSearchParams(category ? { category } : {}, { replace: false })
  }

  function loadMore() {
    setLoadingMore(true)
    fetchBlogPosts({ category: activeCategory, locale, offset: posts.length, limit: BLOG_PAGE_SIZE })
      .then((page: BlogPostsPage) => {
        setPosts(prev => [...prev, ...page.posts])
        setHasMore(page.hasMore)
      })
      .catch((err: Error) => setError(err.message || 'Could not load more posts.'))
      .finally(() => setLoadingMore(false))
  }

  function runSearch(next: string) {
    setQuery(next)
    const trimmed = next.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchError(null)
      return
    }
    setSearching(true)
    searchBlogPosts(trimmed, locale)
      .then(results => { setSearchResults(results); setSearchError(null) })
      .catch((err: Error) => setSearchError(err.message || 'Search failed.'))
      .finally(() => setSearching(false))
  }

  function switchLocale(next: BlogLocale) {
    setLocale(next)
    localStorage.setItem(BLOG_LOCALE_STORAGE_KEY, next)
    if (isSearching) runSearch(query)
  }

  const activeCategoryLabel = useMemo(
    () => BLOG_CATEGORIES.find(c => c.slug === activeCategory)?.label ?? null,
    [activeCategory]
  )

  // First post becomes the big featured card, Discord-blog style — but only
  // on the unfiltered "All" view; category tabs and search show a plain grid.
  const showFeatured = !isSearching && !activeCategory && posts.length > 0
  const featured = showFeatured ? posts[0] : null
  const rest = showFeatured ? posts.slice(1) : posts

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Seo
        title="Blog"
        description="Updates, community spotlights, and everything happening on Chillverse."
        path="/blog"
      />

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 36px' }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          The Chillverse Blog
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
          Patch notes, community spotlights, and dev diaries — straight from the team building Chillverse.
        </p>
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search posts…"
            style={{
              width: '100%', padding: '11px 14px 11px 38px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              fontSize: 13.5, outline: 'none',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => runSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isStaff && (
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/blog/admin') }}
              className="ripple-wrap"
              title="Manage posts"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
              }}
            >
              <Settings2 size={13} /> Manage
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
            <Languages size={13} color="var(--text-muted)" style={{ marginLeft: 6 }} />
            {BLOG_LOCALES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={(e) => { ripple(e); switchLocale(l.code) }}
                className="ripple-wrap"
                style={{
                  fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                  color: locale === l.code ? '#fff' : 'var(--text-dim)',
                  background: locale === l.code ? 'var(--accent)' : 'transparent',
                }}
                title={l.label}
              >
                {l.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 28, paddingBottom: 2 }}>
          <button type="button" onClick={(e) => { ripple(e); selectCategory(null) }} className="ripple-wrap" style={tabStyle(activeCategory === null)}>
            All
          </button>
          {BLOG_CATEGORIES.map(cat => (
            <button key={cat.slug} type="button" onClick={(e) => { ripple(e); selectCategory(cat.slug) }} className="ripple-wrap" style={tabStyle(activeCategory === cat.slug)}>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {error && <div style={errorBoxStyle}>{error}</div>}

      {isSearching ? (
        <>
          <SectionLabel>{searching ? 'Searching…' : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'} for "${query}"`}</SectionLabel>
          {searchError && <div style={errorBoxStyle}>{searchError}</div>}
          {!searching && !searchError && searchResults.length === 0 && <EmptyState text="No posts matched your search." />}
          <div style={gridStyle}>
            {searchResults.map(post => <BlogPostCard key={post.id} post={post} />)}
          </div>
        </>
      ) : (
        <>
          {activeCategoryLabel && <SectionLabel>{activeCategoryLabel}</SectionLabel>}
          {loading ? (
            <EmptyState text="Loading posts…" />
          ) : posts.length === 0 ? (
            <EmptyState text="No posts here yet — check back soon." />
          ) : (
            <>
              {featured && <FeaturedPost post={featured} />}
              <div style={gridStyle}>
                {rest.map(post => <BlogPostCard key={post.id} post={post} />)}
              </div>
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={(e) => { ripple(e); loadMore() }}
                    disabled={loadingMore}
                    className="ripple-wrap"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: loadingMore ? 'default' : 'pointer',
                      fontSize: 13, fontWeight: 700, color: 'var(--text)',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999,
                      padding: '10px 22px', opacity: loadingMore ? 0.7 : 1,
                    }}
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                    {loadingMore ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function FeaturedPost({ post }: { post: BlogPost }) {
  const navigate = useNavigate()
  const meta = getBlogCategoryMeta(post.category)
  const Icon = meta.icon
  const publishedLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/blog/${post.slug}`) }}
      className="ripple-wrap"
      style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 0,
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 28,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
        overflow: 'hidden', boxShadow: 'var(--elev-raise)',
      }}
    >
      <div style={{ padding: '28px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content',
          fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          borderRadius: 999, padding: '4px 10px',
        }}>
          <Icon size={12} /> {meta.label}
        </span>
        <h2 style={{ fontSize: 'clamp(19px, 2.4vw, 26px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.25, margin: 0 }}>
          {post.title}
        </h2>
        {post.excerpt && (
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>{post.excerpt}</p>
        )}
        {publishedLabel && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{publishedLabel}</span>}
      </div>
      <div style={{ minHeight: 220, background: 'var(--surface2)' }}>
        {post.hero_image_url && (
          <img src={post.hero_image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13.5 }}>{text}</div>
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
    padding: '9px 16px', borderRadius: 999,
    color: active ? '#fff' : 'var(--text-dim)',
    background: active ? 'var(--accent)' : 'var(--surface)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  }
}

const gridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16,
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 20,
}
