// src/features/support/Support.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, LifeBuoy, MessageSquarePlus, TicketCheck, Eye } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { fetchSupportCategoriesWithCounts, fetchPopularArticles, searchSupportArticles } from './api'
import { getSupportCategoryIcon } from './constants'
import type { SupportCategoryWithCount, SupportArticle, SupportArticleSearchResult } from '../../shared/types'
import SupportSearchBar from './components/SupportSearchBar'

export default function Support() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [categories, setCategories] = useState<SupportCategoryWithCount[]>([])
  const [popularArticles, setPopularArticles] = useState<SupportArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [query, setQuery] = useState(initialQuery)
  const [searchResults, setSearchResults] = useState<SupportArticleSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([fetchSupportCategoriesWithCounts(), fetchPopularArticles(6)])
      .then(([cats, popular]) => {
        if (!active) return
        setCategories(cats)
        setPopularArticles(popular)
        setLoadError(null)
      })
      .catch((err: Error) => {
        if (!active) return
        setLoadError(err.message || 'Could not load the support center.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!initialQuery) return
    runSearch(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryById = useMemo(() => {
    const map = new Map<string, SupportCategoryWithCount>()
    categories.forEach(c => map.set(c.id, c))
    return map
  }, [categories])

  function runSearch(next: string) {
    setQuery(next)
    setSearchParams(next ? { q: next } : {}, { replace: true })

    const trimmed = next.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    setSearching(true)
    searchSupportArticles(trimmed)
      .then(results => {
        setSearchResults(results)
        setSearchError(null)
      })
      .catch((err: Error) => setSearchError(err.message || 'Search failed.'))
      .finally(() => setSearching(false))
  }

  function goToArticle(categoryId: string, articleSlug: string) {
    const category = categoryById.get(categoryId)
    if (!category) return
    navigate(`/support/${category.slug}/${articleSlug}`)
  }

  function articleCountLabel(count: number): string {
    return `${count} article${count === 1 ? '' : 's'}`
  }

  const isSearching = query.trim().length > 0

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 35%, transparent)',
          }}
        >
          <LifeBuoy size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>
          Search for answers or browse by topic
        </h1>
        <SupportSearchBar
          initialValue={initialQuery}
          onSearch={runSearch}
          placeholder="Search for articles…"
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/support/tickets/new') }}
          className="ripple-wrap"
          style={quickActionStyle}
        >
          <MessageSquarePlus size={18} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Contact support</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Submit a ticket to our team</div>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/support/tickets') }}
          className="ripple-wrap"
          style={quickActionStyle}
        >
          <TicketCheck size={18} color="var(--blue)" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>My tickets</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Track requests you've submitted</div>
          </div>
        </button>
      </div>

      {loadError && (
        <div style={errorBoxStyle}>{loadError}</div>
      )}

      {isSearching ? (
        <SearchResultsList
          query={query}
          results={searchResults}
          loading={searching}
          error={searchError}
          onSelect={goToArticle}
        />
      ) : (
        <>
          {/* Categories — one card per topic, showing its published article count */}
          {!loading && categories.length > 0 && (
            <>
              <SectionTitle>All Collections</SectionTitle>
              <div style={{ marginBottom: 28 }}>
                {categories.map(category => {
                  const Icon = getSupportCategoryIcon(category.icon)
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={(e) => { ripple(e); navigate(`/support/${category.slug}`) }}
                      className="ripple-wrap"
                      style={categoryCardStyle}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)',
                      }}>
                        <Icon size={19} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{category.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {articleCountLabel(category.article_count)}
                        </div>
                      </div>
                      <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Popular articles */}
          {!loading && popularArticles.length > 0 && (
            <>
              <SectionTitle>Popular articles</SectionTitle>
              <div style={{ marginBottom: 12 }}>
                {popularArticles.map(article => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={(e) => { ripple(e); goToArticle(article.category_id, article.slug) }}
                    className="ripple-wrap"
                    style={articleRowStyle}
                  >
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{article.title}</div>
                      {article.summary && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{article.summary}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      <Eye size={12} /> {article.view_count}
                    </div>
                    <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>
              Loading help center…
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SearchResultsList({
  query, results, loading, error, onSelect,
}: {
  query: string
  results: SupportArticleSearchResult[]
  loading: boolean
  error: string | null
  onSelect: (categoryId: string, slug: string) => void
}) {
  return (
    <div>
      <SectionTitle>{loading ? 'Searching…' : `Results for "${query}"`}</SectionTitle>
      {error && <div style={errorBoxStyle}>{error}</div>}
      {!loading && !error && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>
          No articles matched your search. Try different words, or contact support directly.
        </div>
      )}
      {!loading && results.map(article => (
        <button
          key={article.id}
          type="button"
          onClick={(e) => { ripple(e); onSelect(article.category_id, article.slug) }}
          className="ripple-wrap"
          style={articleRowStyle}
        >
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{article.title}</div>
            {article.summary && (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{article.summary}</div>
            )}
          </div>
          <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        </button>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  )
}

const quickActionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '14px 16px', boxShadow: 'var(--elev-raise-sm)',
}

const categoryCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '14px 16px', marginBottom: 9,
  boxShadow: 'var(--elev-raise-sm)',
}

const articleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '14px 16px', marginBottom: 9,
  boxShadow: 'var(--elev-raise-sm)',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 20,
}
