// src/pages/Room.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, X, Copy, Check, LogOut, Play } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { useRoom } from './useRoom'
import { leaveRoom, kickPlayer, startRoom } from './rooms'
import { getGameMeta } from '../games/games'
import { tacStart, pkStart } from './multiplayerGames'
import TacZoneMultiplayer from './play/TacZoneMultiplayer'
import PatternKingRelay from './play/PatternKingRelay'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { room, players, loading, error: liveError } = useRoom(roomId ?? null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)

  const isHost = !!user && room?.host_id === user.id
  const meInRoom = !!user && players.some(p => p.user_id === user.id)
  const gameMeta = room?.game_id ? getGameMeta(room.game_id) : undefined
  const GameIcon = gameMeta?.icon

  // Room deleted (host left an empty room, or it was cleaned up) → bounce back.
  useEffect(() => {
    if (!loading && !room) {
      navigate('/rooms', { replace: true })
    }
  }, [loading, room, navigate])

  // Game started → this is the hook point for wiring an actual game screen later.
  useEffect(() => {
    if (room?.status === 'in_progress') {
      // TODO: navigate(`/games/<game>/play?room=${room.id}`) once a game is attached
    }
  }, [room?.status])

  async function handleLeave() {
    if (!roomId) return
    setBusy(true)
    try {
      await leaveRoom(roomId)
      navigate('/rooms')
    } catch (e: any) {
      setActionError(e.message)
      setBusy(false)
    }
  }

  async function handleKick(targetId: string) {
    if (!roomId) return
    setActionError('')
    try {
      await kickPlayer(roomId, targetId)
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function handleStart() {
    if (!roomId) return
    setBusy(true)
    setActionError('')
    try {
      if (gameMeta?.dbKey === 'tac_zone') await tacStart(roomId)
      else if (gameMeta?.dbKey === 'pattern_king') await pkStart(roomId)
      else await startRoom(roomId)
    } catch (e: any) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function copyCode() {
    if (!room) return
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading room…</div>
  }
  if (!room) return null

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={handleLeave} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{gameMeta?.name ?? 'Room Lobby'}</div>
        </div>
        {gameMeta && GameIcon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${gameMeta.accent}18`, border: `1px solid ${gameMeta.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GameIcon size={16} style={{ color: gameMeta.accent }} />
          </div>
        )}
      </div>

      {(liveError || actionError) && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>
          {actionError || liveError}
        </div>
      )}

      {/* Invite code */}
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18, marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          {room.is_private ? 'Private room · invite code' : 'Invite code'}
        </div>
        <div onClick={copyCode} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: 'var(--accent)' }}>{room.code}</span>
          {copied ? <Check size={18} color="#3ecf8e" /> : <Copy size={16} color="var(--text-dim)" />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{copied ? 'Copied!' : 'Tap to copy'}</div>
      </div>

      {/* Roster */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Players ({players.length}/{room.max_players})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {players.map(p => (
          <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>
              {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.display_name?.[0] ?? p.username?.[0] ?? '?')}
            </div>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
              {p.display_name || p.username || 'Player'}
              {p.user_id === user?.id && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> (you)</span>}
            </div>
            {p.is_host && <Crown size={15} color="#ffc857" />}
            {isHost && !p.is_host && (
              <button onClick={() => handleKick(p.user_id)} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!meInRoom || room.status !== 'waiting' ? null : isHost ? (
        <button
          onClick={(e) => { ripple(e); handleStart() }}
          disabled={busy || players.length < 2}
          style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: players.length < 2 ? 'var(--surface2)' : 'var(--accent)', color: players.length < 2 ? 'var(--text-muted)' : '#fff', fontWeight: 800, fontSize: 14, cursor: players.length < 2 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Play size={15} /> {players.length < 2 ? 'Need at least 2 players' : busy ? 'Starting…' : 'Start Game'}
        </button>
      ) : null}

      {room.status === 'in_progress' && user && (
        <>
          {gameMeta?.dbKey === 'tac_zone' && (
            <TacZoneMultiplayer room={room} players={players} userId={user.id} isHost={isHost} />
          )}
          {gameMeta?.dbKey === 'pattern_king' && (
            <PatternKingRelay room={room} players={players} userId={user.id} isHost={isHost} />
          )}
          {gameMeta?.dbKey !== 'tac_zone' && gameMeta?.dbKey !== 'pattern_king' && (
            <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', padding: '14px 0', background: 'var(--surface)', borderRadius: 12, marginTop: 4 }}>
              {gameMeta ? `${gameMeta.name} multiplayer is coming soon — this room is ready and waiting.` : 'This game mode is coming soon.'}
            </div>
          )}
        </>
      )}

      {meInRoom && !isHost && room.status === 'waiting' && (
        <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>Waiting for host to start…</div>
      )}

      <button onClick={handleLeave} disabled={busy} style={{ width: '100%', marginTop: 10, padding: '11px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <LogOut size={14} /> Leave Room
      </button>
    </div>
  )
}
