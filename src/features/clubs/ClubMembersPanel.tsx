// src/features/clubs/ClubMembersPanel.tsx
import { useEffect, useState, useCallback } from 'react'
import { X, Crown, ShieldCheck, MoreVertical, UserMinus, LogOut, Trash2 } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'
import {
  fetchClubMembers, promoteClubMember, removeClubMember, leaveClub,
  type ClubMemberRow, type ClubRole, type ClubRoom,
} from './clubs'

interface ClubMembersPanelProps {
  club: ClubRoom
  myRole: ClubRole
  myId: string
  onClose: () => void
  onLeftOrDeleted: () => void
}

const ROLE_LABEL: Record<ClubRole, string> = { president: 'President', vp: 'VP', member: 'Member' }
const ROLE_COLOR: Record<ClubRole, string> = { president: '#f5c542', vp: '#4f8ef7', member: 'var(--text-dim)' }

export default function ClubMembersPanel({ club, myRole, myId, onClose, onLeftOrDeleted }: ClubMembersPanelProps) {
  const [members, setMembers] = useState<ClubMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await fetchClubMembers(club.id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [club.id])

  useEffect(() => { load() }, [load])

  async function handlePromote(userId: string, role: 'member' | 'vp') {
    setBusy(true)
    setError('')
    try {
      await promoteClubMember(club.id, userId, role)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
      setMenuFor(null)
    }
  }

  async function handleRemove(userId: string) {
    setBusy(true)
    setError('')
    try {
      await removeClubMember(club.id, userId)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
      setMenuFor(null)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError('')
    try {
      await leaveClub(club.id)
      onLeftOrDeleted()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201,
        background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 18,
        padding: '20px 0 16px', width: Math.min(380, window.innerWidth - 32),
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--elev-popover)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Members · {members.length}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ margin: '0 20px 12px', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ overflowY: 'auto', padding: '0 12px', flex: 1 }}>
          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
          ) : members.map(m => {
            const canManage = (myRole === 'president' && m.role !== 'president') || (myRole === 'vp' && m.role === 'member')
            const displayName = m.display_name || m.username
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10, position: 'relative' }}>
                <Avatar src={m.avatar} name={displayName} userId={m.user_id} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: ROLE_COLOR[m.role] }}>
                    {m.role === 'president' && <Crown size={11} />}
                    {m.role === 'vp' && <ShieldCheck size={11} />}
                    {ROLE_LABEL[m.role]}
                  </div>
                </div>

                {canManage && m.user_id !== myId && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setMenuFor(menuFor === m.user_id ? null : m.user_id)} disabled={busy} style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MoreVertical size={15} />
                    </button>
                    {menuFor === m.user_id && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setMenuFor(null)} />
                        <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 6, background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 12, minWidth: 170, boxShadow: 'var(--elev-popover)', overflow: 'hidden' }}>
                          {myRole === 'president' && m.role !== 'vp' && (
                            <button onClick={() => handlePromote(m.user_id, 'vp')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                              <ShieldCheck size={13} /> Make VP
                            </button>
                          )}
                          {myRole === 'president' && m.role === 'vp' && (
                            <button onClick={() => handlePromote(m.user_id, 'member')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                              <UserMinus size={13} /> Remove VP
                            </button>
                          )}
                          <button onClick={() => handleRemove(m.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#ff6b6b' }}>
                            <Trash2 size={13} /> Remove from club
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '14px 20px 0', borderTop: '1px solid var(--border)', marginTop: 10 }}>
          <button onClick={handleLeave} disabled={busy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
            <LogOut size={14} /> Leave club
          </button>
        </div>
      </div>
    </>
  )
}
