// src/pages/games/RapidSort.tsx
// ── Anime Trivia ─────────────────────────────────────────────
// Questions from Open Trivia DB (anime category) + local fallback bank
// Time starts at 10s per question and shrinks as you climb higher streaks
// 4 multiple-choice options · lives system · rank-based difficulty
import { useState, useEffect, useRef, useCallback } from 'react'
import { Drama } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig, calcSessionXP } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../../hooks/useGamePresence'

const ACCENT  = '#9b6dff'
const GAME_ID = 'rapid-sort' as const   // keeps DB key unchanged

// ─── Time per question (shrinks as streak grows) ──────────────
function getTimeForStreak(streak: number, rank: GameRank): number {
  const base: Record<GameRank, number> = {
    beginner:     10,
    intermediate: 9,
    advanced:     8,
    master:       7,
  }
  const b = base[rank]
  // Every 3 correct in a row, lose 1 second, floor at 4
  const reduction = Math.floor(streak / 3)
  return Math.max(4, b - reduction)
}

// ─── Lives per rank ───────────────────────────────────────────
const LIVES: Record<GameRank, number> = {
  beginner:     3,
  intermediate: 3,
  advanced:     2,
  master:       1,
}

// ─── Total questions per session ─────────────────────────────
const TOTAL_Q: Record<GameRank, number> = {
  beginner:     10,
  intermediate: 15,
  advanced:     20,
  master:       25,
}

// ─── Trivia question type ─────────────────────────────────────
interface TriviaQ {
  question: string
  correct: string
  options: string[]   // already shuffled, contains correct
}

// ─── OpenTDB fetch — category 31 = Anime & Manga ─────────────
async function fetchFromOpenTDB(amount: number): Promise<TriviaQ[]> {
  try {
    const url = `https://opentdb.com/api.php?amount=${amount}&category=31&type=multiple&encode=url3986`
    const res  = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (data.response_code !== 0 || !data.results?.length) return []

    return data.results.map((r: {
      question: string
      correct_answer: string
      incorrect_answers: string[]
    }) => {
      const correct = decodeURIComponent(r.correct_answer)
      const wrong   = r.incorrect_answers.map(decodeURIComponent)
      const options = [...wrong, correct].sort(() => Math.random() - 0.5)
      return { question: decodeURIComponent(r.question), correct, options }
    })
  } catch {
    return []
  }
}

