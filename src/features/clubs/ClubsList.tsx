// src/features/clubs/ClubsList.tsx
// Phase 2 of the Clubs redesign (see /areas/chillverse-clubs-redesign.md):
// the "join" box here now takes a pasted invite link instead of a bare
// code — it works for club links and the Global Chat link alike, since
// invite codes are unique across every room type. A "Suggested" tile
// below it offers Global Chat as a one-tap join when its invite is open
// and you're not already in.
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Lock, RefreshCw, Flag, Archive, Link2, X, Globe, Users } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getUnreadCounts } from '../../shared/lib/unread'
import { fetchMyClubs, type MyClub } from './clubs'
import { parseInviteCode, getInvitePreview, joinByInviteCode, joinGlobalDirect, fetchGlobalSuggestion, type InvitePreview } from './invites'
import ClubIcon from './clubIcons'
import CreateClubModal from './CreateClubModal'

function ClubBadge({ iconKey, size = 34 }: { iconKey: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent), #7c5cff)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
    }}>
      <ClubIcon iconKey={iconKey} size={Math.round(size * 0.52)} />
    </div>
  )
}

interface ClubsListProps {
  /** True when rendered inside the Chat hub's Clubs tab — hides the
   *  standalone back-arrow/title row, since the hub already provides it. */
  embedded?: boolean
}

export default function ClubsList({ embedded = false }: ClubsListProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [myClubs, setMyClubs] = useState<MyClub[]>([])
  const [unreadByClub, setUnreadByClub] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [joinOpen, setJoinOpen] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [globalSuggestion, setGlobalSuggestion] = useState<{ roomId: string; memberCount: number } | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const mine = await fetchMyClubs(user.id)
      setMyClubs(mine)
      setUnreadByClub(await getUnreadCounts(supabase, mine.map(c => c.id), user.id))
      const g = await fetchGlobalSuggestion(user.id)
      setGlobalSuggestion(g && g.open && !g.isMember ? { roomId: g.roomId, memberCount: g.memberCount } : null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
    if (!user) return
    const ch = supabase
      .channel('clubs-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms', filter: 'type=eq.club' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user])

  async function handleCheckLink() {
    const code = parseInviteCode(linkInput)
    if (!code) { setError("That doesn't look like an invite link — paste the full link someone shared with you."); return }
    setChecking(true)
    setError('')
    setPreview(null)
    try {
      const p = await getInvitePreview(code)
      if (!p) { setError('This invite link is invalid or has expired.'); return }
      setPreview(p)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  async function handleConfirmJoin() {
    if (!preview) return
    setJoining(true)
    setError('')
    try {
      const code = parseInviteCode(linkInput)!
      const roomId = await joinByInviteCode(code, preview.roomType)
      if (preview.roomType === 'global') navigate('/chat?tab=chats', { state: { openRoomId: roomId } })
      else navigate(`/clubs/${roomId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleJoinGlobalSuggestion() {
    setJoining(true)
    setError('')
    try {
      const roomId = await joinGlobalDirect()
      navigate('/chat?tab=chats', { state: { openRoomId: roomId } })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {!embedded && (
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <ArrowLeft size={15} />
          </button>
        )}
        {!embedded && <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Clubs</div>}
        <button onClick={load} style={{ marginLeft: embedded ? 0 : 'auto', width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => setJoinOpen(o => !o)}
          style={{ marginLeft: embedded ? 'auto' : 0, width: 34, height: 34, borderRadius: 10, background: joinOpen ? 'var(--surface2)' : 'var(--surface)', border: joinOpen ? '1px solid var(--accent)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: joinOpen ? 'var(--accent)' : 'var(--text-dim)' }}
          title="Join with a link"
        >
          <Link2 size={14} />
        </button>
        <button
          onClick={(e) => { ripple(e); setCreateOpen(true) }}
          className="ripple-wrap"
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Join with a link — icon above reveals this inline */}
      {joinOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={linkInput}
              onChange={e => { setLinkInput(e.target.value); setPreview(null) }}
              placeholder="Paste an invite link…"
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
            />
            <button onClick={handleCheckLink} disabled={checking || !linkInput.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: checking ? 0.7 : 1 }}>
              {checking ? '…' : 'Find'}
            </button>
            <button onClick={() => { setJoinOpen(false); setLinkInput(''); setPreview(null); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <X size={15} />
            </button>
          </div>

          {preview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 12 }}>
              {preview.roomType === 'global' ? (
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), #7c5cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Globe size={17} />
                </div>
              ) : (
                <ClubBadge iconKey={preview.iconKey} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{preview.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{preview.memberCount} member{preview.memberCount === 1 ? '' : 's'}</div>
              </div>
              <button onClick={handleConfirmJoin} disabled={joining} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: joining ? 0.7 : 1 }}>
                {joining ? '…' : 'Join'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>{error}</div>
      )}

      {/* Suggested — Global Chat, when invites are open and you're not already in */}
      {globalSuggestion && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Suggested</div>
          <div onClick={handleJoinGlobalSuggestion} className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), #7c5cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Globe size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Global Chat</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} /> {globalSuggestion.memberCount} member{globalSuggestion.memberCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Your clubs */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Your clubs</div>
      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
      ) : myClubs.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', marginBottom: 8 }}>You haven't joined any clubs yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {myClubs.map(club => (
            <div key={club.id} onClick={() => navigate(`/clubs/${club.id}`)} className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer' }}>
              <ClubBadge iconKey={club.icon_key} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {club.my_role} · {club.member_count} member{club.member_count === 1 ? '' : 's'}
                </div>
              </div>
              {club.archived_at ? (
                <span title="Archived — renew Pro to restore" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#ff6b6b' }}>
                  <Archive size={12} /> Archived
                </span>
              ) : club.grace_started_at ? (
                <span title="Will be archived soon unless you renew Pro" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f5c542' }}>
                  <Flag size={12} /> Grace
                </span>
              ) : club.is_private ? (
                <Lock size={13} style={{ color: 'var(--text-muted)' }} />
              ) : null}
              {!!unreadByClub.get(club.id) && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 10, padding: '2px 7px', minWidth: 18, textAlign: 'center', flexShrink: 0 }}>
                  {unreadByClub.get(club.id)! > 99 ? '99+' : unreadByClub.get(club.id)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateClubModal
          onClose={() => setCreateOpen(false)}
          onCreated={(roomId) => { setCreateOpen(false); navigate(`/clubs/${roomId}`) }}
        />
      )}
    </div>
  )
}
