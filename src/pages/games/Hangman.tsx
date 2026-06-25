// src/pages/games/Hangman.tsx
import { useState, useEffect, useRef } from 'react'
import { Hash } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal } from './GameShell'
import { ripple } from '../../lib/ripple'

const ACCENT = '#ff6b00'
const MAX_LIVES = 3
const MAX_HINTS = 3

// ─── Word bank ────────────────────────────────────────────────
interface WordEntry { word: string; category: string; difficulty: 'easy' | 'medium' | 'hard' | 'impossible' }

const WORDS: WordEntry[] = [
  // easy
  { word: 'CAT',      category: 'Animals',    difficulty: 'easy' },
  { word: 'DOG',      category: 'Animals',    difficulty: 'easy' },
  { word: 'SUN',      category: 'Nature',     difficulty: 'easy' },
  { word: 'FISH',     category: 'Animals',    difficulty: 'easy' },
  { word: 'JUMP',     category: 'Actions',    difficulty: 'easy' },
  { word: 'CAKE',     category: 'Food',       difficulty: 'easy' },
  { word: 'PLAY',     category: 'Actions',    difficulty: 'easy' },
  { word: 'BIRD',     category: 'Animals',    difficulty: 'easy' },
  { word: 'RAIN',     category: 'Nature',     difficulty: 'easy' },
  { word: 'TREE',     category: 'Nature',     difficulty: 'easy' },
  { word: 'LION',     category: 'Animals',    difficulty: 'easy' },
  { word: 'STAR',     category: 'Space',      difficulty: 'easy' },
  { word: 'FROG',     category: 'Animals',    difficulty: 'easy' },
  { word: 'SAND',     category: 'Nature',     difficulty: 'easy' },
  { word: 'BOOK',     category: 'Objects',    difficulty: 'easy' },
  // medium
  { word: 'PYTHON',   category: 'Tech',       difficulty: 'medium' },
  { word: 'GALAXY',   category: 'Space',      difficulty: 'medium' },
  { word: 'JUNGLE',   category: 'Nature',     difficulty: 'medium' },
  { word: 'CASTLE',   category: 'Places',     difficulty: 'medium' },
  { word: 'SOCKET',   category: 'Tech',       difficulty: 'medium' },
  { word: 'PEPPER',   category: 'Food',       difficulty: 'medium' },
  { word: 'BRIDGE',   category: 'Places',     difficulty: 'medium' },
  { word: 'CHROME',   category: 'Tech',       difficulty: 'medium' },
  { word: 'CACTUS',   category: 'Nature',     difficulty: 'medium' },
  { word: 'FROZEN',   category: 'Movies',     difficulty: 'medium' },
  { word: 'MARBLE',   category: 'Objects',    difficulty: 'medium' },
  { word: 'SPRINT',   category: 'Sports',     difficulty: 'medium' },
  { word: 'GRAVEL',   category: 'Nature',     difficulty: 'medium' },
  { word: 'FLUTE',    category: 'Music',      difficulty: 'medium' },
  { word: 'WALLET',   category: 'Objects',    difficulty: 'medium' },
  // hard
  { word: 'QUANTUM',  category: 'Science',    difficulty: 'hard' },
  { word: 'PHOENIX',  category: 'Mythology',  difficulty: 'hard' },
  { word: 'ENCRYPT',  category: 'Tech',       difficulty: 'hard' },
  { word: 'WRINKLE',  category: 'Words',      difficulty: 'hard' },
  { word: 'XYLOPHONE',category: 'Music',      difficulty: 'hard' },
  { word: 'FJORD',    category: 'Geography',  difficulty: 'hard' },
  { word: 'BIZARRE',  category: 'Words',      difficulty: 'hard' },
  { word: 'TYCOON',   category: 'Business',   difficulty: 'hard' },
  { word: 'VORTEX',   category: 'Science',    difficulty: 'hard' },
  { word: 'GLADIATOR',category: 'Movies',     difficulty: 'hard' },
  { word: 'RHYTHM',   category: 'Music',      difficulty: 'hard' },
  { word: 'WYVERN',   category: 'Mythology',  difficulty: 'hard' },
  { word: 'BAROQUE',  category: 'Art',        difficulty: 'hard' },
  { word: 'FLUXION',  category: 'Science',    difficulty: 'hard' },
  { word: 'ZEPHYR',   category: 'Nature',     difficulty: 'hard' },
  // impossible
  { word: 'MNEMONIC',   category: 'Words',      difficulty: 'impossible' },
  { word: 'SYZYGY',     category: 'Space',      difficulty: 'impossible' },
  { word: 'QUIXOTIC',   category: 'Words',      difficulty: 'impossible' },
  { word: 'PNEUMONIA',  category: 'Medicine',   difficulty: 'impossible' },
  { word: 'CHRYSALIS',  category: 'Biology',    difficulty: 'impossible' },
  { word: 'ALGORITHM',  category: 'Tech',       difficulty: 'impossible' },
  { word: 'XENOPHOBIA', category: 'Psychology', difficulty: 'impossible' },
  { word: 'LABYRINTH',  category: 'Mythology',  difficulty: 'impossible' },
  { word: 'POLYPHONY',  category: 'Music',      difficulty: 'impossible' },
  { word: 'PHOSPHORUS', category: 'Science',    difficulty: 'impossible' },
  { word: 'BYZANTINE',  category: 'History',    difficulty: 'impossible' },
  { word: 'HYPOTHESIS', category: 'Science',    difficulty: 'impossible' },
  { word: 'ARCHIPELAGO',category: 'Geography',  difficulty: 'impossible' },
  { word: 'JUXTAPOSE',  category: 'Words',      difficulty: 'impossible' },
  { word: 'CRYPTOGRAM', category: 'Tech',       difficulty: 'impossible' },
]

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible'