// ─── Local fallback bank (shown if API fails / offline) ───────
const FALLBACK: TriviaQ[] = ([
  { q: 'What is the name of the main protagonist in Naruto?',                              a: 'Naruto Uzumaki',      w: ['Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha'] },
  { q: 'Which anime features the Survey Corps fighting Titans?',                            a: 'Attack on Titan',     w: ['Demon Slayer', 'Tokyo Ghoul', 'Fullmetal Alchemist'] },
  { q: 'What is the name of Goku\'s signature energy attack in Dragon Ball Z?',             a: 'Kamehameha',          w: ['Rasengan', 'Chidori', 'Galick Gun'] },
  { q: 'In One Piece, what is the name of Luffy\'s pirate crew?',                          a: 'Straw Hat Pirates',   w: ['Heart Pirates', 'Blackbeard Pirates', 'Big Mom Pirates'] },
  { q: 'Which anime is set in a world where 80% of the population has superpowers called "Quirks"?', a: 'My Hero Academia', w: ['Fairy Tail', 'Black Clover', 'Jujutsu Kaisen'] },
  { q: 'Who is the creator of the Death Note in the anime of the same name?',              a: 'Ryuk',                w: ['Light Yagami', 'L', 'Misa Amane'] },
  { q: 'What studio produced Spirited Away?',                                              a: 'Studio Ghibli',       w: ['Toei Animation', 'Madhouse', 'Bones'] },
  { q: 'In Fullmetal Alchemist, what did Edward Elric lose in the failed transmutation?',  a: 'His right arm and left leg', w: ['Both arms', 'His right leg and left arm', 'His eyes'] },
  { q: 'What is the real name of the character known as "L" in Death Note?',               a: 'L Lawliet',           w: ['Light Yagami', 'Nate River', 'Mihael Keehl'] },
  { q: 'In Sword Art Online, what is the name of the first virtual reality game?',         a: 'Sword Art Online',    w: ['ALfheim Online', 'Gun Gale Online', 'Ordinal Scale'] },
  { q: 'Which anime features a boy named Tanjiro who fights demons to save his sister?',   a: 'Demon Slayer',        w: ['Blue Exorcist', 'Noragami', 'Bleach'] },
  { q: 'What is the power system called in Hunter x Hunter?',                              a: 'Nen',                 w: ['Chakra', 'Reiatsu', 'Mana'] },
  { q: 'In Bleach, what is the name of Ichigo\'s primary Zanpakuto?',                      a: 'Zangetsu',            w: ['Senbonzakura', 'Ryujin Jakka', 'Wabisuke'] },
  { q: 'Who is the protagonist of the anime "Jujutsu Kaisen"?',                            a: 'Yuji Itadori',        w: ['Megumi Fushiguro', 'Satoru Gojo', 'Ryomen Sukuna'] },
  { q: 'What is the name of the hidden village where Naruto lives?',                       a: 'Konohagakure',        w: ['Sunagakure', 'Kumogakure', 'Kirigakure'] },
  { q: 'In Re:Zero, what ability does Subaru Natsuki have?',                               a: 'Return by Death',     w: ['Time Manipulation', 'Future Sight', 'Parallel Existence'] },
  { q: 'Which anime takes place in the underground city of Abyss?',                        a: 'Made in Abyss',       w: ['No Game No Life', 'Overlord', 'That Time I Got Reincarnated as a Slime'] },
  { q: 'What is Saitama\'s hero name in One Punch Man?',                                   a: 'Caped Baldy',         w: ['Genos', 'Tank Top Tiger', 'Mumen Rider'] },
  { q: 'In Fairy Tail, what is the name of Natsu\'s exceed companion?',                    a: 'Happy',               w: ['Carla', 'Panther Lily', 'Frosch'] },
  { q: 'Which anime is about a group of kids who are transported to a digital world?',     a: 'Digimon',             w: ['Pokémon', '.hack//Sign', 'Sword Art Online'] },
  { q: 'What is the name of the school in My Hero Academia?',                              a: 'UA High School',      w: ['Shiketsu High', 'Ketsubutsu Academy', 'Isamu Academy'] },
  { q: 'In Cowboy Bebop, what is the name of the spaceship the crew lives on?',            a: 'Bebop',               w: ['Red Tail', 'Hammerhead', 'Swordfish'] },
  { q: 'Which character shouts "DATTEBAYO!" in Naruto?',                                   a: 'Naruto Uzumaki',      w: ['Obito Uchiha', 'Minato Namikaze', 'Jiraiya'] },
  { q: 'In Tokyo Ghoul, what is the name of the protagonist who becomes a half-ghoul?',    a: 'Kaneki Ken',          w: ['Touka Kirishima', 'Juuzou Suzuya', 'Amon Koutarou'] },
  { q: 'What is the subtitle of the second season of Sword Art Online?',                   a: 'Phantom Bullet',      w: ['Fairy Dance', 'Alicization', 'War of Underworld'] },
  { q: 'In Evangelion, what does NERV fight against?',                                     a: 'Angels',              w: ['Demons', 'Kaiju', 'Apostles'] },
  { q: 'Which anime features a protagonist named Gon who wants to find his father?',       a: 'Hunter x Hunter',     w: ['Dragon Ball', 'One Piece', 'Black Clover'] },
  { q: 'What is the name of Roronoa Zoro\'s three-sword fighting style in One Piece?',     a: 'Santoryu',            w: ['Ittoryu', 'Nitoryu', 'Yontoryu'] },
  { q: 'In Black Clover, what is Asta\'s unique ability?',                                  a: 'Anti-Magic',          w: ['Dark Magic', 'Mana Skin', 'Time Magic'] },
  { q: 'Which studio is known for producing "Demon Slayer: Kimetsu no Yaiba"?',            a: 'ufotable',            w: ['Bones', 'Madhouse', 'Mappa'] },
]).map(({ q, a, w }) => ({
  question: q,
  correct: a,
  options: [...w, a].sort(() => Math.random() - 0.5),
}))

