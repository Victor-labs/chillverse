// src/pages/games/TwoTruthsOneFalse.tsx
import { useState, useEffect, useRef } from 'react'
import { Eye, Check, X } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig, calcSessionXP } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { TWO_TRUTHS_DATA } from './gameData'
import { ripple } from '../../lib/ripple'

const ACCENT = '#9b6dff'
const GAME_ID = 'two-truths' as const

interface RankTTConfig {
  rounds: number
  perRoundSec: number
  difficulty: 'easy' | 'medium' | 'mixed'
  streakRequired: number
}

const RANK_CONFIG: Record<GameRank, RankTTConfig> = {
  beginner:     { rounds: 2,  perRoundSec: 15, difficulty: 'easy',   streakRequired: 5 },
  intermediate: { rounds: 2,  perRoundSec: 15, difficulty: 'mixed',  streakRequired: 5 },
  advanced:     { rounds: 8,  perRoundSec: 15, difficulty: 'medium', streakRequired: 5 },
  master:       { rounds: 10, perRoundSec: 13, difficulty: 'medium', streakRequired: 5 },
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function TwoTruthsOneFalse({ rank: initialRank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [questions, setQuestions] = useState<typeof TWO_TRUTHS_DATA>([])
  const [qIdx, setQIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const qIdxRef = useRef(0)
  const startRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getRankCfg() { return RANK_CONFIG[rankState.rank] }

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
  }

  function startTimer() {
    clearTimers()
    const cfg = getRankCfg()
    setTimeLeft(cfg.perRoundSec)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          // Time out — reveal and advance
          revealAndAdvance(-1)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function revealAndAdvance(picked: number) {
    clearTimers()
    setSelected(picked)
    setRevealed(true)
    advanceRef.current = setTimeout(() => {
      setRevealed(false)
      setSelected(null)
      qIdxRef.current += 1
      const cfg = getRankCfg()
      if (qIdxRef.current >= cfg.rounds) {
        endGame()
        return
      }
      setQIdx(qIdxRef.current)
      startTimer()
    }, 1800)
  }

  function pick(idx: number) {
    if (revealed) return
    clearTimers()
    const q = questions[qIdxRef.current]
    if (idx === q.falseIdx) {
      const pts = 50 + Math.floor((timeLeft / getRankCfg().perRoundSec) * 20)
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current)
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
    } else {
      onWrong()
    }
    revealAndAdvance(idx)
  }

  function endGame() {
    clearTimers()
    const cfg = getRankCfg()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp = calcSessionXP(correctRef.current, cfg.rounds, rankState.bestStreak, 5)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Two Truths, One False',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total: cfg.rounds,
      detail: { 'Lies Detected': correctRef.current, 'Total Rounds': cfg.rounds },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    const cfg = getRankCfg()
    const pool = cfg.difficulty === 'easy'
      ? TWO_TRUTHS_DATA.filter(q => q.difficulty === 'easy')
      : cfg.difficulty === 'medium'
        ? TWO_TRUTHS_DATA.filter(q => q.difficulty === 'medium')
        : TWO_TRUTHS_DATA
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, cfg.rounds)
    setQuestions(shuffled)
    setQIdx(0); setScore(0); setSelected(null); setRevealed(false)
    setPromoted(null); setResult(null)
    qIdxRef.current = 0; scoreRef.current = 0; correctRef.current = 0
    startRef.current = Date.now()
    setPhase('play')
    startTimer()
  }

  useEffect(() => () => clearTimers(), [])

  const rankCfg = getRankConfig(rankState.rank)
  const cfg = getRankCfg()
  const q = questions[qIdx]
  const timePct = (timeLeft / cfg.perRoundSec) * 100

  const LABELS = ['A', 'B', 'C']

  const rules = [
    { icon: '🧠', text: 'Test your logical reasoning' },
    { icon: '⚠️', text: 'One statement is always false — find it' },
    { icon: '⏱', text: `${cfg.perRoundSec}s per round · ${cfg.rounds} rounds (${rankCfg.label})` },
    { icon: '🔥', text: '5 correct in a row = rank up' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Two Truths, One False"
      tagline="Spot the lie! Find the false statement among three claims."
      accent={ACCENT}
      icon={<Eye size={40} />}
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: `${ACCENT}06`, position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.08, background: ACCENT, top: '10%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Two Truths, One False"
        accent={ACCENT}
        icon={<Eye size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraLeft={
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
            Round {qIdx + 1}/{cfg.rounds}
          </span>
        }
        extraRight={
          <StatChip label="Score" value={score} accent={ACCENT} />
        }
      />

      {/* Timer bar + time */}
      <div style={{ padding: '8px 16px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
          <span>Round {qIdx + 1} of {cfg.rounds}</span>
          <span style={{ fontWeight: 700, color: timeLeft <= 4 ? 'var(--red)' : ACCENT }}>⏱ {timeLeft}s</span>
        </div>
        <TimerBar pct={timePct} accent={ACCENT} urgent />
      </div>

      {/* Question header */}
      <div className="neu-card" style={{ margin: '10px 16px', padding: '16px 18px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          Which statement is <span style={{ color: 'var(--red)', fontWeight: 900 }}>FALSE</span>?
        </p>
      </div>

      {/* Statements */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 16px', flex: 1 }}>
        {q?.statements.map((stmt, i) => {
          const isFalse = i === q.falseIdx
          const isSelected = selected === i

          let bg = 'var(--surface)'
          let border = 'rgba(255,255,255,0.07)'
          let icon: React.ReactNode = null

          if (revealed) {
            if (isFalse) {
              bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.55)'
              icon = <X size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
            } else if (isSelected) {
              // Player picked this true statement by mistake
              bg = 'rgba(255,79,79,0.08)'; border = 'rgba(255,79,79,0.35)'
              icon = <Check size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
            } else {
              bg = 'rgba(62,207,142,0.10)'; border = 'rgba(62,207,142,0.4)'
              icon = <Check size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
            }
          }

          return (
            <button
              key={i}
              type="button"
              className="ripple-wrap"
              onClick={(e) => { ripple(e); pick(i) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 14px', borderRadius: 16, textAlign: 'left',
                background: bg, border: `1.5px solid ${border}`,
                boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                cursor: revealed ? 'default' : 'pointer', transition: 'all 0.22s',
              }}
            >
              {/* Label bubble */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: ACCENT,
              }}>
                {LABELS[i]}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, lineHeight: 1.45 }}>{stmt}</span>
              {icon}
            </button>
          )
        })}
      </div>

      {/* Explanation after reveal */}
      {revealed && q && (
        <div style={{
          margin: '8px 16px', padding: '12px 16px', borderRadius: 14,
          background: `${ACCENT}10`, border: `1px solid ${ACCENT}25`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Explanation: </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{q.explanation}</span>
        </div>
      )}

      <div style={{ height: 16 }} />
      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
