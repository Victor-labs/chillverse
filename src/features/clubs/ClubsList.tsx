// src/features/clubs/ClubsList.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Lock, RefreshCw, Flag, Archive } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { listPublicClubs, fetchMyClubs, joinClub, type ClubSummary, type MyClub } from './clubs'
import CreateClubModal from './CreateClubModal'

function ClubBadge({ name, iconUrl, size = 34 }: { name: string; iconUrl?: string | null; size?: number }) {
  const initial = (name.trim()[0] || '?').toUpperCase()
  if (iconUrl) {
    return <img src={iconUrl} alt="" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent), #7c5cff)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.42), color: '#fff',
    }}>
      {initial}
    </div>
  )
}

export default function ClubsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [myClubs, setMyClubs] = useState<MyClub[]>([])
  const [publicClubs, setPublicClubs] = useState<ClubSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [mine, pub] = await Promise.all([fetchMyClubs(user.id), listPublicClubs()])
      setMyClubs(mine)
      setPublicClubs(pub)
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
    try {
      const roomId = await joinClub({ code: codeInput.trim() })
      navigate(`/clubs/${roomId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleJoinPublic(club: ClubSummary) {
    setError('')
    try {
      const roomId = await joinClub({ roomId: club.id })
      navigate(`/clubs/${roomId}`)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Clubs</div>
        <button onClick={load} style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <RefreshCw size={14} />
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

      {/* Join by code */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Join with a code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. 7F3K9Q"
            maxLength={6}
            style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 15, letterSpacing: 3, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
          />
          <button onClick={handleJoinByCode} disabled={joining || !codeInput.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: joining ? 0.7 : 1 }}>
            {joining ? '…' : 'Join'}
          </button>
        </div>
      </div>

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
              <ClubBadge name={club.name} />
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
              <ClubBadge name={club.name} />
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
