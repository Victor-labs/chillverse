// src/pages/games/PatternMemory.tsx
import { useState, useEffect, useRef } from 'react'
import { Brain } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'

const ACCENT = '#9b6dff'
const GAME_ID = 'pattern-memory' as const

interface RankFlashConfig {
  flashOnMs: number
  flashOffMs: number
}

const RANK_FLASH: Record<GameRank, RankFlashConfig> = {
  beginner:     { flashOnMs: 600, flashOffMs: 200 },
  intermediate: { flashOnMs: 450, flashOffMs: 180 },
  advanced:     { flashOnMs: 300, flashOffMs: 150 },
  master:       { flashOnMs: 250, flashOffMs: 120 },
}

// Difficulty lever: grid size + sequence length, scaled by current game rank
interface PatternConfig {
  gridSize: number
  sequenceLength: number
}

const PATTERN_CONFIG: Record<GameRank, PatternConfig> = {
  beginner:     { gridSize: 3, sequenceLength: 3 },
  intermediate: { gridSize: 3, sequenceLength: 4 },
  advanced:     { gridSize: 4, sequenceLength: 5 },
  master:       { gridSize: 4, sequenceLength: 6 },
}

function getPatternConfig(rank: GameRank): PatternConfig {
  return PATTERN_CONFIG[rank]
}

// Base XP per correct round, scaled by current game rank
const RANK_XP: Record<GameRank, number> = {
  beginner:     20,
  intermediate: 22,
  advanced:     24,
  master:       26,
}

const STREAK_THRESHOLD = 5
const STREAK_MULTIPLIER = 1.5

