// src/features/support/SupportArticle.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ThumbsUp, ThumbsDown, MessageSquarePlus, Check } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import {
  fetchSupportCategoryBySlug, fetchArticleBySlug, incrementArticleView,
  submitArticleFeedback, fetchMyArticleFeedback,
} from './api'
import Breadcrumbs from './components/Breadcrumbs'
import type { SupportCategory, SupportArticle as SupportArticleType } from '../../shared/types'

export default function SupportArticle() {
  const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [category, setCategory] = useState<SupportCategory | null>(null)
  const [article, setArticle] = useState<SupportArticleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [myFeedback, setMyFeedback] = useState<boolean | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  const hasCountedView = useRef(false)

  useEffect(() => {
    if (!categorySlug || !articleSlug) return
    let active = true
    setLoading(true)
    hasCountedView.current = false

    fetchSupportCategoryBySlug(categorySlug)
      .then(async cat => {
        if (!active) return
        if (!cat) {
          setError('This article could not be found.')
          return
        }
        setCategory(cat)

        const art = await fetchArticleBySlug(cat.id, articleSlug)
        if (!active) return
        if (!art) {
          setError('This article could not be found.')
          return
        }
        setArticle(art)
        setError(null)

        if (!hasCountedView.current) {
          hasCountedView.current = true
          incrementArticleView(art.id).catch(() => { /* non-fatal */ })
        }

        if (user) {
          const feedback = await fetchMyArticleFeedback(art.id, user.id)
          if (active) setMyFeedback(feedback)
        }
      })
      .catch((err: Error) => {
        if (!active) return
        setError(err.message || 'This article could not be found.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [categorySlug, articleSlug, user])

  async function handleFeedback(isHelpful: boolean) {
    if (!article || !user || feedbackSubmitting) return
    setFeedbackSubmitting(true)
    try {
      await submitArticleFeedback(article.id, user.id, isHelpful)
      setMyFeedback(isHelpful)
      setArticle(prev => {
        if (!prev) return prev
        // Optimistically reconcile local counts; server-side recompute already ran.
        const wasHelpful = myFeedback === true
        const wasNotHelpful = myFeedback === false
        let helpful = prev.helpful_count
        let notHelpful = prev.not_helpful_count
        if (isHelpful && !wasHelpful) { helpful += 1; if (wasNotHelpful) notHelpful -= 1 }
        if (!isHelpful && !wasNotHelpful) { notHelpful += 1; if (wasHelpful) helpful -= 1 }
        return { ...prev, helpful_count: helpful, not_helpful_count: notHelpful }
      })
    } catch {
      // Non-fatal — leave state as-is; the person can retry.
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (error || !article || !category) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Breadcrumbs items={[{ label: 'All Collections', onClick: () => navigate('/support') }, { label: 'Not found' }]} />
        <div style={errorBoxStyle}>{error || 'This article could not be found.'}</div>
      </div>
    )
  }

  const paragraphs = article.content.split(/\n\s*\n/).filter(Boolean)
  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <Breadcrumbs
        items={[
          { label: 'All Collections', onClick: () => navigate('/support') },
          { label: category.name, onClick: () => navigate(`/support/${category.slug}`) },
          { label: article.title },
        ]}
      />

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{article.title}</h1>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{publishedDate}</div>
      {article.summary && (
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>{article.summary}</p>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        padding: '22px 24px', marginBottom: 24,
        boxShadow: 'var(--elev-raise-sm)',
      }}>
        {paragraphs.map((para, i) => (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: i === paragraphs.length - 1 ? 0 : 16 }}>
            {para}
          </p>
        ))}
      </div>

      {article.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {article.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '4px 10px',
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Feedback */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '16px 18px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Was this article helpful?</span>
        {user ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={(e) => { ripple(e); handleFeedback(true) }}
              disabled={feedbackSubmitting}
              className="ripple-wrap"
              style={feedbackButtonStyle(myFeedback === true, 'var(--green)')}
            >
              {myFeedback === true ? <Check size={14} /> : <ThumbsUp size={14} />}
              Yes ({article.helpful_count})
            </button>
            <button
              type="button"
              onClick={(e) => { ripple(e); handleFeedback(false) }}
              disabled={feedbackSubmitting}
              className="ripple-wrap"
              style={feedbackButtonStyle(myFeedback === false, 'var(--red)')}
            >
              {myFeedback === false ? <Check size={14} /> : <ThumbsDown size={14} />}
              No ({article.not_helpful_count})
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log in to leave feedback</span>
        )}
      </div>

      {/* Still need help */}
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/support/tickets/new') }}
        className="ripple-wrap"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: '14px 16px',
          boxShadow: 'var(--elev-raise-sm)',
        }}
      >
        <MessageSquarePlus size={18} color="var(--accent)" />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Still need help?</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Contact our support team directly</div>
        </div>
      </button>
    </div>
  )
}

function feedbackButtonStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
    color: active ? '#fff' : color,
    background: active ? color : `${color}1a`,
    border: `1px solid ${active ? color : `${color}40`}`,
  }
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13,
}
