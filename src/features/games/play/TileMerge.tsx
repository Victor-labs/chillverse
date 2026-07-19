// src/pages/games/TileMerge.tsx
// "Chill Merge" — a Tile-Up-style merge puzzle, reskinned for Chillverse.
// Tap a cell to drop the current tile. It merges with AT MOST ONE matching
// neighbor per placement (no infinite cascades) — chains have to be built
// deliberately across turns, and a full board is a loss that ends the
// session immediately. XP is flat per merge (see MERGE_XP).
import { useState, useRef, useMemo } from 'react'
import { Layers, Sparkles } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'

const ACCENT = '#38bdf8'
const GAME_ID = 'tile-merge' as const
const GRID = 4
const CELLS = GRID * GRID

// Flat XP awarded per individual merge event.
const MERGE_XP = 8

// At most this many chained merges resolve from a single placement. Capped
// at 1 so merging takes deliberate multi-turn setup instead of one tap
// wiping out a whole cluster — this is the main difficulty lever.
const MAX_CHAIN = 1

// Cycles through Chillverse's existing accent palette so every level reads
// as an on-brand color, not an arbitrary gradient.
const LEVEL_COLORS = ['#4f8ef7', '#9b6dff', '#3ecf8e', 'var(--accent2)', '#ff4f4f', '#f5c542', '#ff5fa2', '#00e5ff']
const WILD_GRADIENT = 'linear-gradient(135deg, #f5c542, var(--accent2))'

interface Tile {
  level: number
  wild?: boolean
  bornAt: number // used to key merge-pop animation
}

function levelColor(level: number) {
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length]
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

