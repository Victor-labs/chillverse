// src/pages/games/CloseCall.tsx
// "Close Call" — type the closest answer you can. Exact match not required.
// 3 lives · 6s timer per question · 25 XP per correct · costs 4 sessions
import { useState, useEffect, useRef, useCallback } from 'react'
import { Target } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal } from './GameShell'
import { ripple } from '../../lib/ripple'

const ACCENT     = '#ff4d8b'
const MAX_LIVES  = 3
const TIME_LIMIT = 6   // seconds per question
const XP_PER_Q   = 25

// ─── Question bank with accepted answer variants ──────────────
interface Question {
  prompt: string
  // 3 accepted answers — any close match wins
  accepted: string[]
  // shown after result
  funFact?: string
}

const QUESTIONS: Question[] = [
  { prompt: "What do you call the dot above the letter 'i'?",           accepted: ['tittle', 'dot', 'jot'],                 funFact: "It's officially called a tittle." },
  { prompt: 'How many sides does a hexagon have?',                      accepted: ['six', '6'],                             funFact: "Bees figured this out before us." },
  { prompt: 'What gas do plants absorb from the air?',                  accepted: ['carbon dioxide', 'co2', 'carbon'],      funFact: "And release oxygen. Good deal for us." },
  { prompt: 'What is the capital of Japan?',                            accepted: ['tokyo', 'tōkyō'],                       funFact: "Home to the world's busiest train station." },
  { prompt: 'How many strings does a standard guitar have?',            accepted: ['six', '6'],                             funFact: "Bass guitars have 4. Fight me." },
  { prompt: 'What colour do you get mixing red and yellow?',            accepted: ['orange'],                               funFact: "The fruit was named before the colour." },
  { prompt: 'What planet is known as the Red Planet?',                  accepted: ['mars'],                                 funFact: "Its red colour is just iron oxide — rust." },
  { prompt: "What is Sherlock Holmes's address?",                       accepted: ['221b baker street', '221b', 'baker'],   funFact: "The building now hosts a museum." },
  { prompt: 'How many bones are in the adult human body?',              accepted: ['206', 'two hundred six'],               funFact: "Babies start with about 270 and they fuse." },
  { prompt: 'What is the fastest land animal?',                         accepted: ['cheetah'],                              funFact: "Can accelerate faster than most sports cars." },
  { prompt: 'What language has the most native speakers?',              accepted: ['mandarin', 'chinese', 'mandarin chinese'], funFact: "About 1 billion native speakers." },
  { prompt: 'Who painted the Mona Lisa?',                               accepted: ['da vinci', 'leonardo', 'leonardo da vinci'], funFact: "He worked on it for 4 years and never delivered it." },
  { prompt: 'What is the smallest country in the world?',               accepted: ['vatican', 'vatican city'],              funFact: "Its entire territory fits inside a golf course." },
  { prompt: 'What element has the chemical symbol Au?',                 accepted: ['gold'],                                 funFact: "Au is from the Latin word 'aurum'." },
  { prompt: 'How many teeth does an adult human have?',                 accepted: ['32', 'thirty two', 'thirty-two'],       funFact: "That includes the wisdom teeth you probably regret." },
  { prompt: 'What is the longest river in the world?',                  accepted: ['nile', 'amazon'],                       funFact: "Nile vs Amazon — geographers still argue." },
  { prompt: 'What sport is played at Wimbledon?',                       accepted: ['tennis'],                               funFact: "Strawberries and cream are the official snack." },
  { prompt: 'What is the hardest natural substance on Earth?',          accepted: ['diamond'],                              funFact: "Score 10 on the Mohs hardness scale." },
  { prompt: 'How many players on a standard football team?',            accepted: ['eleven', '11'],                         funFact: "Plus subs. Eleven on the pitch at once." },
  { prompt: 'What is the main ingredient in guacamole?',                accepted: ['avocado'],                              funFact: "The word comes from an Aztec word for the fruit." },
  { prompt: 'What ocean is the largest?',                               accepted: ['pacific', 'pacific ocean'],             funFact: "Covers more area than all land combined." },
  { prompt: 'What is the fear of spiders called?',                      accepted: ['arachnophobia'],                        funFact: "One of the most common phobias globally." },
  { prompt: 'How many continents are on Earth?',                        accepted: ['seven', '7'],                           funFact: "Some models count 5 or 6. Seven is most common." },
  { prompt: 'What vitamin does sunlight give you?',                     accepted: ['vitamin d', 'vitamin d3', 'd'],         funFact: "Most people are deficient. Go outside." },
  { prompt: 'What year did the first iPhone launch?',                   accepted: ['2007'],                                 funFact: "January 9th 2007. Steve Jobs wore his turtleneck." },
  { prompt: 'What is the square root of 144?',                         accepted: ['12', 'twelve'],                         funFact: "12 x 12. Simple when you know it." },
  { prompt: 'What currency does Japan use?',                            accepted: ['yen'],                                  funFact: "Written as ¥. Also used for the Chinese yuan." },
  { prompt: 'How many days in a leap year?',                            accepted: ['366', 'three hundred sixty six'],       funFact: "February gets an extra day every 4 years." },
  { prompt: 'What is the chemical formula for water?',                  accepted: ['h2o', 'h₂o'],                           funFact: "Two hydrogen, one oxygen. The OG formula." },
  { prompt: 'Who wrote Romeo and Juliet?',                              accepted: ['shakespeare', 'william shakespeare'],   funFact: "It was originally a poem before it was a play." },
]

