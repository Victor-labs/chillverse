// src/features/support/feedback/VoteButton.tsx
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { toggleFeedbackVote } from './api'
import { useAuth } from '../../auth/useAuth'

interface VoteButtonProps {
  postId: string
  voteCount: number
  hasVoted: boolean
  /** Lets the parent list keep its own row state in sync after a toggle. */
  onChange?: (next: { voteCount: number; hasVoted: boolean }) => void
  size?: 'sm' | 'lg'
}

/**
 * Optimistic upvote toggle. Signed-out visitors aren't blocked from *seeing*
 * this — the help center is a public surface — they're sent to the main site's
 * login with a `next` param so they land back on the exact post afterwards.
 */
export default function VoteButton({ postId, voteCount, hasVoted, onChange, size = 'sm' }: VoteButtonProps) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [count, setCount] = useState(voteCount)
  const [voted, setVoted] = useState(hasVoted)
  const [busy, setBusy] = useState(false)

  const large = size === 'lg'

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    ripple(e)
    e.stopPropagation()
    e.preventDefault()

    if (!session) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    if (busy) return

    // Optimistic flip, rolled back if the RPC rejects.
    const previous = { count, voted }
    setVoted(!voted)
    setCount(c => (voted ? Math.max(c - 1, 0) : c + 1))
    setBusy(true)

    try {
      const fresh = await toggleFeedbackVote(postId)
      setCount(fresh.vote_count)
      setVoted(fresh.has_voted)
      onChange?.({ voteCount: fresh.vote_count, hasVoted: fresh.has_voted })
    } catch {
      setCount(previous.count)
      setVoted(previous.voted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="ripple-wrap"
      onClick={handleClick}
      aria-pressed={voted}
      aria-label={voted ? 'Remove your vote' : 'Upvote this suggestion'}
      style={{
        cursor: 'pointer', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1, width: large ? 68 : 56, padding: large ? '10px 0' : '8px 0',
        borderRadius: 14,
        background: voted ? 'var(--accent-soft)' : 'var(--surface2)',
        border: `1px solid ${voted ? 'var(--accent)' : 'var(--border)'}`,
        color: voted ? 'var(--accent)' : 'var(--text-dim)',
        opacity: busy ? 0.7 : 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <ChevronUp size={large ? 20 : 16} strokeWidth={2.6} />
      <span style={{ fontSize: large ? 17 : 14, fontWeight: 800, lineHeight: 1.1 }}>{count}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {count === 1 ? 'Vote' : 'Votes'}
      </span>
    </button>
  )
}
