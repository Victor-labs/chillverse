// src/features/posts/SinglePostPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ripple } from '../../shared/lib/ripple'
import { fetchPostById } from './posts'
import PostCard from './PostCard'
import type { Post } from './types'

export default function SinglePostPage() {
  const navigate = useNavigate()
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!postId) return
    let active = true
    setLoading(true)
    fetchPostById(postId, user?.id ?? null).then(data => {
      if (active) { setPost(data); setLoading(false) }
    })
    return () => { active = false }
  }, [postId, user?.id])

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', marginBottom: 16, paddingTop: 4 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/feed') }}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--elev-raise-sm)',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Post</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Shared from Chillverse</p>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <div className="neu-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
            Loading post…
          </div>
        ) : post ? (
          <PostCard post={post} onDeleted={() => navigate('/feed')} truncate={false} card={false} />
        ) : (
          <div className="neu-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
            This post doesn't exist or was deleted.
          </div>
        )}
      </div>
    </div>
  )
}
