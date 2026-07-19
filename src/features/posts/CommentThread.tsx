// src/features/posts/CommentThread.tsx
import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { fetchComments, addComment } from './posts'
import type { Comment } from './types'
import HiddenContentNotice from '../moderation/HiddenContentNotice'

export default function CommentThread({ postId }: { postId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    let active = true
    fetchComments(postId).then(data => { if (active) { setComments(data); setLoading(false) } })
    return () => { active = false }
  }, [postId])

  async function handleSend() {
    const body = draft.trim()
    if (!body || !user || posting) return
    setPosting(true)
    setCommentError('')
    const { data, error } = await addComment(postId, user.id, body)
    if (!error && data) {
      setComments(c => [...c, data as Comment])
      setDraft('')
    } else if (error) {
      setCommentError(error.message || 'Failed to post comment. Please try again.')
    }
    setPosting(false)
  }

  return (
    <div className="neu-inset" style={{ padding: 12 }}>
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>No comments yet — be the first.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map(c => (
            <div key={c.id} style={{ fontSize: 12.5, color: 'var(--text)' }}>
              <strong style={{ color: 'var(--text-dim)' }}>
                {c.author?.display_name || c.author?.username || 'User'}:
              </strong>{' '}
              {c.hidden ? <HiddenContentNotice reason={c.hidden_reason} isOwner={user?.id === c.author_id} inline /> : c.body}
            </div>
          ))}
        </div>
      )}

      {user && (
        <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Add a comment…"
            maxLength={300}
            className="cv-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || posting}
            className="btn-primary cv-send-btn"
            style={{ opacity: !draft.trim() || posting ? 0.5 : 1 }}
          >
            <Send size={14} />
          </button>
        </div>
      )}
      {commentError && (
        <p style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>{commentError}</p>
      )}
    </div>
  )
}
