// src/pages/games/Hangman.tsx
import { useState, useEffect, useRef } from 'react'
import { Hash } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal } from './GameShell'
import { ripple } from '../../lib/ripple'

const ACCENT    = '#ff6b00'
const MAX_LIVES = 3
const MAX_HINTS = 3

interface WordEntry { word: string; hint: string; difficulty: 'easy' | 'medium' | 'hard' | 'impossible' }

// ─── Word bank with riddle-style hints ───────────────────────
const WORDS: WordEntry[] = [
  // easy
  { word: 'CAT',       hint: 'It purrs and knocks things off tables.',               difficulty: 'easy' },
  { word: 'DOG',       hint: "Man's best friend. Also loves your shoes.",              difficulty: 'easy' },
  { word: 'SUN',       hint: 'The original source of all your vitamin D.',            difficulty: 'easy' },
  { word: 'FISH',      hint: 'Lives in water, never blinks.',                         difficulty: 'easy' },
  { word: 'CAKE',      hint: 'You only get it once a year — hopefully.',              difficulty: 'easy' },
  { word: 'BIRD',      hint: 'Has wings but not every one of them flies.',            difficulty: 'easy' },
  { word: 'RAIN',      hint: 'Free water falling from the sky.',                      difficulty: 'easy' },
  { word: 'TREE',      hint: 'Gives you shade and your Wi-Fi hates it.',              difficulty: 'easy' },
  { word: 'LION',      hint: 'The king that mostly sleeps 20 hours a day.',           difficulty: 'easy' },
  { word: 'STAR',      hint: "Far away sun. You've been wishing on a dead one.",      difficulty: 'easy' },
  { word: 'FROG',      hint: 'Starts in water, ends on land, always jumps.',          difficulty: 'easy' },
  { word: 'BOOK',      hint: 'Holds a whole world inside but fits in your bag.',      difficulty: 'easy' },
  { word: 'MOON',      hint: 'It controls the tides and werewolves, apparently.',     difficulty: 'easy' },
  { word: 'SNOW',      hint: 'Cold, white, and ruins your plans.',                    difficulty: 'easy' },
  { word: 'WOLF',      hint: 'Howls at the moon. Always misunderstood.',              difficulty: 'easy' },
  // medium
  { word: 'PYTHON',    hint: 'Both a snake and a language that runs the internet.',   difficulty: 'medium' },
  { word: 'GALAXY',    hint: 'Billions of stars in one neighbourhood.',               difficulty: 'medium' },
  { word: 'JUNGLE',    hint: "More species per square metre than your city's whole park.", difficulty: 'medium' },
  { word: 'CASTLE',    hint: 'Had a moat. Now it charges tourist entry.',             difficulty: 'medium' },
  { word: 'CACTUS',    hint: 'Thrives on neglect. You relate.',                       difficulty: 'medium' },
  { word: 'BRIDGE',    hint: 'Connects two places nobody wanted to swim between.',    difficulty: 'medium' },
  { word: 'MARBLE',    hint: 'Cold, smooth, and used to build empires.',              difficulty: 'medium' },
  { word: 'WALLET',    hint: 'Flat and mostly empty. Very relatable.',                difficulty: 'medium' },
  { word: 'PEPPER',    hint: 'Tiny but makes your eyes water if it sneezes.',        difficulty: 'medium' },
  { word: 'FROZEN',    hint: "Elsa's whole situation.",                               difficulty: 'medium' },
  { word: 'SPRINT',    hint: 'Running but with urgency and regret.',                  difficulty: 'medium' },
  { word: 'FLUTE',     hint: 'You blow into it and somehow music happens.',           difficulty: 'medium' },
  { word: 'SOCKET',    hint: 'The hole in the wall that powers everything.',          difficulty: 'medium' },
  { word: 'CHROME',    hint: 'The shiny stuff and also the reason your RAM is gone.', difficulty: 'medium' },
  { word: 'GRAVEL',    hint: 'Tiny rocks that live in driveways and shoe soles.',    difficulty: 'medium' },
  // hard
  { word: 'QUANTUM',   hint: 'Physics so weird even physicists argue about it.',      difficulty: 'hard' },
  { word: 'PHOENIX',   hint: 'Burns to ash, comes back. The original comeback kid.',  difficulty: 'hard' },
  { word: 'ENCRYPT',   hint: 'Scramble a message so only the right person reads it.', difficulty: 'hard' },
  { word: 'FJORD',     hint: "Norway's dramatic coastline that Norway is smug about.", difficulty: 'hard' },
  { word: 'BIZARRE',   hint: 'So strange it is hard to explain but you know it when you see it.', difficulty: 'hard' },
  { word: 'TYCOON',    hint: 'Extremely rich person who probably owns a few islands.', difficulty: 'hard' },
  { word: 'VORTEX',    hint: 'A spinning pull you cannot escape. Also your phone.',   difficulty: 'hard' },
  { word: 'RHYTHM',    hint: 'No vowels, all feeling. Hard to spell, easy to feel.',  difficulty: 'hard' },
  { word: 'WYVERN',    hint: "Dragon but with two legs instead of four. Dragon's slimmer cousin.", difficulty: 'hard' },
  { word: 'BAROQUE',   hint: 'Fancy European art with too many angels and gold.',     difficulty: 'hard' },
  { word: 'WRINKLE',   hint: 'What time does to everything eventually.',              difficulty: 'hard' },
  { word: 'ZEPHYR',    hint: 'A gentle west wind. Sounds like a car name too.',       difficulty: 'hard' },
  { word: 'GLADIATOR', hint: 'Fought for his life in a sand arena. Great movie too.', difficulty: 'hard' },
  { word: 'FLUXION',   hint: "Newton's original name for calculus before calculus was cool.", difficulty: 'hard' },
  { word: 'XYLOPHONE', hint: 'Bang the coloured bars to make music. Kids love it.',   difficulty: 'hard' },
  // impossible
  { word: 'MNEMONIC',    hint: 'A trick your brain uses to remember things it keeps forgetting.', difficulty: 'impossible' },
  { word: 'SYZYGY',      hint: 'Three celestial bodies perfectly aligned. Also unbeatable in Scrabble.', difficulty: 'impossible' },
  { word: 'QUIXOTIC',    hint: 'Chasing impossible dreams with complete sincerity. Don Quijote energy.', difficulty: 'impossible' },
  { word: 'CHRYSALIS',   hint: 'The in-between — not caterpillar, not butterfly. The awkward phase.', difficulty: 'impossible' },
  { word: 'ALGORITHM',   hint: 'A recipe for a computer. Also why your feed shows you that.', difficulty: 'impossible' },
  { word: 'LABYRINTH',   hint: 'A maze you were not meant to escape. Also a Bowie film.', difficulty: 'impossible' },
  { word: 'POLYPHONY',   hint: 'Many voices or melodies playing at once in harmony.',  difficulty: 'impossible' },
  { word: 'PHOSPHORUS',  hint: 'Glows in the dark. Essential for life. Explosive if you are not careful.', difficulty: 'impossible' },
  { word: 'BYZANTINE',   hint: 'So complicated and political it became an adjective for complexity.', difficulty: 'impossible' },
  { word: 'HYPOTHESIS',  hint: 'An educated guess pretending to be scientific.',        difficulty: 'impossible' },
  { word: 'ARCHIPELAGO', hint: 'A chain of islands that looks amazing on a map.',       difficulty: 'impossible' },
  { word: 'JUXTAPOSE',   hint: 'Place two opposite things side by side to make a point.', difficulty: 'impossible' },
  { word: 'CRYPTOGRAM',  hint: 'A message hidden behind a code only the clever will crack.', difficulty: 'impossible' },
  { word: 'PNEUMONIA',   hint: 'A lung infection that starts with a silent P to confuse you.', difficulty: 'impossible' },
  { word: 'XENOPHOBIA',  hint: 'Fear and hatred of people who are from somewhere else.', difficulty: 'impossible' },
]

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible'
const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'impossible']

