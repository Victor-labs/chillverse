// src/pages/games/TacZone.tsx
import { useState, useRef } from 'react'
import { Grid3X3, X, Circle } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'

const ACCENT = '#3ecf8e'
const GAME_ID = 'tac-zone' as const

type TacCell = 'X' | 'O' | null
type TacMode = 'easy' | 'hard' | 'expert'
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const

function checkWin(b: TacCell[]): { winner: TacCell; line: number[] | null } {
  for (const [a, bI, c] of WINS) {
    if (b[a] && b[a] === b[bI] && b[a] === b[c]) return { winner: b[a], line: [a, bI, c] }
  }
  return { winner: null, line: null }
}

function minimax(board: TacCell[], isMax: boolean, depth: number, alpha: number, beta: number): number {
  const { winner } = checkWin(board)
  if (winner === 'O') return 10 - depth
  if (winner === 'X') return depth - 10
  if (board.every(c => c !== null)) return 0
  let best = isMax ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = isMax ? 'O' : 'X'
      const val = minimax(board, !isMax, depth + 1, alpha, beta)
      board[i] = null
      if (isMax) { best = Math.max(best, val); alpha = Math.max(alpha, val) }
      else        { best = Math.min(best, val); beta  = Math.min(beta, val) }
      if (beta <= alpha) break
    }
  }
  return best
}

function getBestMove(board: TacCell[], mode: TacMode): number {
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0)
  if (empty.length === 0) return -1
  if (mode === 'easy') return empty[Math.floor(Math.random() * empty.length)]
  if (mode === 'hard' && Math.random() < 0.35) return empty[Math.floor(Math.random() * empty.length)]
  // Expert + rest of hard: true minimax with alpha-beta pruning
  let best = -Infinity; let move = empty[0]
  for (const i of empty) {
    const b = [...board] as TacCell[]; b[i] = 'O'
    const val = minimax(b, false, 0, -Infinity, Infinity)
    if (val > best) { best = val; move = i }
  }
  return move
}

// Base XP per win, scaled by current game rank (no streak multiplier for TacZone)
const RANK_XP: Record<GameRank, number> = {
  beginner:     25,
  intermediate: 27,
  advanced:     29,
  master:       31,
}

