// src/features/profile/FollowListSheet.tsx
//
// Followers/Following list sheet — originally built inline in Profile.tsx
// for viewing your OWN list; extracted here so PlayerProfile.tsx (viewing
// someone else) can open the exact same list instead of a second,
// inconsistent implementation. Also closes a gap the original didn't
// have: blocked accounts (either direction) are now excluded from the
// list, matching how blocks are already treated everywhere else (Chat,
// PlayerProfile's own follow-status check, etc).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, X } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import SharedAvatar from '../../shared/components/Avatar'
import { getUserRankTier } from './ranks'

interface FollowEntry {
  id: string
  username: string
  display_name: string | null
  xp: number
  avatar: string | null
}

type ListMode = 'followers' | 'following'

export default function FollowListSheet({ profileId, myId, mode, onClose }: {
  profileId: string
  myId: string
  mode: ListMode
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [list, setList] = useState<FollowEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  useEffect(() => {
    let active = true
    setLoading(true)
    async function load() {
      const query = mode === 'followers'
        ? supabase.from('follows').select('profiles!follower_id(id, username, display_name, xp, avatar)').eq('following_id', profileId)
        : supabase.from('follows').select('profiles!following_id(id, username, display_name, xp, avatar)').eq('follower_id', profileId)
      const { data } = await query
      let entries = (data ?? []).map((r: Record<string, unknown>) => r.profiles as FollowEntry).filter(Boolean)

      const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', myId),
        supabase.from('blocks').select('blocker_id').eq('blocked_id', myId),
      ])
      const hiddenIds = new Set([
        ...(blockedByMe ?? []).map(b => b.blocked_id),
        ...(blockedMe ?? []).map(b => b.blocker_id),
      ])
      entries = entries.filter(p => !hiddenIds.has(p.id))

      if (active) { setList(entries); setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [profileId, myId, mode])

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div className="sheet-or-modal" style={{ zIndex: 360 }}>
        <div className="sheet-or-modal-inner" style={{ background: 'var(--surface2)', padding: '24px 20px 36px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{mode === 'followers' ? 'Followers' : 'Following'}</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Users size={32} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No {mode} yet</p>
              </div>
            ) : list.map(p => {
              const rank = getUserRankTier(p.xp)
              return (
                <button key={p.id} type="button" onClick={() => { close(); navigate(`/profile/${p.id}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10 }}>
                  <SharedAvatar src={p.avatar} name={p.display_name || p.username} size={44} radius={13} disabled />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.display_name || p.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11 }}>{rank.emoji}</span>
                      <span style={{ color: rank.color }}>{rank.name}</span>
                      <span>· @{p.username}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
