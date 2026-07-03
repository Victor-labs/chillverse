// src/pages/games/TacZoneMultiplayer.tsx
// Renders inside Room.tsx once a Tac Zone room is in_progress. All logic
// (turn validation, win detection, XP) lives server-side in tac_move/tac_start —
// this component just reflects room.game_state and calls the RPCs.
import { useState } from 'react'
import { X, Circle, Grid3X3 } from 'lucide-react'
import { tacMove, tacStart, type TacState } from '../../lib/multiplayerGames'
import type { RoomRow } from '../../lib/rooms'
import type { RoomPlayerWithProfile } from '../../hooks/useRoom'

const ACCENT = '#3ecf8e'
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const

function winLine(state: TacState): number[] | null {
  if (!state.winner || state.winner === 'draw') return null
  for (const line of WINS) {
    const [a, b, c] = line
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) return [...line]
  }
  return null
}

interface Props {
  room: RoomRow
  players: RoomPlayerWithProfile[]
  userId: string
  isHost: boolean
}

export default function TacZoneMultiplayer({ room, players, userId, isHost }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = room.game_state as TacState | null

  const opponent = players.find(p => p.user_id !== userId)

  async function rematch() {
    setBusy(true); setError('')
    try { await tacStart(room.id) } catch (e: any) { setError(e.message) }
    setBusy(false)
  }

  if (!state) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 16px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>Ready to play Tac Zone.</p>
        {isHost && (
          <button onClick={rematch} disabled={busy} style={{ padding: '11px 24px', borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Starting…' : 'Start Match'}
          </button>
        )}
        {error && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 10 }}>{error}</p>}
      </div>
    )
  }

  const mySymbol = state.players.X === userId ? 'X' : 'O'
  const isMyTurn = room.turn_user_id === userId
  const line = winLine(state)
  const gameOver = !!state.winner

  async function tapCell(idx: number) {
    if (!state || busy || gameOver || !isMyTurn || state.board[idx]) return
    setBusy(true); setError('')
    try { await tacMove(room.id, idx) } catch (e: any) { setError(e.message) }
    setBusy(false)
  }

  const iWon = state.winner === mySymbol
  const isDraw = state.winner === 'draw'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, borderRadius: 12, padding: '4px 10px' }}>
          You are {mySymbol}
        </span>
        <p style={{ fontSize: 13.5, fontWeight: 700, minHeight: 20, color: gameOver ? 'var(--gold)' : isMyTurn ? ACCENT : 'var(--text-muted)' }}>
          {gameOver
            ? isDraw ? "It's a draw!" : iWon ? '🎉 You win!' : `${opponent?.display_name ?? opponent?.username ?? 'Opponent'} wins!`
            : isMyTurn ? 'Your move' : `Waiting on ${opponent?.display_name ?? opponent?.username ?? 'opponent'}…`}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 78px)', gridTemplateRows: 'repeat(3, 78px)', gap: 8 }}>
        {state.board.map((cell, i) => {
          const inLine = line?.includes(i)
          return (
            <button key={i} type="button" onClick={() => tapCell(i)} disabled={!!cell || gameOver || !isMyTurn}
              style={{
                width: 78, height: 78, borderRadius: 18, cursor: cell || gameOver || !isMyTurn ? 'default' : 'pointer',
                background: inLine ? (iWon ? 'rgba(62,207,142,0.18)' : 'rgba(255,77,139,0.18)') : 'var(--surface)',
                boxShadow: inLine ? `0 0 24px ${iWon ? 'rgba(62,207,142,0.5)' : 'rgba(255,77,139,0.5)'}` : '4px 4px 12px var(--neu-dark), -3px -3px 8px var(--neu-light)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s',
              }}>
              {cell === 'X' && <X size={34} style={{ color: ACCENT }} />}
              {cell === 'O' && <Circle size={30} style={{ color: 'var(--pink)' }} />}
            </button>
          )
        })}
      </div>

      {gameOver && isHost && (
        <button onClick={rematch} disabled={busy} style={{ padding: '10px 22px', borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          <Grid3X3 size={13} style={{ marginRight: 6, verticalAlign: -2 }} /> {busy ? 'Starting…' : 'Rematch'}
        </button>
      )}
      {gameOver && !isHost && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Waiting for host to start a rematch…</p>
      )}
      {error && <p style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</p>}
    </div>
  )
}
