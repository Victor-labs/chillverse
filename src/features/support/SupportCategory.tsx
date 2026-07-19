// src/features/support/SupportCategory.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Eye } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { fetchSupportCategoryBySlug, fetchArticlesByCategory } from './api'
import { getSupportCategoryIcon } from './constants'
import Breadcrumbs from './components/Breadcrumbs'
import type { SupportCategory as SupportCategoryType, SupportArticle } from '../../shared/types'

export default function SupportCategory() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const navigate = useNavigate()

  const [category, setCategory] = useState<SupportCategoryType | null>(null)
  const [articles, setArticles] = useState<SupportArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!categorySlug) return
    let active = true
    setLoading(true)

    fetchSupportCategoryBySlug(categorySlug)
      .then(async cat => {
        if (!active) return
        if (!cat) {
          setCategory(null)
          setArticles([])
          setError('This help topic could not be found.')
          return
        }
        setCategory(cat)
        const arts = await fetchArticlesByCategory(cat.id)
        if (!active) return
        setArticles(arts)
        setError(null)
      })
      .catch((err: Error) => {
        if (!active) return
        setError(err.message || 'Could not load this help topic.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [categorySlug])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (error || !category) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Breadcrumbs items={[{ label: 'All Collections', onClick: () => navigate('/support') }, { label: 'Not found' }]} />
        <div style={errorBoxStyle}>{error || 'This help topic could not be found.'}</div>
      </div>
    )
  }

  const Icon = getSupportCategoryIcon(category.icon)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Breadcrumbs
        items={[
          { label: 'All Collections', onClick: () => navigate('/support') },
          { label: category.name },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)',
        }}>
          <Icon size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{category.name}</h1>
          {category.description && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{category.description}</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 22 }}>
        {articles.length} article{articles.length === 1 ? '' : 's'}
      </div>

      {articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>
          No articles in this topic yet.
        </div>
      ) : (
        articles.map(article => (
          <button
            key={article.id}
            type="button"
            onClick={(e) => { ripple(e); navigate(`/support/${category.slug}/${article.slug}`) }}
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
        ))
      )}
    </div>
  )
}

const articleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '14px 16px', marginBottom: 9,
  boxShadow: 'var(--elev-raise-sm)',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13,
}
