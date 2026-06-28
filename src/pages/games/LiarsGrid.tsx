// src/pages/games/LiarsGrid.tsx
import { useState, useEffect, useRef } from 'react'
import { LayoutGrid } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../../hooks/useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { ripple } from '../../lib/ripple'

const ACCENT = '#ff4f4f'
const GAME_ID = 'liars-grid' as const

interface RankGridConfig {
  timeSec: number
  rounds: number
  ops: ('add' | 'sub' | 'mul')[]
  streakRequired: number
}

const RANK_CONFIG: Record<GameRank, RankGridConfig> = {
  beginner:     { timeSec: 60, rounds: 10, ops: ['add', 'sub'],              streakRequired: 5 },
  intermediate: { timeSec: 50, rounds: 11, ops: ['add', 'sub'],              streakRequired: 5 },
  advanced:     { timeSec: 40, rounds: 11, ops: ['add', 'sub', 'mul'],       streakRequired: 5 },
  master:       { timeSec: 30, rounds: 9,  ops: ['add', 'sub', 'mul'],       streakRequired: 5 },
}

// Difficulty lever: timer per round, scaled by current game rank
const RANK_ROUND_TIME: Record<GameRank, number> = {
  beginner:     10,
  intermediate: 8,
  advanced:     6,
  master:       4,
}

function getRoundTime(rank: GameRank): number {
  return RANK_ROUND_TIME[rank]
}

// Base XP per correct answer, scaled by current game rank
const RANK_XP: Record<GameRank, number> = {
  beginner:     15,
  intermediate: 17,
  advanced:     19,
  master:       21,
}

const STREAK_THRESHOLD = 10
const STREAK_MULTIPLIER = 1.5
const SESSION_XP_CAP = 300

interface Equation {
  a: number
  b: number
  op: 'add' | 'sub' | 'mul'
  display: string   // e.g. "14 + 6"
  stated: number    // the answer shown on card
  real: number      // the actual correct answer
  isLiar: boolean
}

function opSymbol(op: 'add' | 'sub' | 'mul') {
  return op === 'add' ? '+' : op === 'sub' ? '−' : '×'
}

function generateGrid(ops: ('add' | 'sub' | 'mul')[], numCells: number): Equation[] {
  const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  const liarIdx = Math.floor(Math.random() * numCells)
  const equations: Equation[] = []

  for (let i = 0; i < numCells; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)]
    let a: number, b: number, real: number

    if (op === 'add') { a = r(1, 27); b = r(1, 27); real = a + b }
    else if (op === 'sub') { a = r(10, 30); b = r(1, a); real = a - b }
    else { a = r(2, 12); b = r(2, 12); real = a * b }

    const isLiar = i === liarIdx
    // For the liar: state a wrong answer (off by 1–7, never 0)
    let stated = real
    if (isLiar) {
      let offset = r(1, 7)
      if (Math.random() < 0.5) offset = -offset
      stated = real + offset
      if (stated === real) stated = real + 1 // safety
    }

    equations.push({
      a, b, op,
      display: `${a} ${opSymbol(op)} ${b}`,
      stated, real, isLiar,
    })
  }
  return equations
}

