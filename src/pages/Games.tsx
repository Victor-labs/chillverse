// src/pages/Games.tsx
import { useState, useEffect, useRef } from 'react'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Brain, Layers, BookOpen, Grid3X3, Flag,
  ChevronRight, X, Trophy, ArrowLeft,
  ArrowUp, ArrowDown, ArrowLeftIcon, ArrowRight,
  Check, Circle, Clock, Lock,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { saveGameSession, getPlaysToday } from '../lib/gameSession'
import type { GameKey } from '../lib/gameSession'
import { useAuth } from '../hooks/useAuth'

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

// ─── Constants ──────────────────────────────────────────────
const GAME_OPEN_HOUR  = 5   // 5:00 AM
const GAME_CLOSE_HOUR = 20  // 8:00 PM
const TOTAL_PLAY_HOURS = 5
const MAX_PLAYS_PER_GAME = 7

// ─── Types ──────────────────────────────────────────────────
type GameId = 'neon-blitz' | 'grid-ghost' | 'flux-sort' | 'trivia-clash' | 'tac-zone' | 'flag-rush'
type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface GameCard {
  id: GameId; key: GameKey; name: string; tagline: string
  icon: LucideIcon; accent: string; difficulty: Difficulty
}

interface GameEndResult {
  gameId: GameId; gameName: string; score: number; xpEarned: number
  durationSec: number; detail: Record<string, string | number>
}

const GAMES: GameCard[] = [
  { id: 'neon-blitz',   key: 'neon_blitz',   name: 'Neon Blitz',   tagline: 'Match the glow. Beat the flash.',        icon: Zap,      accent: '#4f8ef7', difficulty: 'Hard'   },
  { id: 'grid-ghost',   key: 'grid_ghost',   name: 'Grid Ghost',   tagline: 'The grid remembers. Do you?',            icon: Brain,    accent: '#9b6dff', difficulty: 'Medium' },
  { id: 'flux-sort',    key: 'flux_sort',    name: 'Flux Sort',    tagline: 'Sort fast or get sorted out.',           icon: Layers,   accent: '#ff4d8b', difficulty: 'Medium' },
  { id: 'trivia-clash', key: 'trivia_clash', name: 'Trivia Clash', tagline: 'Drop knowledge. Wreck the scoreboard.', icon: BookOpen, accent: '#ff9a3c', difficulty: 'Easy'   },
  { id: 'tac-zone',     key: 'tac_zone',     name: 'Tac Zone',     tagline: 'Three in a row. No mercy.',              icon: Grid3X3,  accent: '#3ecf8e', difficulty: 'Easy'   },
  { id: 'flag-rush',    key: 'flag_rush',    name: 'Flag Rush',    tagline: "Flags don't lie. Can you read them?",   icon: Flag,     accent: '#4f8ef7', difficulty: 'Medium' },
]

const DIFF_COLOR: Record<Difficulty, string> = {
  Easy: 'var(--green)', Medium: 'var(--gold)', Hard: 'var(--pink)',
}

// ─── XP calculation ─────────────────────────────────────────
function calcXP(score: number, durationSec: number, gameId: GameId): number {
  const base: Record<GameId, number> = {
    'neon-blitz': 15, 'grid-ghost': 20, 'flux-sort': 12,
    'trivia-clash': 10, 'tac-zone': 25, 'flag-rush': 8,
  }
  const perPoint = base[gameId]
  const xp = Math.round(score * perPoint)
  // Speed bonus: faster → more XP (up to 50% bonus)
  const speedBonus = durationSec < 30 ? 1.5 : durationSec < 60 ? 1.25 : durationSec < 120 ? 1.1 : 1
  return Math.round(xp * speedBonus)
}

// ─── Time gate helpers ───────────────────────────────────────
function isGameZoneOpen(): boolean {
  const h = new Date().getHours()
  return h >= GAME_OPEN_HOUR && h < GAME_CLOSE_HOUR
}
function nextOpenTime(): string {
  return `${String(GAME_OPEN_HOUR).padStart(2,'0')}:00 AM`
}
function minutesUntilClose(): number {
  const now = new Date()
  const close = new Date()
  close.setHours(GAME_CLOSE_HOUR, 0, 0, 0)
  return Math.max(0, Math.floor((close.getTime() - now.getTime()) / 60000))
}

// ─── Shared helpers ──────────────────────────────────────────
function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface2)', borderRadius: 12, padding: '8px 14px', boxShadow: '2px 2px 6px var(--neu-dark)', minWidth: 60 }}>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

function NeuBtn({ onClick, children, style, disabled }: { onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; style?: React.CSSProperties; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="ripple-wrap"
      style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  )
}

