// src/pages/games/ArrowDash.tsx
import { useState, useEffect, useRef } from 'react'
import { Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { ripple } from '../../../shared/lib/ripple'

const ACCENT = '#4f8ef7'
const GAME_ID = 'arrow-dash' as const

type Dir = 'up' | 'down' | 'left' | 'right'
const ALL_DIRS: Dir[] = ['up', 'down', 'left', 'right']

// Time window (ms) per rank for how long arrow is shown — difficulty lever
const RANK_TIME: Record<GameRank, number> = {
  beginner:     1400,
  intermediate: 1150,
  advanced:     950,
  master:       750,
}

// Base XP per correct answer, scaled by current game rank
const RANK_XP: Record<GameRank, number> = {
  beginner:     8,
  intermediate: 10,
  advanced:     12,
  master:       14,
}

const STREAK_THRESHOLD = 25
const STREAK_MULTIPLIER = 1.5

function getSpawnInterval(rank: GameRank): number {
  return RANK_TIME[rank]
}

const DIR_ICON: Record<Dir, LucideIcon> = {
  up:    ArrowUp,
  down:  ArrowDown,
  left:  ArrowLeft,
  right: ArrowRight,
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function ArrowDash({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [current, setCurrent] = useState<Dir>('up')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [timerPct, setTimerPct] = useState(100)
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none')
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const totalRef = useRef(0)
  const livesRef = useRef(3)
  const startRef = useRef(Date.now())
  const sessionXpRef = useRef(0)
  const sessionStreakRef = useRef(0)
  const arrowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function getRankTime() {
    return getSpawnInterval(rankState.rank)
  }

  function clearTimers() {
    if (arrowTimerRef.current) clearTimeout(arrowTimerRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
  }

  function nextArrow() {
    setCurrent(ALL_DIRS[Math.floor(Math.random() * 4)])
    setFlash('none')
    if (arrowTimerRef.current) clearTimeout(arrowTimerRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    const window = getRankTime()
    const start = Date.now()
    timerIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, 1 - (Date.now() - start) / window)
      setTimerPct(remaining * 100)
    }, 50)

    arrowTimerRef.current = setTimeout(() => {
      // Timeout — counts as wrong
      totalRef.current += 1
      onWrong()
      sessionStreakRef.current = 0
      setFlash('red')
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      if (newLives <= 0) {
        setTimeout(endGame, 400)
        return
      }
      setTimeout(nextArrow, 500)
    }, window)
  }

  function endGame() {
    clearTimers()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp = sessionXpRef.current
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Arrow Dash',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total: totalRef.current,
      detail: { 'Arrows Hit': correctRef.current },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    scoreRef.current = 0; correctRef.current = 0; totalRef.current = 0
    livesRef.current = 3
    sessionXpRef.current = 0; sessionStreakRef.current = 0
    setScore(0); setLives(3); setElapsed(0); setFlash('none')
    startRef.current = Date.now()
    setPhase('play')
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    nextArrow()
  }

  function tap(dir: Dir) {
    if (phase !== 'play') return
    if (arrowTimerRef.current) clearTimeout(arrowTimerRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    totalRef.current += 1

    if (dir === current) {
      setFlash('green')
      scoreRef.current += 1; correctRef.current += 1
      setScore(scoreRef.current)
      sessionStreakRef.current += 1
      const baseXp = RANK_XP[rankState.rank]
      const xpForAnswer = Math.round(
        baseXp * (sessionStreakRef.current > STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1)
      )
      sessionXpRef.current += xpForAnswer
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
      setTimeout(nextArrow, 220)
    } else {
      setFlash('red')
      onWrong()
      sessionStreakRef.current = 0
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      if (newLives <= 0) { setTimeout(endGame, 400); return }
      setTimeout(nextArrow, 450)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (map[e.key] && phase === 'play') { e.preventDefault(); tap(map[e.key]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, current, rankState.rank])

  useEffect(() => () => clearTimers(), [])

  const CurIcon = DIR_ICON[current]
  const rankCfg = getRankConfig(rankState.rank)

  const rules = [
    { icon: '⚡', text: `Tap the correct arrow direction fast` },
    { icon: '❤️', text: `3 lives — wrong tap or timeout costs 1` },
    { icon: '⏱', text: `${RANK_TIME[rankState.rank]}ms window per arrow at ${rankCfg.label} rank` },
    { icon: '🔥', text: `10 consecutive correct = rank up` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Arrow Dash"
      tagline="Tap the arrow direction. Fast."
      accent={ACCENT}
      icon={<Move size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg.streakRequired}
      onStart={start}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={promoted} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', filter: 'blur(90px)', opacity: 0.07, background: ACCENT, top: '5%', left: '-8%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Arrow Dash"
        accent={ACCENT}
        icon={<Move size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            <StatChip label="Time" value={`${elapsed}s`} />
          </div>
        }
      />

      {/* Lives + timer bar row */}
      <div style={{ padding: '8px 16px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ fontSize: 18, opacity: i < lives ? 1 : 0.2 }}>❤️</span>
            ))}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: rankCfg.color,
            background: `${rankCfg.color}18`, border: `1px solid ${rankCfg.color}33`,
            borderRadius: 10, padding: '3px 9px',
          }}>{rankCfg.label}</div>
        </div>
        <TimerBar pct={timerPct} accent={ACCENT} urgent />
      </div>

      {/* Arrow display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 148, height: 148, borderRadius: 34,
          background: flash === 'green' ? 'rgba(62,207,142,0.14)' : flash === 'red' ? 'rgba(255,79,79,0.14)' : 'var(--surface)',
          boxShadow: flash === 'green' ? `0 0 48px rgba(62,207,142,0.45)` : flash === 'red' ? `0 0 48px rgba(255,79,79,0.45)` : '6px 6px 18px var(--neu-dark), -4px -4px 14px var(--neu-light)',
          border: `2px solid ${flash === 'green' ? 'rgba(62,207,142,0.55)' : flash === 'red' ? 'rgba(255,79,79,0.55)' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)',
        }}>
          <CurIcon size={76} style={{ color: flash === 'green' ? 'var(--green)' : flash === 'red' ? 'var(--red)' : ACCENT }} />
        </div>
      </div>

      {/* D-pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gridTemplateRows: 'repeat(2, 76px)', gap: 10, margin: '0 auto 28px', justifyContent: 'center' }}>
        {[
          { dir: 'up' as Dir, col: 2, row: 1, Icon: ArrowUp },
          { dir: 'left' as Dir, col: 1, row: 2, Icon: ArrowLeft },
          { dir: 'down' as Dir, col: 2, row: 2, Icon: ArrowDown },
          { dir: 'right' as Dir, col: 3, row: 2, Icon: ArrowRight },
        ].map(({ dir, col, row, Icon }) => (
          <div key={dir} style={{ gridColumn: col, gridRow: row }}>
            <button
              type="button"
              onClick={(e) => { ripple(e); tap(dir) }}
              className="ripple-wrap"
              style={{
                width: 76, height: 76, borderRadius: 18,
                background: 'var(--surface)', color: 'var(--text-dim)',
                boxShadow: 'var(--elev-raise)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)',
              }}
            >
              <Icon size={24} />
            </button>
          </div>
        ))}
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