type CellStatus = 'idle' | 'selected-wrong' | 'revealed-liar' | 'dimmed'

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function LiarsGrid({ rank: initialRank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [round, setRound] = useState(1)
  const [grid, setGrid] = useState<Equation[]>([])
  const [cellStatus, setCellStatus] = useState<CellStatus[]>([])
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [roundPct, setRoundPct] = useState(100)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)
  const [streakMultiplier, setStreakMultiplier] = useState(1)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const roundRef = useRef(1)
  const startRef = useRef(Date.now())
  const sessionXpRef = useRef(0)
  const sessionStreakRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function getRankCfg() { return RANK_CONFIG[rankState.rank] }

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
    if (roundDeadlineRef.current) clearTimeout(roundDeadlineRef.current)
    if (roundTickRef.current) clearInterval(roundTickRef.current)
  }

  function startRoundTimer(currentGrid: Equation[]) {
    if (roundDeadlineRef.current) clearTimeout(roundDeadlineRef.current)
    if (roundTickRef.current) clearInterval(roundTickRef.current)
    const windowMs = getRoundTime(rankState.rank) * 1000
    const rStart = Date.now()
    setRoundPct(100)
    roundTickRef.current = setInterval(() => {
      const remaining = Math.max(0, 1 - (Date.now() - rStart) / windowMs)
      setRoundPct(remaining * 100)
    }, 50)
    roundDeadlineRef.current = setTimeout(() => {
      // Round timed out with no tap — counts as a miss
      if (roundTickRef.current) clearInterval(roundTickRef.current)
      onWrong()
      sessionStreakRef.current = 0
      setStreakMultiplier(1)
      const liarIdx = currentGrid.findIndex(e => e.isLiar)
      setCellStatus(prev => prev.map((_, i) => (i === liarIdx ? 'revealed-liar' : 'dimmed')))
      const cfg = getRankCfg()
      advanceRef.current = setTimeout(() => {
        const nextRound = roundRef.current + 1
        if (nextRound > cfg.rounds) { endGame(); return }
        newRound(nextRound)
      }, 1200)
    }, windowMs)
  }

  function newRound(rnd: number) {
    const cfg = getRankCfg()
    const newGrid = generateGrid(cfg.ops, 9)
    setGrid(newGrid)
    setCellStatus(Array(9).fill('idle'))
    setRound(rnd)
    roundRef.current = rnd
    startRoundTimer(newGrid)
  }

  function startTimer() {
    clearTimers()
    const cfg = getRankCfg()
    setTimeLeft(cfg.timeSec)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    scoreRef.current = 0; correctRef.current = 0; roundRef.current = 1
    sessionXpRef.current = 0; sessionStreakRef.current = 0
    setScore(0); setPromoted(null); setResult(null)
    setStreakMultiplier(1)
    startRef.current = Date.now()
    newRound(1)
    setPhase('play')
    startTimer()
  }

  function tap(idx: number) {
    if (cellStatus[idx] !== 'idle') return
    const eq = grid[idx]
    const cfg = getRankCfg()
    if (roundDeadlineRef.current) clearTimeout(roundDeadlineRef.current)
    if (roundTickRef.current) clearInterval(roundTickRef.current)

    if (eq.isLiar) {
      // Correct!
      const mult = rankState.currentStreak >= 2 ? 2 : 1
      setStreakMultiplier(mult)
      const pts = Math.floor((timeLeft / cfg.timeSec) * 40 + 20) * mult
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current)
      sessionStreakRef.current += 1
      const baseXp = RANK_XP[rankState.rank]
      const xpForAnswer = Math.round(
        baseXp * (sessionStreakRef.current > STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1)
      )
      sessionXpRef.current += xpForAnswer
      // Reveal: dim all correct, highlight liar in red
      setCellStatus(prev => prev.map((_, i) => i === idx ? 'revealed-liar' : 'dimmed'))
      const { promoted: promo } = onCorrect(cfg.streakRequired)
      if (promo) setPromoted(promo)
      // Advance to next round
      advanceRef.current = setTimeout(() => {
        const nextRound = roundRef.current + 1
        if (nextRound > cfg.rounds) { endGame(); return }
        newRound(nextRound)
      }, 900)
    } else {
      // Wrong — reveal which one was actually wrong
      onWrong()
      sessionStreakRef.current = 0
      setStreakMultiplier(1)
      const liarIdx = grid.findIndex(e => e.isLiar)
      setCellStatus(prev => prev.map((_, i) => {
        if (i === idx) return 'selected-wrong'
        if (i === liarIdx) return 'revealed-liar'
        return 'dimmed'
      }))
      advanceRef.current = setTimeout(() => {
        const nextRound = roundRef.current + 1
        if (nextRound > cfg.rounds) { endGame(); return }
        newRound(nextRound)
      }, 1200)
    }
  }

  function endGame() {
    clearTimers()
    const cfg = getRankCfg()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp = Math.min(sessionXpRef.current, SESSION_XP_CAP)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: "Liar's Grid",
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total: cfg.rounds,
      detail: { 'Liars Found': correctRef.current, 'Best Streak': rankState.bestStreak },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  useEffect(() => () => clearTimers(), [])

  const rankCfg = getRankConfig(rankState.rank)
  const cfg = getRankCfg()

  const rules = [
    { icon: '🔢', text: 'One equation in the grid has a wrong answer' },
    { icon: '👆', text: 'Tap the liar as fast as you can' },
    { icon: '⏱', text: `${getRoundTime(rankState.rank)}s per round to answer · ${cfg.rounds} rounds (${rankCfg.label})` },
    { icon: '🔥', text: '5 correct in a row = rank up · Streak boosts XP' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Liar's Grid"
      tagline="Find the wrong equation. One is lying."
      accent={ACCENT}
      icon={<LayoutGrid size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg.streakRequired}
      onStart={start}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={promoted} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.06, background: ACCENT, top: '10%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Liar's Grid"
        accent={ACCENT}
        icon={<LayoutGrid size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraLeft={
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
            Round {round}/{cfg.rounds}
          </span>
        }
        extraRight={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            {/* Streak multiplier pill */}
            {streakMultiplier > 1 && (
              <div style={{
                background: 'rgba(245,197,66,0.15)', border: '1px solid rgba(245,197,66,0.4)',
                borderRadius: 10, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: 'var(--gold)',
              }}>
                {streakMultiplier}x
              </div>
            )}
            <div style={{
              fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 10,
              color: timeLeft <= 10 ? 'var(--red)' : 'var(--text-dim)',
              background: timeLeft <= 10 ? 'rgba(255,79,79,0.12)' : 'var(--surface2)',
              border: `1px solid ${timeLeft <= 10 ? 'rgba(255,79,79,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              {timeLeft}s
            </div>
          </div>
        }
      />

      {/* Per-round timer bar — shortens as rank increases */}
      <div style={{ padding: '6px 16px 4px' }}>
        <TimerBar pct={roundPct} accent={ACCENT} urgent />
      </div>

      {/* Equation grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '10px 14px', flex: 1, alignContent: 'center' }}>
        {grid.map((eq, i) => {
          const status = cellStatus[i] ?? 'idle'
          const isLiarRevealed = status === 'revealed-liar'
          const isSelectedWrong = status === 'selected-wrong'
          const isDimmed = status === 'dimmed'

          let bg = 'var(--surface)'
          let border = 'rgba(255,255,255,0.07)'
          let shadow = '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)'

          if (isLiarRevealed) {
            bg = 'rgba(255,79,79,0.10)'; border = 'rgba(255,79,79,0.55)'; shadow = `0 0 16px rgba(255,79,79,0.3)`
          } else if (isSelectedWrong) {
            bg = 'rgba(255,79,79,0.06)'; border = 'rgba(255,79,79,0.3)'
          } else if (isDimmed) {
            bg = 'rgba(255,255,255,0.02)'; border = 'rgba(255,255,255,0.04)'
          }

          return (
            <button
              key={i}
              type="button"
              className="ripple-wrap"
              onClick={(e) => { ripple(e); tap(i) }}
              style={{
                borderRadius: 14, padding: '12px 8px', textAlign: 'center',
                background: bg, border: `1px solid ${border}`, boxShadow: shadow,
                cursor: status === 'idle' ? 'pointer' : 'default',
                transition: 'all 0.22s', opacity: isDimmed ? 0.38 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: isLiarRevealed ? 'var(--red)' : 'var(--text)', lineHeight: 1.2 }}>
                {eq.display}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: isLiarRevealed ? 'var(--red)' : 'var(--text)', fontFamily: 'monospace' }}>
                = {eq.stated}
              </span>
              {/* Show real answer in red when liar is revealed */}
              {isLiarRevealed && (
                <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, fontFamily: 'monospace' }}>
                  = {eq.real}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bottom hint */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '4px 0 14px', fontWeight: 600 }}>
        Spot the liar!
      </p>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