const LEVELS = 5
const ROUNDS_PER_LEVEL = 3

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function PatternMemory({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  const [phase, setPhase] = useState<'info' | 'countdown' | 'flash' | 'recall' | 'feedback' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [level, setLevel] = useState(1)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [gridSize, setGridSize] = useState(3)
  const [sequence, setSequence] = useState<number[]>([])    // flash order (with repeats)
  const [playerSeq, setPlayerSeq] = useState<number[]>([])   // player taps so far
  const [cellState, setCellState] = useState<Record<number, 'flash' | 'correct' | 'wrong' | 'dimmed'>>({})
  const [roundMsg, setRoundMsg] = useState('')
  const [promoted, setPromoted] = useState<import('./types').GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRoundsRef = useRef(0)
  const totalRoundsRef = useRef(0)
  const startRef = useRef(Date.now())
  const sessionXpRef = useRef(0)
  const sessionStreakRef = useRef(0)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearFlashTimer() {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }

  function buildSequence(lvl: number): { seq: number[]; unique: number[]; gridSize: number } {
    const cfg = getPatternConfig(rankState.rank)
    const totalCells = cfg.gridSize * cfg.gridSize
    const cellCount = Math.min(cfg.sequenceLength, totalCells)
    const shuffled = Array.from({ length: totalCells }, (_, i) => i).sort(() => Math.random() - 0.5)
    const unique = shuffled.slice(0, cellCount)
    // Each cell repeated 1–3 times (more repeats at higher levels)
    const expanded: number[] = []
    unique.forEach(c => {
      const reps = Math.min(Math.floor(Math.random() * 2) + 1, lvl > 3 ? 3 : 2)
      for (let i = 0; i < reps; i++) expanded.push(c)
    })
    // Shuffle expanded sequence
    return { seq: expanded.sort(() => Math.random() - 0.5), unique, gridSize: cfg.gridSize }
  }

  function flashSequence(seq: number[]) {
    setPhase('flash')
    const cfg = RANK_FLASH[rankState.rank]
    let i = 0
    const next = () => {
      if (i >= seq.length) {
        setCellState({})
        setPhase('recall')
        return
      }
      const cell = seq[i]
      setCellState({ [cell]: 'flash' })
      flashTimerRef.current = setTimeout(() => {
        setCellState({})
        flashTimerRef.current = setTimeout(() => { i++; next() }, cfg.flashOffMs)
      }, cfg.flashOnMs)
    }
    next()
  }

  function startRound(lvl: number, rnd: number) {
    clearFlashTimer()
    const { seq, gridSize: gs } = buildSequence(lvl)
    setSequence(seq)
    setGridSize(gs)
    setPlayerSeq([])
    setCellState({})
    setLevel(lvl); setRound(rnd)
    setCountdown(3); setPhase('countdown')
    let c = 3
    const iv = setInterval(() => {
      c--; setCountdown(c)
      if (c === 0) { clearInterval(iv); flashSequence(seq) }
    }, 1000)
  }

  function start() {
    scoreRef.current = 0; correctRoundsRef.current = 0; totalRoundsRef.current = 0
    sessionXpRef.current = 0; sessionStreakRef.current = 0
    setScore(0); setPromoted(null); setResult(null)
    startRef.current = Date.now()
    startRound(1, 1)
  }

  function tapCell(idx: number) {
    if (phase !== 'recall') return

    const nextPlayerSeq = [...playerSeq, idx]
    const pos = nextPlayerSeq.length - 1

    // Check this step in sequence
    if (sequence[pos] !== idx) {
      // Wrong
      setCellState(prev => ({ ...prev, [idx]: 'wrong' }))
      setPhase('feedback')
      onWrong()
      sessionStreakRef.current = 0
      totalRoundsRef.current += 1
      setTimeout(() => {
        const dur = Math.floor((Date.now() - startRef.current) / 1000)
        endGame(dur)
      }, 700)
      return
    }

    // Correct tap
    setCellState(prev => ({ ...prev, [idx]: 'correct' }))
    setPlayerSeq(nextPlayerSeq)

    if (nextPlayerSeq.length === sequence.length) {
      // Full sequence complete
      setPhase('feedback')
      correctRoundsRef.current += 1; totalRoundsRef.current += 1
      const pts = level * 10 + round * 5
      scoreRef.current += pts
      setScore(scoreRef.current)
      sessionStreakRef.current += 1
      const baseXp = RANK_XP[rankState.rank]
      const xpForRound = Math.round(
        baseXp * (sessionStreakRef.current > STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1)
      )
      sessionXpRef.current += xpForRound
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
      setRoundMsg(`+${pts} pts`)
      setTimeout(() => {
        setRoundMsg('')
        const nextRound = round + 1
        if (nextRound > ROUNDS_PER_LEVEL) {
          const nextLevel = level + 1
          if (nextLevel > LEVELS) {
            const dur = Math.floor((Date.now() - startRef.current) / 1000)
            endGame(dur)
          } else {
            startRound(nextLevel, 1)
          }
        } else {
          startRound(level, nextRound)
        }
      }, 900)
    }
  }

  function endGame(dur: number) {
    clearFlashTimer()
    const xp = sessionXpRef.current
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Pattern Memory',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRoundsRef.current,
      total: totalRoundsRef.current,
      detail: { 'Level Reached': level, 'Best Sequence': rankState.bestStreak },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  useEffect(() => () => clearFlashTimer(), [])

  const rankCfg = getRankConfig(rankState.rank)

  const rules = [
    { icon: '👁️', text: 'Watch the cells flash in sequence' },
    { icon: '👆', text: 'Repeat the exact same order by tapping' },
    { icon: '❌', text: 'One wrong tap ends the round' },
    { icon: '🔥', text: `10 correct sequences = rank up (${rankCfg.label})` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Pattern Memory"
      tagline="Watch the sequence light up, then repeat it."
      accent={ACCENT}
      icon={<Brain size={40} />}
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
      <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', filter: 'blur(90px)', opacity: 0.08, background: ACCENT, top: '5%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Pattern Memory"
        accent={ACCENT}
        icon={<Brain size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraLeft={
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
            Lvl {level}/{LEVELS} · R{round}/{ROUNDS_PER_LEVEL}
          </div>
        }
        extraRight={<StatChip label="Score" value={score} accent={ACCENT} />}
      />

      {/* Status label */}
      <div style={{ padding: '10px 20px 4px', textAlign: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: phase === 'recall' ? 'var(--green)' : 'var(--text-dim)', minHeight: 22, display: 'inline-block' }}>
          {phase === 'countdown' ? '' : phase === 'flash' ? 'Watch carefully…' : phase === 'recall' ? '👆 Tap the exact sequence!' : roundMsg || ''}
        </span>
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{countdown}</div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: 10, maxWidth: gridSize === 4 ? 360 : 316, width: '100%', margin: '8px auto 0', padding: '0 12px' }}>
        {Array.from({ length: gridSize * gridSize }, (_, i) => {
          const st = cellState[i]
          return (
            <button
              key={i}
              type="button"
              onClick={() => tapCell(i)}
              aria-label={`Cell ${i + 1}`}
              style={{
                aspectRatio: '1', borderRadius: 16, cursor: phase === 'recall' ? 'pointer' : 'default',
                background: st === 'flash' ? `rgba(155,109,255,0.55)` : st === 'correct' ? 'rgba(62,207,142,0.28)' : st === 'wrong' ? 'rgba(255,79,79,0.28)' : 'var(--surface)',
                boxShadow: st === 'flash' ? '0 0 28px rgba(155,109,255,0.65)' : st === 'correct' ? '0 0 18px rgba(62,207,142,0.45)' : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                border: `1px solid ${st === 'flash' ? 'rgba(155,109,255,0.7)' : st === 'correct' ? 'rgba(62,207,142,0.6)' : st === 'wrong' ? 'rgba(255,79,79,0.6)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)', opacity: phase === 'countdown' ? 0.3 : 1,
              }}
            />
          )
        })}
      </div>

      {/* Player sequence indicators */}
      {phase === 'recall' && sequence.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '10px 0', flexWrap: 'wrap' }}>
          {sequence.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i < playerSeq.length ? ACCENT : 'var(--surface3)',
              border: `1px solid ${i < playerSeq.length ? ACCENT : 'rgba(255,255,255,0.1)'}`,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      )}

      {roundMsg && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid rgba(62,207,142,0.4)', borderRadius: 20, padding: '8px 20px', fontSize: 14, fontWeight: 700, color: 'var(--green)', boxShadow: 'var(--elev-raise)', zIndex: 50 }}>
          {roundMsg}
        </div>
      )}

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('recall')} />}
    </div>
  )
}
