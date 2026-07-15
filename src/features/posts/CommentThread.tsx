// src/features/posts/CommentThread.tsx
import { useEffect, useState } from 'react'
import { Send, Megaphone } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useModRole } from '../moderation/useModRole'
import { fetchComments, addComment } from './posts'
import type { Comment } from './types'

export default function CommentThread({ postId }: { postId: string }) {
  const { user } = useAuth()
  const { isStaff } = useModRole()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [tagAsNotice, setTagAsNotice] = useState(false)

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
    const { data, error } = await addComment(postId, user.id, body, isStaff && tagAsNotice)
    if (!error && data) {
      setComments(c => [...c, data as Comment])
      setDraft('')
      setTagAsNotice(false)
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
            <div
              key={c.id}
              style={{
                fontSize: 12.5, color: 'var(--text)',
                ...(c.is_notice ? {
                  background: 'rgba(245,197,66,0.10)', border: '1px solid rgba(245,197,66,0.35)',
                  borderRadius: 8, padding: '6px 8px',
                } : {}),
              }}
            >
              {c.is_notice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <Megaphone size={11} style={{ color: '#f5c542' }} />
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#f5c542', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Official Notice
                  </span>
                </div>
              )}
              <strong style={{ color: 'var(--text-dim)' }}>
                {c.author?.display_name || c.author?.username || 'User'}:
              </strong>{' '}
              {c.body}
            </div>
          ))}
        </div>
      )}

      {user && (
        <>
          {isStaff && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tagAsNotice}
                onChange={e => setTagAsNotice(e.target.checked)}
                style={{ accentColor: '#f5c542' }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f5c542' }}>Tag as Official Notice</span>
            </label>
          )}
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Add a comment…"
              maxLength={300}
              style={{
                flex: 1, background: 'var(--surface)', border: 'none', borderRadius: 10,
                padding: '8px 10px', fontSize: 12.5, color: 'var(--text)', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || posting}
              className="btn-primary"
              style={{ padding: 8, display: 'flex', opacity: !draft.trim() || posting ? 0.5 : 1 }}
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
      {commentError && (
        <p style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>{commentError}</p>
      )}
    </div>
  )
}

