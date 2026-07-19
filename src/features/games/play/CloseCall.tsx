// src/pages/games/CloseCall.tsx
// "Close Call" — type the closest answer you can. Exact match not required.
// 3 lives · 6s timer per question · 25 XP per correct · costs 4 sessions
import { useState, useEffect, useRef, useCallback } from 'react'
import { Target } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal } from './GameShell'
import { ripple } from '../../../shared/lib/ripple'
import { useGamePresence } from '../useGamePresence'

const ACCENT     = '#ff4d8b'
const MAX_LIVES  = 3
const TIME_LIMIT_NORMAL     = 12  // seconds for first 20 questions
const TIME_LIMIT_IMPOSSIBLE = 7   // seconds for last 10 (harder) questions
const XP_PER_Q   = 25

// ─── Question bank with accepted answer variants ──────────────
interface Question {
  prompt: string
  // 3 accepted answers — any close match wins
  accepted: string[]
  // shown after result
  funFact?: string
}

// ─── Question bank, split into rotating "parts" ───────────────
// Each part is a self-contained 30-question set (20 normal + 10 harder,
// same pacing as before). Which part a player sees is picked by the
// calendar day, so repeat players get a different set day to day instead
// of memorizing one fixed list. Parts also escalate in difficulty
// (Part A = easy warm-up, B = medium, C = hard) so the game doesn't feel
// "too easy" once someone's played a few times.

