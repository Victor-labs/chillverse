// src/features/clubs/ClubMembersPanel.tsx
// The "Club Info" screen — opened by tapping the club name/icon in
// ClubChat's header (everyone can open it; president/VP get extra
// per-member actions). Member rows use the shared Avatar component, which
// already opens the same mini profile modal Global Chat uses on tap — no
// extra wiring needed for that part.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { X, Crown, ShieldCheck, MoreVertical, UserMinus, LogOut, Trash2, VolumeX, Volume2, Search } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'
import {
  fetchClubMembers, promoteClubMember, removeClubMember, muteClubMember, unmuteClubMember, leaveClub,
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

function isMuted(m: ClubMemberRow): boolean {
  return !!m.muted_until && new Date(m.muted_until).getTime() > Date.now()
}

function muteMinutesLeft(m: ClubMemberRow): number {
  if (!m.muted_until) return 0
  return Math.max(0, Math.round((new Date(m.muted_until).getTime() - Date.now()) / 60000))
}

export default function ClubMembersPanel({ club, myRole, myId, onClose, onLeftOrDeleted }: ClubMembersPanelProps) {
  const [members, setMembers] = useState<ClubMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')

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

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.trim().toLowerCase()
    return members.filter(m => m.username.toLowerCase().includes(q) || (m.display_name ?? '').toLowerCase().includes(q))
  }, [members, search])

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

  async function handleMute(userId: string) {
    setBusy(true)
    setError('')
    try {
      await muteClubMember(club.id, userId)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
      setMenuFor(null)
    }
  }

  async function handleUnmute(userId: string) {
    setBusy(true)
    setError('')
    try {
      await unmuteClubMember(club.id, userId)
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
        padding: '20px 0 16px', width: Math.min(400, window.innerWidth - 32),
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--elev-popover)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', marginBottom: club.description ? 6 : 14 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{club.name}</p>
          <button type="button" onClick={() => setSearchOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: searchOpen ? 'var(--accent)' : 'var(--text-muted)', marginRight: 6 }}>
            <Search size={16} />
          </button>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {club.description && (
          <p style={{ margin: '0 20px 14px', fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{club.description}</p>
        )}

        {searchOpen && (
          <div style={{ margin: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
            <Search size={13} style={{ color: 'var(--text-muted)' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }} />
          </div>
        )}

        <p style={{ margin: '0 20px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {members.length} member{members.length === 1 ? '' : 's'}
        </p>

        {error && (
          <div style={{ margin: '0 20px 12px', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ overflowY: 'auto', padding: '0 12px', flex: 1 }}>
          {loading ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No members match "{search}"</div>
          ) : filteredMembers.map(m => {
            const canManage = (myRole === 'president' && m.role !== 'president') || (myRole === 'vp' && m.role === 'member')
            const displayName = m.display_name || m.username
            const muted = isMuted(m)
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10, position: 'relative' }}>
                <Avatar src={m.avatar} name={displayName} userId={m.user_id} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: ROLE_COLOR[m.role] }}>
                    {m.role === 'president' && <Crown size={11} />}
                    {m.role === 'vp' && <ShieldCheck size={11} />}
                    {ROLE_LABEL[m.role]}
                    {muted && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#ff6b6b', fontWeight: 600 }}><VolumeX size={11} /> {muteMinutesLeft(m)}m</span>}
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
                        <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 6, background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 12, minWidth: 175, boxShadow: 'var(--elev-popover)', overflow: 'hidden' }}>
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
                          {muted ? (
                            <button onClick={() => handleUnmute(m.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                              <Volume2 size={13} /> Unmute
                            </button>
                          ) : (
                            <button onClick={() => handleMute(m.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                              <VolumeX size={13} /> Mute (1h)
                            </button>
                          )}
                          <button onClick={() => handleRemove(m.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#ff6b6b' }}>
                            <Trash2 size={13} /> Kick from club
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
