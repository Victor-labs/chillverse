// src/pages/games/RapidSort.tsx
import { useState, useEffect, useRef } from 'react'
import { Layers, Check, X } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig, calcSessionXP } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { RAPID_SORT_ROUNDS } from './gameData'
import { ripple } from '../../lib/ripple'

const ACCENT = '#ff4d8b'
const GAME_ID = 'rapid-sort' as const

interface RankSortConfig {
  timeSec: number
  questionsPerRound: number
  swapButtons: boolean
}

const RANK_CONFIG: Record<GameRank, RankSortConfig> = {
  beginner:     { timeSec: 30, questionsPerRound: 8,  swapButtons: false },
  intermediate: { timeSec: 30, questionsPerRound: 11, swapButtons: false },
  advanced:     { timeSec: 20, questionsPerRound: 12, swapButtons: false },
  master:       { timeSec: 20, questionsPerRound: 10, swapButtons: true },
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function RapidSort({ rank: initialRank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [roundIdx, setRoundIdx] = useState(0)
  const [itemIdx, setItemIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [correct, setCorrect] = useState(0)
  const [swapped, setSwapped] = useState(false)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const wrongRef = useRef(0)
  const startRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function getRankCfg() { return RANK_CONFIG[rankState.rank] }

  const round = RAPID_SORT_ROUNDS[roundIdx % RAPID_SORT_ROUNDS.length]
  const [word, correctSide] = round.items[itemIdx] ?? ['', 0 as 0 | 1]

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function startTimer() {
    clearTimer()
    const cfg = getRankCfg()
    setTimeLeft(cfg.timeSec)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { nextRound(); return cfg.timeSec }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    scoreRef.current = 0; correctRef.current = 0; wrongRef.current = 0
    setScore(0); setCorrect(0); setPromoted(null); setResult(null)
    setRoundIdx(0); setItemIdx(0)
    setSwapped(Math.random() < 0.5)
    startRef.current = Date.now()
    setPhase('play')
    startTimer()
  }

  function nextRound() {
    clearTimer()
    const cfg = getRankCfg()
    const nextItem = itemIdx + 1
    if (nextItem >= cfg.questionsPerRound) {
      const nextRound = roundIdx + 1
      if (nextRound >= RAPID_SORT_ROUNDS.length) {
        endGame()
        return
      }
      setRoundIdx(nextRound); setItemIdx(0)
    } else {
      setItemIdx(nextItem)
    }
    const cfg2 = getRankCfg()
    if (cfg2.swapButtons) setSwapped(Math.random() < 0.5)
    startTimer()
  }

  function pick(pickedSide: 0 | 1) {
    if (feedback) return
    clearTimer()
    const isCorrect = pickedSide === correctSide
    setFeedback(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      const bonus = Math.floor((timeLeft / getRankCfg().timeSec) * 8)
      const pts = 10 + bonus
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current); setCorrect(correctRef.current)
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)
    } else {
      wrongRef.current += 1
      onWrong()
    }
    setTimeout(() => {
      setFeedback(null)
      nextRound()
    }, 350)
  }

  function endGame() {
    clearTimer()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const total = correctRef.current + wrongRef.current
    const xp = calcSessionXP(correctRef.current, total, rankState.bestStreak, 3)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Rapid Sort',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: xp,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: correctRef.current,
      total,
      detail: { 'Correct Sorts': correctRef.current, 'Wrong Sorts': wrongRef.current },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  useEffect(() => () => clearTimer(), [])

  const rankCfg2 = getRankConfig(rankState.rank)
  const sortCfg = getRankCfg()
  const timePct = (timeLeft / sortCfg.timeSec) * 100

  // Displayed sides (potentially swapped for master)
  const leftCat  = swapped ? round.cats[1] : round.cats[0]
  const rightCat = swapped ? round.cats[0] : round.cats[1]
  const leftSide = (swapped ? 1 : 0) as 0 | 1
  const rightSide = (swapped ? 0 : 1) as 0 | 1

  const rules = [
    { icon: '⚡', text: 'Speed is key — faster taps earn more points' },
    { icon: '🔲', text: 'Tap the correct category for each item' },
    { icon: '⏱', text: `${sortCfg.timeSec}s per round, ${sortCfg.questionsPerRound} items at ${rankCfg2.label}` },
    { icon: rankCfg2.rank === 'master' ? '🔀' : '🔥', text: rankCfg2.rank === 'master' ? 'Master rank: buttons swap sides randomly!' : '10 correct streak = rank up' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Rapid Sort"
      tagline="Sort items into the correct categories as fast as you can!"
      accent={ACCENT}
      icon={<Layers size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg2.streakRequired}
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
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.07, background: ACCENT, bottom: '15%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Rapid Sort"
        accent={ACCENT}
        icon={<Layers size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Pts" value={score} accent={ACCENT} />
            <StatChip label="✓" value={correct} accent="var(--green)" />
          </div>
        }
      />

      <div style={{ padding: '8px 16px 6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <span>Round {roundIdx + 1}/{RAPID_SORT_ROUNDS.length} · Item {itemIdx + 1}/{sortCfg.questionsPerRound}</span>
          <span style={{ fontWeight: 700, color: timeLeft <= 5 ? 'var(--red)' : 'var(--text-dim)' }}>{timeLeft}s</span>
        </div>
        <TimerBar pct={timePct} accent={ACCENT} urgent />
      </div>

      {/* Word card */}
      <div className="neu-card" style={{ margin: '12px 16px', padding: '28px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        {feedback && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: feedback === 'correct' ? 'rgba(62,207,142,0.08)' : 'rgba(255,79,79,0.08)', zIndex: 2 }}>
            {feedback === 'correct' ? <Check size={52} style={{ color: 'var(--green)' }} /> : <X size={52} style={{ color: 'var(--red)' }} />}
          </div>
        )}
        <p style={{ fontSize: 40, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>{word}</p>
        {sortCfg.swapButtons && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>⚠️ Master mode — buttons may swap!</p>
        )}
      </div>

      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 16px 24px' }}>
        <button
          type="button"
          className="ripple-wrap"
          onClick={(e) => { ripple(e); pick(leftSide) }}
          style={{ flex: 1, padding: '22px 8px', borderRadius: 18, fontSize: 16, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #3b5bdb, #4f8ef7)', border: 'none', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: '0 4px 16px rgba(59,91,219,0.3)' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {leftCat}
        </button>
        <button
          type="button"
          className="ripple-wrap"
          onClick={(e) => { ripple(e); pick(rightSide) }}
          style={{ flex: 1, padding: '22px 8px', borderRadius: 18, fontSize: 16, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #9b6dff)', border: 'none', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {rightCat}
        </button>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
