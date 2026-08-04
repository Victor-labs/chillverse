// src/pages/games/TileMerge.tsx
// "Chill Merge" — a placement-and-merge puzzle on a 4x4 board.
//
// You're handed one tile at a time (a color + a number) and tap any empty
// cell to place it — you never slide the board. Get THREE tiles that share
// the exact same color AND number AND are sitting together on the board —
// either 3 in a straight row/column, or 3 of the 4 cells in a 2x2 block
// (reading as an L) — and they start pulsing (a "heartbeat" zoom in/out),
// while every other cell dims out to show they're not tappable right now.
// Matching color+number tiles scattered elsewhere on the board don't count.
// Tap any one of the three pulsing
// tiles and all three collapse into a single tile one level higher, sitting
// wherever you tapped. That new, higher tile can itself complete another
// triple immediately — if it does, the board re-highlights that new triple
// right away and you resolve it the same way before you're handed your
// next tile to place. Chains can run as long as the board allows. If more
// than one triple is on the board at once, all of them highlight together
// and whichever one you tap first is the one that resolves.
//
// Game over: the board is completely full (16/16) and no triple is left
// to clear space.
import { useState, useRef, useMemo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Layers, Star, Flag, Heart, Flame as FlameIcon } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'
import { ripple } from '../../../shared/lib/ripple'

const ACCENT = '#38bdf8'
const GAME_ID = 'tile-merge' as const
const GRID = 4
const CELLS = GRID * GRID

// Flat XP awarded per individual merge event (a triple collapsing into one).
const MERGE_XP = 6

// New tiles are always handed out at level 1 or 2 — every higher level can
// only be reached by merging a triple, same 90/10 weighting Chill Merge has
// always used for its low/high spawn split.
const SPAWN_LOW_CHANCE = 0.9

type TileColor = 'yellow' | 'blue' | 'purple' | 'red'

const COLORS: TileColor[] = ['yellow', 'blue', 'purple', 'red']

const COLOR_META: Record<TileColor, { base: string; light: string; Icon: typeof Star; filled: boolean }> = {
  yellow: { base: '#f5c542', light: '#ffe08a', Icon: Star, filled: true },
  blue:   { base: '#4f8ef7', light: '#8ab4ff', Icon: Flag, filled: true },
  purple: { base: '#9b6dff', light: '#c3a8ff', Icon: Heart, filled: true },
  red:    { base: '#ff5f4f', light: '#ff9a8f', Icon: FlameIcon, filled: true },
}

interface Tile {
  color: TileColor
  level: number
}

type Cell = Tile | null

function randomTile(): Tile {
  return {
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    level: Math.random() < SPAWN_LOW_CHANCE ? 1 : 2,
  }
}

function fontSizeForLevel(level: number) {
  const digits = String(level).length
  if (digits <= 2) return 24
  if (digits === 3) return 18
  return 14
}

function tileKey(t: Tile) {
  return `${t.color}:${t.level}`
}

function idxToRC(i: number) {
  return { r: Math.floor(i / GRID), c: i % GRID }
}

// A triple only counts if the 3 cells actually sit together — either 3 in a
// straight row/column, or 3 of the 4 cells in a 2x2 block (which reads as
// an L). Matching color+number scattered elsewhere on the board doesn't
// qualify.
function isAdjacentTriple(cells: number[]): boolean {
  const rc = cells.map(idxToRC)
  const rows = rc.map(p => p.r)
  const cols = rc.map(p => p.c)
  const rowSpan = Math.max(...rows) - Math.min(...rows)
  const colSpan = Math.max(...cols) - Math.min(...cols)
  if (rowSpan === 0 && colSpan === 2) return true // horizontal line of 3
  if (colSpan === 0 && rowSpan === 2) return true // vertical line of 3
  if (rowSpan <= 1 && colSpan <= 1) return true    // fits a 2x2 block → L-shape
  return false
}

function combinationsOf3(arr: number[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < arr.length - 2; i++)
    for (let j = i + 1; j < arr.length - 1; j++)
      for (let k = j + 1; k < arr.length; k++)
        out.push([arr[i], arr[j], arr[k]])
  return out
}

// Finds every color+level combo that has 3 matching tiles sitting together
// (straight line or 2x2/L-shape) on the board right now. Each group carries
// the 3 cell indices involved so the UI knows exactly which cells to pulse
// and which merge a tap resolves.
function findGroups(board: Cell[]): { key: string; cells: number[] }[] {
  const byKey = new Map<string, number[]>()
  board.forEach((cell, i) => {
    if (!cell) return
    const k = tileKey(cell)
    const arr = byKey.get(k) ?? []
    arr.push(i)
    byKey.set(k, arr)
  })
  const groups: { key: string; cells: number[] }[] = []
  for (const [key, cells] of byKey) {
    if (cells.length < 3) continue
    for (const combo of combinationsOf3(cells)) {
      if (isAdjacentTriple(combo)) {
        groups.push({ key, cells: combo })
        break // one qualifying triple is enough to highlight/resolve for this combo
      }
    }
  }
  return groups
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
  skipIntro?: boolean
}

