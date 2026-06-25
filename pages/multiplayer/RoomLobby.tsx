// src/pages/multiplayer/RoomLobby.tsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crown, Users, LogOut, Play } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRoom } from './useRoom'
import ChatPanel from './ChatPanel'
import { MULTIPLAYER_GAME_MAP } from './multiplayerGameData'
import type { TeamChoice } from './multiplayerTypes'

const AVATAR_COLORS = [
  '#ff6b6b', '#4f8ef7', '#9b6dff', '#3ecf8e',
  '#f5c542', '#ff4d8b', '#ff9a3c', '#00e5ff',
]

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

// ─── Countdown overlay ────────────────────────────────────────
function CountdownOverlay({ serverTs }: { serverTs: string }) {
  const [count, setCount] = useState<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const startMs = new Date(serverTs).getTime()

    function tick() {
      const elapsed = Date.now() - startMs
      const remaining = Math.ceil((3000 - elapsed) / 1000)
      if (remaining <= 0) {
        setCount(0)
        return
      }
      setCount(remaining)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [serverTs])

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'rgba(4,4,15,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-sm font-semibold mb-6 tracking-widest uppercase" style={{ color: '#a78bfa' }}>
        Get Ready!
      </p>
      <div
        key={count}
        className="font-extrabold text-center"
        style={{
          fontSize: 'clamp(80px, 20vw, 160px)',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #6c50ff, #a78bfa, #00e5ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'popUp 0.3s ease-out',
        }}
      >
        {count === 0 ? 'GO!' : count}
      </div>
    </div>
  )
}