// ─── Timer ring ───────────────────────────────────────────────
function TimerRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct  = timeLeft / total
  const r    = 22
  const circ = 2 * Math.PI * r
  const color = timeLeft <= 2 ? '#ff4f4f' : timeLeft <= 4 ? '#f5c542' : ACCENT
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
      <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 30 30)"
        style={{ transition: 'stroke-dashoffset 0.15s linear, stroke 0.3s' }}
      />
      <text x={30} y={35} textAnchor="middle" fontSize={15} fontWeight={800} fill={color}>{timeLeft}</text>
    </svg>
  )
}

// ─── Option button ────────────────────────────────────────────
function OptionBtn({
  label, state, onClick,
}: {
  label: string
  state: 'idle' | 'correct' | 'wrong' | 'reveal'
  onClick: () => void
}) {
  const bg = state === 'correct' ? 'rgba(62,207,142,0.18)' :
             state === 'wrong'   ? 'rgba(255,107,107,0.18)' :
             state === 'reveal'  ? 'rgba(62,207,142,0.10)' :
             'var(--surface2)'
  const border = state === 'correct' ? '1.5px solid #3ecf8e' :
                 state === 'wrong'   ? '1.5px solid #ff6b6b' :
                 state === 'reveal'  ? '1.5px solid rgba(62,207,142,0.4)' :
                 '1px solid rgba(255,255,255,0.07)'
  const color = state === 'correct' ? '#3ecf8e' :
                state === 'wrong'   ? '#ff6b6b' :
                state === 'reveal'  ? '#3ecf8e' :
                'var(--text)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== 'idle'}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 14,
        background: bg, border, color,
        fontSize: 13.5, fontWeight: 600, textAlign: 'left',
        cursor: state === 'idle' ? 'pointer' : 'default',
        transition: 'all 0.18s',
        boxShadow: state === 'idle' ? '2px 2px 6px var(--neu-dark)' : 'none',
      }}
      onMouseEnter={e => { if (state === 'idle') e.currentTarget.style.background = 'rgba(155,109,255,0.12)' }}
      onMouseLeave={e => { if (state === 'idle') e.currentTarget.style.background = 'var(--surface2)' }}
    >
      {label}
    </button>
  )
}

