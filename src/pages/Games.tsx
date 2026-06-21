// src/pages/Games.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Brain, Layers, BookOpen, Grid3X3, Flag,
  ChevronRight, X, Trophy, ArrowLeft,
  ArrowUp, ArrowDown, ArrowLeftIcon, ArrowRight,
  Check, Circle,
} from 'lucide-react'
import { ripple } from '../lib/ripple'

// ─── Types ──────────────────────────────────────────────────
type GameId = 'neon-blitz' | 'grid-ghost' | 'flux-sort' | 'trivia-clash' | 'tac-zone' | 'flag-rush'
type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface GameResult { gameId: GameId; gameName: string; score: number; ts: number }

interface GameCard {
  id: GameId; name: string; tagline: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  accent: string; difficulty: Difficulty
}

// ─── Game metadata ───────────────────────────────────────────
const GAMES: GameCard[] = [
  { id: 'neon-blitz',    name: 'Neon Blitz',    tagline: 'Match the glow. Beat the flash.',        icon: Zap,      accent: '#4f8ef7', difficulty: 'Hard'   },
  { id: 'grid-ghost',    name: 'Grid Ghost',    tagline: 'The grid remembers. Do you?',            icon: Brain,    accent: '#9b6dff', difficulty: 'Medium' },
  { id: 'flux-sort',     name: 'Flux Sort',     tagline: 'Sort fast or get sorted out.',           icon: Layers,   accent: '#ff4d8b', difficulty: 'Medium' },
  { id: 'trivia-clash',  name: 'Trivia Clash',  tagline: 'Drop knowledge. Wreck the scoreboard.', icon: BookOpen, accent: '#ff9a3c', difficulty: 'Easy'   },
  { id: 'tac-zone',      name: 'Tac Zone',      tagline: 'Three in a row. No mercy.',              icon: Grid3X3,  accent: '#3ecf8e', difficulty: 'Easy'   },
  { id: 'flag-rush',     name: 'Flag Rush',     tagline: "Flags don't lie. Can you read them?",   icon: Flag,     accent: '#4f8ef7', difficulty: 'Medium' },
]

const DIFF_COLOR: Record<Difficulty, string> = {
  Easy: 'var(--green)', Medium: 'var(--gold)', Hard: 'var(--pink)',
}

