// src/pages/multiplayer/games/TacZoneMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Crown } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Cell  = 'X' | 'O' | null
type Phase = 'playing' | 'ended'

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const
const TURN_SEC = 15

function checkWin(b: Cell[]): number[] | null {
  for (const line of WINS) {
    const [a, bi, c] = line
    if (b[a] && b[a] === b[bi] && b[a] === b[c]) return [...line]
  }
  return null
}

interface TacMoveEvent { type: 'tac_move'; cellIdx: number; symbol: 'X' | 'O'; playerId: string }
interface TacStartEvent { type: 'tac_start'; xPlayerId: string; serverTs: string }
type TacEvent = TacMoveEvent | TacStartEvent

export default function TacZoneMP({ roomId, myId, players, onGameOver }: MPGameProps) {
  const [board,      setBoard]      = useState<Cell[]>(Array(9).fill(null))
  const [mySymbol,   setMySymbol]   = useState<'X' | 'O' | null>(null)
  const [activeSym,  setActiveSym]  = useState<'X' | 'O'>('X')
  const [winLine,    setWinLine]    = useState<number[] | null>(null)
  const [phase,      setPhase]      = useState<Phase>('playing')
  const [timeLeft,   setTimeLeft]   = useState(TURN_SEC)
  const [results,    setResults]    = useState<PlayerResult[] | null>(null)

  const channelRef   = useRef<RealtimeChannel | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const isOrchestrator = players[0]?.player_id === myId  // first-joined drives setup

  // ── Timer countdown ──
  function startTurnTimer(ts: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - new Date(ts).getTime()) / 1000
      const left = Math.max(0, TURN_SEC - elapsed)
      setTimeLeft(Math.ceil(left))
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        // Auto-forfeit: just advance turn, no move placed
        setActiveSym(prev => prev === 'X' ? 'O' : 'X')
        const newTs = new Date().toISOString()
        startTurnTimer(newTs)
        channelRef.current?.send({
          type: 'broadcast', event: 'tac_event',
          payload: { type: 'tac_forfeit', serverTs: newTs } as unknown as TacEvent,
        })
      }
    }, 200)
  }

  // ── Build results and end ──
  const endGame = useCallback((winnerSym: 'X' | 'O' | null, moves: number) => {
    if (phase === 'ended') return
    setPhase('ended')
    if (timerRef.current) clearInterval(timerRef.current)

    const myRank: GameRank = 'beginner'
    const rankCfg = getRankConfig(myRank)

    const playerResults: PlayerResult[] = players.map(p => {
      const pSym   = p.player_id === myId ? mySymbol : (mySymbol === 'X' ? 'O' : 'X')
      const won    = winnerSym !== null && pSym === winnerSym
      const drew   = winnerSym === null
      const score  = won ? 100 : drew ? 50 : 0
      const correct = won ? Math.max(0, 9 - moves) : 0
      const xpMult = won ? 1.0 : drew ? 0.6 : 0.25
      const xpEarned = Math.round(
        calcSessionXP(correct, 9, 0, rankCfg.xpBase) * xpMult
      )
      return {
        playerId:    p.player_id,
        displayName: p.display_name || p.username,
        score,
        correct,
        total: 9,
        streak: 0,
        rank: myRank,
        xpEarned,
      }
    })

    setResults(playerResults)
    onGameOver()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, players, myId, mySymbol])

  // ── Channel setup ──
  useEffect(() => {
    const channel = supabase.channel(`tac:${roomId}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel.on('broadcast', { event: 'tac_event' }, ({ payload }) => {
      const ev = payload as TacEvent | { type: 'tac_forfeit'; serverTs: string }

      if (ev.type === 'tac_start') {
        setMySymbol(ev.xPlayerId === myId ? 'X' : 'O')
        startTurnTimer(ev.serverTs)
      }

      if (ev.type === 'tac_move') {
        setBoard(prev => {
          const next = [...prev]
          next[ev.cellIdx] = ev.symbol
          const line = checkWin(next)
          const filled = next.every(c => c !== null)
          if (line) {
            setWinLine(line)
            endGame(ev.symbol, next.filter(Boolean).length)
          } else if (filled) {
            endGame(null, 9)
          } else {
            setActiveSym(ev.symbol === 'X' ? 'O' : 'X')
            const ts = new Date().toISOString()
            startTurnTimer(ts)
          }
          return next
        })
      }

      if ((ev as { type: string }).type === 'tac_forfeit') {
        const fe = ev as { type: 'tac_forfeit'; serverTs: string }
        setActiveSym(prev => prev === 'X' ? 'O' : 'X')
        startTurnTimer(fe.serverTs)
      }
    })

    channel.subscribe(() => {
      // Orchestrator assigns X randomly and broadcasts start
      if (isOrchestrator) {
        const xIdx   = Math.random() < 0.5 ? 0 : 1
        const xPlayer = players[xIdx]?.player_id ?? myId
        const serverTs = new Date().toISOString()
        channel.send({
          type: 'broadcast', event: 'tac_event',
          payload: { type: 'tac_start', xPlayerId: xPlayer, serverTs } as TacStartEvent,
        })
      }
    })

    return () => {
      channel.unsubscribe()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function handleCellClick(idx: number) {
    if (!mySymbol || board[idx] || activeSym !== mySymbol || phase === 'ended') return
    channelRef.current?.send({
      type: 'broadcast', event: 'tac_event',
      payload: { type: 'tac_move', cellIdx: idx, symbol: mySymbol, playerId: myId } as TacMoveEvent,
    })
  }

  if (results) {
    return (
      <MultiplayerResults
        gameName="Tac Zone"
        gameEmoji="⭕"
        myId={myId}
        players={results}
        teamMode="ffa"
        onPlayAgain={() => window.location.reload()}
      />
    )
  }

  const isMyTurn = mySymbol !== null && activeSym === mySymbol
  const opponent = players.find(p => p.player_id !== myId)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="text-center mb-6 space-y-1">
        <p className="text-2xl">⭕</p>
        <h1 className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>Tac Zone</h1>
        {mySymbol && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You are <span style={{ color: mySymbol === 'X' ? '#ff4f4f' : '#4f8ef7', fontWeight: 700 }}>{mySymbol}</span>
          </p>
        )}
      </div>

      {/* Players */}
      <div className="flex items-center gap-4 mb-6">
        {players.map(p => (
          <div key={p.player_id} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: p.player_id === players[0]?.player_id ? '#ff4f4f' : '#4f8ef7' }}
            >
              {(p.display_name || p.username).charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {p.display_name || p.username}
            </span>
            {p.is_host && <Crown size={12} style={{ color: '#f5c542' }} />}
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      <div
        className="mb-4 px-4 py-2 rounded-xl text-sm font-bold"
        style={{
          background: isMyTurn ? 'rgba(62,207,142,0.12)' : 'rgba(255,255,255,0.05)',
          color: isMyTurn ? '#3ecf8e' : 'var(--text-dim)',
          border: `1px solid ${isMyTurn ? 'rgba(62,207,142,0.3)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {isMyTurn ? `Your turn — ${timeLeft}s` : `${opponent?.display_name ?? 'Opponent'}'s turn — ${timeLeft}s`}
      </div>

      {/* Timer bar */}
      <div className="w-full max-w-xs mb-6 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(timeLeft / TURN_SEC) * 100}%`,
            background: timeLeft <= 5 ? '#ff4f4f' : '#3ecf8e',
            transition: 'width 0.2s linear',
          }}
        />
      </div>

      {/* Board */}
      <div
        className="grid gap-2 mb-6"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: 240 }}
      >
        {board.map((cell, idx) => {
          const inWinLine = winLine?.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCellClick(idx)}
              disabled={!!cell || !isMyTurn || phase === 'ended'}
              className="rounded-2xl flex items-center justify-center font-extrabold text-3xl transition-all duration-150"
              style={{
                width: 72, height: 72,
                background: inWinLine
                  ? 'rgba(62,207,142,0.2)'
                  : cell
                  ? 'var(--surface)'
                  : isMyTurn ? 'var(--surface2)' : 'var(--surface)',
                border: inWinLine
                  ? '2px solid #3ecf8e'
                  : '2px solid rgba(255,255,255,0.08)',
                cursor: !cell && isMyTurn && phase !== 'ended' ? 'pointer' : 'default',
                color: cell === 'X' ? '#ff4f4f' : '#4f8ef7',
                transform: inWinLine ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {cell}
            </button>
          )
        })}
      </div>
    </div>
  )
}
