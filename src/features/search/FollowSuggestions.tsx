// src/features/search/FollowSuggestions.tsx
//
// "Who to follow" row shown on the search page before the player types
// anything. Mirrors the classic social-app pattern: mutual-follow picks
// ("Followed by X") ranked first, backfilled with other active players.
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import { notifyFollow } from '../achievements/achievements'
import { getFollowSuggestions, type FollowSuggestion } from './search'
import Avatar from '../../shared/components/Avatar'

export default function FollowSuggestions({ myId }: { myId: string }) {
  const navigate = useNavigate()
  const [people, setPeople] = useState<FollowSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    setLoading(true)
    getFollowSuggestions(myId).then(list => {
      if (active) { setPeople(list); setLoading(false) }
    })
    return () => { active = false }
  }, [myId])

  function dismiss(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    ripple(e)
    setPeople(prev => prev.filter(p => p.id !== id))
  }

  async function toggleFollow(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    ripple(e)
    if (busy.has(id)) return
    setBusy(prev => new Set(prev).add(id))
    const alreadyFollowing = following.has(id)
    if (alreadyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', id)
      setFollowing(prev => { const next = new Set(prev); next.delete(id); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: myId, following_id: id })
      await notifyFollow(myId, id)
      setFollowing(prev => new Set(prev).add(id))
    }
    setBusy(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  if (!loading && people.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
        Friend Suggestions
      </div>

      {loading ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>Finding people you may know…</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginRight: -20, paddingRight: 20 }}>
          {people.map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/profile/${p.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/profile/${p.id}`) }}
              style={{
                position: 'relative', flex: '0 0 150px', padding: '18px 12px 14px',
                borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <button
                type="button"
                onClick={e => dismiss(e, p.id)}
                aria-label="Dismiss suggestion"
                style={{
                  position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%',
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>

              <Avatar src={p.avatar} name={p.display_name || p.username} size={56} radius="50%" />

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {p.display_name || p.username}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3, minHeight: 26 }}>
                {p.followedByName ? <>Followed by<br />{p.followedByName}</> : 'You may know each other'}
              </div>

              <button
                type="button"
                onClick={e => toggleFollow(e, p.id)}
                disabled={busy.has(p.id)}
                style={{
                  marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 10,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
                  border: following.has(p.id) ? '1px solid rgba(255,255,255,0.12)' : 'none',
                  background: following.has(p.id) ? 'transparent' : 'var(--accent)',
                  color: following.has(p.id) ? 'var(--text-dim)' : '#fff',
                  cursor: 'pointer', opacity: busy.has(p.id) ? 0.6 : 1,
                }}
              >
                {following.has(p.id) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