const SESSION_XP_CAP = 300

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function TacZone({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const [mode, setMode] = useState<TacMode>('hard')
  useGamePresence(GAME_ID)
  const { rankState } = useRankStreak(GAME_ID, initialRank)

  const [board, setBoard] = useState<TacCell[]>(Array(9).fill(null))
  const [aiTurn, setAiTurn] = useState(false)
  const [gameResult, setGameResult] = useState<{ winner: TacCell; line: number[] | null } | null>(null)
  const [sessionScores, setSessionScores] = useState({ W: 0, D: 0, L: 0 })
  const [totalXP, setTotalXP] = useState(0)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const startRef = useRef(Date.now())
  const moveCountRef = useRef(0)
  const sessionXpRef = useRef(0)

  function newGame() {
    setBoard(Array(9).fill(null))
    setGameResult(null)
    setAiTurn(false)
    moveCountRef.current = 0
  }

  function start() {
    setSessionScores({ W: 0, D: 0, L: 0 })
    setTotalXP(0)
    sessionXpRef.current = 0
    setResult(null)
    startRef.current = Date.now()
    newGame()
    setPhase('play')
  }

  function resolveBoard(b: TacCell[]) {
    const res = checkWin(b)
    const isDraw = b.every(c => c !== null) && !res.winner
    if (res.winner || isDraw) {
      setGameResult(isDraw ? { winner: null, line: null } : res)
      if (res.winner === 'X') {
        // Player wins — flat XP based on current game rank, no multiplier
        const earnedXP = RANK_XP[rankState.rank]
        sessionXpRef.current = Math.min(sessionXpRef.current + earnedXP, SESSION_XP_CAP)
        setTotalXP(sessionXpRef.current)
        setSessionScores(s => ({ ...s, W: s.W + 1 }))
      } else if (res.winner === 'O') {
        setSessionScores(s => ({ ...s, L: s.L + 1 }))
      } else {
        setSessionScores(s => ({ ...s, D: s.D + 1 }))
      }
      return true
    }
    return false
  }

  function tapCell(idx: number) {
    if (phase !== 'play' || board[idx] || aiTurn || gameResult) return
    const nb = [...board] as TacCell[]
    nb[idx] = 'X'; moveCountRef.current += 1
    setBoard(nb)
    if (resolveBoard(nb)) return
    setAiTurn(true)
    setTimeout(() => {
      const move = getBestMove(nb, mode)
      if (move === -1) return
      const nb2 = [...nb] as TacCell[]
      nb2[move] = 'O'; moveCountRef.current += 1
      setBoard(nb2)
      resolveBoard(nb2)
      setAiTurn(false)
    }, 450)
  }

  function endSession() {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const total = sessionScores.W + sessionScores.D + sessionScores.L
    // Already capped as it accumulated (see resolveBoard), so this matches
    // exactly what was shown live in the HUD during play.
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Tac Zone',
      rank: 'beginner', // TacZone is exempt from rank system
      score: sessionScores.W * 100 + sessionScores.D * 30,
      xpEarned: sessionXpRef.current,
      durationSec: dur,
      streak: sessionScores.W,
      correct: sessionScores.W,
      total,
      detail: { 'Wins': sessionScores.W, 'Draws': sessionScores.D, 'Losses': sessionScores.L },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  const rules = [
    { icon: '🧠', text: 'You are X — get three in a row to win' },
    { icon: '⚡', text: 'XP per win scales with your current game rank' },
    { icon: '♾️', text: 'Unlimited plays — no daily limit' },
    { icon: '🤖', text: 'AI difficulty: Easy / Hard / Expert' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Tac Zone"
      tagline="Three in a row. No mercy."
      accent={ACCENT}
      icon={<Grid3X3 size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={0}
      onStart={start}
      onClose={onBack}
      extraContent={
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          {(['easy', 'hard', 'expert'] as TacMode[]).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: mode === m ? 'rgba(255,255,255,0.12)' : 'var(--surface2)',
                color: mode === m ? '#fff' : 'var(--text-dim)',
                border: mode === m ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: mode === m ? `0 0 12px ${ACCENT}30` : '2px 2px 6px var(--neu-dark)',
                textTransform: 'capitalize',
              }}>
              {m}
            </button>
          ))}
        </div>
      }
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.07, background: ACCENT, bottom: '15%', left: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Tac Zone"
        accent={ACCENT}
        icon={<Grid3X3 size={14} />}
        streak={sessionScores.W}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="W" value={sessionScores.W} accent="var(--green)" />
            <StatChip label="D" value={sessionScores.D} />
            <StatChip label="L" value={sessionScores.L} accent="var(--red)" />
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '16px', gap: 16 }}>
        {/* Mode + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, borderRadius: 12, padding: '4px 10px', textTransform: 'uppercase' }}>{mode}</span>
          <p style={{ fontSize: 14, fontWeight: 600, minHeight: 22, color: gameResult ? 'var(--gold)' : aiTurn ? 'var(--text-muted)' : ACCENT }}>
            {gameResult ? (gameResult.winner === 'X' ? '🎉 You win!' : gameResult.winner === 'O' ? '🤖 AI wins!' : "It's a draw!") : aiTurn ? 'AI thinking…' : 'Your move (X)'}
          </p>
        </div>

        {/* XP earned this session */}
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Session XP: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{totalXP}</span>
        </div>

        {/* Board */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 92px)', gridTemplateRows: 'repeat(3, 92px)', gap: 10 }}>
          {board.map((cell, i) => {
            const inLine = gameResult?.line?.includes(i)
            return (
              <button key={i} type="button" onClick={() => tapCell(i)} aria-label={`Cell ${i + 1}`}
                style={{
                  width: 92, height: 92, borderRadius: 20, cursor: cell || gameResult ? 'default' : 'pointer',
                  background: inLine ? (gameResult?.winner === 'X' ? 'rgba(62,207,142,0.18)' : 'rgba(255,77,139,0.18)') : 'var(--surface)',
                  boxShadow: inLine ? `0 0 28px ${gameResult?.winner === 'X' ? 'rgba(62,207,142,0.5)' : 'rgba(255,77,139,0.5)'}` : '4px 4px 12px var(--neu-dark), -3px -3px 8px var(--neu-light)',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s',
                }}>
                {cell === 'X' && <X size={40} style={{ color: ACCENT }} />}
                {cell === 'O' && <Circle size={38} style={{ color: 'var(--pink)' }} />}
              </button>
            )
          })}
        </div>

        {/* Action buttons */}
        {gameResult && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={newGame}
              style={{ padding: '11px 24px', borderRadius: 13, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Rematch
            </button>
            <button type="button" onClick={endSession}
              style={{ padding: '11px 24px', borderRadius: 13, background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 8px var(--neu-dark)' }}>
              End Session
            </button>
          </div>
        )}
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
