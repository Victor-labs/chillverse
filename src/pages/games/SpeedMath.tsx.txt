// src/pages/games/SpeedMath.tsx
import { useState, useEffect, useRef } from 'react'
import { Calculator } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig, calcSessionXP } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { SPEED_MATH_POOL, generateMathQuestion, generateDistractors } from './gameData'
import { ripple } from '../../lib/ripple'

const ACCENT = '#3ecf8e'
const GAME_ID = 'speed-math' as const

interface RankMathConfig {
  timeSec: number
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  streakRequired: number
}

const RANK_CONFIG: Record<GameRank, RankMathConfig> = {
  beginner:     { timeSec: 30, difficulty: 'easy',   streakRequired: 5 },
  intermediate: { timeSec: 25, difficulty: 'easy',   streakRequired: 5 },
  advanced:     { timeSec: 25, difficulty: 'medium', streakRequired: 5 },
  master:       { timeSec: 20, difficulty: 'mixed',  streakRequired: 5 },
}

interface Question { eq: string; answer: number; options: [number, number, number, number]; correctIdx: 0 | 1 | 2 | 3 }

function buildQuestion(difficulty: 'easy' | 'medium' | 'hard' | 'mixed'): Question {
  const diff = difficulty === 'mixed'
    ? (['easy', 'medium', 'hard'] as const)[Math.floor(Math.random() * 3)]
    : difficulty

  // Try static pool first (60% of the time)
  let eq: string, answer: number
  if (Math.random() < 0.6) {
    const pool = SPEED_MATH_POOL.filter(q => q.difficulty === diff)
    const picked = pool[Math.floor(Math.random() * pool.length)] ?? SPEED_MATH_POOL[0]
    eq = picked.eq; answer = picked.answer
  } else {
    const gen = generateMathQuestion(diff)
    eq = gen.eq; answer = gen.answer
  }

  const wrong = generateDistractors(answer)
  const allOpts: number[] = [...wrong]
  const insertPos = Math.floor(Math.random() * 4)
  allOpts.splice(insertPos, 0, answer)
  const four = allOpts.slice(0, 4) as [number, number, number, number]

  return { eq, answer, options: four, correctIdx: four.indexOf(answer) as 0 | 1 | 2 | 3 }
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function SpeedMath({ rank: initialRank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [question, setQuestion] = useState<Question | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [selected, setSelected] = useState<number | null>(null)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const totalRef = useRef(0)
  const startRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getRankCfg() { return RANK_CONFIG[rankState.rank] }

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
  }

  function nextQuestion() {
    const cfg = getRankCfg()
    setQuestion(buildQuestion(cfg.difficulty))
    setSelected(null)
  }

  function endGame() {
    clearTimers()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp = calcSessionXP(correctRef.current, Math.max(totalRef.current, 1), rankState.bestStreak, 3)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Speed Math',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total: totalRef.current,
      detail: { 'Correct': correctRef.current, 'Attempted': totalRef.current },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    const cfg = getRankCfg()
    scoreRef.current = 0; correctRef.current = 0; totalRef.current = 0
    setScore(0); setPromoted(null); setResult(null)
    setTimeLeft(cfg.timeSec)
    startRef.current = Date.now()
    nextQuestion()
    setPhase('play')
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(); return 0 } return t - 1 })
    }, 1000)
  }

  function pick(idx: number) {
    if (selected !== null || !question) return
    setSelected(idx)
    totalRef.current += 1
    if (idx === question.correctIdx) {
      scoreRef.current += 10; correctRef.current += 1
      setScore(scoreRef.current)
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
    } else {
      onWrong()
    }
    advanceRef.current = setTimeout(() => nextQuestion(), 280)
  }

  useEffect(() => () => clearTimers(), [])

  const rankCfg = getRankConfig(rankState.rank)
  const cfg = getRankCfg()
  const timePct = (timeLeft / cfg.timeSec) * 100

  const rules = [
    { icon: '🔢', text: `Solve as many equations as you can in ${cfg.timeSec}s` },
    { icon: '⚡', text: 'Tap the correct answer immediately' },
    { icon: '📈', text: `${cfg.difficulty === 'mixed' ? 'Mixed' : cfg.difficulty.charAt(0).toUpperCase() + cfg.difficulty.slice(1)} difficulty at ${rankCfg.label}` },
    { icon: '🔥', text: '5 correct in a row = rank up' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Speed Math"
      tagline={`Solve as many as you can in ${cfg.timeSec}s.`}
      accent={ACCENT}
      icon={<Calculator size={40} />}
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
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.07, background: ACCENT, top: '5%', left: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Speed Math"
        accent={ACCENT}
        icon={<Calculator size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            <StatChip label="Time" value={`${timeLeft}s`} />
          </div>
        }
      />

      {/* Timer bar */}
      <div style={{ padding: '8px 16px 4px' }}>
        <TimerBar pct={timePct} accent={ACCENT} urgent />
      </div>

      {/* Equation display */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 8 }}>
        <p style={{ fontSize: 52, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)', letterSpacing: '-2px', textAlign: 'center', lineHeight: 1 }}>
          {question?.eq}
        </p>
        <p style={{ fontSize: 22, color: 'var(--text-muted)' }}>?</p>
      </div>

      {/* 2×2 Answer grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 16px 24px' }}>
        {question?.options.map((opt, i) => {
          const isCorrect = i === question.correctIdx
          const isSelected = selected === i
          let bg = 'var(--surface)'; let shadow = '4px 4px 12px var(--neu-dark), -3px -3px 8px var(--neu-light)'
          if (selected !== null) {
            if (isCorrect) { bg = 'rgba(62,207,142,0.14)'; shadow = `0 0 18px rgba(62,207,142,0.35)` }
            else if (isSelected) { bg = 'rgba(255,79,79,0.12)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap"
              onClick={(e) => { ripple(e); pick(i) }}
              style={{
                padding: '22px 12px', borderRadius: 18, textAlign: 'center',
                background: bg, border: 'none',
                boxShadow: shadow,
                cursor: selected !== null ? 'default' : 'pointer', transition: 'all 0.18s',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: 'monospace' }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Bottom progress bar (green depleting) */}
      <div style={{ height: 6, background: 'var(--surface2)', margin: '0 0 8px' }}>
        <div style={{ height: '100%', background: ACCENT, width: `${timePct}%`, transition: 'width 1s linear' }} />
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
