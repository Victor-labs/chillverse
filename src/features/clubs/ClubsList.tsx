// src/features/clubs/ClubsList.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Lock, RefreshCw, Flag, Archive, KeyRound, X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getUnreadCounts } from '../../shared/lib/unread'
import { listPublicClubs, fetchMyClubs, joinClub, type ClubSummary, type MyClub } from './clubs'
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
  const [publicClubs, setPublicClubs] = useState<ClubSummary[]>([])
  const [unreadByClub, setUnreadByClub] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [joinOpen, setJoinOpen] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [pendingNotice, setPendingNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [mine, pub] = await Promise.all([fetchMyClubs(user.id), listPublicClubs()])
      setMyClubs(mine)
      setPublicClubs(pub)
      setUnreadByClub(await getUnreadCounts(supabase, mine.map(c => c.id), user.id))
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

  const myClubIds = new Set(myClubs.map(c => c.id))

  async function handleJoinByCode() {
    if (!codeInput.trim()) return
    setJoining(true)
    setError('')
    setPendingNotice('')
    try {
      const { roomId, status } = await joinClub({ code: codeInput.trim() })
      if (status === 'pending') {
        setPendingNotice("You're on the waiting list — a president or VP needs to accept you before you can chat.")
        setCodeInput('')
        setJoinOpen(false)
      } else {
        navigate(`/clubs/${roomId}`)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleJoinPublic(club: ClubSummary) {
    setError('')
    setPendingNotice('')
    try {
      const { roomId, status } = await joinClub({ roomId: club.id })
      if (status === 'pending') {
        setPendingNotice(`You're on the waiting list for "${club.name}" — a president or VP needs to accept you.`)
      } else {
        navigate(`/clubs/${roomId}`)
      }
    } catch (e: any) {
      setError(e.message)
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
          title="Join with a code"
        >
          <KeyRound size={14} />
        </button>
        <button
          onClick={(e) => { ripple(e); setCreateOpen(true) }}
          className="ripple-wrap"
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>{error}</div>
      )}

      {pendingNotice && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 12.5, marginBottom: 14 }}>{pendingNotice}</div>
      )}

      {/* Join with a code — icon above reveals this inline, no more permanent bar */}
      {joinOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 18, display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. 7F3K9Q"
            maxLength={6}
            style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 15, letterSpacing: 3, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
          />
          <button onClick={handleJoinByCode} disabled={joining || !codeInput.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: joining ? 0.7 : 1 }}>
            {joining ? '…' : 'Join'}
          </button>
          <button onClick={() => { setJoinOpen(false); setCodeInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <X size={15} />
          </button>
        </div>
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

      {/* Browse public clubs */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Browse public clubs</div>
      {!loading && publicClubs.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No public clubs right now. Start one!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {publicClubs.filter(c => !myClubIds.has(c.id)).map(club => (
            <div key={club.id} onClick={() => handleJoinPublic(club)} className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer' }}>
              <ClubBadge iconKey={club.icon_key} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} /> {club.member_count} member{club.member_count === 1 ? '' : 's'}
                </div>
              </div>
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