// ─── Props ────────────────────────────────────────────────────
interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function RapidSort({ rank: initialRank, onEnd, onBack }: Props) {
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [phase, setPhase]       = useState<'info' | 'loading' | 'play' | 'result' | 'quit'>('info')
  const [questions, setQuestions] = useState<TriviaQ[]>([])
  const [qIdx, setQIdx]         = useState(0)
  const [lives, setLives]       = useState(3)
  const [streak, setStreak]     = useState(0)
  const [score, setScore]       = useState(0)
  const [timeLeft, setTimeLeft] = useState(10)
  const [timeCap, setTimeCap]   = useState(10)
  const [answerState, setAnswerState] = useState<'idle' | 'answered'>('idle')
  const [chosenIdx, setChosenIdx]     = useState<number | null>(null)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult]     = useState<GameEndPayload | null>(null)
  const [loadError, setLoadError] = useState(false)

  const startRef  = useRef(Date.now())
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const livesRef  = useRef(3)
  const correctRef = useRef(0)
  const streakRef  = useRef(0)
  const scoreRef   = useRef(0)

  const currentRank = rankState.rank
  const currentQ    = questions[qIdx]
  const totalQ      = questions.length

  // ── Load questions ──────────────────────────────────────────
  async function loadQuestions() {
    setPhase('loading')
    setLoadError(false)
    const need = TOTAL_Q[currentRank]
    livesRef.current  = LIVES[currentRank]
    setLives(LIVES[currentRank])
    streakRef.current = 0; setStreak(0)
    correctRef.current = 0; setCorrect(0)
    scoreRef.current = 0; setScore(0)
    setQIdx(0)
    setAnswerState('idle')
    setChosenIdx(null)

    let qs = await fetchFromOpenTDB(need)
    if (qs.length < need) {
      // Pad with shuffled fallback
      const shuffled = [...FALLBACK].sort(() => Math.random() - 0.5)
      qs = [...qs, ...shuffled].slice(0, need)
    }
    if (qs.length === 0) { setLoadError(true); setPhase('info'); return }

    setQuestions(qs)
    startRef.current = Date.now()
    setPhase('play')
  }

  // ── Timer setup ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play' || answerState !== 'idle' || !currentQ) return
    const cap = getTimeForStreak(streakRef.current, currentRank)
    setTimeCap(cap)
    setTimeLeft(cap)

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
    return () => { if (timerRef.current) clearInterval(timerRef.current!) }
  }, [phase, qIdx, answerState])

  // ── End session ─────────────────────────────────────────────
  const endSession = useCallback((finalCorrect: number, finalTotal: number, finalScore: number) => {
    if (timerRef.current) clearInterval(timerRef.current!)
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const xp  = calcSessionXP(finalCorrect, finalTotal, streakRef.current, getRankConfig(currentRank).xpBase)
    const accuracy = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 0
    const payload: GameEndPayload = {
      gameId: GAME_ID as any,
      gameName: 'Anime Trivia',
      rank: currentRank,
      score: finalScore,
      xpEarned: xp,
      durationSec: dur,
      streak: streakRef.current,
      correct: finalCorrect,
      total: finalTotal,
      detail: { 'Accuracy': `${accuracy}%`, 'Best Streak': streakRef.current },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }, [currentRank, onEnd])

  function handleTimeout() {
    setAnswerState('answered')
    setChosenIdx(null)
    const newLives = livesRef.current - 1
    livesRef.current = newLives
    setLives(newLives)
    streakRef.current = 0; setStreak(0)
    onWrong()
    setTimeout(() => {
      const nextIdx = qIdx + 1
      if (newLives <= 0 || nextIdx >= totalQ) {
        endSession(correctRef.current, qIdx + 1, scoreRef.current)
      } else {
        setQIdx(nextIdx)
        setAnswerState('idle')
        setChosenIdx(null)
      }
    }, 1400)
  }

  function handleAnswer(idx: number) {
    if (answerState !== 'idle' || !currentQ) return
    if (timerRef.current) clearInterval(timerRef.current!)
    setChosenIdx(idx)
    setAnswerState('answered')

    const isCorrect = currentQ.options[idx] === currentQ.correct

    if (isCorrect) {
      const newStreak  = streakRef.current + 1
      const newCorrect = correctRef.current + 1
      const points     = 100 + (timeLeft * 10) + (newStreak >= 3 ? 50 : 0)
      streakRef.current = newStreak; setStreak(newStreak)
      correctRef.current = newCorrect
      scoreRef.current += points; setScore(s => s + points)
      const { promoted: promotion } = onCorrect(rankCfg.streakRequired)
      if (promotion) setPromoted(promotion)
    } else {
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      streakRef.current = 0; setStreak(0)
      onWrong()
    }

    setTimeout(() => {
      const nextIdx = qIdx + 1
      const failed  = !isCorrect && livesRef.current <= 0
      if (failed || nextIdx >= totalQ) {
        endSession(correctRef.current, qIdx + 1, scoreRef.current)
      } else {
        setQIdx(nextIdx)
        setAnswerState('idle')
        setChosenIdx(null)
      }
    }, isCorrect ? 900 : 1400)
  }

  const rankCfg = getRankConfig(currentRank)

  // ── Pre-game info ────────────────────────────────────────────
  if (phase === 'info' || phase === 'loading') {
    return (
      <PreGameModal
        gameName="Anime Trivia"
        tagline="Test your anime knowledge. Time shrinks as your streak grows."
        accent={ACCENT}
        icon={<Drama size={20} />}
        rankState={rankState}
        streakRequired={rankCfg.streakRequired}
        onStart={loadQuestions}
        onClose={onBack}
        rules={[
          { icon: '🎌', text: `${TOTAL_Q[currentRank]} questions from the anime universe` },
          { icon: '⏱️', text: `Starts at ${getTimeForStreak(0, currentRank)}s per question — shrinks every 3 correct` },
          { icon: '❤️', text: `${LIVES[currentRank]} ${LIVES[currentRank] === 1 ? 'life' : 'lives'} — wrong or timeout costs one` },
          { icon: '🔥', text: '3-in-a-row streak gives bonus points' },
          { icon: '📡', text: 'Questions fetched live from OpenTDB' },
        ]}
        extraContent={
          loadError ? (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.25)', fontSize: 12, color: '#ff6b6b', marginBottom: 12 }}>
              ⚠️ Couldn't load questions. Check your connection and try again.
            </div>
          ) : phase === 'loading' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.2)', marginBottom: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(155,109,255,0.3)', borderTopColor: ACCENT, display: 'block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>Fetching questions…</span>
            </div>
          ) : null
        }
      />
    )
  }

  // ── Quit modal ───────────────────────────────────────────────
  if (phase === 'quit') {
    return (
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QuitModal
          onConfirm={() => { if (timerRef.current) clearInterval(timerRef.current!); onBack() }}
          onCancel={() => setPhase('play')}
        />
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <ResultScreen
          payload={result}
          accent={ACCENT}
          onReplay={loadQuestions}
          onBack={onBack}
          promoted={promoted}
        />
      </div>
    )
  }

  // ── Play ─────────────────────────────────────────────────────
  if (!currentQ) return null

  const optionStates = currentQ.options.map((opt, i) => {
    if (answerState === 'idle') return 'idle' as const
    if (opt === currentQ.correct) return 'correct' as const
    if (i === chosenIdx) return 'wrong' as const
    return 'reveal' as const
  })

  // Hearts display
  const maxLives = LIVES[currentRank]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      {/* HUD */}
      <GameHUD
        gameName="Anime Trivia"
        accent={ACCENT}
        icon={<Drama size={15} />}
        streak={streak}
        onQuit={() => { if (timerRef.current) clearInterval(timerRef.current!); setPhase('quit') }}
        extraLeft={
          <StatChip label="Score" value={score} accent={ACCENT} />
        }
        extraRight={
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: maxLives }).map((_, i) => (
              <span key={i} style={{ fontSize: 14, opacity: i < lives ? 1 : 0.2, transition: 'opacity 0.3s' }}>❤️</span>
            ))}
          </div>
        }
      />

      {/* Question area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Progress bar + question count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${ACCENT}, #ff4d8b)`,
              width: `${((qIdx) / totalQ) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
            {qIdx + 1}/{totalQ}
          </span>
        </div>

        {/* Timer + Question card */}
        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${ACCENT}22`,
          borderRadius: 20,
          padding: '20px 18px',
          boxShadow: `0 0 30px ${ACCENT}10, 2px 2px 8px var(--neu-dark)`,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Timer row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: ACCENT,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              background: `${ACCENT}12`, padding: '4px 10px', borderRadius: 20,
              border: `1px solid ${ACCENT}30`,
            }}>
              🎌 Anime Trivia
            </div>
            <TimerRing timeLeft={timeLeft} total={timeCap} />
          </div>

          {/* Question text */}
          <p style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text)',
            lineHeight: 1.55, margin: 0,
          }}>
            {currentQ.question}
          </p>

          {/* Streak speed warning */}
          {streak >= 3 && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#f5c542',
              background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.25)',
              borderRadius: 10, padding: '5px 10px', textAlign: 'center',
            }}>
              🔥 {streak} streak — timer now {timeCap}s
            </div>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentQ.options.map((opt, i) => (
            <OptionBtn
              key={i}
              label={opt}
              state={optionStates[i]}
              onClick={() => handleAnswer(i)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