// ─── Player card ─────────────────────────────────────────────
function PlayerCard({
  name,
  isHost,
  isMe,
  team,
  gameHasTeams,
}: {
  name: string
  isHost: boolean
  isMe: boolean
  team: TeamChoice
  gameHasTeams: boolean
}) {
  const color = avatarColor(name)
  const initial = name.charAt(0).toUpperCase()

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: isMe ? 'rgba(108,80,255,0.1)' : 'var(--surface2)',
        border: isMe ? '1px solid rgba(108,80,255,0.3)' : '1px solid transparent',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
        style={{ background: color }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {name} {isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(you)</span>}
        </p>
        {gameHasTeams && team && (
          <p className="text-[10px]" style={{ color: team === 'A' ? '#4f8ef7' : '#9b6dff' }}>
            Team {team}
          </p>
        )}
      </div>
      {isHost && (
        <Crown size={13} style={{ color: '#f5c542', flexShrink: 0 }} />
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function RoomLobby() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? ''

  const {
    room,
    players,
    messages,
    loading,
    error,
    sendMessage,
    updateMyTeam,
    startCountdown,
    leaveRoom,
    countdownServerTs,
  } = useRoom(roomId ?? '', myId)

  const game = room ? MULTIPLAYER_GAME_MAP[room.game_id as keyof typeof MULTIPLAYER_GAME_MAP] : null
  const myPlayer = players.find(p => p.player_id === myId)
  const isHost = myPlayer?.is_host ?? false
  const isLocked = room?.status === 'countdown' || room?.status === 'in_progress'

  // Determine if start is possible
  const canStart = (() => {
    if (!room || !game || !isHost) return false
    const count = players.length
    if (game.fixedCount) return count === game.maxPlayers
    return count >= game.minPlayers
  })()

  const startBlockReason = (() => {
    if (!room || !game) return ''
    const count = players.length
    if (game.fixedCount && count < game.maxPlayers) {
      return `Need ${game.maxPlayers - count} more player${game.maxPlayers - count > 1 ? 's' : ''}`
    }
    if (!game.fixedCount && count < game.minPlayers) {
      return `Need ${game.minPlayers - count} more player${game.minPlayers - count > 1 ? 's' : ''}`
    }
    return ''
  })()

  // Navigate to game once countdown finishes
  useEffect(() => {
    if (!room) return
    if (room.status === 'in_progress') {
      navigate(`/multiplayer/game/${room.game_id}/${roomId}`)
    }
  }, [room?.status, room?.game_id, roomId, navigate, room])

  // Copy room ID to clipboard
  async function copyRoomId() {
    if (roomId) await navigator.clipboard.writeText(roomId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(108,80,255,0.4)', borderTopColor: '#6c50ff' }}
        />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>Room not found</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate('/multiplayer')}
          className="px-5 py-2 rounded-xl font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #6c50ff, #a78bfa)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Back to Multiplayer
        </button>
      </div>
    )
  }

  const gameHasTeams = game?.teamCapability === 'optional-2v2'
  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')
  const unassigned = players.filter(p => !p.team)

  return (
    <>
      {/* Countdown overlay */}
      {countdownServerTs && <CountdownOverlay serverTs={countdownServerTs} />}

      <div className="max-w-4xl mx-auto py-6 lg:pr-80">

        {/* ── Room header ── */}
        <div
          className="rounded-2xl p-5 mb-6 space-y-1"
          style={{ background: 'var(--surface)', border: '1px solid rgba(108,80,255,0.18)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{game?.emoji ?? '🎮'}</span>
                <h1 className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>
                  {room.room_name}
                </h1>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {game?.name} · {room.is_private ? '🔒 Private' : '🌐 Public'}
              </p>
            </div>

            {/* Status pill */}
            <span
              className="px-3 py-1 rounded-full text-xs font-bold flex-shrink-0"
              style={{
                background: room.status === 'waiting'
                  ? 'rgba(0,229,255,0.1)'
                  : 'rgba(255,184,0,0.1)',
                color: room.status === 'waiting' ? '#00e5ff' : '#ffb800',
              }}
            >
              {room.status === 'waiting' ? 'Waiting' : room.status}
            </span>
          </div>

          {/* Room code copy */}
          <button
            type="button"
            onClick={copyRoomId}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{
              background: 'var(--surface2)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Room ID: {roomId?.slice(0, 8)}… (tap to copy)
          </button>
        </div>

        {/* ── Players ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: '#a78bfa' }} />
            <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              Players ({players.length}/{room.max_player_count})
            </h2>
          </div>

          {gameHasTeams && room.current_player_count >= 4 ? (
            /* Team layout */
            <div className="grid grid-cols-2 gap-x-4">
              {/* Team A */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4f8ef7' }}>
                  Team A
                </p>
                {teamA.map(p => (
                  <PlayerCard
                    key={p.player_id}
                    name={p.display_name || p.username}
                    isHost={p.is_host}
                    isMe={p.player_id === myId}
                    team={p.team}
                    gameHasTeams={gameHasTeams}
                  />
                ))}
                {teamA.length === 0 && (
                  <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>No players yet</p>
                )}
              </div>

              {/* Team B */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9b6dff' }}>
                  Team B
                </p>
                {teamB.map(p => (
                  <PlayerCard
                    key={p.player_id}
                    name={p.display_name || p.username}
                    isHost={p.is_host}
                    isMe={p.player_id === myId}
                    team={p.team}
                    gameHasTeams={gameHasTeams}
                  />
                ))}
                {teamB.length === 0 && (
                  <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>No players yet</p>
                )}
              </div>

              {/* Unassigned */}
              {unassigned.length > 0 && (
                <div className="col-span-2 mt-3 space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Unassigned</p>
                  {unassigned.map(p => (
                    <PlayerCard
                      key={p.player_id}
                      name={p.display_name || p.username}
                      isHost={p.is_host}
                      isMe={p.player_id === myId}
                      team={p.team}
                      gameHasTeams={gameHasTeams}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FFA / flat list */
            <div className="space-y-2">
              {players.map(p => (
                <PlayerCard
                  key={p.player_id}
                  name={p.display_name || p.username}
                  isHost={p.is_host}
                  isMe={p.player_id === myId}
                  team={p.team}
                  gameHasTeams={gameHasTeams}
                />
              ))}
            </div>
          )}

          {/* Team picker — shown only to me, only for team-capable games while waiting */}
          {gameHasTeams && room.status === 'waiting' && (
            <div className="pt-2">
              <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>
                Your team preference:
              </p>
              <div className="flex gap-2">
                {(['A', 'B', null] as TeamChoice[]).map(t => (
                  <button
                    key={String(t)}
                    type="button"
                    onClick={() => updateMyTeam(t)}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150"
                    style={{
                      background: myPlayer?.team === t
                        ? t === 'A' ? 'rgba(79,142,247,0.2)' : t === 'B' ? 'rgba(155,109,255,0.2)' : 'rgba(255,255,255,0.08)'
                        : 'var(--surface2)',
                      color: t === 'A' ? '#4f8ef7' : t === 'B' ? '#9b6dff' : 'var(--text-dim)',
                      border: myPlayer?.team === t
                        ? `1px solid ${t === 'A' ? '#4f8ef7' : t === 'B' ? '#9b6dff' : 'rgba(255,255,255,0.2)'}`
                        : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {t === null ? 'No preference' : `Team ${t}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="mt-6 flex items-center gap-3">
          {/* Leave — only while waiting */}
          {!isLocked && (
            <button
              type="button"
              onClick={async () => {
                await leaveRoom()
                navigate('/multiplayer/browse')
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: 'rgba(255,79,79,0.1)',
                color: '#ff4f4f',
                border: '1px solid rgba(255,79,79,0.2)',
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
              Leave
            </button>
          )}

          {/* Start — only host, only while waiting */}
          {isHost && room.status === 'waiting' && (
            <button
              type="button"
              onClick={startCountdown}
              disabled={!canStart}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity"
              style={{
                background: canStart
                  ? 'linear-gradient(135deg, #6c50ff, #a78bfa)'
                  : 'var(--surface2)',
                color: canStart ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}
            >
              <Play size={16} />
              {canStart ? 'Start Game' : startBlockReason}
            </button>
          )}

          {/* Waiting message for non-hosts */}
          {!isHost && room.status === 'waiting' && (
            <div
              className="flex-1 py-3 rounded-xl text-center text-sm"
              style={{
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              Waiting for host to start…
            </div>
          )}
        </div>

      </div>

      {/* ── Chat panel ── */}
      <ChatPanel messages={messages} myId={myId} onSend={sendMessage} />
    </>
  )
}
