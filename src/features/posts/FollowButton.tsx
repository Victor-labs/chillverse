// src/features/posts/FollowButton.tsx
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { notifyFollow } from '../achievements/achievements'
import { ripple } from '../../shared/lib/ripple'
import { trackWeeklyUniqueValue } from '../missions/weeklyMissions'

export default function FollowButton({ myId, authorId }: { myId: string; authorId: string }) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (myId === authorId) { setLoading(false); return }
    let active = true
    supabase.from('follows').select('follower_id')
      .eq('follower_id', myId).eq('following_id', authorId).maybeSingle()
      .then(({ data }) => { if (active) { setFollowing(!!data); setLoading(false) } })
    return () => { active = false }
  }, [myId, authorId])

  if (myId === authorId || loading) return null

  async function handleToggle(e: MouseEvent<HTMLButtonElement>) {
    ripple(e)
    if (busy) return
    setBusy(true)
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', authorId)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: myId, following_id: authorId })
      await notifyFollow(myId, authorId)
      trackWeeklyUniqueValue(myId, 'users_followed', authorId).catch(console.error)
      setFollowing(true)
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      className="ripple-wrap"
      onClick={handleToggle}
      disabled={busy}
      style={{
        marginLeft: 8,
        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
        border: following ? '1px solid rgba(255,255,255,0.12)' : 'none',
        background: following ? 'transparent' : 'var(--accent)',
        color: following ? 'var(--text-dim)' : '#fff',
        cursor: 'pointer', opacity: busy ? 0.6 : 1,
      }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
