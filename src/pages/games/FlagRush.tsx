// src/pages/games/FlagRush.tsx
import { useState, useEffect, useRef } from 'react'
import { Flag } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig, calcSessionXP } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { FLAG_DATA } from './gameData'
import { ripple } from '../../lib/ripple'

const ACCENT = '#4f8ef7'
const GAME_ID = 'flag-rush' as const

interface RankFlagConfig {
  perFlagSec: number
  totalSec: number
  flagCount: number
}

const RANK_FLAG: Record<GameRank, RankFlagConfig> = {
  beginner:     { perFlagSec: 4, totalSec: 40, flagCount: 10 },
  intermediate: { perFlagSec: 3, totalSec: 30, flagCount: 12 },
  advanced:     { perFlagSec: 3, totalSec: 30, flagCount: 15 },
  master:       { perFlagSec: 3, totalSec: 30, flagCount: 20 },
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function FlagRush({ rank: initialRank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [pool, setPool] = useState<typeof FLAG_DATA>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [flagTimeLeft, setFlagTimeLeft] = useState(4)
  const [totalLeft, setTotalLeft] = useState(40)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const idxRef = useRef(0)
  const flagTimeRef = useRef(4)
  const startRef = useRef(Date.now())
  const flagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getRankCfg() { return RANK_FLAG[rankState.rank] }

  function clearTimers() {
    if (flagTimerRef.current) clearInterval(flagTimerRef.current)
    if (totalTimerRef.current) clearInterval(totalTimerRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
  }

  function advance() {
    clearTimers()
    advanceRef.current = setTimeout(() => {
      setSelected(null)
      idxRef.current += 1
      const cfg = getRankCfg()
      if (idxRef.current >= cfg.flagCount) { endGame(); return }
      setIdx(idxRef.current)
      startFlagTimer()
    }, 320)
  }

  function startFlagTimer() {
    const cfg = getRankCfg()
    if (flagTimerRef.current) clearInterval(flagTimerRef.current)
    flagTimeRef.current = cfg.perFlagSec
    setFlagTimeLeft(cfg.perFlagSec)
    flagTimerRef.current = setInterval(() => {
      flagTimeRef.current -= 1
      setFlagTimeLeft(flagTimeRef.current)
      if (flagTimeRef.current <= 0) {
        clearInterval(flagTimerRef.current!)
        onWrong()
        advance()
      }
    }, 1000)
  }

  function start() {
    const cfg = getRankCfg()
    const shuffled = [...FLAG_DATA].sort(() => Math.random() - 0.5).slice(0, cfg.flagCount)
    setPool(shuffled)
    idxRef.current = 0; scoreRef.current = 0; correctRef.current = 0
    setIdx(0); setScore(0); setCorrect(0); setSelected(null)
    setPromoted(null); setResult(null)
    startRef.current = Date.now()
    setTotalLeft(cfg.totalSec)
    setPhase('play')
    startFlagTimer()
    totalTimerRef.current = setInterval(() => {
      setTotalLeft(t => { if (t <= 1) { endGame(); return 0 } return t - 1 })
    }, 1000)
  }

  function pick(i: number) {
    if (selected !== null) return
    setSelected(i)
    if (flagTimerRef.current) clearInterval(flagTimerRef.current)
    if (i === pool[idxRef.current].c) {
      // XP: faster = more (4s remaining = 6xp, 1s = 3xp)
      const pts = 70 + (flagTimeRef.current * 10)
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current); setCorrect(correctRef.current)
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
    } else {
      onWrong()
    }
    advance()
  }

  function endGame() {
    clearTimers()
    const cfg = getRankCfg()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp = calcSessionXP(correctRef.current, cfg.flagCount, rankState.bestStreak, 6)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Flag Rush',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total: cfg.flagCount,
      detail: { 'Flags Correct': correctRef.current, 'Total Flags': cfg.flagCount },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  useEffect(() => () => clearTimers(), [])

  const rankCfg = getRankConfig(rankState.rank)
  const flagCfg = getRankCfg()
  const cur = pool[idx]
  const flagPct = (flagTimeLeft / flagCfg.perFlagSec) * 100
  const totalPct = (totalLeft / flagCfg.totalSec) * 100

  const rules = [
    { icon: '🚩', text: `Identify the flag as fast as possible` },
    { icon: '⚡', text: 'Faster taps earn more points' },
    { icon: '⏱', text: `${flagCfg.perFlagSec}s per flag · ${flagCfg.totalSec}s total · ${flagCfg.flagCount} flags (${rankCfg.label})` },
    { icon: '🔥', text: '10 correct in a row = rank up' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Flag Rush"
      tagline="Flags don't lie. Can you read them?"
      accent={ACCENT}
      icon={<Flag size={40} />}
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
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.06, background: ACCENT, top: '5%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Flag Rush"
        accent={ACCENT}
        icon={<Flag size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            <StatChip label={`${idx + 1}/${flagCfg.flagCount}`} value={`${correct}✓`} />
          </div>
        }
      />

      {/* Timer bars */}
      <div style={{ padding: '8px 16px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
          <span>Flag timer</span>
          <span>Total: {totalLeft}s</span>
        </div>
        <TimerBar pct={flagPct} accent={ACCENT} urgent />
        <TimerBar pct={totalPct} accent="rgba(79,142,247,0.4)" />
      </div>

      {/* Flag card */}
      <div className="neu-card" style={{ margin: '10px 16px', padding: '24px 20px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ fontSize: 92, lineHeight: 1, marginBottom: 10 }}>{cur?.flag}</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Which country is this?</p>
      </div>

      {/* Options grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px 20px' }}>
        {cur?.opts.map((opt, i) => {
          const isCor = i === cur.c; const isSel = selected === i
          let bg = 'var(--surface)'; let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCor) { bg = 'rgba(62,207,142,0.12)'; border = 'rgba(62,207,142,0.5)' }
            else if (isSel) { bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.5)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap"
              onClick={(e) => { ripple(e); pick(i) }}
              style={{ padding: '15px 10px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: selected !== null ? 'default' : 'pointer', background: bg, border: `1px solid ${border}`, boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)', color: 'var(--text)', textAlign: 'center', transition: 'all 0.2s' }}>
              {opt}
            </button>
          )
        })}
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
