// src/features/profile/FollowListSheet.tsx
//
// Followers/Following list sheet — originally built inline in Profile.tsx
// for viewing your OWN list; extracted here so PlayerProfile.tsx (viewing
// someone else) and ProfilePreviewModal.tsx (the profile popup) can all
// open the exact same list instead of separate, inconsistent
// implementations.
//
// Backed by the get_follow_list() RPC (see migration 0096), which does
// three things server-side in one round trip: excludes blocked accounts
// (either direction, same rule as everywhere else — Chat, PlayerProfile's
// follow-status check, etc), sorts by each entry's OWN follower count
// (most-followed first), and caps the result at 50.
//
// zIndex: callers that already have a sheet of their own open (like
// ProfilePreviewModal, whose profile-popup portal renders around 20000)
// pass a zIndex prop so this list stacks correctly above it. Defaults to
// the 505/510 pair used by the older full-page Profile.tsx / PlayerProfile.tsx,
// which don't sit inside another portal.
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
  followers_count: number
}

type ListMode = 'followers' | 'following'

export default function FollowListSheet({ profileId, myId, mode, onClose, zIndex }: {
  profileId: string
  myId: string
  mode: ListMode
  onClose: () => void
  /** Backdrop z-index; the sheet itself renders 5 above this. Defaults to 505. */
  zIndex?: number
}) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [list, setList] = useState<FollowEntry[]>([])
  const [loading, setLoading] = useState(true)

  const backdropZ = zIndex ?? 505
  const sheetZ = backdropZ + 5

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.rpc('get_follow_list', { p_profile_id: profileId, p_mode: mode, p_viewer_id: myId })
      .then(({ data }) => {
        if (!active) return
        setList((data ?? []) as FollowEntry[])
        setLoading(false)
      })
    return () => { active = false }
  }, [profileId, myId, mode])

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: backdropZ }} />
      <div className="sheet-or-modal" style={{ zIndex: sheetZ }}>
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {p.followers_count.toLocaleString()}
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
