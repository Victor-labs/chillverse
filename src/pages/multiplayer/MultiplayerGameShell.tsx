// src/pages/multiplayer/MultiplayerGameShell.tsx
// Route: /multiplayer/game/:gameId/:roomId
// Sits between RoomLobby (countdown done) and each individual game component.
// Handles: room status guard, loading, routing to correct game, chat panel overlay.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRoom } from './useRoom'
import ChatPanel from './ChatPanel'
import type { MultiplayerGameId } from './multiplayerGameData'

// Game components — lazy-ish via conditional import pattern
import TacZoneMP         from './games/TacZoneMP'
import TriviaClashMP     from './games/TriviaClashMP'
import LiarsGridMP       from './games/LiarsGridMP'
import TwoTruthsMP       from './games/TwoTruthsMP'
import BluffBidMP        from './games/BluffBidMP'
import NumberRushMP      from './games/NumberRushMP'
import WordChainMP       from './games/WordChainMP'

export default function MultiplayerGameShell() {
  const { gameId, roomId } = useParams<{ gameId: string; roomId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? ''

  const { room, players, messages, sendMessage, broadcast, loading, error, isHost } =
    useRoom(roomId ?? '', myId)

  const [gameOver, setGameOver] = useState(false)

  // Guard: if room not in_progress, redirect back
  useEffect(() => {
    if (!room || loading) return
    if (room.status === 'waiting') {
      navigate(`/multiplayer/room/${roomId}`, { replace: true })
    }
  }, [room?.status, loading, navigate, roomId, room])

  // When the game ends, only the HOST marks the room as completed.
  // This prevents race conditions where multiple players all try to
  // update the row at once. Non-hosts just set local gameOver state.
  useEffect(() => {
    if (!room || loading) return
    if ((room.status === 'completed' || gameOver) && isHost) {
      supabase
        .from('game_rooms')
        .update({ status: 'completed' })
        .eq('id', roomId)
        .eq('status', 'in_progress') // guard — only transition from in_progress
        .then(({ error }) => {
          if (error) console.error('[MultiplayerGameShell] Failed to complete room:', error.message)
        })
    }
  }, [room?.status, gameOver, loading, isHost, roomId, room])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(108,80,255,0.4)', borderTopColor: '#6c50ff' }} />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: 'var(--bg)' }}>
        <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>
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

  const sharedProps = {
    roomId: roomId ?? '',
    myId,
    players,
    room,
    broadcast,
    onGameOver: () => setGameOver(true),
  }

  function renderGame() {
    switch (gameId as MultiplayerGameId) {
      case 'tac-zone':      return <TacZoneMP      {...sharedProps} />
      case 'trivia-clash':  return <TriviaClashMP  {...sharedProps} />
      case 'liars-grid':    return <LiarsGridMP     {...sharedProps} />
      case 'two-truths':    return <TwoTruthsMP     {...sharedProps} />
      case 'bluff-bid':     return <BluffBidMP      {...sharedProps} />
      case 'number-rush':   return <NumberRushMP    {...sharedProps} />
      case 'word-chain':    return <WordChainMP     {...sharedProps} />
      default:
        return (
          <div className="flex items-center justify-center h-screen">
            <p style={{ color: 'var(--text-muted)' }}>Unknown game: {gameId}</p>
          </div>
        )
    }
  }

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Game fills viewport, chat floats on top */}
      {renderGame()}
      <ChatPanel messages={messages} myId={myId} onSend={sendMessage} />
    </div>
  )
}