const PART_A: Question[] = [
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

const PART_B: Question[] = [
  { prompt: 'What is the collective noun for a group of crows?',        accepted: ['murder', 'a murder'],                   funFact: "A murder of crows. Nobody knows exactly why." },
  { prompt: 'What year did the Berlin Wall fall?',                      accepted: ['1989'],                                 funFact: "It came down on November 9th, 1989." },
  { prompt: 'What is the currency of Switzerland?',                     accepted: ['franc', 'swiss franc'],                 funFact: "One of the few currencies to survive both World Wars intact." },
  { prompt: 'Who developed the theory of general relativity?',          accepted: ['einstein', 'albert einstein'],          funFact: "Published in 1915, it redefined gravity itself." },
  { prompt: 'What is the largest organ in the human body?',             accepted: ['skin'],                                 funFact: "It makes up about 16% of your body weight." },
  { prompt: 'How many time zones does Russia span?',                    accepted: ['11', 'eleven'],                         funFact: "It's the most of any country on Earth." },
  { prompt: 'What is the capital of Australia?',                        accepted: ['canberra'],                             funFact: "Not Sydney — it was a compromise city built for the job." },
  { prompt: 'What metal is liquid at room temperature?',                accepted: ['mercury'],                              funFact: "It's also called quicksilver." },
  { prompt: 'Who wrote "1984"?',                                        accepted: ['orwell', 'george orwell'],              funFact: "Published in 1949, decades before the year itself." },
  { prompt: 'What is the smallest prime number?',                       accepted: ['2', 'two'],                             funFact: "It's also the only even prime number." },
  { prompt: 'What is the tallest mountain in Africa?',                  accepted: ['kilimanjaro', 'mount kilimanjaro'],     funFact: "It's a dormant volcano, not part of a range." },
  { prompt: 'What year did World War II end?',                          accepted: ['1945'],                                 funFact: "V-J Day marked the final surrender in September 1945." },
  { prompt: 'What is the study of earthquakes called?',                 accepted: ['seismology'],                           funFact: "Seismologists use instruments called seismographs." },
  { prompt: 'How many chambers does the human heart have?',             accepted: ['4', 'four'],                            funFact: "Two atria, two ventricles." },
  { prompt: 'What is the national language of Brazil?',                 accepted: ['portuguese'],                           funFact: "The only Portuguese-speaking country in South America." },
  { prompt: 'What is the freezing point of water in Fahrenheit?',       accepted: ['32'],                                   funFact: "That's 0°C, for the rest of the world." },
  { prompt: 'Who composed the Ninth Symphony?',                         accepted: ['beethoven', 'ludwig van beethoven'],    funFact: "He was almost completely deaf by the time he wrote it." },
  { prompt: 'What is the capital of Canada?',                           accepted: ['ottawa'],                               funFact: "Not Toronto — a common mix-up." },
  { prompt: "What gas makes up most of Earth's atmosphere?",            accepted: ['nitrogen'],                             funFact: "About 78%, with oxygen a distant second at 21%." },
  { prompt: 'What is the main language spoken in Egypt?',               accepted: ['arabic'],                               funFact: "Egyptian Arabic is widely understood across the region." },
  { prompt: 'What is the term for a word that reads the same backwards?', accepted: ['palindrome'],                         funFact: "\"Racecar\" and \"level\" are classic examples." },
  { prompt: 'Who was the first woman to win a Nobel Prize?',            accepted: ['marie curie', 'curie'],                 funFact: "She won it twice, in two different sciences." },
  { prompt: 'What is the SI unit of electrical resistance?',            accepted: ['ohm'],                                  funFact: "Named after physicist Georg Ohm." },
  { prompt: 'In which year did the Titanic sink?',                      accepted: ['1912'],                                 funFact: "It sank on its very first voyage." },
  { prompt: 'What is the longest bone in the human body?',              accepted: ['femur'],                                funFact: "It's the thigh bone, roughly a quarter of your height." },
  { prompt: 'Which country has the most natural lakes?',                accepted: ['canada'],                               funFact: "It holds more freshwater lakes than the rest of the world combined." },
  { prompt: 'What is the term for an animal that eats both plants and meat?', accepted: ['omnivore'],                       funFact: "Humans, bears, and pigs all fit the bill." },
  { prompt: 'Who wrote "The Odyssey"?',                                 accepted: ['homer'],                                funFact: "Attributed to Homer, though authorship is still debated." },
  { prompt: 'What is the chemical symbol for potassium?',               accepted: ['k'],                                    funFact: "From the Latin \"kalium.\"" },
  { prompt: 'What year was the United Nations founded?',                accepted: ['1945'],                                 funFact: "Founded right after WWII to prevent another one." },
]

const PART_C: Question[] = [
  { prompt: 'What is the capital of Mongolia?',                         accepted: ['ulaanbaatar'],                          funFact: "One of the coldest capital cities on Earth." },
  { prompt: 'Who wrote "Crime and Punishment"?',                        accepted: ['dostoevsky', 'fyodor dostoevsky'],      funFact: "He wrote it partly to pay off gambling debts." },
  { prompt: 'What is the SI unit of frequency?',                        accepted: ['hertz'],                                funFact: "Named after Heinrich Hertz, who proved radio waves exist." },
  { prompt: 'Which element has atomic number 1?',                       accepted: ['hydrogen'],                             funFact: "The lightest and most abundant element in the universe." },
  { prompt: 'What year did the French Revolution begin?',               accepted: ['1789'],                                 funFact: "It kicked off with the storming of the Bastille." },
  { prompt: 'What is the study of fossils called?',                     accepted: ['paleontology'],                         funFact: "It sits at the crossroads of biology and geology." },
  { prompt: 'Who was the first person to walk on the moon?',            accepted: ['neil armstrong', 'armstrong'],          funFact: "\"One small step\" — July 20th, 1969." },
  { prompt: 'What is the capital of Iceland?',                          accepted: ['reykjavik'],                            funFact: "It's the northernmost capital of a sovereign state." },
  { prompt: 'What is the process by which plants make food called?',    accepted: ['photosynthesis'],                       funFact: "It converts sunlight, water, and CO2 into sugar and oxygen." },
  { prompt: 'Which ocean is the smallest?',                             accepted: ['arctic', 'arctic ocean'],               funFact: "It's smaller than Russia." },
  { prompt: 'Who developed the polio vaccine?',                         accepted: ['jonas salk', 'salk'],                   funFact: "He famously refused to patent it." },
  { prompt: 'What is the largest desert in the world by area?',         accepted: ['antarctic', 'antarctica'],              funFact: "Deserts are defined by dryness, not heat — Antarctica qualifies." },
  { prompt: 'What is the term for fear of heights?',                    accepted: ['acrophobia'],                           funFact: "Distinct from vertigo, which is a balance disorder." },
  { prompt: 'Who wrote "Pride and Prejudice"?',                         accepted: ['jane austen', 'austen'],                funFact: "It was originally titled \"First Impressions.\"" },
  { prompt: 'What is the capital of Peru?',                             accepted: ['lima'],                                 funFact: "Founded by Francisco Pizarro in 1535." },
  { prompt: 'What is the powerhouse of the cell called?',               accepted: ['mitochondria', 'mitochondrion'],        funFact: "They have their own separate DNA." },
  { prompt: 'What year did India gain independence?',                   accepted: ['1947'],                                 funFact: "August 15th, 1947, from British rule." },
  { prompt: 'Who painted the ceiling of the Sistine Chapel?',           accepted: ['michelangelo'],                         funFact: "It took him roughly four years, mostly lying on his back." },
  { prompt: 'What is the currency of India?',                           accepted: ['rupee', 'indian rupee'],                funFact: "The symbol ₹ was adopted in 2010." },
  { prompt: 'What is the term for a triangle with all sides equal?',    accepted: ['equilateral'],                          funFact: "All three angles are also equal, at 60° each." },
  { prompt: 'Who wrote "The Republic"?',                                accepted: ['plato'],                                funFact: "It's structured as a dialogue led by Socrates." },
  { prompt: 'What is the SI unit of electric current?',                 accepted: ['ampere', 'amp'],                        funFact: "Named after André-Marie Ampère." },
  { prompt: 'Which vitamin deficiency causes scurvy?',                  accepted: ['vitamin c', 'c'],                       funFact: "Sailors carried citrus fruit for centuries before knowing why it worked." },
  { prompt: 'What is the capital of Uruguay?',                          accepted: ['montevideo'],                           funFact: "Home to about half the country's population." },
  { prompt: 'Who discovered penicillin?',                               accepted: ['alexander fleming', 'fleming'],         funFact: "He noticed it by accident in a messy petri dish." },
  { prompt: 'What is the term for the fear of enclosed spaces?',        accepted: ['claustrophobia'],                       funFact: "One of the most commonly reported phobias." },
  { prompt: 'Which planet has the shortest day?',                       accepted: ['jupiter'],                              funFact: "It spins all the way around in about 10 hours." },
  { prompt: 'What is the study of weather called?',                     accepted: ['meteorology'],                          funFact: "Nothing to do with meteors, despite the name." },
  { prompt: 'Who wrote "War and Peace"?',                               accepted: ['tolstoy', 'leo tolstoy'],               funFact: "At over 1,200 pages, it's one of the longest major novels ever written." },
  { prompt: 'What is the capital of Kazakhstan?',                       accepted: ['astana'],                               funFact: "It was renamed Nur-Sultan then renamed back to Astana." },
]

const QUESTION_PARTS: Question[][] = [PART_A, PART_B, PART_C]
const PART_LABELS = ['Warm-Up', 'Mixed', 'Hard Mode']

// Picks a part based on the calendar day so returning players see a
// different set day to day, cycling through all parts.
function getTodayPartIndex(numParts: number): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  return dayOfYear % numParts
}

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