// Tuned to be "somewhat hard": mostly plain level-1 tiles, a modest chunk
// of level-2s, and wild tiles are rare — so a matching neighbor isn't
// guaranteed every turn, and building up a merge takes real placement.
function rollTile(): Tile {
  const r = Math.random()
  const bornAt = Date.now()
  if (r < 0.03) return { level: 1, wild: true, bornAt }
  if (r < 0.18) return { level: 2, bornAt }
  return { level: 1, bornAt }
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

  const [board, setBoard] = useState<(Tile | null)[]>(Array(CELLS).fill(null))
  const [current, setCurrent] = useState<Tile>(() => rollTile())
  const [next, setNext] = useState<Tile>(() => rollTile())
  const [score, setScore] = useState(0)
  const [mergeCount, setMergeCount] = useState(0)
  const [highestLevel, setHighestLevel] = useState(1)
  const [popIdx, setPopIdx] = useState<number | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const startRef = useRef(Date.now())

  function finish(finalBoard: (Tile | null)[], finalScore: number, finalMerges: number, finalTop: number) {
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const boardFull = finalBoard.every(c => c !== null)
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
        'Top Tile': `Lv.${finalTop}`,
        'Result': boardFull ? 'Board full — game over' : 'Ended early',
      },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function start() {
    setScore(0)
    setMergeCount(0)
    setHighestLevel(1)
    setResult(null)
    startRef.current = Date.now()
    setBoard(Array(CELLS).fill(null))
    setCurrent(rollTile())
    setNext(rollTile())
    setPhase('play')
  }

  function place(idx: number) {
    if (phase !== 'play' || board[idx]) return
    const nb = [...board]
    nb[idx] = { ...current, bornAt: Date.now() }

    let localMerges = 0
    let localScore = 0
    let top = highestLevel
    let cursor = idx

    // Resolve at most MAX_CHAIN merges from the placed cell — deliberately
    // capped so one tap can't cascade through the whole board.
    while (localMerges < MAX_CHAIN) {
      const cell = nb[cursor]
      if (!cell) break
      const match = neighborsOf(cursor).find(n => {
        const t = nb[n]
        return t && (t.level === cell.level || t.wild || cell.wild)
      })
      if (match === undefined) break
      const mergedLevel = cell.level + 1
      nb[cursor] = { level: mergedLevel, bornAt: Date.now() }
      nb[match] = null
      localMerges += 1
      localScore += mergedLevel * 10
      top = Math.max(top, mergedLevel)
    }

    const newScore = score + localScore
    const newMergeCount = mergeCount + localMerges
    setBoard(nb)
    setPopIdx(cursor)
    setTimeout(() => setPopIdx(null), 260)

    if (localMerges > 0) {
      setScore(newScore)
      setMergeCount(newMergeCount)
      setHighestLevel(top)
    }

    // Game over: board full. This is a loss — the session ends right here,
    // no free "new board" continue.
    const isFull = nb.every(c => c !== null)
    if (isFull) {
      finish(nb, newScore, newMergeCount, top)
      return
    }

    setCurrent(next)
    setNext(rollTile())
  }

  function endSessionEarly() {
    finish(board, score, mergeCount, highestLevel)
  }

  const filled = useMemo(() => board.filter(Boolean).length, [board])
  const emptyCells = useMemo(() => board.map((c, i) => c ? -1 : i).filter(i => i >= 0), [board])
  // No empty cell can accept the current tile without a legal outcome check
  // needed here — placement is always legal on an empty cell; this just
  // reflects how close the board is to a forced loss for the "cells left" UI.
  const cellsLeft = CELLS - filled

  const rules = [
    { icon: '👆', text: 'Tap any empty cell to place the current tile' },
    { icon: '🔗', text: 'Merges with at most one matching neighbor at a time — chains take setup' },
    { icon: '⚡', text: `+${MERGE_XP} XP per merge, added straight to your profile` },
    { icon: '✨', text: 'Rare gold wild tiles merge with any level next to them' },
    { icon: '💀', text: 'Board fills up (16/16) with no room left → game over, session ends' },
    { icon: '🔒', text: `Costs ${sessionCost} sessions per play` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chill Merge"
      tagline="Place tiles, chain the merges, don't run out of room."
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 12, padding: '4px 10px',
            color: cellsLeft <= 3 ? 'var(--red)' : ACCENT,
            background: cellsLeft <= 3 ? 'rgba(255,79,79,0.12)' : `${ACCENT}18`,
            border: `1px solid ${cellsLeft <= 3 ? 'rgba(255,79,79,0.4)' : ACCENT + '33'}`,
          }}>
            {cellsLeft <= 3 ? `⚠ ${cellsLeft} CELLS LEFT` : `${cellsLeft} CELLS LEFT`}
          </span>
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
          {board.map((cell, i) => (
            <button key={i} type="button" onClick={() => place(i)} disabled={!!cell || phase !== 'play'}
              aria-label={cell ? `Level ${cell.level} tile` : `Empty cell ${i + 1}`}
              style={{
                width: 74, height: 74, borderRadius: 16,
                cursor: cell || phase !== 'play' ? 'default' : 'pointer',
                background: cell ? (cell.wild ? WILD_GRADIENT : `linear-gradient(135deg, ${levelColor(cell.level)}, ${levelColor(cell.level)}cc)`) : 'var(--surface)',
                boxShadow: cell
                  ? `0 0 ${popIdx === i ? 26 : 14}px ${cell.wild ? '#f5c54255' : levelColor(cell.level) + '55'}, 3px 3px 8px var(--neu-dark)`
                  : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: popIdx === i ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
              }}>
              {cell && (cell.wild
                ? <Sparkles size={22} style={{ color: '#fff' }} />
                : <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>{cell.level}</span>)}
            </button>
          ))}
        </div>

        {/* Tile tray */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: 6, textTransform: 'uppercase' }}>Place Now</div>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: current.wild ? WILD_GRADIENT : `linear-gradient(135deg, ${levelColor(current.level)}, ${levelColor(current.level)}cc)`,
              boxShadow: `0 0 16px ${current.wild ? '#f5c54255' : levelColor(current.level) + '55'}, 3px 3px 8px var(--neu-dark)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.15)',
            }}>
              {current.wild ? <Sparkles size={20} style={{ color: '#fff' }} /> : <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{current.level}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: 6, textTransform: 'uppercase' }}>Next Up</div>
            <div style={{
              width: 44, height: 44, borderRadius: 12, opacity: 0.65,
              background: next.wild ? WILD_GRADIENT : `linear-gradient(135deg, ${levelColor(next.level)}, ${levelColor(next.level)}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)',
            }}>
              {next.wild ? <Sparkles size={16} style={{ color: '#fff' }} /> : <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{next.level}</span>}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filled}/{CELLS} cells filled — fill the board and it's game over</p>

        {emptyCells.length > 0 && (
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
