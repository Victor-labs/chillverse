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

  // The most recent post becomes a big stacked hero — but only on the
  // unfiltered "All" view; category tabs and search show a plain grid.
  const showFeatured = !isSearching && !activeCategory && posts.length > 0
  const featured = showFeatured ? posts[0] : null
  const rest = showFeatured ? posts.slice(1) : posts

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <Seo
        title="Blog"
        description="Updates, community spotlights, and everything happening on Chillverse."
        path="/blog"
      />

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', maxWidth: 760, margin: '8px auto 32px' }}>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          Chillverse Blog
        </h1>
      </div>

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
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

      {/* ── Controls row (below tabs) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search posts…"
            style={{
              width: '100%', padding: '13px 16px 13px 42px', borderRadius: 14,
              background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
              fontSize: 14, outline: 'none',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => runSearch('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isStaff && (
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/blog/admin') }}
              className="ripple-wrap"
              title="Manage posts"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: 'var(--text-dim)',
                background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px',
              }}
            >
              <Settings2 size={14} /> Manage
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 999, padding: 4 }}>
            <Languages size={14} color="var(--text-muted)" style={{ marginLeft: 8 }} />
            {BLOG_LOCALES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={(e) => { ripple(e); switchLocale(l.code) }}
                className="ripple-wrap"
                style={{
                  fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
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
              {rest.length > 0 && <SectionLabel>{showFeatured ? 'More from Chillverse' : 'Latest'}</SectionLabel>}
              <div style={gridStyle}>
                {rest.map(post => <BlogPostCard key={post.id} post={post} />)}
              </div>
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36 }}>
                  <button
                    type="button"
                    onClick={(e) => { ripple(e); loadMore() }}
                    disabled={loadingMore}
                    className="ripple-wrap"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: loadingMore ? 'default' : 'pointer',
                      fontSize: 13.5, fontWeight: 700, color: 'var(--text)',
                      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 999,
                      padding: '12px 26px', opacity: loadingMore ? 0.7 : 1,
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

// Stacked hero article — full-width image on top, then category/title/excerpt
// below it, left-aligned. Deliberately no card box/border around it: it's
// meant to read as the page's lead story, not one tile among many.
function FeaturedPost({ post }: { post: BlogPost }) {
  const navigate = useNavigate()
  const meta = getBlogCategoryMeta(post.category)
  const publishedLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/blog/${post.slug}`) }}
      className="ripple-wrap"
      style={{
        display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'transparent', border: 'none', padding: 0, marginBottom: 64,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '21 / 9', borderRadius: 24, overflow: 'hidden', background: 'var(--surface2)', marginBottom: 28 }}>
        {post.hero_image_url && (
          <img src={post.hero_image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{meta.label}</span>
          {publishedLabel && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{publishedLabel}</span>
            </>
          )}
        </div>
        <h2 style={{ fontSize: 'clamp(24px, 3.4vw, 36px)', fontWeight: 900, color: 'var(--text)', lineHeight: 1.15, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          {post.title}
        </h2>
        {post.excerpt && (
          <p style={{ fontSize: 15.5, color: 'var(--text-dim)', lineHeight: 1.65, margin: 0 }}>{post.excerpt}</p>
        )}
      </div>
    </button>
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
  return <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-dim)', fontSize: 14 }}>{text}</div>
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
    padding: '8px 14px', borderRadius: 999,
    color: active ? '#fff' : 'var(--text-dim)',
    background: active ? 'var(--accent)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  }
}

const gridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '40px 32px', marginBottom: 24,
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 24,
}