const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'impossible']

const DIFF_META: Record<Difficulty, { label: string; color: string; winsNeeded: number; xpPerWord: number }> = {
  easy:       { label: 'Easy',       color: '#3ecf8e', winsNeeded: 3,  xpPerWord: 8  },
  medium:     { label: 'Medium',     color: '#4f8ef7', winsNeeded: 3,  xpPerWord: 14 },
  hard:       { label: 'Hard',       color: '#9b6dff', winsNeeded: 3,  xpPerWord: 22 },
  impossible: { label: 'Impossible', color: '#f5c542', winsNeeded: 3,  xpPerWord: 36 },
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function pickWord(difficulty: Difficulty, usedWords: Set<string>): WordEntry {
  const pool = WORDS.filter(w => w.difficulty === difficulty && !usedWords.has(w.word))
  if (!pool.length) {
    // all used — reset and pick any
    return WORDS.filter(w => w.difficulty === difficulty)[Math.floor(Math.random() * WORDS.filter(w => w.difficulty === difficulty).length)]
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Hangman drawing ──────────────────────────────────────────
function HangmanFigure({ wrong, accent }: { wrong: number; accent: string }) {
  const s = { stroke: '#888899', strokeWidth: 2.5, strokeLinecap: 'round' as const, fill: 'none' }
  const a = { ...s, stroke: accent }
  return (
    <svg width={110} height={130} viewBox="0 0 110 130" style={{ display:'block' }}>
      {/* gallows — always visible */}
      <line x1={10}  y1={125} x2={100} y2={125} {...s} />
      <line x1={30}  y1={125} x2={30}  y2={10}  {...s} />
      <line x1={30}  y1={10}  x2={65}  y2={10}  {...s} />
      <line x1={65}  y1={10}  x2={65}  y2={26}  {...s} />
      {/* head */}
      {wrong >= 1 && <circle cx={65} cy={34} r={8} {...a} />}
      {/* body */}
      {wrong >= 2 && <line x1={65} y1={42} x2={65} y2={80} {...a} />}
      {/* left arm */}
      {wrong >= 3 && <line x1={65} y1={52} x2={48} y2={66} {...a} />}
      {/* ...but with 3 lives, max wrong = 3, so we stop at left arm for 'lose' */}
    </svg>
  )
}

// ─── Difficulty progress sidebar ─────────────────────────────
function DiffProgressBar({ difficulty, winsInDiff, winsNeeded }: { difficulty: Difficulty; winsInDiff: number; winsNeeded: number }) {
  const meta = DIFF_META[difficulty]
  const pct = Math.min(100, (winsInDiff / winsNeeded) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:700, color: meta.color }}>{meta.label}</span>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{winsInDiff}/{winsNeeded}</span>
      </div>
      <div style={{ height:4, borderRadius:2, background:'var(--surface3)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:2, background: meta.color, width:`${pct}%`, transition:'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────
interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function Hangman({ rank: _rank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')

  // progression
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [winsPerDiff, setWinsPerDiff] = useState<Record<Difficulty, number>>({ easy:0, medium:0, hard:0, impossible:0 })
  const [totalWins, setTotalWins] = useState(0)
  const [totalLosses, setTotalLosses] = useState(0)
  const [totalXP, setTotalXP] = useState(0)
  const [usedWords] = useState<Set<string>>(new Set())

  // word state
  const [entry, setEntry] = useState<WordEntry | null>(null)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [livesLeft, setLivesLeft] = useState(MAX_LIVES)
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS)
  const [wordResult, setWordResult] = useState<'win' | 'lose' | null>(null)

  // session timing
  const startRef = useRef(Date.now())
  const [result, setResult] = useState<GameEndPayload | null>(null)

  // derived
  const letters = entry ? entry.word.split('') : []
  const wrong = guessed.size > 0
    ? [...guessed].filter(l => !letters.includes(l)).length
    : 0
  const revealed = letters.every(l => guessed.has(l))

  // check win/lose after each guess
  useEffect(() => {
    if (phase !== 'play' || !entry || wordResult) return
    if (revealed) {
      setWordResult('win')
    } else if (livesLeft <= 0) {
      setWordResult('lose')
    }
  }, [guessed, livesLeft])

  // auto-advance after word result
  useEffect(() => {
    if (!wordResult) return
    const timeout = setTimeout(() => {
      if (wordResult === 'win') {
        handleWordWin()
      } else {
        handleWordLose()
      }
    }, 1800)
    return () => clearTimeout(timeout)
  }, [wordResult])

  function loadWord(diff: Difficulty) {
    const w = pickWord(diff, usedWords)
    usedWords.add(w.word)
    setEntry(w)
    setGuessed(new Set())
    setLivesLeft(MAX_LIVES)
    setWordResult(null)
  }

  function handleWordWin() {
    const xp = DIFF_META[difficulty].xpPerWord
    setTotalXP(x => x + xp)
    setTotalWins(w => w + 1)

    const newWins = { ...winsPerDiff, [difficulty]: winsPerDiff[difficulty] + 1 }
    setWinsPerDiff(newWins)

    // advance difficulty?
    const needed = DIFF_META[difficulty].winsNeeded
    if (newWins[difficulty] >= needed) {
      const idx = DIFF_ORDER.indexOf(difficulty)
      if (idx < DIFF_ORDER.length - 1) {
        const next = DIFF_ORDER[idx + 1]
        setDifficulty(next)
        loadWord(next)
      } else {
        // completed impossible — still keep playing impossible
        loadWord('impossible')
      }
    } else {
      loadWord(difficulty)
    }
  }

  function handleWordLose() {
    setTotalLosses(l => l + 1)
    // add base xp even for losing
    setTotalXP(x => x + 13)
    loadWord(difficulty)
  }

  function guess(letter: string) {
    if (guessed.has(letter) || wordResult) return
    const newGuessed = new Set(guessed)
    newGuessed.add(letter)
    setGuessed(newGuessed)
    if (!letters.includes(letter)) {
      setLivesLeft(l => l - 1)
    }
  }

  function useHint() {
    if (hintsLeft <= 0 || !entry || wordResult) return
    const unrevealed = letters.filter(l => !guessed.has(l))
    if (!unrevealed.length) return
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    setHintsLeft(h => h - 1)
    const newGuessed = new Set(guessed)
    newGuessed.add(pick)
    setGuessed(newGuessed)
  }

  function endSession() {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    // XP formula: base 13 if never tried hard, scales up to 80 for impossible grinders
    const diffBonus = { easy:0, medium:10, hard:28, impossible:50 }[difficulty]
    const xpEarned = Math.min(80, Math.max(13, totalXP + diffBonus))

    const payload: GameEndPayload = {
      gameId: 'hangman' as any,
      gameName: 'Hangman',
      rank: _rank,
      score: totalWins * 100,
      xpEarned,
      durationSec: dur,
      streak: totalWins,
      correct: totalWins,
      total: totalWins + totalLosses,
      detail: { 'Words Solved': totalWins, 'Max Difficulty': DIFF_META[difficulty].label },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    startRef.current = Date.now()
    setDifficulty('easy')
    setWinsPerDiff({ easy:0, medium:0, hard:0, impossible:0 })
    setTotalWins(0); setTotalLosses(0); setTotalXP(0)
    setHintsLeft(MAX_HINTS)
    usedWords.clear()
    setResult(null)
    loadWord('easy')
    setPhase('play')
  }

  const rankCfg = getRankConfig(_rank)
  const diffMeta = DIFF_META[difficulty]

  const rules = [
    { icon: '🔤', text: 'Guess the hidden word letter by letter.' },
    { icon: '❤️', text: '3 lives per word — wrong letters cost a life.' },
    { icon: '💡', text: '3 hints for the whole session — reveals a random letter.' },
    { icon: '📈', text: 'Win 3 words per tier to advance: Easy → Medium → Hard → Impossible.' },
    { icon: '⚡', text: 'Session costs 3 global plays.' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Hangman"
      tagline="Guess the word. One letter at a time."
      accent={ACCENT}
      icon={<Hash size={40} />}
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

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      {/* ambient glow */}
      <div style={{ position:'absolute', width:220, height:220, borderRadius:'50%', filter:'blur(90px)', opacity:0.07, background:ACCENT, top:'10%', right:'-10%', pointerEvents:'none' }} />

      <GameHUD
        gameName="Hangman"
        accent={ACCENT}
        icon={<Hash size={14} />}
        streak={totalWins}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display:'flex', gap:6 }}>
            <StatChip label="Wins"  value={totalWins}  accent={ACCENT} />
            <StatChip label="Lives" value={'❤️'.repeat(livesLeft) || '💀'} />
          </div>
        }
      />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Left: progress sidebar ── */}
        <div style={{ width:90, flexShrink:0, padding:'14px 10px', borderRight:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>Progress</div>
          {DIFF_ORDER.map(d => (
            <DiffProgressBar
              key={d}
              difficulty={d}
              winsInDiff={winsPerDiff[d]}
              winsNeeded={DIFF_META[d].winsNeeded}
            />
          ))}
          <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:3 }}>XP so far</div>
            <div style={{ fontSize:14, fontWeight:800, color:ACCENT }}>{totalXP}</div>
          </div>
        </div>

        {/* ── Right: game area ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 12px 0', overflowY:'auto' }}>

          {/* Difficulty badge + category */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:700, color:diffMeta.color, background:`${diffMeta.color}18`, padding:'3px 10px', borderRadius:20, border:`1px solid ${diffMeta.color}33` }}>
              {diffMeta.label}
            </span>
            {entry && (
              <span style={{ fontSize:10, color:'var(--text-muted)', background:'var(--surface2)', padding:'3px 10px', borderRadius:20 }}>
                {entry.category}
              </span>
            )}
          </div>

          {/* Hangman figure */}
          <HangmanFigure wrong={wrong} accent={ACCENT} />

          {/* Word display */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', margin:'12px 0 6px' }}>
            {letters.map((l, i) => {
              const show = guessed.has(l) || (wordResult === 'lose')
              return (
                <div key={i} style={{
                  width:28, height:36, borderRadius:8,
                  background: show ? `${diffMeta.color}18` : 'var(--surface2)',
                  border: show ? `1px solid ${diffMeta.color}55` : '1px solid rgba(255,255,255,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, fontWeight:800, color: show ? diffMeta.color : 'transparent',
                  boxShadow:'2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)',
                  transition:'all 0.2s',
                }}>
                  {show ? l : '_'}
                </div>
              )
            })}
          </div>

          {/* Word result flash */}
          {wordResult && (
            <div style={{
              fontSize:13, fontWeight:800, marginBottom:6,
              color: wordResult === 'win' ? '#3ecf8e' : '#ff6b6b',
              animation:'wordFlash 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {wordResult === 'win' ? `✅ Correct! +${DIFF_META[difficulty].xpPerWord} XP` : `❌ It was: ${entry?.word}`}
            </div>
          )}

          {/* Hint button */}
          <button
            type="button"
            onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); useHint() }}
            disabled={hintsLeft <= 0 || !!wordResult}
            className="ripple-wrap"
            style={{
              padding:'6px 16px', borderRadius:12, cursor: hintsLeft <= 0 || wordResult ? 'not-allowed' : 'pointer',
              background: hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.12)' : 'var(--surface2)',
              color: hintsLeft > 0 && !wordResult ? '#f5c542' : 'var(--text-muted)',
              fontSize:11, fontWeight:700, marginBottom:10,
              border: `1px solid ${hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.3)' : 'rgba(255,255,255,0.06)'}`,
              opacity: hintsLeft <= 0 || wordResult ? 0.5 : 1,
              transition:'all 0.2s',
            }}
          >
            💡 Hint ({hintsLeft} left)
          </button>

          {/* Keyboard */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center', paddingBottom:16, maxWidth:320 }}>
            {ALPHABET.map(l => {
              const isGuessed = guessed.has(l)
              const isCorrect = isGuessed && letters.includes(l)
              const isWrong   = isGuessed && !letters.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  className="ripple-wrap"
                  onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); guess(l) }}
                  disabled={isGuessed || !!wordResult}
                  style={{
                    width:32, height:36, borderRadius:9, fontSize:13, fontWeight:700,
                    border: isCorrect ? `1px solid ${diffMeta.color}55` : isWrong ? '1px solid rgba(255,107,107,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    background: isCorrect ? `${diffMeta.color}18` : isWrong ? 'rgba(255,107,107,0.1)' : 'var(--surface)',
                    color: isCorrect ? diffMeta.color : isWrong ? '#ff6b6b' : 'var(--text)',
                    cursor: isGuessed || wordResult ? 'default' : 'pointer',
                    boxShadow: isGuessed ? 'none' : '2px 2px 5px var(--neu-dark),-1px -1px 3px var(--neu-light)',
                    opacity: isWrong ? 0.45 : 1,
                    transition:'all 0.15s',
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>

          {/* End session button */}
          <button
            type="button"
            onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); endSession() }}
            className="ripple-wrap"
            style={{ marginBottom:20, padding:'8px 22px', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', background:'var(--surface2)', color:'var(--text-dim)', fontSize:12, fontWeight:600, cursor:'pointer' }}
          >
            End Session
          </button>

        </div>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}

      <style>{`
        @keyframes wordFlash { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}
