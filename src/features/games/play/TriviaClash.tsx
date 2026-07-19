// src/pages/games/TriviaClash.tsx
import { useState, useEffect, useRef } from 'react'
import { BookOpen, WifiOff, RefreshCw } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { useTriviaQuestions } from '../useTriviaQuestions'
import { ripple } from '../../../shared/lib/ripple'

const ACCENT = 'var(--accent2)'
const GAME_ID = 'trivia-clash' as const

// XP per correct answer
const XP_PER_CORRECT = 20

// Per-question timer in seconds
const QUESTION_TIMER_SEC = 5

interface RankTriviaConfig {
  questions: number
  difficulty: 'easy' | 'medium'
  streakRequired: number
}

const RANK_CONFIG: Record<GameRank, RankTriviaConfig> = {
  beginner:     { questions: 10, difficulty: 'easy',   streakRequired: 5 },
  intermediate: { questions: 10, difficulty: 'easy',   streakRequired: 5 },
  advanced:     { questions: 12, difficulty: 'medium', streakRequired: 5 },
  master:       { questions: 10, difficulty: 'medium', streakRequired: 5 },
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function TriviaClash({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)
  const { questions, fetchState, error, fetchQuestions } = useTriviaQuestions()

  const [qIdx,          setQIdx]          = useState(0)
  const [score,         setScore]         = useState(0)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIMER_SEC)
  const [selected,      setSelected]      = useState<number | null>(null)
  const [correctCount,  setCorrectCount]  = useState(0)
  const [promoted,      setPromoted]      = useState<GameRank | null>(null)
  const [result,        setResult]        = useState<GameEndPayload | null>(null)
  const [endReason,     setEndReason]     = useState<'completed' | 'wrong' | 'timeout'>('completed')

  const scoreRef         = useRef(0)
  const correctRef       = useRef(0)
  const qIdxRef          = useRef(0)
  const startRef         = useRef(Date.now())
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  function getRankCfg() { return RANK_CONFIG[rankState.rank] }

  function clearTimers() {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    if (advanceTimerRef.current)  clearTimeout(advanceTimerRef.current)
  }

  function endGame(reason: 'completed' | 'wrong' | 'timeout') {
    clearTimers()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const cfg = getRankCfg()
    const xp  = correctRef.current * XP_PER_CORRECT
    const payload: GameEndPayload = {
      gameId:      GAME_ID,
      gameName:    'Trivia Clash',
      rank:        rankState.rank,
      score:       scoreRef.current,
      xpEarned:    xp,
      durationSec: dur,
      streak:      rankState.bestStreak,
      correct:     correctRef.current,
      total:       cfg.questions,
      detail: {
        'Correct':    correctRef.current,
        'Total':      cfg.questions,
        'End reason': reason === 'wrong' ? 'Wrong answer' : reason === 'timeout' ? 'Time ran out' : 'Completed',
      },
    }
    setEndReason(reason)
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function startQuestionTimer() {
    clearTimers()
    setQuestionTimeLeft(QUESTION_TIMER_SEC)
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeLeft(t => {
        if (t <= 1) {
          clearInterval(questionTimerRef.current!)
          onWrong()
          advanceTimerRef.current = setTimeout(() => endGame('timeout'), 600)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  // Kick off the fetch when user hits Start on the info screen
  function handleStart() {
    const cfg = getRankCfg()
    fetchQuestions(rankState.rank, cfg.questions)
  }

  // Once questions are ready, start the actual game
  useEffect(() => {
    if (fetchState !== 'ready' || questions.length === 0) return
    setQIdx(0); setScore(0); setCorrectCount(0); setSelected(null)
    setPromoted(null); setResult(null); setEndReason('completed')
    qIdxRef.current = 0; scoreRef.current = 0; correctRef.current = 0
    startRef.current = Date.now()
    setPhase('play')
    startQuestionTimer()
  }, [fetchState, questions])

  function pick(idx: number) {
    if (selected !== null) return
    clearTimers()
    setSelected(idx)
    const q = questions[qIdxRef.current]
    const isCorrect = idx === q.correct

    if (isCorrect) {
      const pts = 50
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current); setCorrectCount(correctRef.current)
      const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
      if (promo) setPromoted(promo)

      advanceTimerRef.current = setTimeout(() => {
        setSelected(null)
        qIdxRef.current += 1
        if (qIdxRef.current >= questions.length) {
          endGame('completed')
          return
        }
        setQIdx(qIdxRef.current)
        startQuestionTimer()
      }, 700)
    } else {
      onWrong()
      advanceTimerRef.current = setTimeout(() => endGame('wrong'), 800)
    }
  }

  useEffect(() => () => clearTimers(), [])

  const rankCfg = getRankConfig(rankState.rank)
  const cfg     = getRankCfg()
  const q       = questions[qIdx]
  const timerPct = (questionTimeLeft / QUESTION_TIMER_SEC) * 100

  const rules = [
    { icon: '🧠', text: `${cfg.questions} questions per game` },
    { icon: '⏱', text: `${QUESTION_TIMER_SEC}s per question — answer fast` },
    { icon: '💀', text: `One wrong answer ends the game` },
    { icon: '📚', text: `${cfg.difficulty === 'easy' ? 'Easy' : 'Medium'} difficulty at ${rankCfg.label}` },
    { icon: '🔥', text: `5 correct in a row = rank up` },
    { icon: '⭐', text: `${XP_PER_CORRECT} XP per correct answer` },
  ]

  // ── Info screen ───────────────────────────────────────────
  if (phase === 'info') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <PreGameModal
        gameName="Trivia Clash"
        tagline="Drop knowledge. Wreck the scoreboard."
        accent={ACCENT}
        icon={<BookOpen size={40} />}
        rules={rules}
        rankState={rankState}
        streakRequired={rankCfg.streakRequired}
        onStart={handleStart}
        onClose={onBack}
      />

      {/* Loading overlay — shown while fetching questions */}
      {fetchState === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(17,17,19,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: `3px solid ${ACCENT}33`,
            borderTopColor: ACCENT,
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Loading questions…</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fresh from the trivia vault, no repeats</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error state */}
      {fetchState === 'error' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(17,17,19,0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        }}>
          <WifiOff size={40} style={{ color: '#ff4f4f' }} />
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>Couldn't load questions</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{error}</p>
          <button type="button" onClick={handleStart}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Try Again
          </button>
          <button type="button" onClick={onBack}
            style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Go back
          </button>
        </div>
      )}
    </div>
  )

  // ── Result screen ─────────────────────────────────────────
  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {endReason !== 'completed' && (
        <div style={{
          margin: '16px 16px 0', padding: '12px 16px', borderRadius: 14,
          background: endReason === 'wrong' ? 'rgba(255,79,79,0.1)' : 'rgba(245,197,66,0.1)',
          border: `1px solid ${endReason === 'wrong' ? 'rgba(255,79,79,0.3)' : 'rgba(245,197,66,0.3)'}`,
          fontSize: 13, fontWeight: 700,
          color: endReason === 'wrong' ? '#ff4f4f' : '#f5c542',
          textAlign: 'center',
        }}>
          {endReason === 'wrong' ? '❌ Wrong answer — session over' : '⏰ Time ran out — session over'}
        </div>
      )}
      <ResultScreen
        payload={result}
        accent={ACCENT}
        onReplay={() => { setResult(null); handleStart() }}
        onBack={onBack}
        promoted={promoted}
      sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  // ── Play screen ───────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.07, background: ACCENT, top: '10%', right: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Trivia Clash"
        accent={ACCENT}
        icon={<BookOpen size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            <StatChip label={`${qIdx + 1}/${questions.length}`} value={`${correctCount}✓`} />
          </div>
        }
      />

      {/* Per-question timer */}
      <div style={{ padding: '8px 16px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
          <span>Time per question</span>
          <span style={{ fontWeight: 700, color: questionTimeLeft <= 2 ? '#ff4f4f' : 'var(--text-dim)' }}>{questionTimeLeft}s</span>
        </div>
        <TimerBar pct={timerPct} accent={questionTimeLeft <= 2 ? '#ff4f4f' : ACCENT} urgent={questionTimeLeft <= 2} />
      </div>

      {/* Question card */}
      <div className="neu-card" style={{ margin: '10px 16px', padding: '20px 18px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.55 }}>{q?.q}</p>
      </div>

      {/* Answer grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px 20px' }}>
        {q?.a.map((ans, i) => {
          const isCorrect  = i === q.correct
          const isSelected = selected === i
          let bg = 'var(--surface)'; let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCorrect)       { bg = 'rgba(62,207,142,0.12)';  border = 'rgba(62,207,142,0.5)'  }
            else if (isSelected) { bg = 'rgba(255,79,79,0.12)';   border = 'rgba(255,79,79,0.5)'   }
          }
          return (
            <button key={i} type="button" className="ripple-wrap"
              onClick={(e) => { ripple(e); pick(i) }}
              style={{ padding: '16px 10px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: selected !== null ? 'default' : 'pointer', background: bg, border: `1px solid ${border}`, boxShadow: 'var(--elev-raise-sm)', color: 'var(--text)', textAlign: 'center', transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)' }}>
              {ans}
            </button>
          )
        })}
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