const DIFF_META: Record<Difficulty, { label: string; color: string; winsNeeded: number; xpPerWord: number }> = {
  easy:       { label: 'Easy',       color: '#3ecf8e', winsNeeded: 3, xpPerWord: 8  },
  medium:     { label: 'Medium',     color: '#4f8ef7', winsNeeded: 3, xpPerWord: 14 },
  hard:       { label: 'Hard',       color: '#9b6dff', winsNeeded: 3, xpPerWord: 22 },
  impossible: { label: 'Impossible', color: '#f5c542', winsNeeded: 3, xpPerWord: 36 },
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function pickWord(difficulty: Difficulty, usedWords: Set<string>): WordEntry {
  const pool = WORDS.filter(w => w.difficulty === difficulty && !usedWords.has(w.word))
  const src  = pool.length ? pool : WORDS.filter(w => w.difficulty === difficulty)
  return src[Math.floor(Math.random() * src.length)]
}

function HangmanFigure({ wrong, accent }: { wrong: number; accent: string }) {
  const s = { stroke: '#888899', strokeWidth: 2.5, strokeLinecap: 'round' as const, fill: 'none' }
  const a = { ...s, stroke: accent }
  return (
    <svg width={110} height={130} viewBox="0 0 110 130" style={{ display:'block' }}>
      <line x1={10}  y1={125} x2={100} y2={125} {...s} />
      <line x1={30}  y1={125} x2={30}  y2={10}  {...s} />
      <line x1={30}  y1={10}  x2={65}  y2={10}  {...s} />
      <line x1={65}  y1={10}  x2={65}  y2={26}  {...s} />
      {wrong >= 1 && <circle cx={65} cy={34} r={8} {...a} />}
      {wrong >= 2 && <line x1={65} y1={42} x2={65} y2={80} {...a} />}
      {wrong >= 3 && <line x1={65} y1={52} x2={48} y2={66} {...a} />}
    </svg>
  )
}

function DiffProgressBar({ difficulty, winsInDiff, winsNeeded }: { difficulty: Difficulty; winsInDiff: number; winsNeeded: number }) {
  const meta = DIFF_META[difficulty]
  const pct  = Math.min(100, (winsInDiff / winsNeeded) * 100)
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

interface Props { rank: GameRank; onEnd: (payload: GameEndPayload) => void; onBack: () => void }

export default function Hangman({ rank: _rank, onEnd, onBack }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')

  const [difficulty, setDifficulty]     = useState<Difficulty>('easy')
  const [winsPerDiff, setWinsPerDiff]   = useState<Record<Difficulty, number>>({ easy:0, medium:0, hard:0, impossible:0 })
  const [totalWins, setTotalWins]       = useState(0)
  const [totalLosses, setTotalLosses]   = useState(0)
  const [totalXP, setTotalXP]           = useState(0)
  const [usedWords]                     = useState<Set<string>>(new Set())

  const [entry, setEntry]           = useState<WordEntry | null>(null)
  const [guessed, setGuessed]       = useState<Set<string>>(new Set())
  const [livesLeft, setLivesLeft]   = useState(MAX_LIVES)
  const [hintsLeft, setHintsLeft]   = useState(MAX_HINTS)
  const [wordResult, setWordResult] = useState<'win' | 'lose' | null>(null)

  const startRef = useRef(Date.now())
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const letters  = entry ? entry.word.split('') : []
  const wrong    = guessed.size > 0 ? [...guessed].filter(l => !letters.includes(l)).length : 0
  const revealed = letters.length > 0 && letters.every(l => guessed.has(l))

  useEffect(() => {
    if (phase !== 'play' || !entry || wordResult) return
    if (revealed)        setWordResult('win')
    else if (livesLeft <= 0) setWordResult('lose')
  }, [guessed, livesLeft])

  useEffect(() => {
    if (!wordResult) return
    const t = setTimeout(() => {
      wordResult === 'win' ? handleWordWin() : handleWordLose()
    }, 1800)
    return () => clearTimeout(t)
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
    const newTotalWins = totalWins + 1
    const newXP        = totalXP + xp
    setTotalXP(newTotalWins => newTotalWins) // just trigger re-render
    setTotalXP(newXP)
    setTotalWins(newTotalWins)

    const newWins = { ...winsPerDiff, [difficulty]: winsPerDiff[difficulty] + 1 }
    setWinsPerDiff(newWins)

    const needed = DIFF_META[difficulty].winsNeeded
    if (newWins[difficulty] >= needed) {
      const idx = DIFF_ORDER.indexOf(difficulty)
      if (idx < DIFF_ORDER.length - 1) {
        const next = DIFF_ORDER[idx + 1]
        setDifficulty(next)
        loadWord(next)
      } else {
        loadWord('impossible')
      }
    } else {
      loadWord(difficulty)
    }
  }

  function handleWordLose() {
    setTotalLosses(l => l + 1)
    // No XP for a loss — avoids the loophole of farming easy losses
    loadWord(difficulty)
  }

  function guess(letter: string) {
    if (guessed.has(letter) || wordResult) return
    const ng = new Set(guessed); ng.add(letter)
    setGuessed(ng)
    if (!letters.includes(letter)) setLivesLeft(l => l - 1)
  }

  function useHint() {
    if (hintsLeft <= 0 || !entry || wordResult) return
    const unrevealed = letters.filter(l => !guessed.has(l))
    if (!unrevealed.length) return
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    setHintsLeft(h => h - 1)
    const ng = new Set(guessed); ng.add(pick)
    setGuessed(ng)
  }

  function endSession() {
    const dur          = Math.floor((Date.now() - startRef.current) / 1000)
    const totalPlayed  = totalWins + totalLosses
    // XP = only what was earned from correct words. No bonus for losses.
    // Cap at 200 to prevent impossible grind abuse.
    const xpEarned     = Math.min(200, Math.max(0, totalXP))

    const payload: GameEndPayload = {
      gameId:      'hangman' as any,
      gameName:    'Hangman',
      rank:        _rank,
      score:       totalWins * 100,
      xpEarned,
      durationSec: dur,
      streak:      totalWins,
      correct:     totalWins,
      total:       totalPlayed,
      detail:      { 'Words Solved': totalWins, 'Words Failed': totalLosses, 'Accuracy': totalPlayed > 0 ? `${Math.round((totalWins / totalPlayed) * 100)}%` : '0%' },
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

  const rankCfg  = getRankConfig(_rank)
  const diffMeta = DIFF_META[difficulty]

  const rules = [
    { icon: '🔤', text: 'Guess the hidden word letter by letter.' },
    { icon: '💡', text: 'Each word comes with a riddle-style hint — use it wisely.' },
    { icon: '❤️', text: '3 lives per word. Wrong letters cost a life.' },
    { icon: '🚫', text: 'No XP for failed words — only correct ones count.' },
    { icon: '📈', text: 'Win 3 words per tier: Easy → Medium → Hard → Impossible.' },
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
        {/* Sidebar */}
        <div style={{ width:90, flexShrink:0, padding:'14px 10px', borderRight:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>Progress</div>
          {DIFF_ORDER.map(d => (
            <DiffProgressBar key={d} difficulty={d} winsInDiff={winsPerDiff[d]} winsNeeded={DIFF_META[d].winsNeeded} />
          ))}
          <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:3 }}>XP earned</div>
            <div style={{ fontSize:14, fontWeight:800, color:ACCENT }}>{totalXP}</div>
          </div>
        </div>

        {/* Game area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 12px 0', overflowY:'auto' }}>

          {/* Difficulty + hint badge */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap', justifyContent:'center' }}>
            <span style={{ fontSize:10, fontWeight:700, color:diffMeta.color, background:`${diffMeta.color}18`, padding:'3px 10px', borderRadius:20, border:`1px solid ${diffMeta.color}33` }}>
              {diffMeta.label}
            </span>
          </div>

          <HangmanFigure wrong={wrong} accent={ACCENT} />

          {/* Riddle hint */}
          {entry && (
            <div style={{ fontSize:11, color:'var(--text-dim)', textAlign:'center', maxWidth:260, lineHeight:1.5, marginBottom:10, fontStyle:'italic', padding:'8px 12px', background:'var(--surface2)', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)' }}>
              💬 {entry.hint}
            </div>
          )}

          {/* Word display */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', margin:'6px 0' }}>
            {letters.map((l, i) => {
              const show = guessed.has(l) || wordResult === 'lose'
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

          {wordResult && (
            <div style={{ fontSize:13, fontWeight:800, margin:'8px 0', color: wordResult === 'win' ? '#3ecf8e' : '#ff6b6b', animation:'wordFlash 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
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
              padding:'6px 16px', borderRadius:12,
              cursor: hintsLeft <= 0 || wordResult ? 'not-allowed' : 'pointer',
              background: hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.12)' : 'var(--surface2)',
              color: hintsLeft > 0 && !wordResult ? '#f5c542' : 'var(--text-muted)',
              fontSize:11, fontWeight:700, marginBottom:10,
              border: `1px solid ${hintsLeft > 0 && !wordResult ? 'rgba(245,197,66,0.3)' : 'rgba(255,255,255,0.06)'}`,
              opacity: hintsLeft <= 0 || wordResult ? 0.5 : 1,
              transition:'all 0.2s',
            }}
          >
            💡 Reveal letter ({hintsLeft} left)
          </button>

          {/* Keyboard */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center', paddingBottom:16, maxWidth:320 }}>
            {ALPHABET.map(l => {
              const isGuessed = guessed.has(l)
              const isCorrect = isGuessed && letters.includes(l)
              const isWrong   = isGuessed && !letters.includes(l)
              return (
                <button key={l} type="button" className="ripple-wrap"
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
                  }}>
                  {l}
                </button>
              )
            })}
          </div>

          <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); endSession() }} className="ripple-wrap"
            style={{ marginBottom:20, padding:'8px 22px', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', background:'var(--surface2)', color:'var(--text-dim)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            End Session
          </button>
        </div>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
      <style>{`@keyframes wordFlash { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}
