// src/pages/multiplayer/RoomLobby.tsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crown, Users, LogOut, Play, Copy, Check } from 'lucide-react'
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

// ---------------------------------------------------------------
// Countdown overlay (5 seconds)
// ---------------------------------------------------------------
function CountdownOverlay({ serverTs }: { serverTs: string }) {
  const [count, setCount] = useState<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const startMs = new Date(serverTs).getTime()

    function tick() {
      const elapsed = Date.now() - startMs
      const remaining = Math.ceil((5000 - elapsed) / 1000)
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

// ---------------------------------------------------------------
// Player card
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// Short code copy widget (private rooms only)
// ---------------------------------------------------------------
function PrivateCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors"
      style={{
        background: 'rgba(108,80,255,0.08)',
        border: '1px solid rgba(108,80,255,0.25)',
        cursor: 'pointer',
      }}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-left" style={{ color: 'var(--text-muted)' }}>
          Private Room Code
        </p>
        <p
          className="font-extrabold text-base tracking-[0.25em] font-mono text-left"
          style={{ color: '#a78bfa', letterSpacing: '0.2em' }}
        >
          {code}
        </p>
      </div>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1"
        style={{ background: copied ? 'rgba(62,207,142,0.15)' : 'rgba(108,80,255,0.12)' }}
      >
        {copied
          ? <Check size={13} style={{ color: '#3ecf8e' }} />
          : <Copy size={13} style={{ color: '#a78bfa' }} />
        }
      </div>
    </button>
  )
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
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
    isHost,
    sendMessage,
    updateMyTeam,
    startCountdown,
    leaveRoom,
    countdownServerTs,
  } = useRoom(roomId ?? '', myId)

  const game = room ? MULTIPLAYER_GAME_MAP[room.game_id as keyof typeof MULTIPLAYER_GAME_MAP] : null
  const myPlayer = players.find(p => p.player_id === myId)
  const isLocked = room?.status === 'countdown' || room?.status === 'in_progress'

  // -- enoughPlayers: purely about count, independent of host status ----
  // Used by BOTH host and non-host to show accurate waiting messages.
  const enoughPlayers = (() => {
    if (!room || !game) return false
    const count = players.length
    if (game.fixedCount) return count === game.maxPlayers
    return count >= game.minPlayers
  })()

  // -- canStart: host ONLY can click the start button -------------------
  const canStart = isHost && enoughPlayers && room?.status === 'waiting'

  // Reason the start button is disabled (shown inside the button)
  const startBlockReason = (() => {
    if (!room || !game) return ''
    if (!enoughPlayers) {
      const count = players.length
      if (game.fixedCount && count < game.maxPlayers) {
        return `Need ${game.maxPlayers - count} more player${game.maxPlayers - count > 1 ? 's' : ''}`
      }
      if (!game.fixedCount && count < game.minPlayers) {
        return `Need ${game.minPlayers - count} more player${game.minPlayers - count > 1 ? 's' : ''}`
      }
    }
    return ''
  })()

  // Slots remaining uses live players.length — always accurate
  const slotsRemaining = room ? room.max_player_count - players.length : 0

  // Navigate to game once in_progress
  useEffect(() => {
    if (!room) return
    if (room.status === 'in_progress') {
      navigate(`/multiplayer/game/${room.game_id}/${roomId}`)
    }
  }, [room?.status, room?.game_id, roomId, navigate, room])

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

  // Room was closed by host leaving — show clear message and back button
  if (error || !room) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          {error?.includes('closed') ? 'Room Closed' : 'Room not found'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {error ?? 'This room no longer exists.'}
        </p>
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
      {countdownServerTs && room.status === 'countdown' && <CountdownOverlay serverTs={countdownServerTs} />}

      <div className="max-w-4xl mx-auto py-6 lg:pr-80">

        {/* -- Room header -- */}
        <div
          className="rounded-2xl p-5 mb-6 space-y-3"
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
              {slotsRemaining > 0 && (
                <p className="text-xs mt-1" style={{ color: '#3ecf8e' }}>
                  {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            <span
              className="px-3 py-1 rounded-full text-xs font-bold flex-shrink-0"
              style={{
                background: room.status === 'waiting'
                  ? 'rgba(0,229,255,0.1)'
                  : room.status === 'countdown'
                  ? 'rgba(255,184,0,0.1)'
                  : 'rgba(108,80,255,0.1)',
                color: room.status === 'waiting' ? '#00e5ff'
                  : room.status === 'countdown' ? '#ffb800'
                  : '#a78bfa',
              }}
            >
              {room.status === 'waiting' ? 'Waiting'
                : room.status === 'countdown' ? 'Starting…'
                : 'In Game'}
            </span>
          </div>

          {/* -- Private room: show the 8-char short code for the host to share -- */}
          {/* Public rooms: no code shown — they appear in Browse Rooms automatically */}
          {room.is_private && room.short_code && isHost && (
            <PrivateCodeBadge code={room.short_code} />
          )}
          {room.is_private && room.short_code && !isHost && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              🔒 Private room — your host will share the room code.
            </p>
          )}
        </div>

        {/* -- Players -- */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: '#a78bfa' }} />
            {/* Player count uses live players array — always accurate including host */}
            <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              Players ({players.length}/{room.max_player_count})
            </h2>
          </div>

          {gameHasTeams && players.length >= 4 ? (
            <div className="grid grid-cols-2 gap-x-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4f8ef7' }}>Team A</p>
                {teamA.map(p => (
                  <PlayerCard key={p.player_id} name={p.display_name || p.username} isHost={p.is_host} isMe={p.player_id === myId} team={p.team} gameHasTeams={gameHasTeams} />
                ))}
                {teamA.length === 0 && <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>No players yet</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9b6dff' }}>Team B</p>
                {teamB.map(p => (
                  <PlayerCard key={p.player_id} name={p.display_name || p.username} isHost={p.is_host} isMe={p.player_id === myId} team={p.team} gameHasTeams={gameHasTeams} />
                ))}
                {teamB.length === 0 && <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>No players yet</p>}
              </div>
              {unassigned.length > 0 && (
                <div className="col-span-2 mt-3 space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Unassigned</p>
                  {unassigned.map(p => (
                    <PlayerCard key={p.player_id} name={p.display_name || p.username} isHost={p.is_host} isMe={p.player_id === myId} team={p.team} gameHasTeams={gameHasTeams} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {players.map(p => (
                <PlayerCard key={p.player_id} name={p.display_name || p.username} isHost={p.is_host} isMe={p.player_id === myId} team={p.team} gameHasTeams={gameHasTeams} />
              ))}
            </div>
          )}

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

        {/* -- Actions -- */}
        <div className="mt-6 flex items-center gap-3">
          {/* Leave — hidden during countdown/in_progress */}
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

          {/* Force Start — host only, enabled when enough players */}
          {isHost && room.status === 'waiting' && (
            <button
              type="button"
              onClick={startCountdown}
              disabled={!canStart}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity"
              style={{
                background: canStart ? 'rgba(108,80,255,0.2)' : 'var(--surface2)',
                color: canStart ? '#a78bfa' : 'var(--text-muted)',
                border: canStart
                  ? '1px solid rgba(108,80,255,0.5)'
                  : '1px solid transparent',
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}
            >
              <Play size={16} />
              {canStart ? 'Start Game' : startBlockReason || 'Waiting for players…'}
            </button>
          )}

          {/* Non-host waiting message — shows accurate status for ALL players */}
          {!isHost && room.status === 'waiting' && (
            <div
              className="flex-1 py-3 rounded-xl text-center text-sm"
              style={{
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {enoughPlayers
                ? `Waiting for host to start… (${players.length}/${room.max_player_count})`
                : startBlockReason
                  ? `${startBlockReason} to start`
                  : `Waiting for more players… (${players.length}/${room.max_player_count})`
              }
            </div>
          )}

          {/* Countdown / in-progress status message for everyone */}
          {room.status === 'countdown' && (
            <div
              className="flex-1 py-3 rounded-xl text-center text-sm font-semibold"
              style={{
                background: 'rgba(255,184,0,0.08)',
                color: '#ffb800',
                border: '1px solid rgba(255,184,0,0.15)',
              }}
            >
              Game starting…
            </div>
          )}

          {room.status === 'in_progress' && (
            <div
              className="flex-1 py-3 rounded-xl text-center text-sm font-semibold"
              style={{
                background: 'rgba(108,80,255,0.08)',
                color: '#a78bfa',
                border: '1px solid rgba(108,80,255,0.15)',
              }}
            >
              Game in progress
            </div>
          )}
        </div>

      </div>

      <ChatPanel messages={messages} myId={myId} onSend={sendMessage} />
    </>
  )
}
