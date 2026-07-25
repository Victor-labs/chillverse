// src/features/dashboard/FriendsOnlineWidget.tsx
//
// "N friends are online" — cross-references your following list against
// the app-wide presence set (OnlinePresenceProvider, tracked once in
// AppLayout) so this is genuinely live, not a stale last_seen_at read.
// Respects each friend's own show_online_activity toggle (same setting
// that already gates their "came online" follower notification — if
// they've opted out of broadcasting activity, they're excluded here too,
// not just from that notification) and excludes blocked accounts in
// either direction. Renders nothing if no one you follow is online, same
// convention as LuckyUserBanner.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import SharedAvatar from '../../shared/components/Avatar'
import { useOnlineUserIds } from '../../context/OnlinePresence'

interface FriendRow {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
}

export default function FriendsOnlineWidget({ userId }: { userId: string | null }) {
  const navigate = useNavigate()
  const onlineIds = useOnlineUserIds()
  const [candidates, setCandidates] = useState<FriendRow[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Following list + eligibility (show_online_activity, not blocked) only
  // needs refetching when the follow graph changes — not on every presence
  // tick, so this is a separate effect from the live online filtering below.
  useEffect(() => {
    if (!userId) return
    let active = true
    async function load() {
      const { data: followingRows } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
      const ids = (followingRows ?? []).map(r => r.following_id)
      if (!ids.length) { if (active) setCandidates([]); return }

      const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
        supabase.from('blocks').select('blocker_id').eq('blocked_id', userId),
      ])
      const hiddenIds = new Set([
        ...(blockedByMe ?? []).map(b => b.blocked_id),
        ...(blockedMe ?? []).map(b => b.blocker_id),
      ])
      const visibleIds = ids.filter(id => !hiddenIds.has(id))
      if (!visibleIds.length) { if (active) setCandidates([]); return }

      const { data: profiles } = await supabase.from('profiles')
        .select('id, username, display_name, avatar, show_online_activity')
        .in('id', visibleIds)
      const eligible = (profiles ?? []).filter(p => p.show_online_activity !== false) as FriendRow[]
      if (active) setCandidates(eligible)
    }
    load()
    return () => { active = false }
  }, [userId])

  if (!candidates || candidates.length === 0) return null

  const online = candidates.filter(c => onlineIds.has(c.id))
  if (online.length === 0) return null

  const label = online.length === 1
    ? `${online[0].display_name || online[0].username} is online`
    : `${online.length} friends are online`

  return (
    <div
      className="neu-card"
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: expanded ? 12 : 0, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(62,207,142,0.12)', border: '1px solid rgba(62,207,142,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3ecf8e', flexShrink: 0 }}>
          <Users size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tap to {expanded ? 'hide' : 'see who'}</div>
        </div>
        <div style={{ display: 'flex' }}>
          {online.slice(0, 4).map((f, i) => (
            <div key={f.id} style={{ marginLeft: i === 0 ? 0 : -10, border: '2px solid var(--surface)', borderRadius: 10 }}>
              <SharedAvatar src={f.avatar} name={f.display_name || f.username} size={28} radius={9} disabled />
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {online.map(f => (
            <div key={f.id}
              onClick={(e) => { e.stopPropagation(); navigate(`/profile/${f.id}`) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10 }}
            >
              <SharedAvatar src={f.avatar} name={f.display_name || f.username} size={30} radius={10} disabled />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{f.display_name || f.username}</div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf8e', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