export default function TileMerge({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 2, skipIntro }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState } = useRankStreak(GAME_ID, initialRank)

  const [board, setBoard] = useState<Cell[]>(() => Array.from({ length: CELLS }, () => null))
  const [current, setCurrent] = useState<Tile>(() => randomTile())
  const [next, setNext] = useState<Tile>(() => randomTile())
  const [score, setScore] = useState(0)
  const [mergeCount, setMergeCount] = useState(0)
  const [highestLevel, setHighestLevel] = useState(1)
  const [groups, setGroups] = useState<{ key: string; cells: number[] }[]>([])
  const [popPositions, setPopPositions] = useState<number[]>([])
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const startRef = useRef(Date.now())

  const highlightedCells = useMemo(() => new Set(groups.flatMap(g => g.cells)), [groups])
  const resolving = groups.length > 0

  function start() {
    setScore(0)
    setMergeCount(0)
    setHighestLevel(1)
    setResult(null)
    setGroups([])
    setPopPositions([])
    startRef.current = Date.now()
    setBoard(Array.from({ length: CELLS }, () => null))
    setCurrent(randomTile())
    setNext(randomTile())
    setPhase('play')
  }

  function finish(finalScore: number, finalMerges: number, finalTop: number) {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Chill Merge',
      rank: 'beginner', // Chill Merge is exempt from the rank system, like Tac Zone
      score: finalScore,
      xpEarned: finalMerges * MERGE_XP,
      durationSec: dur,
      streak: finalTop,
      correct: finalMerges,
      total: finalMerges,
      detail: {
        'Merges': finalMerges,
        'Top Level': `${finalTop}`,
        'Result': 'Board full — no triple left to clear',
      },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  // Places the queued "current" tile on an empty cell, then checks for a
  // triple. If one exists, the board enters resolving mode (highlighted,
  // rest dimmed) instead of handing out the next tile right away.
  function placeTile(i: number) {
    if (phase !== 'play' || resolving) return
    if (board[i] !== null) return

    const nb = board.slice()
    nb[i] = current
    const foundGroups = findGroups(nb)
    const newScore = score + 1

    setBoard(nb)
    setScore(newScore)
    setPopPositions([i])
    setTimeout(() => setPopPositions([]), 260)

    if (foundGroups.length > 0) {
      setGroups(foundGroups)
      return
    }

    // No triple — hand out the next tile and check for game over.
    setCurrent(next)
    setNext(randomTile())

    if (nb.every(c => c !== null)) {
      finish(newScore, mergeCount, highestLevel)
    }
  }

  // Resolves whichever triple the tapped cell belongs to: all three
  // matching tiles collapse into one, one level higher, at the tapped
  // position. If that creates a fresh triple, the board stays in
  // resolving mode and re-highlights it; otherwise placement resumes.
  function resolveTap(i: number) {
    const group = groups.find(g => g.cells.includes(i))
    if (!group) return

    const mergedTile = board[group.cells[0]]
    if (!mergedTile) return
    const newLevel = mergedTile.level + 1

    const nb = board.slice()
    for (const c of group.cells) nb[c] = null
    nb[i] = { color: mergedTile.color, level: newLevel }

    const gained = newLevel * 5
    const newScore = score + gained
    const newMergeCount = mergeCount + 1
    const newHighest = Math.max(highestLevel, newLevel)

    setBoard(nb)
    setScore(newScore)
    setMergeCount(newMergeCount)
    setHighestLevel(newHighest)
    setPopPositions([i])
    setTimeout(() => setPopPositions([]), 260)

    const nextGroups = findGroups(nb)
    setGroups(nextGroups)

    if (nextGroups.length > 0) return // chain continues, stay in resolving mode

    if (nb.every(c => c !== null)) {
      finish(newScore, newMergeCount, newHighest)
    }
  }

  function handleCellClick(e: ReactMouseEvent<HTMLDivElement>, i: number) {
    if (phase !== 'play') return
    if (resolving) {
      if (!highlightedCells.has(i)) return
      ripple(e)
      resolveTap(i)
    } else {
      if (board[i] !== null) return
      ripple(e)
      placeTile(i)
    }
  }

  function endSessionEarly() {
    finish(score, mergeCount, highestLevel)
  }

  const filled = useMemo(() => board.filter(c => c !== null).length, [board])

  const rules = [
    { icon: '👆', text: 'Tap any empty cell to place your queued tile' },
    { icon: '🎯', text: 'Get 3 matching tiles (same color AND number) sitting together — a straight line or an L/2x2 shape — to trigger a merge' },
    { icon: '💓', text: 'Matching triples pulse and highlight — tap any of the three to merge them' },
    { icon: '🔗', text: 'A merge can chain straight into another triple — resolve it before you place again' },
    { icon: '⚡', text: `+${MERGE_XP} XP per merge, added straight to your profile` },
    { icon: '💀', text: 'Board fills up (16/16) with no triple left → game over, session ends' },
    { icon: '🔒', text: `Costs ${sessionCost} sessions per play` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chill Merge"
      tagline="Place tiles, chain the merges, chase the high score."
      accent={ACCENT}
      icon={<Layers size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={0}
      onStart={start}
      onClose={onBack}
      autoStart={skipIntro}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.08, background: ACCENT, top: '10%', right: '-8%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Chill Merge"
        accent={ACCENT}
        icon={<Layers size={14} />}
        streak={highestLevel}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="SCORE" value={score} accent={ACCENT} />
            <StatChip label="MERGES" value={mergeCount} accent="var(--gold)" />
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: '16px', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{filled}/{CELLS} cells filled</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Session XP: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{mergeCount * MERGE_XP}</span>
          </span>
        </div>

        {resolving && (
          <p style={{
            fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.6px',
            animation: 'tm-textPulse 1.1s ease-in-out infinite',
          }}>
            Tap a highlighted tile to merge
          </p>
        )}

        {/* Board */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${GRID}, 74px)`, gridTemplateRows: `repeat(${GRID}, 74px)`,
            gap: 8, background: 'var(--surface2)', padding: 10, borderRadius: 20,
            boxShadow: 'var(--elev-inset)',
          }}>
          {board.map((cell, i) => {
            const isHighlighted = highlightedCells.has(i)
            const isDimmed = resolving && !isHighlighted
            const meta = cell ? COLOR_META[cell.color] : null
            const Icon = meta?.Icon
            const clickable = !resolving ? cell === null : isHighlighted

            return (
              <div key={i}
                onClick={e => handleCellClick(e, i)}
                style={{
                  width: 74, height: 74, borderRadius: 16,
                  background: cell && meta
                    ? `linear-gradient(135deg, ${meta.light}, ${meta.base})`
                    : 'var(--surface)',
                  boxShadow: isHighlighted
                    ? `0 0 22px ${meta?.base ?? ACCENT}88, inset 0 0 0 2px #fff`
                    : cell && meta
                      ? `0 0 ${popPositions.includes(i) ? 26 : 14}px ${meta.base}55, 3px 3px 8px var(--neu-dark)`
                      : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                  border: isHighlighted ? '2px solid #fff' : '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  opacity: isDimmed ? 0.32 : 1,
                  filter: isDimmed ? 'grayscale(0.6)' : 'none',
                  cursor: clickable ? 'pointer' : 'default',
                  transform: popPositions.includes(i) ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, opacity 0.25s, filter 0.25s',
                  animation: isHighlighted ? 'tm-heartbeat 0.9s ease-in-out infinite' : undefined,
                  position: 'relative', overflow: 'hidden',
                }}>
                {cell && Icon && (
                  <Icon
                    size={12}
                    fill={meta?.filled ? 'rgba(255,255,255,0.85)' : 'none'}
                    style={{ color: 'rgba(255,255,255,0.85)', position: 'absolute', top: 6, left: 6 }}
                  />
                )}
                {cell && (
                  <span style={{
                    fontSize: fontSizeForLevel(cell.level), fontWeight: 800,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.35)',
                  }}>{cell.level}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Place Now / Next Up queue */}
        {!resolving && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ display: 'flex', gap: 22 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Place Now</span>
                <QueueTile tile={current} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.65 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Next Up</span>
                <QueueTile tile={next} small />
              </div>
            </div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Place Anywhere</p>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {resolving ? 'A triple is ready — tap one of the pulsing tiles to merge it' : 'Tap an empty cell to place your tile — full board with no triple ends the session'}
        </p>

        <button type="button" onClick={endSessionEarly}
          style={{ padding: '9px 18px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          End Session Early
        </button>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}

      <style>{`
        @keyframes tm-heartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes tm-textPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function QueueTile({ tile, small }: { tile: Tile; small?: boolean }) {
  const meta = COLOR_META[tile.color]
  const Icon = meta.Icon
  const size = small ? 48 : 58
  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      background: `linear-gradient(135deg, ${meta.light}, ${meta.base})`,
      boxShadow: `0 0 12px ${meta.base}55, 3px 3px 8px var(--neu-dark)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Icon
        size={11}
        fill={meta.filled ? 'rgba(255,255,255,0.85)' : 'none'}
        style={{ color: 'rgba(255,255,255,0.85)', position: 'absolute', top: 5, left: 5 }}
      />
      <span style={{ fontSize: small ? 18 : 22, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>{tile.level}</span>
    </div>
  )
}
