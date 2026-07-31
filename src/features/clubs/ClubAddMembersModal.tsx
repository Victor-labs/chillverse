// src/features/clubs/ClubAddMembersModal.tsx
// "Add members" picker, opened from Club Info (ClubMembersPanel) by anyone
// in the club — president, VP, or regular member. Lists the people the
// caller already has a DM thread with (the RPC excludes existing members
// and anyone already on the awaiting list). Tapping a row calls
// invite_or_add_club_member: president/VP adds the person instantly,
// a regular member's tap sends them to the awaiting list instead — the
// backend decides which, this component just reflects whatever comes back.

import { useEffect, useState, useCallback } from 'react'
import { X, Search, UserPlus, Check, Clock } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'
import { fetchClubInviteCandidates, inviteClubMember, type ClubInviteCandidate } from './clubs'

interface ClubAddMembersModalProps {
  roomId: string
  onClose: () => void
  /** Called after at least one successful invite, so the parent can refresh
   *  its member/pending lists. */
  onInvited: () => void
}

type RowState = 'idle' | 'busy' | 'added' | 'pending'

export default function ClubAddMembersModal({ roomId, onClose, onInvited }: ClubAddMembersModalProps) {
  const [candidates, setCandidates] = useState<ClubInviteCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [anyInvited, setAnyInvited] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCandidates(await fetchClubInviteCandidates(roomId))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => { load() }, [load])

  const filtered = candidates.filter(c => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return c.username.toLowerCase().includes(q) || (c.display_name ?? '').toLowerCase().includes(q)
  })

  async function handleAdd(candidate: ClubInviteCandidate) {
    setRowState(s => ({ ...s, [candidate.user_id]: 'busy' }))
    setError('')
    try {
      const result = await inviteClubMember(roomId, candidate.user_id)
      setRowState(s => ({ ...s, [candidate.user_id]: result === 'added' ? 'added' : 'pending' }))
      setAnyInvited(true)
      onInvited()
    } catch (e: any) {
      setError(e.message)
      setRowState(s => ({ ...s, [candidate.user_id]: 'idle' }))
    }
  }

  function handleClose() {
    if (anyInvited) onInvited()
    onClose()
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={handleClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 211,
        background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 18,
        padding: '20px 0 16px', width: Math.min(400, window.innerWidth - 32),
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--elev-popover)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <UserPlus size={15} style={{ color: 'var(--text-dim)' }} />
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Add members</p>
          </div>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ margin: '0 20px 14px', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          People you chat with often. Adding someone as a member sends them straight in — anyone else's pick goes to the awaiting list.
        </p>

        <div style={{ margin: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your chats…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }} />
        </div>

        {error && (
          <div style={{ margin: '0 20px 12px', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ overflowY: 'auto', padding: '0 12px', flex: 1 }}>
          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              {candidates.length === 0 ? "No one to add yet — start a DM with someone first." : `No chats match "${search}"`}
            </div>
          ) : filtered.map(c => {
            const displayName = c.display_name || c.username
            const state = rowState[c.user_id] ?? 'idle'
            return (
              <div key={c.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10 }}>
                <Avatar src={c.avatar} name={displayName} userId={c.user_id} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{c.username}</div>
                </div>
                {state === 'added' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#3ecf8e' }}>
                    <Check size={13} /> Added
                  </span>
                ) : state === 'pending' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
                    <Clock size={13} /> Requested
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(c)}
                    disabled={state === 'busy'}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: state === 'busy' ? 0.6 : 1, flexShrink: 0 }}
                  >
                    {state === 'busy' ? '…' : 'Add'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
