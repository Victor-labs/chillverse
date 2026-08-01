// src/pages/games/TileMerge.tsx
// "Chill Merge" — a tap-to-place merge puzzle, reskinned for Chillverse.
// Tap a cell to drop the current tile. On placement, it merges with the
// FIRST matching neighbor found (up/down/left/right, at most one merge per
// placement — no cascades, so chains have to be built deliberately across
// turns). Merge math is number-based, not doubling like classic 2048:
//   - Two DIFFERENT adjacent values always ADD (1+2=3, 2+3=5)
//   - Two EQUAL adjacent values ADD if odd (3+3=6), MULTIPLY if even (4+4=16)
// As the highest tile climbs, the spawn pool shifts toward bigger starter
// tiles, but a small baseline chance of a low tile always remains so the
// board never gets "safe." Past a threshold, cells can randomly freeze —
// fully locked (can't place into, merge into, or clear) until 3 merges have
// happened anywhere else on the board, which thaws them back to normal.
import { useState, useRef, useMemo } from 'react'
import { Layers, Snowflake } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'

const ACCENT = '#38bdf8'
const GAME_ID = 'tile-merge' as const
const GRID = 4
const CELLS = GRID * GRID

// Flat XP awarded per individual merge event.
const MERGE_XP = 8

// Hazard tuning: cells only start freezing once the board has proven it can
// handle it (a tile of at least this value has been reached), at most this
// many cells can be frozen at once, and a frozen cell needs this many merges
// (anywhere on the board) before it thaws.
const FREEZE_MIN_HIGHEST = 8
const MAX_FROZEN = 2
const FREEZE_THAW_MERGES = 3
const FREEZE_CHANCE = 0.12

// Spawn difficulty: as the highest tile crosses these milestones, the spawn
// weight table below shifts toward bigger starter values.
const MILESTONES = [8, 24, 60, 150]
// Weight table per tier for starter values [1, 2, 3, 4]. Value 1's weight
// never drops below 10% of the total, even at max tier — that's the
// deliberate "random low tile" difficulty spike so a high board never gets
// fully safe.
const TIER_WEIGHTS: number[][] = [
  [70, 22, 6, 2],
  [45, 30, 18, 7],
  [25, 30, 28, 17],
  [15, 25, 32, 28],
  [10, 20, 32, 38],
]

// Cycles through Chillverse's existing accent palette so every tile reads
// as an on-brand color, not an arbitrary gradient. Indexed by growth stage
// (log2 of value) so the palette advances smoothly as numbers climb.
const LEVEL_COLORS = ['#4f8ef7', '#9b6dff', '#3ecf8e', 'var(--accent2)', '#ff4f4f', '#f5c542', '#ff5fa2', '#00e5ff']
const FREEZE_GRADIENT = 'linear-gradient(135deg, #7dd3fc, #38bdf8)'

interface BoardCell {
  value: number | null
  bornAt: number
  frozen: boolean
  freezeMergesLeft: number
}

function emptyCell(): BoardCell {
  return { value: null, bornAt: 0, frozen: false, freezeMergesLeft: 0 }
}

function colorForValue(value: number) {
  const stage = Math.floor(Math.log2(Math.max(value, 1)))
  return LEVEL_COLORS[stage % LEVEL_COLORS.length]
}

function fontSizeForValue(value: number) {
  const digits = String(value).length
  if (digits <= 2) return 22
  if (digits === 3) return 17
  return 13
}

function neighborsOf(idx: number): number[] {
  const row = Math.floor(idx / GRID)
  const col = idx % GRID
  const out: number[] = []
  if (row > 0) out.push(idx - GRID)
  if (row < GRID - 1) out.push(idx + GRID)
  if (col > 0) out.push(idx - 1)
  if (col < GRID - 1) out.push(idx + 1)
  return out
}

// Same value: add if odd, multiply if even. Different values: always add.
function mergeResult(a: number, b: number): number {
  if (a === b) return a % 2 === 0 ? a * b : a + b
  return a + b
}

function tierFor(highest: number): number {
  let tier = 0
  for (const m of MILESTONES) if (highest >= m) tier++
  return tier
}

