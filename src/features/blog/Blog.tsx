// src/features/blog/Blog.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Newspaper, Languages, Loader2, Settings2 } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useModRole } from '../moderation/useModRole'
import { fetchBlogPosts, searchBlogPosts, type BlogPostsPage } from './api'
import { BLOG_CATEGORIES, BLOG_LOCALES, BLOG_LOCALE_STORAGE_KEY, BLOG_PAGE_SIZE } from './constants'
import BlogPostCard from './BlogPostCard'
import type { BlogCategory, BlogLocale, BlogPost, BlogSearchResult } from '../../shared/types'

function readStoredLocale(): BlogLocale {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(BLOG_LOCALE_STORAGE_KEY)
  return stored === 'pcm' ? 'pcm' : 'en'
}

export default function Blog() {
  const navigate = useNavigate()
  const { isAdmin } = useModRole()
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

  // ── Load first page whenever category or locale changes ──
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
      .catch((err: Error) => {
        if (!active) return
        setError(err.message || 'Could not load posts.')
      })
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
    // Re-running search under the new locale keeps results consistent with the toggle.
    if (isSearching) runSearch(query)
  }

  const activeCategoryLabel = useMemo(
    () => BLOG_CATEGORIES.find(c => c.slug === activeCategory)?.label ?? null,
    [activeCategory]
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          }}>
            <Newspaper size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Blog</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Updates, spotlights, and everything Chillverse</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => { ripple(e); navigate('/blog/admin') }}
              className="ripple-wrap"
              title="Manage posts"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}
            >
              <Settings2 size={14} color="var(--text-dim)" />
            </button>
          )}

          {/* Language switcher */}
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

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
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

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 22, paddingBottom: 2 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); selectCategory(null) }}
            className="ripple-wrap"
            style={tabStyle(activeCategory === null)}
          >
            All
          </button>
          {BLOG_CATEGORIES.map(cat => (
            <button
              key={cat.slug}
              type="button"
              onClick={(e) => { ripple(e); selectCategory(cat.slug) }}
              className="ripple-wrap"
              style={tabStyle(activeCategory === cat.slug)}
            >
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
          {!searching && !searchError && searchResults.length === 0 && (
            <EmptyState text="No posts matched your search." />
          )}
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
              <div style={gridStyle}>
                {posts.map(post => <BlogPostCard key={post.id} post={post} />)}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13.5 }}>
      {text}
    </div>
  )
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
