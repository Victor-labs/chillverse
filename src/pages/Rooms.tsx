// src/pages/Rooms.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Lock, RefreshCw } from 'lucide-react'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { createRoom, joinRoomByCode, fetchPublicRooms, type RoomRow } from '../lib/rooms'

export default function Rooms() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRooms(await fetchPublicRooms())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function handleCreate() {
    setCreating(true)
    setError('')
    try {
      const { id } = await createRoom({ isPrivate, maxPlayers })
      navigate(`/rooms/${id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinByCode() {
    if (!codeInput.trim()) return
    setJoining(true)
    setError('')
    try {
      const roomId = await joinRoomByCode(codeInput.trim())
      navigate(`/rooms/${roomId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleJoinRoom(room: RoomRow) {
    setError('')
    try {
      const roomId = await joinRoomByCode(room.code)
      navigate(`/rooms/${roomId}`)
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
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Multiplayer</div>
        <button onClick={load} style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>{error}</div>
      )}

      {/* Create room */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Create a room</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setIsPrivate(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${!isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: !isPrivate ? 'rgba(255,107,0,0.1)' : 'var(--bg)', color: !isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Public</button>
          <button onClick={() => setIsPrivate(true)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: isPrivate ? 'rgba(255,107,0,0.1)' : 'var(--bg)', color: isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Private (code only)</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max players</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[2, 4, 6, 8].map(n => (
              <button key={n} onClick={() => setMaxPlayers(n)} style={{ width: 30, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${maxPlayers === n ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: maxPlayers === n ? 'rgba(255,107,0,0.1)' : 'var(--bg)', color: maxPlayers === n ? 'var(--accent)' : 'var(--text-dim)' }}>{n}</button>
            ))}
          </div>
        </div>
        <button onClick={(e) => { ripple(e as any); handleCreate() }} disabled={creating} className="ripple-wrap" style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: creating ? 0.7 : 1 }}>
          <Plus size={14} /> {creating ? 'Creating…' : 'Create Room'}
        </button>
      </div>

      {/* Join by code */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Join with a code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. 7F3K9Q"
            maxLength={6}
            style={{ flex: 1, background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', fontSize: 15, letterSpacing: 3, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
          />
          <button onClick={handleJoinByCode} disabled={joining || !codeInput.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: joining ? 0.7 : 1 }}>
            {joining ? '…' : 'Join'}
          </button>
        </div>
      </div>

      {/* Public rooms list */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Public rooms</div>
      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</div>
      ) : rooms.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No public rooms right now. Create one!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.map(room => (
            <div key={room.id} onClick={() => handleJoinRoom(room)} className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexShrink: 0 }}>
                {room.is_private ? <Lock size={14} /> : <Users size={14} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Room {room.code}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Waiting for players</div>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}>Max {room.max_players}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
