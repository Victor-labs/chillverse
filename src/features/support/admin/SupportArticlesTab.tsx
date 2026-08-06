// src/features/support/admin/SupportArticlesTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import {
  inputStyle, rowStyle, iconButtonStyle, primaryButtonStyle, errorBoxStyle,
} from '../../blog/admin/styles'
import { fetchAllArticles, fetchAllCategories, updateArticle, deleteArticle } from './api'
import type { SupportArticle, SupportCategory } from '../../../shared/types'

interface Props {
  isAdmin: boolean
  refreshToken: number
  onCreate: () => void
  onEdit: (article: SupportArticle) => void
}

export default function SupportArticlesTab({ isAdmin, refreshToken, onCreate, onEdit }: Props) {
  const [articles, setArticles] = useState<SupportArticle[]>([])
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'published' | 'draft'>('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([fetchAllArticles(), fetchAllCategories()])
      .then(([rows, cats]) => {
        if (!active) return
        setArticles(rows)
        setCategories(cats)
        setError(null)
      })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load articles.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [refreshToken])

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter(a => {
      if (categoryFilter && a.category_id !== categoryFilter) return false
      if (statusFilter === 'published' && !a.is_published) return false
      if (statusFilter === 'draft' && a.is_published) return false
      if (q && !a.title.toLowerCase().includes(q) && !a.slug.toLowerCase().includes(q)) return false
      return true
    })
  }, [articles, query, categoryFilter, statusFilter])

  async function togglePublished(article: SupportArticle) {
    setBusyId(article.id)
    try {
      const next = await updateArticle(article.id, { is_published: !article.is_published })
      setArticles(prev => prev.map(a => (a.id === article.id ? next : a)))
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Could not update that article.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(article: SupportArticle) {
    // Articles are indexed by search engines once live, so deleting a
    // published one breaks real inbound links — worth spelling out.
    const warning = article.is_published
      ? `Delete "${article.title}"? It's published, so any search result or link pointing to it will start 404ing.`
      : `Delete the draft "${article.title}"? This can't be undone.`
    if (!window.confirm(warning)) return

    setBusyId(article.id)
    try {
      await deleteArticle(article.id)
      setArticles(prev => prev.filter(a => a.id !== article.id))
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Could not delete that article.')
    } finally {
      setBusyId(null)
    }
  }

  const draftCount = articles.filter(a => !a.is_published).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or slug…"
          style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'published' | 'draft')}
          style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
        <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); onCreate() }} style={primaryButtonStyle}>
          <Plus size={14} /> New article
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        {articles.length} article{articles.length === 1 ? '' : 's'} · {draftCount} draft{draftCount === 1 ? '' : 's'}
        {visible.length !== articles.length ? ` · ${visible.length} matching` : ''}
      </p>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>}
      {!loading && visible.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>
          {articles.length === 0 ? 'No articles yet.' : 'Nothing matches those filters.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(article => {
          const category = categoryById[article.category_id]
          return (
            <div key={article.id} style={rowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{article.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: article.is_published ? 'var(--green)' : 'var(--text-muted)',
                    background: `color-mix(in srgb, ${article.is_published ? 'var(--green)' : 'var(--text-muted)'} 14%, transparent)`,
                    borderRadius: 999, padding: '3px 8px',
                  }}>
                    {article.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {category?.name ?? 'Uncategorised'} · /{article.slug} · {article.view_count} views
                  {' · '}👍 {article.helpful_count} · 👎 {article.not_helpful_count}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {article.is_published && category && (
                  <a
                    href={`/support/${category.slug}/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View live"
                    style={{ ...iconButtonStyle, color: 'var(--text-dim)', textDecoration: 'none' }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  type="button"
                  title={article.is_published ? 'Unpublish' : 'Publish'}
                  disabled={busyId === article.id}
                  onClick={(e) => { ripple(e); void togglePublished(article) }}
                  style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}
                >
                  {article.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  title="Edit"
                  onClick={(e) => { ripple(e); onEdit(article) }}
                  style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}
                >
                  <Pencil size={14} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    title="Delete"
                    disabled={busyId === article.id}
                    onClick={(e) => { ripple(e); void handleDelete(article) }}
                    style={{ ...iconButtonStyle, color: 'var(--red, #ff5f56)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
