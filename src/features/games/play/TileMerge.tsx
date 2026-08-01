// src/pages/games/TileMerge.tsx
// "Chill Merge" — the classic 2048 slide-and-merge, reskinned for
// Chillverse, with one hazard twist: frozen tiles.
//
// Swipe (or use the arrow buttons) to slide every tile on the board at
// once in that direction. Two tiles of the SAME value combine into double
// that value when they collide (1+1=2, 2+2=4, 4+4=8, ...) — only equal
// values ever merge, exactly like the original. After every legal move a
// new tile spawns automatically on a random empty cell.
//
// Twist: once you've built a big enough tile, cells can randomly freeze —
// the frozen tile shows its number greyed out and does NOT slide or merge
// like a normal tile; it just sits there blocking that lane. The only way
// to clear it is to slide a matching-value tile straight into it, which
// breaks the ice: the frozen tile thaws, doubles, and behaves normally
// again from then on.
import { useState, useRef, useEffect, useMemo } from 'react'
import type { CSSProperties, TouchEvent as ReactTouchEvent } from 'react'
import { Layers, Snowflake, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'

const ACCENT = '#38bdf8'
const GAME_ID = 'tile-merge' as const
const GRID = 4
const CELLS = GRID * GRID

// Flat XP awarded per individual merge event (includes breaking the ice).
const MERGE_XP = 8

// Hazard tuning: cells only start freezing once a tile this big has been
// reached, at most this many cells can be frozen at once, and each legal
// swipe has this chance of freezing one more (occupied, non-frozen) cell.
const FREEZE_MIN_HIGHEST = 8
const MAX_FROZEN = 2
const FREEZE_CHANCE = 0.12

// New-tile spawn split — same 90/10 weighting as the original 2048's 2/4
// split, just based at 1/2 since this board starts from 1.
const SPAWN_LOW_CHANCE = 0.9

type Dir = 'left' | 'right' | 'up' | 'down'

interface Cell {
  value: number | null
  frozen: boolean
}

function emptyCell(): Cell {
  return { value: null, frozen: false }
}

const LEVEL_COLORS = ['#4f8ef7', '#9b6dff', '#3ecf8e', 'var(--accent2)', '#ff4f4f', '#f5c542', '#ff5fa2', '#00e5ff']

function colorForValue(value: number) {
  const stage = Math.floor(Math.log2(Math.max(value, 1)))
  return LEVEL_COLORS[stage % LEVEL_COLORS.length]
}

function fontSizeForValue(value: number) {
  const digits = String(value).length
  if (digits <= 2) return 24
  if (digits === 3) return 18
  return 14
}

function idx(row: number, col: number) {
  return row * GRID + col
}

// Each line is the 4 board indices in leading→trailing order for that
// direction — index 0 is the edge tiles slide toward.
function linesForDir(dir: Dir): number[][] {
  const lines: number[][] = []
  if (dir === 'left') for (let r = 0; r < GRID; r++) lines.push([0, 1, 2, 3].map(c => idx(r, c)))
  else if (dir === 'right') for (let r = 0; r < GRID; r++) lines.push([3, 2, 1, 0].map(c => idx(r, c)))
  else if (dir === 'up') for (let c = 0; c < GRID; c++) lines.push([0, 1, 2, 3].map(r => idx(r, c)))
  else for (let c = 0; c < GRID; c++) lines.push([3, 2, 1, 0].map(r => idx(r, c)))
  return lines
}

// Collapses one line (4 cells, leading→trailing order) toward index 0.
// Frozen cells never move and split the line into independent segments —
// tiles can't slide past a frozen cell into the segment beyond it. The
// tile closest to a frozen cell (on its trailing side) may merge INTO it
// if the values match, which thaws it and doubles its value; otherwise the
// frozen cell just blocks that lane like a wall.
function collapseLine(line: Cell[]): { result: Cell[]; gained: number; merges: number; mergedPositions: number[] } {
  const result: Cell[] = new Array(4)
  let gained = 0
  let merges = 0
  const mergedPositions: number[] = []

  const segments: number[][] = []
  let current: number[] = []
  for (let i = 0; i < 4; i++) {
    if (line[i].frozen) {
      if (current.length) segments.push(current)
      current = []
      result[i] = { ...line[i] }
    } else {
      current.push(i)
    }
  }
  if (current.length) segments.push(current)

  for (const seg of segments) {
    const obstacleIdx = seg[0] > 0 && line[seg[0] - 1].frozen ? seg[0] - 1 : -1
    const obstacleValue = obstacleIdx >= 0 ? (line[obstacleIdx].value as number) : null

    const values = seg.map(i => line[i].value).filter((v): v is number => v !== null)

    const collapsed: number[] = []
    const collapsedIsMerge: boolean[] = []
    let i = 0
    while (i < values.length) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        const merged = values[i] * 2
        collapsed.push(merged)
        collapsedIsMerge.push(true)
        gained += merged
        merges++
        i += 2
      } else {
        collapsed.push(values[i])
        collapsedIsMerge.push(false)
        i += 1
      }
    }

    // Try breaking the ice: the tile closest to the frozen obstacle merges
    // into it if the value matches — but only if that tile hasn't already
    // merged once this move (classic 2048 rule: one merge per tile per swipe).
    if (obstacleValue !== null && collapsed.length > 0 && collapsed[0] === obstacleValue && !collapsedIsMerge[0]) {
      const newVal = obstacleValue * 2
      result[obstacleIdx] = { value: newVal, frozen: false }
      mergedPositions.push(obstacleIdx)
      gained += newVal
      merges++
      collapsed.shift()
      collapsedIsMerge.shift()
    }

    for (let k = 0; k < seg.length; k++) {
      const pos = seg[k]
      if (k < collapsed.length) {
        result[pos] = { value: collapsed[k], frozen: false }
        if (collapsedIsMerge[k]) mergedPositions.push(pos)
      } else {
        result[pos] = emptyCell()
      }
    }
  }

  return { result, gained, merges, mergedPositions }
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function TileMerge({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 2 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState } = useRankStreak(GAME_ID, initialRank)

  const [board, setBoard] = useState<Cell[]>(() => Array.from({ length: CELLS }, emptyCell))
  const [score, setScore] = useState(0)
  const [mergeCount, setMergeCount] = useState(0)
  const [highestValue, setHighestValue] = useState(1)
  const [popPositions, setPopPositions] = useState<number[]>([])
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const startRef = useRef(Date.now())
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function spawnTile(b: Cell[]): Cell[] {
    const emptyIdxs = b.map((c, i) => (c.value === null && !c.frozen ? i : -1)).filter(i => i >= 0)
    if (emptyIdxs.length === 0) return b
    const pick = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)]
    const next = b.map(c => ({ ...c }))
    next[pick] = { value: Math.random() < SPAWN_LOW_CHANCE ? 1 : 2, frozen: false }
    return next
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
        'Top Tile': `${finalTop}`,
        'Result': 'No legal move left — game over',
      },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    setScore(0)
    setMergeCount(0)
    setHighestValue(1)
    setResult(null)
    startRef.current = Date.now()
    let b = Array.from({ length: CELLS }, emptyCell)
    b = spawnTile(b)
    b = spawnTile(b)
    setBoard(b)
    setPhase('play')
  }

  // Dry-run every direction to see if any legal move remains.
  function hasLegalMove(b: Cell[]): boolean {
    return (['left', 'right', 'up', 'down'] as Dir[]).some(dir =>
      linesForDir(dir).some(line => {
        const cellsLine = line.map(i => b[i])
        const { result: r } = collapseLine(cellsLine)
        return line.some((pos, k) => b[pos].value !== r[k].value || b[pos].frozen !== r[k].frozen)
      })
    )
  }

  // Plain function (not memoized) — it reads board/score/mergeCount/
  // highestValue straight from the closure, so it's always working off the
  // latest render's state. All setState calls happen directly here, never
  // nested inside another setState's updater, so there's no risk of the
  // onEnd callback or score/XP updates double-firing under double-invoke.
  function swipe(dir: Dir) {
    if (phase !== 'play') return
    const lines = linesForDir(dir)
    const nb: Cell[] = board.map(c => ({ ...c }))
    let totalGained = 0
    let totalMerges = 0
    let changed = false
    const mergedGlobal: number[] = []

    for (const line of lines) {
      const cellsLine = line.map(i => board[i])
      const { result: r, gained, merges, mergedPositions } = collapseLine(cellsLine)
      totalGained += gained
      totalMerges += merges
      for (let k = 0; k < 4; k++) {
        const pos = line[k]
        if (board[pos].value !== r[k].value || board[pos].frozen !== r[k].frozen) changed = true
        nb[pos] = r[k]
      }
      for (const mp of mergedPositions) mergedGlobal.push(line[mp])
    }

    if (!changed) return // illegal move — no-op, classic 2048 behavior

    let finalBoard = spawnTile(nb)

    const newScore = score + totalGained
    const newMergeCount = mergeCount + totalMerges
    const newHighest = Math.max(highestValue, ...finalBoard.map(c => c.value ?? 0))

    if (newHighest >= FREEZE_MIN_HIGHEST) {
      const frozenCount = finalBoard.filter(c => c.frozen).length
      if (frozenCount < MAX_FROZEN && Math.random() < FREEZE_CHANCE) {
        const candidates = finalBoard.map((c, i) => (c.value !== null && !c.frozen ? i : -1)).filter(i => i >= 0)
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)]
          finalBoard = finalBoard.map((c, i) => (i === pick ? { ...c, frozen: true } : c))
        }
      }
    }

    setBoard(finalBoard)
    setScore(newScore)
    setMergeCount(newMergeCount)
    setHighestValue(newHighest)
    setPopPositions(mergedGlobal)
    setTimeout(() => setPopPositions([]), 260)

    if (!hasLegalMove(finalBoard)) {
      finish(newScore, newMergeCount, newHighest)
    }
  }

  // swipeRef always points at the latest swipe closure above, so the
  // window keydown listener (attached once per play session) never reads
  // stale board/score state.
  const swipeRef = useRef(swipe)
  swipeRef.current = swipe

  useEffect(() => {
    if (phase !== 'play') return
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      swipeRef.current(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  function onTouchStart(e: ReactTouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: ReactTouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    const THRESHOLD = 24
    if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return
    if (Math.abs(dx) > Math.abs(dy)) swipe(dx > 0 ? 'right' : 'left')
    else swipe(dy > 0 ? 'down' : 'up')
  }

  function endSessionEarly() {
    finish(score, mergeCount, highestValue)
  }

  const filled = useMemo(() => board.filter(c => c.value !== null).length, [board])
  const frozenCount = useMemo(() => board.filter(c => c.frozen).length, [board])

  const rules = [
    { icon: '👆', text: 'Swipe (or use the arrows) to slide every tile at once' },
    { icon: '➕', text: 'Two equal tiles combine into double the value: 1+1=2, 2+2=4, 4+4=8...' },
    { icon: '🎲', text: 'A new tile spawns automatically after every legal move' },
    { icon: '⚡', text: `+${MERGE_XP} XP per merge, added straight to your profile` },
    { icon: '❄️', text: 'Cells can freeze grey and lock in place — slide a matching tile into one to break the ice' },
    { icon: '💀', text: 'No legal move left in any direction → game over, session ends' },
    { icon: '🔒', text: `Costs ${sessionCost} sessions per play` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chill Merge"
      tagline="Swipe to merge, chase the high tile, dodge the freeze."
      accent={ACCENT}
      icon={<Layers size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={0}
      onStart={start}
      onClose={onBack}
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
        streak={highestValue}
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
          {frozenCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, borderRadius: 12, padding: '4px 10px',
              color: '#7dd3fc', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Snowflake size={11} /> {frozenCount} FROZEN
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Session XP: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{mergeCount * MERGE_XP}</span>
          </span>
        </div>

        {/* Board */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${GRID}, 74px)`, gridTemplateRows: `repeat(${GRID}, 74px)`,
            gap: 8, background: 'var(--surface2)', padding: 10, borderRadius: 20,
            boxShadow: 'var(--elev-inset)', touchAction: 'none',
          }}>
          {board.map((cell, i) => (
            <div key={i}
              style={{
                width: 74, height: 74, borderRadius: 16,
                background: cell.frozen
                  ? 'linear-gradient(135deg, rgba(125,211,252,0.35), rgba(56,189,248,0.35))'
                  : cell.value !== null
                    ? `linear-gradient(135deg, ${colorForValue(cell.value)}, ${colorForValue(cell.value)}cc)`
                    : 'var(--surface)',
                boxShadow: cell.frozen
                  ? '0 0 12px rgba(56,189,248,0.35), inset 0 0 0 1px rgba(125,211,252,0.5)'
                  : cell.value !== null
                    ? `0 0 ${popPositions.includes(i) ? 26 : 14}px ${colorForValue(cell.value)}55, 3px 3px 8px var(--neu-dark)`
                    : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                border: cell.frozen ? '1px solid rgba(125,211,252,0.6)' : '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transform: popPositions.includes(i) ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
              }}>
              {cell.frozen && <Snowflake size={14} style={{ color: '#e0f2fe', marginBottom: 2 }} />}
              {cell.value !== null && (
                <span style={{
                  fontSize: fontSizeForValue(cell.value), fontWeight: 800,
                  color: cell.frozen ? 'rgba(255,255,255,0.55)' : '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.35)',
                }}>{cell.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Directional controls (fallback for/alongside swipe gestures) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gridTemplateRows: 'repeat(2, 36px)', gap: 6, marginTop: 2 }}>
          <div />
          <button type="button" onClick={() => swipe('up')} style={arrowBtnStyle}><ArrowUp size={16} /></button>
          <div />
          <button type="button" onClick={() => swipe('left')} style={arrowBtnStyle}><ArrowLeft size={16} /></button>
          <button type="button" onClick={() => swipe('down')} style={arrowBtnStyle}><ArrowDown size={16} /></button>
          <button type="button" onClick={() => swipe('right')} style={arrowBtnStyle}><ArrowRight size={16} /></button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Swipe the board or tap the arrows — no legal move left ends the session</p>

        <button type="button" onClick={endSessionEarly}
          style={{ padding: '9px 18px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          End Session Early
        </button>
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}

const arrowBtnStyle: CSSProperties = {
  width: 40, height: 36, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