// ─── Shared helpers ──────────────────────────────────────────
function NeuBtn({ onClick, children, style, disabled }: { onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; style?: React.CSSProperties; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ripple-wrap"
      style={{
        background: 'var(--surface2)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '10px 16px',
        color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface2)', borderRadius: 12, padding: '8px 14px',
      boxShadow: '2px 2px 6px var(--neu-dark)',
      minWidth: 60,
    }}>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

// ─── Game Start Screen ───────────────────────────────────────
function StartScreen({ game, onStart, children }: { game: GameCard; onStart: () => void; children?: React.ReactNode }) {
  const Icon = game.icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32, gap: 20 }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24,
        background: `linear-gradient(135deg, ${game.accent}33, ${game.accent}11)`,
        border: `2px solid ${game.accent}44`,
        boxShadow: `0 0 32px ${game.accent}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={40} style={{ color: game.accent }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{game.name}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>{game.tagline}</p>
      </div>
      {children}
      <button
        type="button"
        className="btn-primary ripple-wrap"
        onClick={onStart}
        style={{ padding: '14px 40px', borderRadius: 14, fontSize: 15, fontWeight: 800, marginTop: 8 }}
      >
        Start {game.name}
      </button>
    </div>
  )
}

// ─── Game Over Screen ────────────────────────────────────────
function GameOver({ score, label, onReplay, onBack }: { score: number; label: string; onReplay: () => void; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, padding: 32 }}>
      <div className="neu-card" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 340, width: '100%' }}>
        <Trophy size={48} style={{ color: 'var(--gold)', marginBottom: 12 }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{score > 200 ? 'Well Played!' : 'Game Over'}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>{label}</p>
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)', marginBottom: 24 }}>{score}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-primary ripple-wrap" onClick={onReplay} style={{ flex: 1, padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700 }}>Play Again</button>
          <NeuBtn onClick={onBack} style={{ flex: 1, padding: '11px' }}>Back to Games</NeuBtn>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 1: NEON BLITZ
// ═══════════════════════════════════════════════════════════
type Dir = 'up' | 'down' | 'left' | 'right'
const ALL_DIRS: Dir[] = ['up', 'down', 'left', 'right']
const DIR_ICONS: Record<Dir, React.ComponentType<{ size?: number }>> = {
  up: ArrowUp, down: ArrowDown, left: ArrowLeftIcon, right: ArrowRight,
}

function NeonBlitz({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [current, setCurrent] = useState<Dir>('up')
  const [score, setScore] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none')
  const [elapsed, setElapsed] = useState(0)
  const [plays, setPlays] = useState(0)
  const durationRef = useRef(1200)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const nextArrow = useCallback(() => {
    setCurrent(ALL_DIRS[Math.floor(Math.random() * 4)])
    setFlash('none')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setMistakes(m => {
        const next = m + 1
        if (next >= 2) { setPhase('over'); return next }
        setFlash('red')
        setTimeout(() => nextArrow(), 400)
        return next
      })
    }, durationRef.current)
  }, [])

  function start() {
    setScore(0); setMistakes(0); setElapsed(0); durationRef.current = 1200
    setPlays(p => p + 1); setPhase('play')
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    nextArrow()
  }

  useEffect(() => {
    if (phase === 'over') {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      onEnd(score)
    }
  }, [phase, score, onEnd])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'play') return
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (map[e.key]) tap(map[e.key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, current])

  function tap(dir: Dir) {
    if (phase !== 'play') return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dir === current) {
      setFlash('green')
      setScore(s => s + 1)
      durationRef.current = Math.max(400, durationRef.current - 30)
      setTimeout(nextArrow, 200)
    } else {
      setFlash('red')
      setMistakes(m => {
        const next = m + 1
        if (next >= 2) { setPhase('over'); return next }
        setTimeout(nextArrow, 400)
        return next
      })
    }
  }

  const CurIcon = DIR_ICONS[current]
  const game = GAMES[0]

  if (phase === 'start') return <StartScreen game={game} onStart={start} />
  if (phase === 'over') return <GameOver score={score} label={`${score} correct answers`} onReplay={start} onBack={() => onEnd(score)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '24px 20px', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Score" value={score} />
        <StatChip label="Time" value={`${elapsed}s`} />
        <StatChip label="Errors" value={`${mistakes}/2`} />
      </div>

      {/* Arrow display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 140, height: 140, borderRadius: 32,
          background: flash === 'green' ? 'rgba(62,207,142,0.15)' : flash === 'red' ? 'rgba(255,79,79,0.15)' : 'var(--surface)',
          boxShadow: flash === 'green' ? '0 0 40px rgba(62,207,142,0.4)' : flash === 'red' ? '0 0 40px rgba(255,79,79,0.4)' : '6px 6px 16px var(--neu-dark), -4px -4px 12px var(--neu-light)',
          border: `2px solid ${flash === 'green' ? 'rgba(62,207,142,0.5)' : flash === 'red' ? 'rgba(255,79,79,0.5)' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          <CurIcon size={72} style={{ color: flash === 'green' ? 'var(--green)' : flash === 'red' ? 'var(--red)' : 'var(--blue)' }} />
        </div>
      </div>

      {/* D-pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gridTemplateRows: 'repeat(2, 72px)', gap: 10, marginBottom: 20 }}>
        {/* Up: row1 col2 */}
        <div style={{ gridColumn: 2, gridRow: 1 }}>
          <button type="button" onClick={(e) => { ripple(e); tap('up') }} className="ripple-wrap" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--surface)', boxShadow: '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowUp size={22} style={{ color: 'var(--text-dim)' }} />
          </button>
        </div>
        {/* Left: row2 col1 */}
        <div style={{ gridColumn: 1, gridRow: 2 }}>
          <button type="button" onClick={(e) => { ripple(e); tap('left') }} className="ripple-wrap" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--surface)', boxShadow: '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeftIcon size={22} style={{ color: 'var(--text-dim)' }} />
          </button>
        </div>
        {/* Down: row2 col2 */}
        <div style={{ gridColumn: 2, gridRow: 2 }}>
          <button type="button" onClick={(e) => { ripple(e); tap('down') }} className="ripple-wrap" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--surface)', boxShadow: '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowDown size={22} style={{ color: 'var(--text-dim)' }} />
          </button>
        </div>
        {/* Right: row2 col3 */}
        <div style={{ gridColumn: 3, gridRow: 2 }}>
          <button type="button" onClick={(e) => { ripple(e); tap('right') }} className="ripple-wrap" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--surface)', boxShadow: '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowRight size={22} style={{ color: 'var(--text-dim)' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 2: GRID GHOST
// ═══════════════════════════════════════════════════════════
function GridGhost({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'countdown' | 'show' | 'recall' | 'over'>('start')
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [pattern, setPattern] = useState<number[]>([])
  const [tapped, setTapped] = useState<number[]>([])
  const [cellFlash, setCellFlash] = useState<Record<number, 'green' | 'red' | 'show'>>({})
  const [countdown, setCountdown] = useState(3)
  const [toast, setToast] = useState('')
  const [plays, setPlays] = useState(0)

  function genPattern(lvl: number) {
    const cells = Array.from({ length: 9 }, (_, i) => i)
    const shuffled = cells.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(lvl, 8))
  }

  function startLevel(lvl: number) {
    const p = genPattern(lvl)
    setPattern(p); setTapped([]); setCellFlash({})
    setPhase('countdown'); setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--; setCountdown(c)
      if (c === 0) {
        clearInterval(iv)
        setPhase('show')
        const fl: Record<number, 'show'> = {}
        p.forEach(i => { fl[i] = 'show' })
        setCellFlash(fl)
        setTimeout(() => { setCellFlash({}); setPhase('recall') }, 3000)
      }
    }, 1000)
  }

  function start() {
    setScore(0); setLevel(1); setPlays(p => p + 1); startLevel(1)
  }

  function tapCell(idx: number) {
    if (phase !== 'recall') return
    if (tapped.includes(idx)) return

    if (pattern.includes(idx)) {
      const next = [...tapped, idx]
      setCellFlash(f => ({ ...f, [idx]: 'green' }))
      setTapped(next)
      if (next.length === pattern.length) {
        setScore(s => s + 1)
        setToast('Level Clear!')
        setTimeout(() => {
          setToast('')
          setLevel(l => {
            const nl = l + 1
            startLevel(nl)
            return nl
          })
        }, 800)
      }
    } else {
      setCellFlash(f => ({ ...f, [idx]: 'red' }))
      setTimeout(() => { setPhase('over'); onEnd(score) }, 600)
    }
  }

  const game = GAMES[1]

  if (phase === 'start') return <StartScreen game={game} onStart={start} />
  if (phase === 'over') return <GameOver score={score} label={`Reached level ${level}`} onReplay={start} onBack={() => onEnd(score)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '24px 20px', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Level" value={level} />
        <StatChip label="Score" value={score} />
        <StatChip label="Plays" value={plays} />
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: phase === 'recall' ? 'var(--green)' : 'var(--text-dim)', textAlign: 'center', minHeight: 24 }}>
        {phase === 'countdown' ? '' : phase === 'show' ? 'Watch carefully!' : 'Your turn!'}
      </div>

      {phase === 'countdown' && (
        <div style={{ fontSize: 80, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{countdown}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 300, margin: '0 auto' }}>
        {Array.from({ length: 9 }, (_, i) => {
          const fl = cellFlash[i]
          return (
            <button
              key={i}
              type="button"
              onClick={() => tapCell(i)}
              aria-label={`Cell ${i + 1}`}
              style={{
                aspectRatio: '1', borderRadius: 16, cursor: phase === 'recall' ? 'pointer' : 'default',
                background: fl === 'show' ? 'rgba(155,109,255,0.4)' : fl === 'green' ? 'rgba(62,207,142,0.3)' : fl === 'red' ? 'rgba(255,79,79,0.3)' : 'var(--surface)',
                boxShadow: fl === 'show' ? '0 0 20px rgba(155,109,255,0.5)' : fl === 'green' ? '0 0 16px rgba(62,207,142,0.4)' : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s', opacity: phase === 'countdown' ? 0.4 : 1,
              }}
            />
          )
        })}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)', border: '1px solid rgba(62,207,142,0.4)',
          borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: 'var(--green)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 3: FLUX SORT
// ═══════════════════════════════════════════════════════════
const FLUX_ROUNDS = [
  { cats: ['Living', 'Non-Living'], items: [['Bird','L'],['Rock','N'],['Tree','L'],['Chair','N'],['Dog','L'],['Lamp','N'],['Fish','L'],['Book','N']] },
  { cats: ['Water Vehicle', 'Land Vehicle'], items: [['Kayak','L'],['Motorcycle','R'],['Submarine','L'],['Bus','R'],['Yacht','L'],['Truck','R'],['Canoe','L'],['Car','R']] },
  { cats: ['Blue Things', 'Green Things'], items: [['Sky','L'],['Grass','R'],['Ocean','L'],['Leaf','R'],['Jeans','L'],['Frog','R'],['Blueberry','L'],['Cucumber','R']] },
  { cats: ['Hot', 'Cold'], items: [['Fire','L'],['Ice','R'],['Sun','L'],['Snow','R'],['Pepper','L'],['Glacier','R'],['Lava','L'],['Mint','R']] },
  { cats: ['Fruit', 'Vegetable'], items: [['Apple','L'],['Carrot','R'],['Mango','L'],['Broccoli','R'],['Strawberry','L'],['Spinach','R'],['Grape','L'],['Potato','R']] },
  { cats: ['Ancient', 'Modern'], items: [['Pyramid','L'],['Smartphone','R'],['Scroll','L'],['Laptop','R'],['Chariot','L'],['Drone','R'],['Sundial','L'],['Robot','R']] },
]

function FluxSort({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [roundIdx, setRoundIdx] = useState(0)
  const [itemIdx, setItemIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(20)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [plays, setPlays] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const round = FLUX_ROUNDS[roundIdx]
  const [word, side] = round?.items[itemIdx] ?? ['', 'L']

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(20)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { nextRound(); return 20 }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    setScore(0); setRoundIdx(0); setItemIdx(0); setPlays(p => p + 1)
    setPhase('play'); startTimer()
  }

  function nextRound() {
    if (roundIdx >= FLUX_ROUNDS.length - 1) { setPhase('over'); onEnd(score); return }
    setRoundIdx(r => r + 1); setItemIdx(0); startTimer()
  }

  function pick(pickedSide: 'L' | 'R') {
    const correct = pickedSide === side
    if (correct) {
      const bonus = Math.floor((timeLeft / 20) * 10) + 10
      setScore(s => s + bonus)
      setFeedback('correct')
    } else {
      setFeedback('wrong')
    }
    setTimeout(() => {
      setFeedback(null)
      if (itemIdx >= round.items.length - 1) { nextRound() }
      else setItemIdx(i => i + 1)
    }, 300)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const game = GAMES[2]
  if (phase === 'start') return <StartScreen game={game} onStart={start} />
  if (phase === 'over') return <GameOver score={score} label="Rounds complete!" onReplay={start} onBack={() => onEnd(score)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 20px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Time" value={`${timeLeft}s`} />
        <StatChip label="Points" value={score} />
        <StatChip label="Round" value={`${roundIdx + 1}/6`} />
      </div>

      {/* Timer bar */}
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 1px 1px 4px var(--neu-dark)' }}>
        <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 2, width: `${(timeLeft / 20) * 100}%`, transition: 'width 1s linear' }} />
      </div>

      {/* Word card */}
      <div className="neu-card" style={{ padding: '32px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {feedback && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: feedback === 'correct' ? 'rgba(62,207,142,0.08)' : 'rgba(255,79,79,0.08)' }}>
            {feedback === 'correct' ? <Check size={40} style={{ color: 'var(--green)' }} /> : <X size={40} style={{ color: 'var(--red)' }} />}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Sort this:</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{word}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{itemIdx + 1} / {round.items.length}</p>
      </div>

      {/* Category buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick('L') }} style={{ flex: 1, padding: '20px 8px', borderRadius: 16, fontSize: 15, fontWeight: 800, color: '#fff', background: '#3b5bdb', border: 'none', cursor: 'pointer' }}>
          {round.cats[0]}
        </button>
        <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick('R') }} style={{ flex: 1, padding: '20px 8px', borderRadius: 16, fontSize: 15, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', cursor: 'pointer' }}>
          {round.cats[1]}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 4: TRIVIA CLASH
// ═══════════════════════════════════════════════════════════
const TRIVIA_POOL = [
  { q: 'What planet is known as the Red Planet?', a: ['Mars','Venus','Saturn','Jupiter'], correct: 0, category: 'Science' },
  { q: 'How many sides does a hexagon have?', a: ['5','6','7','8'], correct: 1, category: 'Math' },
  { q: 'Which country has the largest population?', a: ['India','USA','China','Brazil'], correct: 2, category: 'Geography' },
  { q: 'What is the capital of Japan?', a: ['Seoul','Beijing','Tokyo','Bangkok'], correct: 2, category: 'Geography' },
  { q: 'Who painted the Mona Lisa?', a: ['Picasso','Da Vinci','Monet','Rembrandt'], correct: 1, category: 'Art' },
  { q: 'What gas do plants absorb?', a: ['Oxygen','Nitrogen','CO2','Hydrogen'], correct: 2, category: 'Science' },
  { q: 'How many continents are there?', a: ['5','6','7','8'], correct: 2, category: 'Geography' },
  { q: 'What is H2O?', a: ['Air','Water','Fire','Earth'], correct: 1, category: 'Science' },
  { q: 'What sport uses a shuttlecock?', a: ['Tennis','Badminton','Squash','Ping Pong'], correct: 1, category: 'Sports' },
  { q: 'Which metal is liquid at room temperature?', a: ['Iron','Gold','Mercury','Silver'], correct: 2, category: 'Science' },
  { q: 'In what year did WW2 end?', a: ['1943','1944','1945','1946'], correct: 2, category: 'History' },
  { q: 'How many bones in the human body?', a: ['196','206','216','226'], correct: 1, category: 'Biology' },
  { q: 'What is the fastest land animal?', a: ['Lion','Horse','Cheetah','Leopard'], correct: 2, category: 'Animals' },
  { q: 'Who wrote Romeo and Juliet?', a: ['Dickens','Shakespeare','Austen','Hemingway'], correct: 1, category: 'Literature' },
  { q: 'What color do you get mixing red + blue?', a: ['Green','Orange','Purple','Brown'], correct: 2, category: 'Art' },
  { q: 'What is the largest ocean?', a: ['Atlantic','Indian','Arctic','Pacific'], correct: 3, category: 'Geography' },
  { q: 'How many days in a leap year?', a: ['364','365','366','367'], correct: 2, category: 'Math' },
  { q: 'What language has the most native speakers?', a: ['English','Spanish','Mandarin','Hindi'], correct: 2, category: 'Language' },
  { q: 'What organ pumps blood?', a: ['Lungs','Liver','Brain','Heart'], correct: 3, category: 'Biology' },
  { q: 'Which is the smallest continent?', a: ['Antarctica','Europe','Australia','S.America'], correct: 2, category: 'Geography' },
]

function TriviaClash({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [questions, setQuestions] = useState<typeof TRIVIA_POOL>([])
  const [qIdx, setQIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [selected, setSelected] = useState<number | null>(null)
  const [plays, setPlays] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(15); startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { advance(null); return 15 }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    const shuffled = [...TRIVIA_POOL].sort(() => Math.random() - 0.5).slice(0, 10)
    setQuestions(shuffled); setQIdx(0); setScore(0); setSelected(null)
    setPlays(p => p + 1); setPhase('play'); startTimer()
  }

  function advance(picked: number | null) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeout(() => {
      setSelected(null)
      if (qIdx >= questions.length - 1) { setPhase('over'); onEnd(score); return }
      setQIdx(i => i + 1); startTimer()
    }, 800)
  }

  function pick(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    const q = questions[qIdx]
    if (idx === q.correct) {
      const bonus = elapsed < 5 ? 50 : elapsed < 10 ? 25 : 0
      setScore(s => s + 100 + bonus)
    }
    advance(idx)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const game = GAMES[3]
  if (phase === 'start') return <StartScreen game={game} onStart={start} />
  if (phase === 'over') return <GameOver score={score} label="Trivia complete!" onReplay={start} onBack={() => onEnd(score)} />

  const q = questions[qIdx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Time" value={`${timeLeft}s`} />
        <StatChip label="Score" value={score} />
        <StatChip label="Q" value={`${qIdx + 1}/10`} />
      </div>

      {/* Question card */}
      <div className="neu-card" style={{ padding: '24px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--gold)', marginBottom: 10 }}>{q.category}</p>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>{q.q}</p>
        {/* Timer ring */}
        <div style={{ marginTop: 12 }}>
          <svg width="48" height="48" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--surface2)" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={timeLeft <= 5 ? 'var(--red)' : 'var(--gold)'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - timeLeft / 15)}`}
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            <text x="24" y="29" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="700">{timeLeft}</text>
          </svg>
        </div>
      </div>

      {/* Answers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {q.a.map((ans, i) => {
          const isCorrect = i === q.correct
          const isSelected = selected === i
          let bg = 'var(--surface)'
          let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCorrect) { bg = 'rgba(62,207,142,0.12)'; border = 'rgba(62,207,142,0.5)' }
            else if (isSelected) { bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.5)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(i) }}
              style={{
                padding: '16px 12px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: bg, border: `1px solid ${border}`,
                boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                color: 'var(--text)', textAlign: 'center', transition: 'all 0.2s',
              }}>
              {ans}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 5: TAC ZONE
// ═══════════════════════════════════════════════════════════
type TacCell = 'X' | 'O' | null
type TacDifficulty = 'Easy' | 'Medium' | 'Hard'
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWinner(b: TacCell[]): { winner: TacCell; line: number[] | null } {
  for (const [a, bIdx, c] of WINS) {
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return { winner: b[a], line: [a, bIdx, c] }
  }
  return { winner: null, line: null }
}

function minimax(board: TacCell[], isMax: boolean): number {
  const { winner } = checkWinner(board)
  if (winner === 'O') return 10
  if (winner === 'X') return -10
  if (board.every(c => c !== null)) return 0
  let best = isMax ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = isMax ? 'O' : 'X'
      const val = minimax(board, !isMax)
      board[i] = null
      best = isMax ? Math.max(best, val) : Math.min(best, val)
    }
  }
  return best
}

function bestMove(board: TacCell[], diff: TacDifficulty): number {
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0)
  if (diff === 'Easy') return empty[Math.floor(Math.random() * empty.length)]
  if (diff === 'Medium' && Math.random() < 0.5) return empty[Math.floor(Math.random() * empty.length)]
  let best = -Infinity; let move = empty[0]
  for (const i of empty) {
    const b = [...board]; b[i] = 'O'
    const val = minimax(b, false)
    if (val > best) { best = val; move = i }
  }
  return move
}

function TacZone({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [diff, setDiff] = useState<TacDifficulty>('Medium')
  const [board, setBoard] = useState<TacCell[]>(Array(9).fill(null))
  const [aiTurn, setAiTurn] = useState(false)
  const [result, setResult] = useState<{ winner: TacCell; line: number[] | null } | null>(null)
  const [scores, setScores] = useState({ W: 0, D: 0, L: 0 })
  const [plays, setPlays] = useState(0)

  function start() {
    setBoard(Array(9).fill(null)); setResult(null); setAiTurn(false)
    setPlays(p => p + 1); setPhase('play')
  }

  function endGame(b: TacCell[]) {
    const res = checkWinner(b)
    const draw = b.every(c => c !== null) && !res.winner
    setResult(draw ? { winner: null, line: null } : res)
    if (res.winner === 'X') setScores(s => ({ ...s, W: s.W + 1 }))
    else if (res.winner === 'O') setScores(s => ({ ...s, L: s.L + 1 }))
    else if (draw) setScores(s => ({ ...s, D: s.D + 1 }))
  }

  function tapCell(idx: number) {
    if (phase !== 'play' || board[idx] || aiTurn || result) return
    const nb = [...board]; nb[idx] = 'X'
    setBoard(nb)
    const res = checkWinner(nb)
    if (res.winner || nb.every(c => c !== null)) { endGame(nb); return }
    setAiTurn(true)
    setTimeout(() => {
      const move = bestMove(nb, diff)
      const nb2 = [...nb]; nb2[move] = 'O'
      setBoard(nb2)
      endGame(nb2)
      setAiTurn(false)
    }, 600)
  }

  const game = GAMES[4]
  const totalScore = scores.W * 100 + scores.D * 20

  if (phase === 'start') return (
    <StartScreen game={game} onStart={start}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['Easy','Medium','Hard'] as TacDifficulty[]).map(d => (
          <button key={d} type="button" onClick={() => setDiff(d)}
            style={{
              padding: '7px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: diff === d ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: diff === d ? '#fff' : 'var(--text-dim)',
              border: diff === d ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.06)',
            }}>
            {d}
          </button>
        ))}
      </div>
    </StartScreen>
  )

  if (phase === 'over') return <GameOver score={totalScore} label={`${scores.W}W · ${scores.D}D · ${scores.L}L`} onReplay={start} onBack={() => onEnd(totalScore)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '20px', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Wins" value={scores.W} />
        <StatChip label="Draws" value={scores.D} />
        <StatChip label="Loss" value={scores.L} />
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: result ? 'var(--gold)' : aiTurn ? 'var(--text-muted)' : 'var(--blue)' }}>
        {result ? (result.winner === 'X' ? 'You win!' : result.winner === 'O' ? 'AI wins!' : 'Draw!') : aiTurn ? 'AI thinking…' : 'Your turn'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gridTemplateRows: 'repeat(3, 88px)', gap: 10 }}>
        {board.map((cell, i) => {
          const inLine = result?.line?.includes(i)
          return (
            <button key={i} type="button" onClick={() => tapCell(i)} aria-label={`Cell ${i + 1}`}
              style={{
                width: 88, height: 88, borderRadius: 18, cursor: cell || result ? 'default' : 'pointer',
                background: inLine ? (result?.winner === 'X' ? 'rgba(79,142,247,0.15)' : 'rgba(255,77,139,0.15)') : 'var(--surface)',
                boxShadow: inLine ? `0 0 20px ${result?.winner === 'X' ? 'rgba(79,142,247,0.4)' : 'rgba(255,77,139,0.4)'}` : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              }}>
              {cell === 'X' && <X size={36} style={{ color: 'var(--blue)' }} />}
              {cell === 'O' && <Circle size={34} style={{ color: 'var(--pink)' }} />}
            </button>
          )
        })}
      </div>

      {result && (
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-primary ripple-wrap" onClick={start} style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Rematch</button>
          <NeuBtn onClick={() => onEnd(totalScore)} style={{ padding: '10px 20px' }}>Back</NeuBtn>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 6: FLAG RUSH
// ═══════════════════════════════════════════════════════════
const FLAGS = [
  { flag:'🇳🇬', country:'Nigeria',       options:['Nigeria','Ghana','Cameroon','Senegal'],          correct:0 },
  { flag:'🇫🇷', country:'France',        options:['France','Belgium','Italy','Spain'],              correct:0 },
  { flag:'🇧🇷', country:'Brazil',        options:['Brazil','Argentina','Colombia','Peru'],          correct:0 },
  { flag:'🇯🇵', country:'Japan',         options:['China','Japan','South Korea','Vietnam'],         correct:1 },
  { flag:'🇩🇪', country:'Germany',       options:['Austria','Germany','Switzerland','Netherlands'], correct:1 },
  { flag:'🇮🇹', country:'Italy',         options:['Spain','Portugal','Italy','Greece'],             correct:2 },
  { flag:'🇪🇸', country:'Spain',         options:['Mexico','Spain','Argentina','Portugal'],         correct:1 },
  { flag:'🇺🇸', country:'USA',           options:['Canada','Australia','USA','UK'],                 correct:2 },
  { flag:'🇬🇧', country:'UK',            options:['Ireland','UK','Australia','Canada'],             correct:1 },
  { flag:'🇨🇦', country:'Canada',        options:['USA','Australia','Canada','New Zealand'],        correct:2 },
  { flag:'🇦🇺', country:'Australia',     options:['New Zealand','UK','Australia','Canada'],         correct:2 },
  { flag:'🇮🇳', country:'India',         options:['Pakistan','Bangladesh','India','Sri Lanka'],     correct:2 },
  { flag:'🇨🇳', country:'China',         options:['Japan','China','South Korea','Vietnam'],         correct:1 },
  { flag:'🇲🇽', country:'Mexico',        options:['Colombia','Mexico','Brazil','Peru'],             correct:1 },
  { flag:'🇿🇦', country:'South Africa',  options:['Kenya','Nigeria','South Africa','Zimbabwe'],     correct:2 },
  { flag:'🇰🇪', country:'Kenya',         options:['Kenya','Ethiopia','Tanzania','Uganda'],          correct:0 },
  { flag:'🇦🇷', country:'Argentina',     options:['Brazil','Chile','Argentina','Uruguay'],          correct:2 },
  { flag:'🇵🇹', country:'Portugal',      options:['Spain','Italy','Portugal','France'],             correct:2 },
  { flag:'🇳🇱', country:'Netherlands',   options:['Belgium','Germany','Netherlands','Denmark'],     correct:2 },
  { flag:'🇸🇪', country:'Sweden',        options:['Norway','Finland','Sweden','Denmark'],           correct:2 },
  { flag:'🇹🇷', country:'Turkey',        options:['Turkey','Iran','Egypt','Saudi Arabia'],          correct:0 },
  { flag:'🇪🇬', country:'Egypt',         options:['Morocco','Algeria','Egypt','Libya'],             correct:2 },
  { flag:'🇸🇦', country:'Saudi Arabia',  options:['UAE','Iran','Saudi Arabia','Iraq'],              correct:2 },
  { flag:'🇰🇷', country:'South Korea',   options:['Japan','China','South Korea','Vietnam'],         correct:2 },
  { flag:'🇮🇩', country:'Indonesia',     options:['Malaysia','Indonesia','Philippines','Thailand'], correct:1 },
  { flag:'🇵🇰', country:'Pakistan',      options:['India','Bangladesh','Pakistan','Afghanistan'],   correct:2 },
  { flag:'🇧🇩', country:'Bangladesh',    options:['India','Pakistan','Bangladesh','Nepal'],         correct:2 },
  { flag:'🇻🇳', country:'Vietnam',       options:['Thailand','Vietnam','Cambodia','Laos'],          correct:1 },
  { flag:'🇹🇭', country:'Thailand',      options:['Vietnam','Cambodia','Thailand','Myanmar'],       correct:2 },
  { flag:'🇵🇱', country:'Poland',        options:['Czech Republic','Hungary','Poland','Slovakia'],  correct:2 },
]

function FlagRush({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [pool, setPool] = useState<typeof FLAGS>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(10)
  const [selected, setSelected] = useState<number | null>(null)
  const [plays, setPlays] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(10); startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { advance(); return 10 }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    const shuffled = [...FLAGS].sort(() => Math.random() - 0.5).slice(0, 15)
    setPool(shuffled); setIdx(0); setScore(0); setSelected(null)
    setPlays(p => p + 1); setPhase('play'); startTimer()
  }

  function advance() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeout(() => {
      setSelected(null)
      if (idx >= 14) { setPhase('over'); onEnd(score); return }
      setIdx(i => i + 1); startTimer()
    }, 700)
  }

  function pick(i: number) {
    if (selected !== null) return
    setSelected(i)
    if (timerRef.current) clearInterval(timerRef.current)
    if (i === pool[idx].correct) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const bonus = elapsed < 4 ? 40 : 0
      setScore(s => s + 80 + bonus)
    }
    advance()
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const game = GAMES[5]
  if (phase === 'start') return <StartScreen game={game} onStart={start} />
  if (phase === 'over') return <GameOver score={score} label="15 flags done!" onReplay={start} onBack={() => onEnd(score)} />

  const current = pool[idx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Time" value={`${timeLeft}s`} />
        <StatChip label="Score" value={score} />
        <StatChip label="Flag" value={`${idx + 1}/15`} />
      </div>

      <div className="neu-card" style={{ padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 12 }}>{current.flag}</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Which country is this?</p>
        {/* Timer bar */}
        <div style={{ marginTop: 14, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 2, width: `${(timeLeft / 10) * 100}%`, transition: 'width 1s linear' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {current.options.map((opt, i) => {
          const isCorrect = i === current.correct
          const isSelected = selected === i
          let bg = 'var(--surface)'
          let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCorrect) { bg = 'rgba(62,207,142,0.12)'; border = 'rgba(62,207,142,0.5)' }
            else if (isSelected) { bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.5)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(i) }}
              style={{
                padding: '16px 12px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: bg, border: `1px solid ${border}`,
                boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                color: 'var(--text)', textAlign: 'center', transition: 'all 0.2s',
              }}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME VIEW WRAPPER
// ═══════════════════════════════════════════════════════════
function GameView({ gameId, onBack, onEnd }: { gameId: GameId; onBack: () => void; onEnd: (score: number, gameId: GameId) => void }) {
  const [quitModal, setQuitModal] = useState(false)
  const game = GAMES.find(g => g.id === gameId)!

  function handleEnd(score: number) { onEnd(score, gameId) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: 'var(--bg)', position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', filter: 'blur(100px)', opacity: 0.08, background: game.accent, top: '10%', left: '-10%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(100px)', opacity: 0.06, background: game.accent, bottom: '10%', right: '-5%', pointerEvents: 'none' }} />

      {/* Game header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 52, flexShrink: 0, position: 'relative', zIndex: 10,
        background: 'rgba(17,17,19,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button type="button" onClick={() => setQuitModal(true)} style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', background: 'var(--surface2)', padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>{game.name}</span>
        <div style={{ width: 34 }} />
      </div>

      {/* Game content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {gameId === 'neon-blitz'   && <NeonBlitz   onEnd={handleEnd} />}
        {gameId === 'grid-ghost'   && <GridGhost   onEnd={handleEnd} />}
        {gameId === 'flux-sort'    && <FluxSort    onEnd={handleEnd} />}
        {gameId === 'trivia-clash' && <TriviaClash onEnd={handleEnd} />}
        {gameId === 'tac-zone'     && <TacZone     onEnd={handleEnd} />}
        {gameId === 'flag-rush'    && <FlagRush    onEnd={handleEnd} />}
      </div>

      {/* Quit modal */}
      {quitModal && (
        <>
          <div className="overlay-backdrop" onClick={() => setQuitModal(false)} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="neu-card" style={{ padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', animation: 'popUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Quit game?</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Your progress will be lost.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <NeuBtn onClick={() => setQuitModal(false)} style={{ flex: 1, padding: '11px' }}>Cancel</NeuBtn>
                <button type="button" className="btn-primary ripple-wrap" onClick={onBack} style={{ flex: 1, padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Quit</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// LOBBY
// ═══════════════════════════════════════════════════════════
function Lobby({ onPlay, results, bestScores }: { onPlay: (id: GameId) => void; results: GameResult[]; bestScores: Record<GameId, number> }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      {/* Hero */}
      <section className="su d1">
        <div className="neu-card" style={{ padding: '22px 20px', marginBottom: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Game Zone</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>Pick a game. Chase the leaderboard.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="chip">🎮 <strong>{results.length}</strong> played today</span>
            <span className="chip">🏆 <strong>{results.length > 0 ? Math.max(...results.map(r => r.score)) : '—'}</strong> top score</span>
          </div>
        </div>
      </section>

      {/* Game grid */}
      <section className="su d2">
        <p className="section-label">Games</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {GAMES.map(game => {
            const Icon = game.icon
            const best = bestScores[game.id]
            return (
              <button
                key={game.id}
                type="button"
                className="neu-card ripple-wrap"
                onClick={(e) => { ripple(e); onPlay(game.id) }}
                style={{ padding: 20, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', border: 'none' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, marginBottom: 14,
                  background: `${game.accent}18`,
                  boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={22} style={{ color: game.accent }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{game.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>{game.tagline}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: DIFF_COLOR[game.difficulty], background: `${DIFF_COLOR[game.difficulty]}18`, padding: '3px 8px', borderRadius: 20, border: `1px solid ${DIFF_COLOR[game.difficulty]}33` }}>
                    {game.difficulty}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{best ? `Best: ${best}` : 'Not played'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>
                  Play <ChevronRight size={13} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Recent results */}
      <section className="su d3">
        <p className="section-label">Recent Results</p>
        {results.length === 0 ? (
          <div className="neu-card-sm" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No games played yet. Pick one above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.slice(-5).reverse().map((r, i) => (
              <div key={i} className="neu-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${GAMES.find(g => g.id === r.gameId)?.accent ?? 'var(--accent)'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => { const G = GAMES.find(g => g.id === r.gameId)!; const I = G.icon; return <I size={16} style={{ color: G.accent }} /> })()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.gameName}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ROOT GAMES PAGE
// ═══════════════════════════════════════════════════════════
export default function Games() {
  const navigate = useNavigate()
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [results, setResults] = useState<GameResult[]>([])
  const [bestScores, setBestScores] = useState<Record<GameId, number>>({} as Record<GameId, number>)

  function handleGameEnd(score: number, gameId: GameId) {
    const game = GAMES.find(g => g.id === gameId)!
    setResults(r => [...r, { gameId, gameName: game.name, score, ts: Date.now() }])
    setBestScores(b => ({ ...b, [gameId]: Math.max(b[gameId] ?? 0, score) }))
    setActiveGame(null)
  }

  if (activeGame) {
    return <GameView gameId={activeGame} onBack={() => setActiveGame(null)} onEnd={handleGameEnd} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={15} />
        </button>
      </div>
      <Lobby onPlay={setActiveGame} results={results} bestScores={bestScores} />
    </div>
  )
}