// ─── Fuzzy match ─────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function isClose(userInput: string, accepted: string[]): boolean {
  const u = normalize(userInput)
  for (const ans of accepted) {
    const a = normalize(ans)
    if (u === a) return true
    // Allow 1 char difference for short words, 2 for longer
    const threshold = a.length <= 5 ? 1 : 2
    if (levenshtein(u, a) <= threshold) return true
    // Substring match — if user typed the key part
    if (a.includes(u) && u.length >= 3) return true
  }
  return false
}

// ─── Timer ring ───────────────────────────────────────────────
function TimerRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct   = timeLeft / total
  const r     = 22
  const circ  = 2 * Math.PI * r
  const color = timeLeft <= 2 ? '#ff4f4f' : timeLeft <= 4 ? '#f5c542' : ACCENT
  return (
    <svg width={60} height={60} viewBox="0 0 60 60">
      <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
        style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
      />
      <text x={30} y={35} textAnchor="middle" fontSize={15} fontWeight={800} fill={color}>{timeLeft}</text>
    </svg>
  )
}

interface Props { rank: GameRank; onEnd: (payload: GameEndPayload) => void; onBack: () => void }

export default function CloseCall({ rank: _rank, onEnd, onBack }: Props) {
  const [phase, setPhase]         = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const [qIndex, setQIndex]       = useState(0)
  const [shuffled, setShuffled]   = useState<Question[]>([])
  const [timeLeft, setTimeLeft]   = useState(TIME_LIMIT)
  const [input, setInput]         = useState('')
  const [lives, setLives]         = useState(MAX_LIVES)
  const [correct, setCorrect]     = useState(0)
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong' | 'timeout'>('idle')
  const [result, setResult]       = useState<GameEndPayload | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const startRef                  = useRef(Date.now())
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentQ  = shuffled[qIndex]
  const totalQ    = shuffled.length

  const endSession = useCallback((finalCorrect: number, finalTotal: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp  = finalCorrect * XP_PER_Q
    const payload: GameEndPayload = {
      gameId: 'close_call' as any,
      gameName: 'Close Call',
      rank: _rank,
      score: finalCorrect * 100,
      xpEarned: xp,
      durationSec: dur,
      streak: finalCorrect,
      correct: finalCorrect,
      total: finalTotal,
      detail: { 'Correct': finalCorrect, 'Answered': finalTotal, 'XP': xp },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }, [_rank, onEnd])

  // Timer
  useEffect(() => {
    if (phase !== 'play' || answerState !== 'idle') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, qIndex, answerState])

  function handleTimeout() {
    setAnswerState('timeout')
    const newLives = lives - 1
    setLives(newLives)
    setTimeout(() => {
      if (newLives <= 0) {
        endSession(correct, qIndex + 1)
      } else {
        nextQuestion()
      }
    }, 1600)
  }

  function submit() {
    if (!input.trim() || answerState !== 'idle' || !currentQ) return
    if (timerRef.current) clearInterval(timerRef.current)

    const hit = isClose(input, currentQ.accepted)
    if (hit) {
      setAnswerState('correct')
      const newCorrect = correct + 1
      setCorrect(newCorrect)
      setTimeout(() => nextQuestion(), 1600)
    } else {
      const newLives = lives - 1
      setLives(newLives)
      setAnswerState('wrong')
      setTimeout(() => {
        if (newLives <= 0) {
          endSession(correct, qIndex + 1)
        } else {
          nextQuestion()
        }
      }, 1800)
    }
  }

  function nextQuestion() {
    const next = qIndex + 1
    if (next >= totalQ) {
      endSession(correct, totalQ)
      return
    }
    setQIndex(next)
    setInput('')
    setTimeLeft(TIME_LIMIT)
    setAnswerState('idle')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function start() {
    const s = [...QUESTIONS].sort(() => Math.random() - 0.5)
    setShuffled(s)
    setQIndex(0)
    setInput('')
    setLives(MAX_LIVES)
    setCorrect(0)
    setTimeLeft(TIME_LIMIT)
    setAnswerState('idle')
    setResult(null)
    startRef.current = Date.now()
    setPhase('play')
    setTimeout(() => inputRef.current?.focus(), 200)
  }

  const rankCfg = getRankConfig(_rank)
  const rules = [
    { icon: '💬', text: "You're asked a question. Type the closest answer you know." },
    { icon: '✅', text: "Close enough counts — typos and near-misses are forgiven." },
    { icon: '⏱️', text: '6 seconds to answer. Time runs out = lose a life.' },
    { icon: '❤️', text: '3 lives total. Lose them all and the session ends.' },
    { icon: '⚡', text: `${XP_PER_Q} XP per correct answer. Session costs 4 plays.` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Close Call"
      tagline="Type your best answer. Close enough counts."
      accent={ACCENT}
      icon={<Target size={40} />}
      rules={rules}
      rankState={{ rank: _rank, currentStreak: 0, bestStreak: 0 }}
      streakRequired={rankCfg.streakRequired}
      onStart={start}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={null} />
    </div>
  )

  const stateColor = answerState === 'correct' ? '#3ecf8e' : answerState === 'wrong' || answerState === 'timeout' ? '#ff4f4f' : ACCENT

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', width:240, height:240, borderRadius:'50%', filter:'blur(100px)', opacity:0.08, background:ACCENT, top:'-5%', right:'-10%', pointerEvents:'none' }} />

      <GameHUD
        gameName="Close Call"
        accent={ACCENT}
        icon={<Target size={14} />}
        streak={correct}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display:'flex', gap:6 }}>
            <StatChip label="Score" value={correct} accent={ACCENT} />
            <StatChip label="Lives" value={'❤️'.repeat(lives) || '💀'} />
          </div>
        }
      />

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 20px', gap:24 }}>

        {/* Progress bar */}
        <div style={{ width:'100%', maxWidth:480 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
            <span>Question {qIndex + 1} of {totalQ}</span>
            <span>{correct} correct · {XP_PER_Q * correct} XP</span>
          </div>
          <div style={{ height:4, borderRadius:2, background:'var(--surface2)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:2, background:ACCENT, width:`${((qIndex) / totalQ) * 100}%`, transition:'width 0.4s' }} />
          </div>
        </div>

        {/* Timer */}
        <TimerRing timeLeft={timeLeft} total={TIME_LIMIT} />

        {/* Question card */}
        <div style={{
          width:'100%', maxWidth:480,
          background: answerState === 'correct' ? 'rgba(62,207,142,0.08)' : answerState === 'wrong' || answerState === 'timeout' ? 'rgba(255,79,79,0.08)' : 'var(--surface)',
          border: `1.5px solid ${answerState === 'idle' ? 'rgba(255,255,255,0.07)' : stateColor + '40'}`,
          borderRadius:20, padding:'24px 22px',
          boxShadow: `0 0 ${answerState !== 'idle' ? '20px' : '0px'} ${stateColor}20, 4px 4px 12px var(--neu-dark),-2px -2px 8px var(--neu-light)`,
          transition:'all 0.3s',
          textAlign:'center',
        }}>
          <p style={{ fontSize:16, fontWeight:700, color:'var(--text)', lineHeight:1.5, marginBottom:20 }}>
            {currentQ?.prompt}
          </p>

          {/* Answer state message */}
          {answerState !== 'idle' && (
            <div style={{ fontSize:13, fontWeight:800, color: stateColor, marginBottom:12, animation:'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              {answerState === 'correct' && `✅ Correct! +${XP_PER_Q} XP`}
              {answerState === 'wrong'   && `❌ Not quite. Answer: ${currentQ?.accepted[0]}`}
              {answerState === 'timeout' && `⏰ Time's up! Answer: ${currentQ?.accepted[0]}`}
            </div>
          )}

          {answerState !== 'idle' && currentQ?.funFact && (
            <p style={{ fontSize:11, color:'var(--text-dim)', fontStyle:'italic', marginBottom:12 }}>
              💡 {currentQ.funFact}
            </p>
          )}

          {/* Input */}
          <div style={{ display:'flex', gap:8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              disabled={answerState !== 'idle'}
              placeholder="Type your answer…"
              style={{
                flex:1, background:'var(--bg)', border:`1.5px solid ${answerState !== 'idle' ? stateColor + '40' : 'rgba(255,255,255,0.1)'}`,
                borderRadius:12, padding:'10px 14px', fontSize:14, color:'var(--text)',
                outline:'none', transition:'border 0.2s',
              }}
            />
            <button
              type="button"
              onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); submit() }}
              disabled={answerState !== 'idle' || !input.trim()}
              className="ripple-wrap"
              style={{
                padding:'10px 18px', borderRadius:12, border:'none', fontWeight:700, fontSize:13,
                background: answerState !== 'idle' || !input.trim() ? 'var(--surface2)' : ACCENT,
                color: answerState !== 'idle' || !input.trim() ? 'var(--text-muted)' : '#fff',
                cursor: answerState !== 'idle' || !input.trim() ? 'not-allowed' : 'pointer',
                transition:'all 0.2s', flexShrink:0,
              }}
            >
              Send
            </button>
          </div>
        </div>

        {/* Lives display */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <span key={i} style={{ fontSize:22, opacity: i < lives ? 1 : 0.2, transition:'opacity 0.3s' }}>❤️</span>
          ))}
        </div>

      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
      <style>{`
        @keyframes popIn { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}