// Weighted random pick from the tier's spawn table — see TIER_WEIGHTS above.
function rollTile(highest: number): number {
  const weights = TIER_WEIGHTS[tierFor(highest)]
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i + 1
  }
  return 1
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

  const [board, setBoard] = useState<BoardCell[]>(() => Array.from({ length: CELLS }, emptyCell))
  const [current, setCurrent] = useState<number>(() => rollTile(1))
  const [next, setNext] = useState<number>(() => rollTile(1))
  const [score, setScore] = useState(0)
  const [mergeCount, setMergeCount] = useState(0)
  const [highestValue, setHighestValue] = useState(1)
  const [popIdx, setPopIdx] = useState<number | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const startRef = useRef(Date.now())

  function finish(finalBoard: BoardCell[], finalScore: number, finalMerges: number, finalTop: number) {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const noRoomLeft = finalBoard.every(c => c.value !== null || c.frozen)
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
        'Result': noRoomLeft ? 'Board locked up — game over' : 'Ended early',
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
    setBoard(Array.from({ length: CELLS }, emptyCell))
    setCurrent(rollTile(1))
    setNext(rollTile(1))
    setPhase('play')
  }

  function place(idx: number) {
    if (phase !== 'play') return
    const cell = board[idx]
    if (cell.frozen || cell.value !== null) return

    const nb = board.map(c => ({ ...c }))
    nb[idx] = { value: current, bornAt: Date.now(), frozen: false, freezeMergesLeft: 0 }

    // Resolve at most one merge, against the first eligible neighbor found
    // (frozen or empty neighbors don't count) — deliberately capped so one
    // tap can't cascade through the whole board.
    let merged = false
    let mergedValue = 0
    for (const n of neighborsOf(idx)) {
      const t = nb[n]
      if (t.value !== null && !t.frozen) {
        mergedValue = mergeResult(nb[idx].value as number, t.value)
        nb[idx] = { value: mergedValue, bornAt: Date.now(), frozen: false, freezeMergesLeft: 0 }
        nb[n] = emptyCell()
        merged = true
        break
      }
    }

    let newScore = score
    let newMergeCount = mergeCount
    let newHighest = highestValue

    if (merged) {
      newScore = score + mergedValue * 10
      newMergeCount = mergeCount + 1
      newHighest = Math.max(highestValue, mergedValue)

      // Thaw progression: every merge on the board — not just merges
      // touching the frozen cell itself — counts down every frozen cell.
      for (let i = 0; i < nb.length; i++) {
        if (!nb[i].frozen) continue
        const left = nb[i].freezeMergesLeft - 1
        nb[i] = left <= 0
          ? { value: nb[i].value, bornAt: Date.now(), frozen: false, freezeMergesLeft: 0 }
          : { ...nb[i], freezeMergesLeft: left }
      }
    }

    // Hazard spawn: once the board has proven it can handle it, there's a
    // random chance a cell (empty or occupied, never the one just played)
    // freezes solid until it's thawed via merges elsewhere.
    const frozenCount = nb.filter(c => c.frozen).length
    if (newHighest >= FREEZE_MIN_HIGHEST && frozenCount < MAX_FROZEN && Math.random() < FREEZE_CHANCE) {
      const candidates = nb.map((c, i) => (!c.frozen && i !== idx ? i : -1)).filter(i => i >= 0)
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        nb[pick] = { ...nb[pick], frozen: true, freezeMergesLeft: FREEZE_THAW_MERGES }
      }
    }

    setBoard(nb)
    setPopIdx(idx)
    setTimeout(() => setPopIdx(null), 260)

    if (merged) {
      setScore(newScore)
      setMergeCount(newMergeCount)
      setHighestValue(newHighest)
    }

    // Game over: no legal cell left to place into (open and not frozen).
    // This is a loss — the session ends right here, no free continue.
    const legalOpen = nb.filter(c => c.value === null && !c.frozen).length
    if (legalOpen === 0) {
      finish(nb, newScore, newMergeCount, newHighest)
      return
    }

    setCurrent(next)
    setNext(rollTile(newHighest))
  }

  function endSessionEarly() {
    finish(board, score, mergeCount, highestValue)
  }

  const filled = useMemo(() => board.filter(c => c.value !== null).length, [board])
  const frozenCount = useMemo(() => board.filter(c => c.frozen).length, [board])
  const openCells = useMemo(() => board.filter(c => c.value === null && !c.frozen).length, [board])

  const rules = [
    { icon: '👆', text: 'Tap any empty cell to place the current tile' },
    { icon: '➕', text: 'Different neighbors ADD together (1+2=3, 2+3=5)' },
    { icon: '✖️', text: 'Equal neighbors ADD if odd (3+3=6), MULTIPLY if even (4+4=16)' },
    { icon: '🔗', text: 'Only one merge per placement — chains take setup across turns' },
    { icon: '⚡', text: `+${MERGE_XP} XP per merge, added straight to your profile` },
    { icon: '❄️', text: `Cells can freeze solid — locked until ${FREEZE_THAW_MERGES} merges happen anywhere else` },
    { icon: '💀', text: 'No legal cell left to place into → game over, session ends' },
    { icon: '🔒', text: `Costs ${sessionCost} sessions per play` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chill Merge"
      tagline="Place tiles, merge by value, dodge the freeze."
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
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 12, padding: '4px 10px',
            color: openCells <= 3 ? 'var(--red)' : ACCENT,
            background: openCells <= 3 ? 'rgba(255,79,79,0.12)' : `${ACCENT}18`,
            border: `1px solid ${openCells <= 3 ? 'rgba(255,79,79,0.4)' : ACCENT + '33'}`,
          }}>
            {openCells <= 3 ? `⚠ ${openCells} CELLS LEFT` : `${openCells} CELLS LEFT`}
          </span>
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
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${GRID}, 74px)`, gridTemplateRows: `repeat(${GRID}, 74px)`,
          gap: 8, background: 'var(--surface2)', padding: 10, borderRadius: 20,
          boxShadow: 'var(--elev-inset)',
        }}>
          {board.map((cell, i) => {
            const disabled = cell.frozen || cell.value !== null || phase !== 'play'
            return (
              <button key={i} type="button" onClick={() => place(i)} disabled={disabled}
                aria-label={cell.frozen ? `Frozen cell, ${cell.freezeMergesLeft} merges left to thaw` : cell.value !== null ? `Tile ${cell.value}` : `Empty cell ${i + 1}`}
                style={{
                  width: 74, height: 74, borderRadius: 16,
                  cursor: disabled ? 'default' : 'pointer',
                  background: cell.frozen
                    ? FREEZE_GRADIENT
                    : cell.value !== null
                      ? `linear-gradient(135deg, ${colorForValue(cell.value)}, ${colorForValue(cell.value)}cc)`
                      : 'var(--surface)',
                  opacity: cell.frozen ? 0.85 : 1,
                  boxShadow: cell.frozen
                    ? '0 0 14px rgba(56,189,248,0.4), 3px 3px 8px var(--neu-dark)'
                    : cell.value !== null
                      ? `0 0 ${popIdx === i ? 26 : 14}px ${colorForValue(cell.value)}55, 3px 3px 8px var(--neu-dark)`
                      : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                  border: cell.frozen ? '1px solid rgba(125,211,252,0.6)' : '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  transform: popIdx === i ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
                }}>
                {cell.frozen ? (
                  <>
                    <Snowflake size={18} style={{ color: '#fff' }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginTop: 2 }}>{cell.freezeMergesLeft} left</span>
                  </>
                ) : cell.value !== null ? (
                  <span style={{ fontSize: fontSizeForValue(cell.value), fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>{cell.value}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Tile tray */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: 6, textTransform: 'uppercase' }}>Place Now</div>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `linear-gradient(135deg, ${colorForValue(current)}, ${colorForValue(current)}cc)`,
              boxShadow: `0 0 16px ${colorForValue(current)}55, 3px 3px 8px var(--neu-dark)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.15)',
            }}>
              <span style={{ fontSize: fontSizeForValue(current), fontWeight: 800, color: '#fff' }}>{current}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: 6, textTransform: 'uppercase' }}>Next Up</div>
            <div style={{
              width: 44, height: 44, borderRadius: 12, opacity: 0.65,
              background: `linear-gradient(135deg, ${colorForValue(next)}, ${colorForValue(next)}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)',
            }}>
              <span style={{ fontSize: fontSizeForValue(next) - 4, fontWeight: 800, color: '#fff' }}>{next}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filled}/{CELLS} cells filled — no legal cell left and it's game over</p>

        {openCells > 0 && (
          <button type="button" onClick={endSessionEarly}
            style={{ padding: '9px 18px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            End Session Early
          </button>
        )}
      </div>

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}