function StartScreen({ game, onStart, children }: { game: GameCard; onStart: () => void; children?: React.ReactNode }) {
  const Icon = game.icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32, gap: 20 }}>
      <div style={{ width: 88, height: 88, borderRadius: 24, background: `linear-gradient(135deg, ${game.accent}33, ${game.accent}11)`, border: `2px solid ${game.accent}44`, boxShadow: `0 0 32px ${game.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={40} style={{ color: game.accent }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{game.name}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>{game.tagline}</p>
      </div>
      {children}
      <button type="button" className="btn-primary ripple-wrap" onClick={onStart} style={{ padding: '14px 40px', borderRadius: 14, fontSize: 15, fontWeight: 800, marginTop: 8 }}>
        Start {game.name}
      </button>
    </div>
  )
}

// ─── End-of-game toast / results screen ─────────────────────
function ResultScreen({ result, onReplay, onBack }: { result: GameEndResult; onReplay: () => void; onBack: () => void }) {
  const mins = Math.floor(result.durationSec / 60)
  const secs = result.durationSec % 60
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  const betterThan = Math.min(99, Math.floor(40 + Math.random() * 50))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 24 }}>
      <div className="neu-card" style={{ padding: '28px 24px', textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {result.score > 500 ? '🏆' : result.score > 200 ? '🎯' : '💪'}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
          {result.score > 500 ? 'Legendary!' : result.score > 200 ? 'Well Played!' : 'Game Over'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>{result.gameName}</p>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Score',      value: String(result.score) },
            { label: 'Time',       value: durationStr },
            { label: 'XP Earned',  value: `+${result.xpEarned}` },
            { label: 'Better than',value: `${betterThan}%` },
            ...Object.entries(result.detail).map(([k, v]) => ({ label: k, value: String(v) })),
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: label === 'XP Earned' ? 'var(--accent)' : label === 'Better than' ? 'var(--green)' : 'var(--text)', fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* XP banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
          <Zap size={16} /> +{result.xpEarned} XP added to your profile
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-primary ripple-wrap" onClick={onReplay} style={{ flex: 1, padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700 }}>Play Again</button>
          <NeuBtn onClick={onBack} style={{ flex: 1, padding: '11px' }}>Game List</NeuBtn>
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
const DIR_ICONS: Record<Dir, LucideIcon> = { up: ArrowUp, down: ArrowDown, left: ArrowLeftIcon, right: ArrowRight }

function NeonBlitz({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [current, setCurrent] = useState<Dir>('up')
  const [score, setScore] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none')
  const [elapsed, setElapsed] = useState(0)
  const durationRef = useRef(1200)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef = useRef(0)

  function nextArrow() {
    setCurrent(ALL_DIRS[Math.floor(Math.random() * 4)])
    setFlash('none')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setMistakes(m => {
        const next = m + 1
        if (next >= 3) { endGame(); return next }
        setFlash('red')
        setTimeout(() => nextArrow(), 400)
        return next
      })
    }, durationRef.current)
  }

  function endGame() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    setPhase('over')
    onEnd(scoreRef.current, elapsed, { Correct: scoreRef.current, Errors: mistakes })
  }

  function start() {
    scoreRef.current = 0
    setScore(0); setMistakes(0); setElapsed(0); durationRef.current = 1200
    setPhase('play')
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    nextArrow()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'play') return
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (map[e.key]) tap(map[e.key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, current])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
  }, [])

  function tap(dir: Dir) {
    if (phase !== 'play') return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dir === current) {
      setFlash('green')
      scoreRef.current += 1
      setScore(s => s + 1)
      durationRef.current = Math.max(300, durationRef.current - 30)
      setTimeout(nextArrow, 200)
    } else {
      setFlash('red')
      setMistakes(m => {
        const next = m + 1
        if (next >= 3) { setTimeout(endGame, 400); return next }
        setTimeout(nextArrow, 400)
        return next
      })
    }
  }

  if (phase === 'start') return <StartScreen game={GAMES[0]} onStart={start} />
  if (phase === 'over') return null

  const CurIcon = DIR_ICONS[current]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '24px 20px', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Score" value={score} />
        <StatChip label="Time" value={`${elapsed}s`} />
        <StatChip label="Lives" value={'❤️'.repeat(3 - mistakes)} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 140, height: 140, borderRadius: 32, background: flash === 'green' ? 'rgba(62,207,142,0.15)' : flash === 'red' ? 'rgba(255,79,79,0.15)' : 'var(--surface)', boxShadow: flash === 'green' ? '0 0 40px rgba(62,207,142,0.4)' : flash === 'red' ? '0 0 40px rgba(255,79,79,0.4)' : '6px 6px 16px var(--neu-dark), -4px -4px 12px var(--neu-light)', border: `2px solid ${flash === 'green' ? 'rgba(62,207,142,0.5)' : flash === 'red' ? 'rgba(255,79,79,0.5)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          <CurIcon size={72} style={{ color: flash === 'green' ? 'var(--green)' : flash === 'red' ? 'var(--red)' : 'var(--blue)' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gridTemplateRows: 'repeat(2, 72px)', gap: 10, marginBottom: 20 }}>
        {[
          { dir: 'up' as Dir, col: 2, row: 1, Icon: ArrowUp },
          { dir: 'left' as Dir, col: 1, row: 2, Icon: ArrowLeftIcon },
          { dir: 'down' as Dir, col: 2, row: 2, Icon: ArrowDown },
          { dir: 'right' as Dir, col: 3, row: 2, Icon: ArrowRight },
        ].map(({ dir, col, row, Icon }) => (
          <div key={dir} style={{ gridColumn: col, gridRow: row }}>
            <button type="button" onClick={(e) => { ripple(e); tap(dir) }} className="ripple-wrap" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--surface)', boxShadow: '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon size={22} style={{ color: 'var(--text-dim)' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 2: GRID GHOST
// Sequential flash (one cell at a time), 5 levels × 3 rounds
// ═══════════════════════════════════════════════════════════
function GridGhost({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const [phase, setPhase] = useState<'start' | 'countdown' | 'flash' | 'recall' | 'result' | 'over'>('start')
  const [level, setLevel] = useState(1)
  const [round, setRound] = useState(1) // 3 rounds per level
  const [score, setScore] = useState(0)
  const [sequence, setSequence] = useState<number[]>([])    // full flash sequence (may repeat)
  const [pattern, setPattern] = useState<number[]>([])       // unique cells to recall
  const [tapped, setTapped] = useState<number[]>([])
  const [flashIdx, setFlashIdx] = useState(-1)              // which index in sequence is currently lit
  const [cellFlash, setCellFlash] = useState<Record<number, 'flash' | 'correct' | 'wrong'>>({})
  const [countdown, setCountdown] = useState(3)
  const [roundMsg, setRoundMsg] = useState('')
  const startRef = useRef(Date.now())
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build a sequence: each unique cell appears 1-3 times, order randomised
  function buildSequence(lvl: number): { seq: number[]; unique: number[] } {
    const cellCount = Math.min(2 + lvl, 7)
    const all = Array.from({ length: 9 }, (_, i) => i)
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    const unique = shuffled.slice(0, cellCount)
    // Each cell repeated 1-2 times then shuffled
    const expanded: number[] = []
    unique.forEach(c => {
      const reps = Math.floor(Math.random() * 2) + 1
      for (let i = 0; i < reps; i++) expanded.push(c)
    })
    return { seq: expanded.sort(() => Math.random() - 0.5), unique }
  }

  function startFlashSequence(seq: number[]) {
    setPhase('flash')
    let i = 0
    const flashNext = () => {
      if (i >= seq.length) {
        setCellFlash({})
        setFlashIdx(-1)
        setPhase('recall')
        return
      }
      const cell = seq[i]
      setFlashIdx(cell)
      setCellFlash({ [cell]: 'flash' })
      flashTimerRef.current = setTimeout(() => {
        setCellFlash({})
        flashTimerRef.current = setTimeout(() => {
          i++
          flashNext()
        }, 200)
      }, 600)
    }
    flashNext()
  }

  function startRound(lvl: number, rnd: number) {
    const { seq, unique } = buildSequence(lvl)
    setSequence(seq); setPattern(unique)
    setTapped([]); setCellFlash({}); setFlashIdx(-1)
    setLevel(lvl); setRound(rnd)
    setCountdown(3); setPhase('countdown')
    let c = 3
    const iv = setInterval(() => {
      c--; setCountdown(c)
      if (c === 0) { clearInterval(iv); startFlashSequence(seq) }
    }, 1000)
  }

  function start() {
    startRef.current = Date.now()
    setScore(0); startRound(1, 1)
  }

  function tapCell(idx: number) {
    if (phase !== 'recall') return
    if (tapped.includes(idx)) return

    if (pattern.includes(idx)) {
      const next = [...tapped, idx]
      setCellFlash(f => ({ ...f, [idx]: 'correct' }))
      setTapped(next)
      if (next.length === pattern.length) {
        // Round complete
        const pts = level * 10 + round * 5
        setScore(s => s + pts)
        setRoundMsg(`Round ${round} Clear! +${pts} pts`)
        setPhase('result')
        setTimeout(() => {
          setRoundMsg('')
          if (round < 3) {
            startRound(level, round + 1)
          } else if (level < 5) {
            startRound(level + 1, 1)
          } else {
            // All 5 levels done
            const dur = Math.floor((Date.now() - startRef.current) / 1000)
            setPhase('over')
            onEnd(score + pts, dur, { 'Level Reached': 5, 'Rounds Cleared': 15 })
          }
        }, 900)
      }
    } else {
      setCellFlash(f => ({ ...f, [idx]: 'wrong' }))
      setTimeout(() => {
        const dur = Math.floor((Date.now() - startRef.current) / 1000)
        setPhase('over')
        onEnd(score, dur, { 'Level Reached': level, 'Round': round })
      }, 600)
    }
  }

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }, [])

  if (phase === 'start') return <StartScreen game={GAMES[1]} onStart={start} />
  if (phase === 'over') return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '20px', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Level" value={level} />
        <StatChip label="Round" value={`${round}/3`} />
        <StatChip label="Score" value={score} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, minHeight: 22, color: 'var(--text-dim)', textAlign: 'center' }}>
        {phase === 'countdown' ? '' : phase === 'flash' ? 'Watch the sequence!' : phase === 'recall' ? '👆 Tap the cells you saw' : roundMsg}
      </div>

      {phase === 'countdown' && (
        <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{countdown}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 300, margin: '0 auto' }}>
        {Array.from({ length: 9 }, (_, i) => {
          const fl = cellFlash[i]
          return (
            <button key={i} type="button" onClick={() => tapCell(i)} aria-label={`Cell ${i + 1}`}
              style={{
                aspectRatio: '1', borderRadius: 16,
                cursor: phase === 'recall' ? 'pointer' : 'default',
                background: fl === 'flash' ? 'rgba(155,109,255,0.5)' : fl === 'correct' ? 'rgba(62,207,142,0.3)' : fl === 'wrong' ? 'rgba(255,79,79,0.3)' : 'var(--surface)',
                boxShadow: fl === 'flash' ? '0 0 24px rgba(155,109,255,0.6)' : fl === 'correct' ? '0 0 16px rgba(62,207,142,0.4)' : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.18s', opacity: phase === 'countdown' ? 0.3 : 1,
              }} />
          )
        })}
      </div>

      {roundMsg && (
        <div style={{ position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid rgba(62,207,142,0.4)', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: 'var(--green)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50 }}>
          {roundMsg}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 3: FLUX SORT — buttons swap sides randomly
// ═══════════════════════════════════════════════════════════
interface FluxRound { cats: [string, string]; items: [string, 0 | 1][] }

const FLUX_ROUNDS: FluxRound[] = [
  { cats: ['Living', 'Non-Living'],      items: [['Bird',0],['Rock',1],['Tree',0],['Chair',1],['Dog',0],['Lamp',1],['Fish',0],['Book',1],['Cat',0],['Stone',1]] },
  { cats: ['Water Vehicle', 'Land'],     items: [['Kayak',0],['Motorcycle',1],['Submarine',0],['Bus',1],['Yacht',0],['Truck',1],['Canoe',0],['Car',1],['Ferry',0],['Train',1]] },
  { cats: ['Hot', 'Cold'],               items: [['Fire',0],['Ice',1],['Sun',0],['Snow',1],['Pepper',0],['Glacier',1],['Lava',0],['Mint',1],['Volcano',0],['Blizzard',1]] },
  { cats: ['Fruit', 'Vegetable'],        items: [['Apple',0],['Carrot',1],['Mango',0],['Broccoli',1],['Strawberry',0],['Spinach',1],['Grape',0],['Potato',1],['Peach',0],['Onion',1]] },
  { cats: ['Ancient', 'Modern'],         items: [['Pyramid',0],['Smartphone',1],['Scroll',0],['Laptop',1],['Chariot',0],['Drone',1],['Sundial',0],['Robot',1],['Catapult',0],['Satellite',1]] },
  { cats: ['Sky', 'Ground'],             items: [['Eagle',0],['Mole',1],['Cloud',0],['Worm',1],['Falcon',0],['Badger',1],['Kite',0],['Ant',1],['Balloon',0],['Crab',1]] },
  { cats: ['Fast', 'Slow'],              items: [['Cheetah',0],['Tortoise',1],['Jet',0],['Snail',1],['Lightning',0],['Glacier',1],['Bullet',0],['Sloth',1],['Rocket',0],['Slug',1]] },
  { cats: ['Digital', 'Physical'],       items: [['Email',0],['Letter',1],['NFT',0],['Painting',1],['Podcast',0],['Book',1],['Stream',0],['Cinema',1],['App',0],['Store',1]] },
]

function FluxSort({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [roundIdx, setRoundIdx] = useState(0)
  const [itemIdx, setItemIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  // Randomly swap button sides each item
  const [swapped, setSwapped] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  const round = FLUX_ROUNDS[roundIdx % FLUX_ROUNDS.length]
  const [word, correctSide] = round.items[itemIdx] ?? ['', 0 as 0 | 1]

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(15)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { nextItem(false); return 15 }
        return t - 1
      })
    }, 1000)
  }

  function start() {
    startRef.current = Date.now()
    setScore(0); setRoundIdx(0); setItemIdx(0); setCorrect(0); setWrong(0)
    setSwapped(Math.random() < 0.5)
    setPhase('play'); startTimer()
  }

  function nextItem(wasCorrect: boolean) {
    if (timerRef.current) clearInterval(timerRef.current)
    setFeedback(wasCorrect ? 'correct' : 'wrong')
    setTimeout(() => {
      setFeedback(null)
      const nextItem = itemIdx + 1
      if (nextItem >= round.items.length) {
        const nextRound = roundIdx + 1
        if (nextRound >= FLUX_ROUNDS.length) {
          const dur = Math.floor((Date.now() - startRef.current) / 1000)
          setPhase('over')
          onEnd(score, dur, { Correct: correct, Wrong: wrong, Rounds: FLUX_ROUNDS.length })
          return
        }
        setRoundIdx(nextRound); setItemIdx(0)
      } else {
        setItemIdx(nextItem)
      }
      setSwapped(Math.random() < 0.5)
      startTimer()
    }, 350)
  }

  function pick(pickedSide: 0 | 1) {
    if (feedback) return
    if (timerRef.current) clearInterval(timerRef.current)
    const isCorrect = pickedSide === correctSide
    if (isCorrect) {
      const bonus = Math.floor((timeLeft / 15) * 20)
      setScore(s => s + 10 + bonus)
      setCorrect(c => c + 1)
    } else {
      setWrong(w => w + 1)
    }
    nextItem(isCorrect)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Actual displayed sides (swapped or not)
  const leftCat  = swapped ? round.cats[1] : round.cats[0]
  const rightCat = swapped ? round.cats[0] : round.cats[1]
  const leftSide = swapped ? 1 : 0
  const rightSide = swapped ? 0 : 1

  if (phase === 'start') return <StartScreen game={GAMES[2]} onStart={start} />
  if (phase === 'over') return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Time" value={`${timeLeft}s`} />
        <StatChip label="Points" value={score} />
        <StatChip label="✓" value={correct} />
        <StatChip label="✗" value={wrong} />
      </div>
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 1px 1px 4px var(--neu-dark)' }}>
        <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 2, width: `${(timeLeft / 15) * 100}%`, transition: 'width 1s linear' }} />
      </div>
      <div className="neu-card" style={{ padding: '28px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {feedback && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: feedback === 'correct' ? 'rgba(62,207,142,0.08)' : 'rgba(255,79,79,0.08)', zIndex: 2 }}>
            {feedback === 'correct' ? <Check size={48} style={{ color: 'var(--green)' }} /> : <X size={48} style={{ color: 'var(--red)' }} />}
          </div>
        )}
        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
          Round {roundIdx + 1}/{FLUX_ROUNDS.length} · {itemIdx + 1}/{round.items.length}
        </p>
        <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>{word}</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(leftSide as 0 | 1) }}
          style={{ flex: 1, padding: '20px 8px', borderRadius: 16, fontSize: 15, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #3b5bdb, #4f8ef7)', border: 'none', cursor: 'pointer' }}>
          {leftCat}
        </button>
        <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(rightSide as 0 | 1) }}
          style={{ flex: 1, padding: '20px 8px', borderRadius: 16, fontSize: 15, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #9b6dff)', border: 'none', cursor: 'pointer' }}>
          {rightCat}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 4: TRIVIA CLASH — 20 Qs, 90s total, <5s per Q auto-advance
// ═══════════════════════════════════════════════════════════
const TRIVIA_POOL = [
  { q: 'What planet is known as the Red Planet?', a: ['Mars','Venus','Saturn','Jupiter'], correct: 0, cat: 'Science' },
  { q: 'How many sides does a hexagon have?', a: ['5','6','7','8'], correct: 1, cat: 'Math' },
  { q: 'Which country has the largest population?', a: ['India','USA','China','Brazil'], correct: 2, cat: 'Geography' },
  { q: 'What is the capital of Japan?', a: ['Seoul','Beijing','Tokyo','Bangkok'], correct: 2, cat: 'Geography' },
  { q: 'Who painted the Mona Lisa?', a: ['Picasso','Da Vinci','Monet','Rembrandt'], correct: 1, cat: 'Art' },
  { q: 'What gas do plants absorb?', a: ['Oxygen','Nitrogen','CO₂','Hydrogen'], correct: 2, cat: 'Science' },
  { q: 'How many continents are there?', a: ['5','6','7','8'], correct: 2, cat: 'Geography' },
  { q: 'What is H₂O?', a: ['Air','Water','Fire','Earth'], correct: 1, cat: 'Science' },
  { q: 'What sport uses a shuttlecock?', a: ['Tennis','Badminton','Squash','Ping Pong'], correct: 1, cat: 'Sports' },
  { q: 'Which metal is liquid at room temperature?', a: ['Iron','Gold','Mercury','Silver'], correct: 2, cat: 'Science' },
  { q: 'In what year did WW2 end?', a: ['1943','1944','1945','1946'], correct: 2, cat: 'History' },
  { q: 'How many bones in the human body?', a: ['196','206','216','226'], correct: 1, cat: 'Biology' },
  { q: 'What is the fastest land animal?', a: ['Lion','Horse','Cheetah','Leopard'], correct: 2, cat: 'Animals' },
  { q: 'Who wrote Romeo and Juliet?', a: ['Dickens','Shakespeare','Austen','Hemingway'], correct: 1, cat: 'Literature' },
  { q: 'What colour do you get mixing red + blue?', a: ['Green','Orange','Purple','Brown'], correct: 2, cat: 'Art' },
  { q: 'What is the largest ocean?', a: ['Atlantic','Indian','Arctic','Pacific'], correct: 3, cat: 'Geography' },
  { q: 'How many days in a leap year?', a: ['364','365','366','367'], correct: 2, cat: 'Math' },
  { q: 'Which language has the most native speakers?', a: ['English','Spanish','Mandarin','Hindi'], correct: 2, cat: 'Language' },
  { q: 'What organ pumps blood?', a: ['Lungs','Liver','Brain','Heart'], correct: 3, cat: 'Biology' },
  { q: 'Which is the smallest continent?', a: ['Antarctica','Europe','Australia','S.America'], correct: 2, cat: 'Geography' },
  { q: 'What is the chemical symbol for gold?', a: ['Gd','Go','Au','Ag'], correct: 2, cat: 'Science' },
  { q: 'How many players in a basketball team on court?', a: ['4','5','6','7'], correct: 1, cat: 'Sports' },
  { q: 'What is the speed of light (km/s)?', a: ['100k','300k','500k','1M'], correct: 1, cat: 'Science' },
  { q: 'Who invented the telephone?', a: ['Edison','Tesla','Bell','Morse'], correct: 2, cat: 'History' },
  { q: 'What is the hardest natural substance?', a: ['Iron','Granite','Quartz','Diamond'], correct: 3, cat: 'Science' },
]

function TriviaClash({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const TOTAL_Q = 20
  const TOTAL_TIME = 90
  const Q_TIME = 5

  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [questions, setQuestions] = useState<typeof TRIVIA_POOL>([])
  const [qIdx, setQIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [qTimeLeft, setQTimeLeft] = useState(Q_TIME)
  const [totalLeft, setTotalLeft] = useState(TOTAL_TIME)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const qTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const qIdxRef = useRef(0)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)

  function endGame() {
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    if (totalTimerRef.current) clearInterval(totalTimerRef.current)
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    setPhase('over')
    onEnd(scoreRef.current, dur, { Correct: correctRef.current, Total: TOTAL_Q, Accuracy: `${Math.round((correctRef.current / TOTAL_Q) * 100)}%` })
  }

  function startQTimer() {
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    setQTimeLeft(Q_TIME)
    qTimerRef.current = setInterval(() => {
      setQTimeLeft(t => {
        if (t <= 1) { advance(); return Q_TIME }
        return t - 1
      })
    }, 1000)
  }

  function advance() {
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    setTimeout(() => {
      setSelected(null)
      qIdxRef.current += 1
      if (qIdxRef.current >= TOTAL_Q) { endGame(); return }
      setQIdx(qIdxRef.current)
      startQTimer()
    }, 600)
  }

  function start() {
    const shuffled = [...TRIVIA_POOL].sort(() => Math.random() - 0.5).slice(0, TOTAL_Q)
    setQuestions(shuffled); setQIdx(0); setScore(0); setCorrect(0); setSelected(null)
    qIdxRef.current = 0; scoreRef.current = 0; correctRef.current = 0
    startRef.current = Date.now()
    setTotalLeft(TOTAL_TIME); setPhase('play'); startQTimer()
    totalTimerRef.current = setInterval(() => {
      setTotalLeft(t => { if (t <= 1) { endGame(); return 0 } return t - 1 })
    }, 1000)
  }

  function pick(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    const q = questions[qIdxRef.current]
    if (idx === q.correct) {
      const bonus = qTimeLeft >= 4 ? 30 : qTimeLeft >= 2 ? 15 : 0
      const pts = 50 + bonus
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current); setCorrect(correctRef.current)
    }
    advance()
  }

  useEffect(() => () => {
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    if (totalTimerRef.current) clearInterval(totalTimerRef.current)
  }, [])

  if (phase === 'start') return <StartScreen game={GAMES[3]} onStart={start} />
  if (phase === 'over') return null

  const q = questions[qIdx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px 16px', gap: 12 }}>
      {/* Timers */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Q Time" value={`${qTimeLeft}s`} />
        <StatChip label="Total" value={`${totalLeft}s`} />
        <StatChip label="Score" value={score} />
        <StatChip label={`${qIdx + 1}/${TOTAL_Q}`} value={`${correct}✓`} />
      </div>

      {/* Total time bar */}
      <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: totalLeft < 30 ? 'var(--red)' : 'var(--green)', width: `${(totalLeft / TOTAL_TIME) * 100}%`, transition: 'width 1s linear' }} />
      </div>

      {/* Question card */}
      <div className="neu-card" style={{ padding: '18px 16px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--gold)', marginBottom: 8 }}>{q?.cat}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>{q?.q}</p>
        {/* Per-question timer ring */}
        <svg width="44" height="44" style={{ display: 'block', margin: '10px auto 0' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface2)" strokeWidth="3" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={qTimeLeft <= 2 ? 'var(--red)' : 'var(--gold)'}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 18}`}
            strokeDashoffset={`${2 * Math.PI * 18 * (1 - qTimeLeft / Q_TIME)}`}
            transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
          <text x="22" y="27" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="700">{qTimeLeft}</text>
        </svg>
      </div>

      {/* Answers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {q?.a.map((ans, i) => {
          const isCorrect = i === q.correct
          const isSelected = selected === i
          let bg = 'var(--surface)'; let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCorrect) { bg = 'rgba(62,207,142,0.12)'; border = 'rgba(62,207,142,0.5)' }
            else if (isSelected) { bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.5)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(i) }}
              style={{ padding: '14px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: bg, border: `1px solid ${border}`, boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)', color: 'var(--text)', textAlign: 'center', transition: 'all 0.2s' }}>
              {ans}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 5: TAC ZONE — proper minimax tic-tac-toe
// ═══════════════════════════════════════════════════════════
type TacCell = 'X' | 'O' | null
type TacDiff = 'Easy' | 'Medium' | 'Hard'
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const

function checkWin(b: TacCell[]): { winner: TacCell; line: number[] | null } {
  for (const [a, bI, c] of WINS) {
    if (b[a] && b[a] === b[bI] && b[a] === b[c]) return { winner: b[a], line: [a, bI, c] }
  }
  return { winner: null, line: null }
}

function minimax(board: TacCell[], isMax: boolean, depth: number): number {
  const { winner } = checkWin(board)
  if (winner === 'O') return 10 - depth
  if (winner === 'X') return depth - 10
  if (board.every(c => c !== null)) return 0
  let best = isMax ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = isMax ? 'O' : 'X'
      const val = minimax(board, !isMax, depth + 1)
      board[i] = null
      best = isMax ? Math.max(best, val) : Math.min(best, val)
    }
  }
  return best
}

function getBestMove(board: TacCell[], diff: TacDiff): number {
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0)
  if (empty.length === 0) return -1
  if (diff === 'Easy') return empty[Math.floor(Math.random() * empty.length)]
  if (diff === 'Medium' && Math.random() < 0.4) return empty[Math.floor(Math.random() * empty.length)]
  // Hard + partial Medium: true minimax
  let best = -Infinity; let move = empty[0]
  for (const i of empty) {
    const b = [...board] as TacCell[]; b[i] = 'O'
    const val = minimax(b, false, 0)
    if (val > best) { best = val; move = i }
  }
  return move
}

function TacZone({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [diff, setDiff] = useState<TacDiff>('Medium')
  const [board, setBoard] = useState<TacCell[]>(Array(9).fill(null))
  const [aiTurn, setAiTurn] = useState(false)
  const [result, setResult] = useState<{ winner: TacCell; line: number[] | null } | null>(null)
  const [scores, setScores] = useState({ W: 0, D: 0, L: 0 })
  const startRef = useRef(Date.now())

  function newGame() {
    setBoard(Array(9).fill(null)); setResult(null); setAiTurn(false)
  }

  function start() {
    startRef.current = Date.now()
    setScores({ W: 0, D: 0, L: 0 }); newGame(); setPhase('play')
  }

  function resolveBoard(b: TacCell[]) {
    const res = checkWin(b)
    const isDraw = b.every(c => c !== null) && !res.winner
    if (res.winner || isDraw) {
      setResult(isDraw ? { winner: null, line: null } : res)
      if (res.winner === 'X') setScores(s => ({ ...s, W: s.W + 1 }))
      else if (res.winner === 'O') setScores(s => ({ ...s, L: s.L + 1 }))
      else setScores(s => ({ ...s, D: s.D + 1 }))
      return true
    }
    return false
  }

  function tapCell(idx: number) {
    if (phase !== 'play' || board[idx] || aiTurn || result) return
    const nb = [...board] as TacCell[]; nb[idx] = 'X'
    setBoard(nb)
    if (resolveBoard(nb)) return
    setAiTurn(true)
    setTimeout(() => {
      const move = getBestMove(nb, diff)
      if (move === -1) return
      const nb2 = [...nb] as TacCell[]; nb2[move] = 'O'
      setBoard(nb2)
      resolveBoard(nb2)
      setAiTurn(false)
    }, 500)
  }

  function finishSession() {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const total = scores.W + scores.D + scores.L
    const totalScore = scores.W * 100 + scores.D * 30
    onEnd(totalScore, dur, { Wins: scores.W, Draws: scores.D, Losses: scores.L, Games: total })
  }

  if (phase === 'start') return (
    <StartScreen game={GAMES[4]} onStart={start}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['Easy','Medium','Hard'] as TacDiff[]).map(d => (
          <button key={d} type="button" onClick={() => setDiff(d)}
            style={{ padding: '7px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: diff === d ? 'rgba(255,255,255,0.10)' : 'transparent', color: diff === d ? '#fff' : 'var(--text-dim)', border: diff === d ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.06)' }}>
            {d}
          </button>
        ))}
      </div>
    </StartScreen>
  )

  if (phase === 'over') return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '16px', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatChip label="Wins" value={scores.W} />
        <StatChip label="Draws" value={scores.D} />
        <StatChip label="Losses" value={scores.L} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, minHeight: 22, color: result ? 'var(--gold)' : aiTurn ? 'var(--text-muted)' : 'var(--blue)' }}>
        {result ? (result.winner === 'X' ? '🎉 You win!' : result.winner === 'O' ? '🤖 AI wins!' : "It's a draw!") : aiTurn ? 'AI thinking…' : 'Your move (X)'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 90px)', gridTemplateRows: 'repeat(3, 90px)', gap: 10 }}>
        {board.map((cell, i) => {
          const inLine = result?.line?.includes(i)
          return (
            <button key={i} type="button" onClick={() => tapCell(i)} aria-label={`Cell ${i + 1}`}
              style={{ width: 90, height: 90, borderRadius: 18, cursor: cell || result ? 'default' : 'pointer', background: inLine ? (result?.winner === 'X' ? 'rgba(79,142,247,0.18)' : 'rgba(255,77,139,0.18)') : 'var(--surface)', boxShadow: inLine ? `0 0 24px ${result?.winner === 'X' ? 'rgba(79,142,247,0.5)' : 'rgba(255,77,139,0.5)'}` : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {cell === 'X' && <X size={38} style={{ color: 'var(--blue)' }} />}
              {cell === 'O' && <Circle size={36} style={{ color: 'var(--pink)' }} />}
            </button>
          )
        })}
      </div>
      {result && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-primary ripple-wrap" onClick={newGame} style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Rematch</button>
          <NeuBtn onClick={finishSession} style={{ padding: '10px 20px' }}>End Session</NeuBtn>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// GAME 6: FLAG RUSH — 5s per flag
// ═══════════════════════════════════════════════════════════
const FLAGS = [
  { flag:'🇳🇬',country:'Nigeria',       opts:['Nigeria','Ghana','Cameroon','Senegal'],          c:0 },
  { flag:'🇫🇷',country:'France',        opts:['France','Belgium','Italy','Spain'],              c:0 },
  { flag:'🇧🇷',country:'Brazil',        opts:['Brazil','Argentina','Colombia','Peru'],          c:0 },
  { flag:'🇯🇵',country:'Japan',         opts:['China','Japan','South Korea','Vietnam'],         c:1 },
  { flag:'🇩🇪',country:'Germany',       opts:['Austria','Germany','Switzerland','Netherlands'], c:1 },
  { flag:'🇮🇹',country:'Italy',         opts:['Spain','Portugal','Italy','Greece'],             c:2 },
  { flag:'🇪🇸',country:'Spain',         opts:['Mexico','Spain','Argentina','Portugal'],         c:1 },
  { flag:'🇺🇸',country:'USA',           opts:['Canada','Australia','USA','UK'],                 c:2 },
  { flag:'🇬🇧',country:'UK',            opts:['Ireland','UK','Australia','Canada'],             c:1 },
  { flag:'🇨🇦',country:'Canada',        opts:['USA','Australia','Canada','New Zealand'],        c:2 },
  { flag:'🇦🇺',country:'Australia',     opts:['New Zealand','UK','Australia','Canada'],         c:2 },
  { flag:'🇮🇳',country:'India',         opts:['Pakistan','Bangladesh','India','Sri Lanka'],     c:2 },
  { flag:'🇨🇳',country:'China',         opts:['Japan','China','South Korea','Vietnam'],         c:1 },
  { flag:'🇲🇽',country:'Mexico',        opts:['Colombia','Mexico','Brazil','Peru'],             c:1 },
  { flag:'🇿🇦',country:'South Africa',  opts:['Kenya','Nigeria','South Africa','Zimbabwe'],     c:2 },
  { flag:'🇰🇪',country:'Kenya',         opts:['Kenya','Ethiopia','Tanzania','Uganda'],          c:0 },
  { flag:'🇦🇷',country:'Argentina',     opts:['Brazil','Chile','Argentina','Uruguay'],          c:2 },
  { flag:'🇵🇹',country:'Portugal',      opts:['Spain','Italy','Portugal','France'],             c:2 },
  { flag:'🇳🇱',country:'Netherlands',   opts:['Belgium','Germany','Netherlands','Denmark'],     c:2 },
  { flag:'🇸🇪',country:'Sweden',        opts:['Norway','Finland','Sweden','Denmark'],           c:2 },
  { flag:'🇹🇷',country:'Turkey',        opts:['Turkey','Iran','Egypt','Saudi Arabia'],          c:0 },
  { flag:'🇪🇬',country:'Egypt',         opts:['Morocco','Algeria','Egypt','Libya'],             c:2 },
  { flag:'🇸🇦',country:'Saudi Arabia',  opts:['UAE','Iran','Saudi Arabia','Iraq'],              c:2 },
  { flag:'🇰🇷',country:'South Korea',   opts:['Japan','China','South Korea','Vietnam'],         c:2 },
  { flag:'🇮🇩',country:'Indonesia',     opts:['Malaysia','Indonesia','Philippines','Thailand'], c:1 },
  { flag:'🇵🇰',country:'Pakistan',      opts:['India','Bangladesh','Pakistan','Afghanistan'],   c:2 },
  { flag:'🇧🇩',country:'Bangladesh',    opts:['India','Pakistan','Bangladesh','Nepal'],         c:2 },
  { flag:'🇻🇳',country:'Vietnam',       opts:['Thailand','Vietnam','Cambodia','Laos'],          c:1 },
  { flag:'🇹🇭',country:'Thailand',      opts:['Vietnam','Cambodia','Thailand','Myanmar'],       c:2 },
  { flag:'🇵🇱',country:'Poland',        opts:['Czech Republic','Hungary','Poland','Slovakia'],  c:2 },
]

function FlagRush({ onEnd }: { onEnd: (score: number, dur: number, detail: Record<string, string | number>) => void }) {
  const FLAG_TIME = 5
  const [phase, setPhase] = useState<'start' | 'play' | 'over'>('start')
  const [pool, setPool] = useState<typeof FLAGS>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(FLAG_TIME)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const idxRef = useRef(0)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)

  function advance() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeout(() => {
      setSelected(null)
      idxRef.current += 1
      if (idxRef.current >= 15) {
        const dur = Math.floor((Date.now() - startRef.current) / 1000)
        setPhase('over')
        onEnd(scoreRef.current, dur, { Correct: correctRef.current, Total: 15, Accuracy: `${Math.round((correctRef.current / 15) * 100)}%` })
        return
      }
      setIdx(idxRef.current)
      startTimer()
    }, 500)
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(FLAG_TIME)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { advance(); return FLAG_TIME } return t - 1 })
    }, 1000)
  }

  function start() {
    const shuffled = [...FLAGS].sort(() => Math.random() - 0.5).slice(0, 15)
    setPool(shuffled); idxRef.current = 0; scoreRef.current = 0; correctRef.current = 0
    setIdx(0); setScore(0); setCorrect(0); setSelected(null)
    startRef.current = Date.now()
    setPhase('play'); startTimer()
  }

  function pick(i: number) {
    if (selected !== null) return
    setSelected(i)
    if (timerRef.current) clearInterval(timerRef.current)
    if (i === pool[idxRef.current].c) {
      // Faster = more points. 5s=80, 4s=90, 3s=100, 2s=110, 1s=120
      const pts = 70 + (timeLeft * 10)
      scoreRef.current += pts; correctRef.current += 1
      setScore(scoreRef.current); setCorrect(correctRef.current)
    }
    advance()
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  if (phase === 'start') return <StartScreen game={GAMES[5]} onStart={start} />
  if (phase === 'over') return null

  const cur = pool[idx]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <StatChip label="Time" value={`${timeLeft}s`} />
        <StatChip label="Score" value={score} />
        <StatChip label={`${idx + 1}/15`} value={`${correct}✓`} />
      </div>
      <div className="neu-card" style={{ padding: '20px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 10 }}>{cur?.flag}</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>Which country is this?</p>
        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
          <div style={{ height: '100%', background: timeLeft <= 2 ? 'var(--red)' : 'var(--blue)', width: `${(timeLeft / FLAG_TIME) * 100}%`, transition: 'width 1s linear' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cur?.opts.map((opt, i) => {
          const isCor = i === cur.c; const isSel = selected === i
          let bg = 'var(--surface)'; let border = 'rgba(255,255,255,0.07)'
          if (selected !== null) {
            if (isCor) { bg = 'rgba(62,207,142,0.12)'; border = 'rgba(62,207,142,0.5)' }
            else if (isSel) { bg = 'rgba(255,79,79,0.12)'; border = 'rgba(255,79,79,0.5)' }
          }
          return (
            <button key={i} type="button" className="ripple-wrap" onClick={(e) => { ripple(e); pick(i) }}
              style={{ padding: '15px 10px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: bg, border: `1px solid ${border}`, boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)', color: 'var(--text)', textAlign: 'center', transition: 'all 0.2s' }}>
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
function GameView({
  gameId, onBack, onResult,
}: {
  gameId: GameId
  onBack: () => void
  onResult: (result: GameEndResult) => void
}) {
  const [quitModal, setQuitModal] = useState(false)
  const [result, setResult] = useState<GameEndResult | null>(null)
  const { session } = useAuth()
  const game = GAMES.find(g => g.id === gameId)!
  const startRef = useRef(Date.now())

  async function handleEnd(score: number, dur: number, detail: Record<string, string | number>) {
    const xpEarned = calcXP(score, dur, gameId)
    const r: GameEndResult = { gameId, gameName: game.name, score, xpEarned, durationSec: dur, detail }
    setResult(r)
    onResult(r)
    // Write to Supabase if logged in
    if (session?.user) {
      await saveGameSession(session.user.id, {
        game: game.key, score, xpEarned, durationSec: dur,
        metadata: detail as Record<string, unknown>,
      })
    }
  }

  function handleReplay() { setResult(null); startRef.current = Date.now() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', filter: 'blur(100px)', opacity: 0.07, background: game.accent, top: '5%', left: '-10%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(100px)', opacity: 0.05, background: game.accent, bottom: '10%', right: '-5%', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 52, flexShrink: 0, position: 'relative', zIndex: 10, background: 'rgba(17,17,19,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button type="button" onClick={() => result ? onBack() : setQuitModal(true)} style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', background: 'var(--surface2)', padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>{game.name}</span>
        <div style={{ width: 34 }} />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {result ? (
          <ResultScreen result={result} onReplay={handleReplay} onBack={onBack} />
        ) : (
          <>
            {gameId === 'neon-blitz'   && <NeonBlitz   onEnd={handleEnd} />}
            {gameId === 'grid-ghost'   && <GridGhost   onEnd={handleEnd} />}
            {gameId === 'flux-sort'    && <FluxSort    onEnd={handleEnd} />}
            {gameId === 'trivia-clash' && <TriviaClash onEnd={handleEnd} />}
            {gameId === 'tac-zone'     && <TacZone     onEnd={handleEnd} />}
            {gameId === 'flag-rush'    && <FlagRush    onEnd={handleEnd} />}
          </>
        )}
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
function Lobby({
  onPlay, results, bestScores, playsToday, open, minutesLeft,
}: {
  onPlay: (id: GameId) => void
  results: GameEndResult[]
  bestScores: Partial<Record<GameId, number>>
  playsToday: Partial<Record<GameId, number>>
  open: boolean
  minutesLeft: number
}) {
  const hoursLeft = Math.floor(minutesLeft / 60)
  const minsLeft = minutesLeft % 60

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      {/* Time gate banner */}
      {!open && (
        <div style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>Game Zone is closed</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Opens at {nextOpenTime()} daily. 5 hours of gameplay available per day.</p>
          </div>
        </div>
      )}
      {open && minutesLeft < 60 && (
        <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Game Zone closes in {minutesLeft}m!</p>
        </div>
      )}

      {/* Hero */}
      <section className="su d1">
        <div className="neu-card" style={{ padding: '22px 20px', marginBottom: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Game Zone</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>Open {GAME_OPEN_HOUR}:00–{GAME_CLOSE_HOUR}:00 daily · 5 hours total · 7 plays per game</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip"><Clock size={11} /> {open ? `${hoursLeft}h ${minsLeft}m left today` : 'Closed'}</span>
            <span className="chip">🎮 <strong>{results.length}</strong> sessions today</span>
            {results.length > 0 && <span className="chip">🏆 <strong>{Math.max(...results.map(r => r.score))}</strong> top score</span>}
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
            const plays = playsToday[game.id] ?? 0
            const maxed = plays >= MAX_PLAYS_PER_GAME
            const locked = !open || maxed
            return (
              <button key={game.id} type="button" className="neu-card ripple-wrap"
                onClick={(e) => { if (!locked) { ripple(e); onPlay(game.id) } }}
                style={{ padding: 18, cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', border: 'none', opacity: locked ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
                {maxed && (
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: 8, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>MAX PLAYS</div>
                )}
                <div style={{ width: 44, height: 44, borderRadius: 13, marginBottom: 12, background: `${game.accent}18`, boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 6px var(--neu-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: game.accent }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{game.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{game.tagline}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: DIFF_COLOR[game.difficulty], background: `${DIFF_COLOR[game.difficulty]}18`, padding: '3px 7px', borderRadius: 20 }}>{game.difficulty}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{plays}/{MAX_PLAYS_PER_GAME} plays</span>
                </div>
                {best !== undefined && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Best: {best}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, fontWeight: 700, color: locked ? 'var(--text-muted)' : 'var(--blue)' }}>
                  {locked ? <Lock size={11} /> : null} {locked ? (maxed ? 'Limit reached' : 'Zone closed') : 'Play'} {!locked && <ChevronRight size={12} />}
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
            {[...results].reverse().slice(0, 5).map((r, i) => {
              const g = GAMES.find(g => g.id === r.gameId)!
              const Icon = g.icon
              return (
                <div key={i} className="neu-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color: g.accent }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.gameName}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{r.xpEarned} XP · {r.durationSec}s</p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>{r.score}</span>
                </div>
              )
            })}
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
  const { session } = useAuth()
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [results, setResults] = useState<GameEndResult[]>([])
  const [bestScores, setBestScores] = useState<Partial<Record<GameId, number>>>({})
  const [playsToday, setPlaysToday] = useState<Partial<Record<GameId, number>>>({})
  const [open, setOpen] = useState(isGameZoneOpen())
  const [minutesLeft, setMinutesLeft] = useState(minutesUntilClose())

  // Refresh open status every minute
  useEffect(() => {
    const iv = setInterval(() => {
      setOpen(isGameZoneOpen())
      setMinutesLeft(minutesUntilClose())
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  // Load today's play counts from Supabase
  useEffect(() => {
    if (!session?.user) return
    const userId = session.user.id
    Promise.all(GAMES.map(g => getPlaysToday(userId, g.key))).then(counts => {
      const map: Partial<Record<GameId, number>> = {}
      GAMES.forEach((g, i) => { map[g.id] = counts[i] })
      setPlaysToday(map)
    })
  }, [session])

  function handleResult(result: GameEndResult) {
    setResults(r => [...r, result])
    setBestScores(b => ({ ...b, [result.gameId]: Math.max(b[result.gameId] ?? 0, result.score) }))
    setPlaysToday(p => ({ ...p, [result.gameId]: (p[result.gameId] ?? 0) + 1 }))
  }

  if (activeGame) {
    return (
      <GameView
        gameId={activeGame}
        onBack={() => setActiveGame(null)}
        onResult={handleResult}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={15} />
        </button>
      </div>
      <Lobby onPlay={setActiveGame} results={results} bestScores={bestScores} playsToday={playsToday} open={open} minutesLeft={minutesLeft} />
    </div>
  )
}