interface Props { rank: GameRank; onEnd: (payload: GameEndPayload) => void; onBack: () => void; sessionsLeft?: number; sessionCost?: number }

export default function CloseCall({ rank: _rank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  useGamePresence('close-call')
  const [phase, setPhase]         = useState<'info' | 'play' | 'result' | 'quit'>('info')
  const [qIndex, setQIndex]       = useState(0)
  const [partIndex, setPartIndex] = useState(() => getTodayPartIndex(QUESTION_PARTS.length))
  const [shuffled, setShuffled]   = useState<Question[]>([])
  const [timeLeft, setTimeLeft]   = useState(TIME_LIMIT_NORMAL)
  const [timeLimit, setTimeLimit]  = useState(TIME_LIMIT_NORMAL)
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
      gameId: 'close-call' as any,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const limit = next >= 20 ? TIME_LIMIT_IMPOSSIBLE : TIME_LIMIT_NORMAL
    setTimeLimit(limit)
    setTimeLeft(limit)
    setAnswerState('idle')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function start() {
    const todayPart = getTodayPartIndex(QUESTION_PARTS.length)
    setPartIndex(todayPart)
    const s = [...QUESTION_PARTS[todayPart]].sort(() => Math.random() - 0.5)
    setShuffled(s)
    setQIndex(0)
    setInput('')
    setLives(MAX_LIVES)
    setCorrect(0)
    setTimeLeft(TIME_LIMIT_NORMAL)
    setTimeLimit(TIME_LIMIT_NORMAL)
    setAnswerState('idle')
    setResult(null)
    startRef.current = Date.now()
    setPhase('play')
    setTimeout(() => inputRef.current?.focus(), 200)
  }

  const rankCfg = getRankConfig(_rank)
  const todaysLabel = PART_LABELS[getTodayPartIndex(QUESTION_PARTS.length)]
  const rules = [
    { icon: '💬', text: "You're asked a question. Type the closest answer you know." },
    { icon: '✅', text: "Close enough counts — typos and near-misses are forgiven." },
    { icon: '⏱️', text: '6 seconds to answer. Time runs out = lose a life.' },
    { icon: '❤️', text: '3 lives total. Lose them all and the session ends.' },
    { icon: '⚡', text: `${XP_PER_Q} XP per correct answer. Session costs 4 plays.` },
    { icon: '🔄', text: `Today's set: ${todaysLabel}. Questions rotate daily — come back tomorrow for a new set.` },
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
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={null} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
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
            <StatChip label="Set" value={PART_LABELS[partIndex]} accent={ACCENT} />
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
        <TimerRing timeLeft={timeLeft} total={timeLimit} />

        {/* Question card */}
        <div style={{
          width:'100%', maxWidth:480,
          background: answerState === 'correct' ? 'rgba(62,207,142,0.08)' : answerState === 'wrong' || answerState === 'timeout' ? 'rgba(255,79,79,0.08)' : 'var(--surface)',
          border: `1.5px solid ${answerState === 'idle' ? 'rgba(255,255,255,0.07)' : stateColor + '40'}`,
          borderRadius:20, padding:'24px 22px',
          boxShadow: `0 0 ${answerState !== 'idle' ? '20px' : '0px'} ${stateColor}20, 4px 4px 12px var(--neu-dark),-2px -2px 8px var(--neu-light)`,
          transition:'background-color var(--dur-slow) var(--ease-out), color var(--dur-slow) var(--ease-out), border-color var(--dur-slow) var(--ease-out), box-shadow var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out), opacity var(--dur-slow) var(--ease-out)',
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
              onClick={(e) => { ripple(e); submit() }}
              disabled={answerState !== 'idle' || !input.trim()}
              className="ripple-wrap"
              style={{
                padding:'10px 18px', borderRadius:12, border:'none', fontWeight:700, fontSize:13,
                background: answerState !== 'idle' || !input.trim() ? 'var(--surface2)' : ACCENT,
                color: answerState !== 'idle' || !input.trim() ? 'var(--text-muted)' : '#fff',
                cursor: answerState !== 'idle' || !input.trim() ? 'not-allowed' : 'pointer',
                transition:'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)', flexShrink:0,
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
