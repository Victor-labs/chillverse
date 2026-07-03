// src/pages/games/PatternKingRelay.tsx
// Renders inside Room.tsx once a Pattern King room is in_progress.
// Rules: one player is "active" and is shown a target pattern. The grid
// flashes face-up briefly (peek), then flips down. The active player has
// 6 seconds to tap the two cards matching the target. Succeed -> turn
// passes to the other player for a harder round. Fail (wrong pick or
// timeout) -> the active player loses, the other (who was spectating) wins.
// All resolution is server-side (pk_start/pk_begin_match/pk_pick/pk_timeout).
import { useEffect, useRef, useState } from 'react'
import { Eye, Zap } from 'lucide-react'
import { pkStart, pkBeginMatch, pkPick, pkTimeout, type PKState } from '../../lib/multiplayerGames'
import type { RoomRow } from '../../lib/rooms'
import type { RoomPlayerWithProfile } from '../../hooks/useRoom'

const ACCENT = '#00e5ff'

interface Props {
  room: RoomRow
  players: RoomPlayerWithProfile[]
  userId: string
  isHost: boolean
}

export default function PatternKingRelay({ room, players, userId, isHost }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const state = room.game_state as PKState | null
  const beganRef = useRef<string | null>(null)   // phase_started_at we've already called pk_begin_match for
  const timedOutRef = useRef<string | null>(null) // phase_started_at we've already tried pk_timeout for

  // 10x/sec clock for countdown displays + phase-boundary triggers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [])

  const activeUserId = state ? state.players[state.active_idx] : null
  const isActive = !!activeUserId && activeUserId === userId
  const activePlayer = players.find(p => p.user_id === activeUserId)

  // Drive peek -> match transition (only the active player's client triggers it)
  useEffect(() => {
    if (!state || state.phase !== 'peek' || !isActive) return
    const startedAt = new Date(state.phase_started_at).getTime()
    const elapsed = now - startedAt
    if (elapsed >= state.peek_ms && beganRef.current !== state.phase_started_at) {
      beganRef.current = state.phase_started_at
      pkBeginMatch(room.id).catch(() => { beganRef.current = null })
    }
  }, [now, state?.phase, state?.phase_started_at, isActive])

  // Safety net: if the 6s deadline passes and nothing resolved it, either
  // player's client forces resolution so a stalling opponent can't stall forever.
  useEffect(() => {
    if (!state || state.phase !== 'match' || !state.deadline) return
    const deadline = new Date(state.deadline).getTime()
    if (now > deadline + 250 && timedOutRef.current !== state.deadline) {
      timedOutRef.current = state.deadline
      pkTimeout(room.id).catch(() => {})
    }
  }, [now, state?.phase, state?.deadline])

  async function start() {
    setBusy(true); setError('')
    try { await pkStart(room.id) } catch (e: any) { setError(e.message) }
    setBusy(false)
  }

  async function pick(idx: number) {
    if (!state || busy || !isActive || state.phase !== 'match') return
    if (state.picks.includes(idx)) return
    setBusy(true); setError('')
    try { await pkPick(room.id, idx) } catch (e: any) { setError(e.message) }
    setBusy(false)
  }

  if (!state) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 16px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Alternating sudden-death. Find your pair in 6 seconds.</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Miss it, and your opponent wins.</p>
        {isHost && (
          <button onClick={start} disabled={busy} style={{ padding: '11px 24px', borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Starting…' : 'Start Relay'}
          </button>
        )}
        {error && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 10 }}>{error}</p>}
      </div>
    )
  }

  const gameOver = state.phase === 'done'
  const iWon = state.winner === userId

  if (gameOver) {
    const winnerP = players.find(p => p.user_id === state.winner)
    const winnerName = winnerP?.display_name ?? winnerP?.username ?? 'Opponent'
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ fontSize: 20, fontWeight: 900, color: iWon ? ACCENT : 'var(--text-muted)', marginBottom: 6 }}>
          {iWon ? '🏆 You win!' : `${winnerName} wins!`}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Survived {state.rounds_completed} round{state.rounds_completed === 1 ? '' : 's'}</p>
        {isHost && (
          <button onClick={start} disabled={busy} style={{ padding: '10px 22px', borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Starting…' : 'Rematch'}
          </button>
        )}
        {!isHost && <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Waiting for host to start a rematch…</p>}
      </div>
    )
  }

  const isPeek = state.phase === 'peek'
  const secLeft = isPeek
    ? Math.max(0, Math.ceil((state.peek_ms - (now - new Date(state.phase_started_at).getTime())) / 1000))
    : state.deadline ? Math.max(0, (new Date(state.deadline).getTime() - now) / 1000) : 6

  const cols = state.grid.length <= 6 ? 3 : state.grid.length <= 8 ? 4 : state.grid.length <= 12 ? 4 : 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 8px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, borderRadius: 12, padding: '4px 10px' }}>
          Round {state.round}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800,
          color: isPeek ? 'var(--gold)' : ACCENT, background: isPeek ? 'rgba(245,197,66,0.1)' : `${ACCENT}14`,
          border: `1px solid ${isPeek ? 'rgba(245,197,66,0.3)' : ACCENT + '30'}`, borderRadius: 20, padding: '4px 10px',
        }}>
          {isPeek ? <Eye size={11} /> : <Zap size={11} />} {isPeek ? 'Memorize' : `${secLeft.toFixed(1)}s`}
        </span>
      </div>

      <p style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'center', color: isActive ? ACCENT : 'var(--text-muted)' }}>
        {isActive
          ? `Find the pair: ${state.target_sym}`
          : `${activePlayer?.display_name ?? activePlayer?.username ?? 'Opponent'} is finding ${state.target_sym} — you're spectating`}
      </p>

      {!isPeek && (
        <div style={{ width: '90%', maxWidth: 280, height: 5, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: secLeft < 2 ? '#ff6b6b' : ACCENT, width: `${(secLeft / 6) * 100}%`, transition: 'width 0.1s linear' }} />
        </div>
      )}

      <div style={{ display: 'grid', gap: 7, gridTemplateColumns: `repeat(${cols}, 1fr)`, width: '100%', maxWidth: 320, padding: '6px 8px' }}>
        {state.grid.map((sym, i) => {
          const revealed = isPeek || state.picks.includes(i)
          const clickable = isActive && !isPeek && !state.picks.includes(i)
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => pick(i)}
              style={{
                aspectRatio: '1 / 1', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
                background: revealed ? 'var(--surface2)' : 'var(--surface)',
                boxShadow: revealed ? 'inset 1px 1px 4px var(--neu-dark)' : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, cursor: clickable ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              {revealed ? sym : <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>✦</span>}
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</p>}
    </div>
  )
}
