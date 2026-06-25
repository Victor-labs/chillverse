// src/pages/multiplayer/games/NumberRushMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import { validateNumberRushExpression, getRoundTimeState } from '../raceEngine'
import { NUMBER_RUSH_ROUNDS } from '../../games/gameData'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

const ROUNDS    = 8
const ROUND_SEC = 20
const REVEAL_MS = 2500

type Phase = 'playing' | 'reveal' | 'ended'

interface NREvent {
  type:         'nr_start' | 'nr_solved' | 'nr_timeout' | 'nr_end'
  roundIndex?:  number
  serverTs?:    string
  digits?:      [number, number, number, number]
  target?:      number
  example?:     string
  winnerId?:    string
  expression?:  string
  solveTimeMs?: number
  pointsEarned?: number
  finalScores?:  Record<string, number>
  finalWins?:    Record<string, number>
}

function pickRounds(count: number) {
  const pool = [...NUMBER_RUSH_ROUNDS]
  const out: typeof NUMBER_RUSH_ROUNDS = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

// Simple calculator input: tap digits and operators to build expression
const OPS = ['+', '-', '×', '÷', '(', ')']

export default function NumberRushMP({ roomId, myId, players, onGameOver }: MPGameProps) {
  const isOrchestrator = players[0]?.player_id === myId

  const [roundIndex,   setRoundIndex]   = useState(0)
  const [phase,        setPhase]        = useState<Phase>('playing')
  const [serverTs,     setServerTs]     = useState<string | null>(null)
  const [digits,       setDigits]       = useState<[number, number, number, number] | null>(null)
  const [target,       setTarget]       = useState<number | null>(null)
  const [example,      setExample]      = useState<string>('')
  const [expression,   setExpression]   = useState('')
  const [exprError,    setExprError]    = useState<string | null>(null)
  const [roundWinner,  setRoundWinner]  = useState<{ id: string; expr: string; ms: number; pts: number } | null>(null)
  const [scores,       setScores]       = useState<Record<string, number>>({})
  const [timeLeft,     setTimeLeft]     = useState(ROUND_SEC)
  const [results,      setResults]      = useState<PlayerResult[] | null>(null)
  const [roundLocked,  setRoundLocked]  = useState(false)

  const channelRef    = useRef<RealtimeChannel | null>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundsRef     = useRef<typeof NUMBER_RUSH_ROUNDS>([])
  const scoresRef     = useRef<Record<string, number>>({})
  const winsRef       = useRef<Record<string, number>>({})

  function runDisplayTimer(ts: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const { remainingMs } = getRoundTimeState(ts, ROUND_SEC)
      setTimeLeft(Math.ceil(remainingMs / 1000))
      if (remainingMs <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 100)
  }

  const startRound = useCallback((idx: number, rs: typeof NUMBER_RUSH_ROUNDS) => {
    if (!channelRef.current || idx >= rs.length) return
    const r  = rs[idx]
    const ts = new Date().toISOString()
    channelRef.current.send({
      type: 'broadcast', event: 'nr_event',
      payload: { type: 'nr_start', roundIndex: idx, serverTs: ts, digits: r.digits, target: r.target, example: r.example } as NREvent,
    })
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    roundTimerRef.current = setTimeout(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'nr_event', payload: { type: 'nr_timeout', roundIndex: idx } as NREvent })
    }, (ROUND_SEC + 0.5) * 1000)
  }, [])

  useEffect(() => {
    const channel = supabase.channel(`nr:${roomId}`, { config: { broadcast: { self: true } } })
    channelRef.current = channel

    channel.on('broadcast', { event: 'nr_event' }, ({ payload }) => {
      const ev = payload as NREvent

      if (ev.type === 'nr_start' && ev.serverTs && ev.digits && ev.target !== undefined) {
        setRoundIndex(ev.roundIndex ?? 0)
        setDigits(ev.digits)
        setTarget(ev.target)
        setExample(ev.example ?? '')
        setServerTs(ev.serverTs)
        setExpression('')
        setExprError(null)
        setRoundWinner(null)
        setRoundLocked(false)
        setPhase('playing')
        runDisplayTimer(ev.serverTs)
      }

      if (ev.type === 'nr_solved' && ev.winnerId) {
        if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        setRoundLocked(true)
        setRoundWinner({ id: ev.winnerId, expr: ev.expression ?? '', ms: ev.solveTimeMs ?? 0, pts: ev.pointsEarned ?? 0 })
        setPhase('reveal')

        const newScores = { ...scoresRef.current }
        const newWins   = { ...winsRef.current }
        newScores[ev.winnerId] = (newScores[ev.winnerId] ?? 0) + (ev.pointsEarned ?? 0)
        newWins[ev.winnerId]   = (newWins[ev.winnerId] ?? 0) + 1
        scoresRef.current = newScores
        winsRef.current   = newWins
        setScores(newScores)

        setTimeout(() => {
          const next = (ev.roundIndex ?? 0) + 1
          if (next >= ROUNDS) {
            if (isOrchestrator) channel.send({ type: 'broadcast', event: 'nr_event', payload: { type: 'nr_end', finalScores: scoresRef.current, finalWins: winsRef.current } as NREvent })
          } else if (isOrchestrator) startRound(next, roundsRef.current)
        }, REVEAL_MS)
      }

      if (ev.type === 'nr_timeout') {
        if (timerRef.current) clearInterval(timerRef.current)
        setRoundLocked(true)
        setPhase('reveal')
        setTimeout(() => {
          const next = (ev.roundIndex ?? 0) + 1
          if (next >= ROUNDS) {
            if (isOrchestrator) channel.send({ type: 'broadcast', event: 'nr_event', payload: { type: 'nr_end', finalScores: scoresRef.current, finalWins: winsRef.current } as NREvent })
          } else if (isOrchestrator) startRound(next, roundsRef.current)
        }, REVEAL_MS)
      }

      if (ev.type === 'nr_end' && ev.finalScores && ev.finalWins) {
        const rank: GameRank = 'beginner'
        const rankCfg = getRankConfig(rank)
        const playerResults: PlayerResult[] = players.map(p => {
          const score   = ev.finalScores![p.player_id] ?? 0
          const correct = ev.finalWins![p.player_id] ?? 0
          const xp      = calcSessionXP(correct, ROUNDS, 0, rankCfg.xpBase)
          return { playerId: p.player_id, displayName: p.display_name || p.username, score, correct, total: ROUNDS, streak: 0, rank, xpEarned: xp }
        })
        setResults(playerResults)
        onGameOver()
      }
    })

    channel.subscribe(() => {
      if (isOrchestrator) {
        const rs = pickRounds(ROUNDS)
        roundsRef.current = rs
        startRound(0, rs)
      }
    })

    return () => { channel.unsubscribe(); if (timerRef.current) clearInterval(timerRef.current); if (roundTimerRef.current) clearTimeout(roundTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function appendToExpr(val: string) {
    setExpression(prev => prev + val)
    setExprError(null)
  }

  function handleSubmit() {
    if (roundLocked || phase !== 'playing' || !digits || target === null || !serverTs) return
    const op = expression.replace(/×/g, '*').replace(/÷/g, '/')
    const { valid, reason } = validateNumberRushExpression(op, digits, target)
    if (!valid) { setExprError(reason ?? 'Invalid'); return }
    const solveTimeMs = Date.now() - new Date(serverTs).getTime()
    const pts         = 100 + Math.max(0, 50 - Math.floor(solveTimeMs / 200))
    channelRef.current?.send({
      type: 'broadcast', event: 'nr_event',
      payload: { type: 'nr_solved', roundIndex, winnerId: myId, expression, solveTimeMs, pointsEarned: pts } as NREvent,
    })
  }

  if (results) {
    return <MultiplayerResults gameName="Number Rush" gameEmoji="🔥" myId={myId} players={results} teamMode="ffa" onPlayAgain={() => window.location.reload()} />
  }

  const winnerName = roundWinner ? (players.find(p => p.player_id === roundWinner.id)?.display_name || players.find(p => p.player_id === roundWinner.id)?.username || 'Player') : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>🔥 Number Rush</span>
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--surface2)', color: '#ff4d8b' }}>Round {roundIndex + 1}/{ROUNDS}</span>
        <span className="text-xs font-mono" style={{ color: timeLeft <= 5 ? '#ff4f4f' : 'var(--text-muted)' }}>{timeLeft}s</span>
      </div>

      <div className="h-1" style={{ background: 'var(--surface2)' }}>
        <div className="h-full" style={{ width: `${(timeLeft / ROUND_SEC) * 100}%`, background: timeLeft <= 5 ? '#ff4f4f' : '#ff4d8b', transition: 'width 0.1s linear' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-4 max-w-md mx-auto w-full">
        {digits && target !== null ? (
          <>
            {/* Target */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Make this number</p>
              <p className="font-extrabold text-5xl font-mono" style={{ color: '#ff4d8b' }}>{target}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>using all 4 digits with +  −  ×  ÷</p>
            </div>

            {/* Digits */}
            <div className="flex gap-3">
              {digits.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => !roundLocked && appendToExpr(String(d))}
                  className="w-14 h-14 rounded-2xl font-extrabold text-2xl font-mono transition-all"
                  style={{
                    background: 'var(--surface)',
                    border: '2px solid rgba(255,77,139,0.3)',
                    color: '#ff4d8b',
                    cursor: roundLocked ? 'default' : 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Expression display */}
            <div className="w-full rounded-xl px-4 py-3 font-mono text-lg min-h-[48px] text-center"
              style={{ background: 'var(--surface)', border: `1px solid ${exprError ? '#ff4f4f' : 'rgba(255,77,139,0.2)'}`, color: 'var(--text)' }}>
              {expression || <span style={{ color: 'var(--text-muted)' }}>tap digits & operators…</span>}
            </div>
            {exprError && <p className="text-xs" style={{ color: '#ff4f4f' }}>{exprError}</p>}

            {/* Operators */}
            <div className="grid grid-cols-6 gap-2 w-full">
              {OPS.map(op => (
                <button key={op} type="button" onClick={() => !roundLocked && appendToExpr(op)}
                  className="py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: 'none', cursor: roundLocked ? 'default' : 'pointer' }}>
                  {op}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => setExpression(prev => prev.slice(0, -1))} disabled={roundLocked}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: 'none', cursor: roundLocked ? 'default' : 'pointer' }}>
                ⌫
              </button>
              <button type="button" onClick={() => setExpression('')} disabled={roundLocked}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: 'none', cursor: roundLocked ? 'default' : 'pointer' }}>
                Clear
              </button>
              <button type="button" onClick={handleSubmit} disabled={roundLocked || !expression}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: !roundLocked && expression ? 'linear-gradient(135deg, #ff4d8b, #ff9a3c)' : 'var(--surface2)', color: !roundLocked && expression ? '#fff' : 'var(--text-muted)', border: 'none', cursor: !roundLocked && expression ? 'pointer' : 'not-allowed' }}>
                Submit
              </button>
            </div>

            {/* Reveal banner */}
            {phase === 'reveal' && (
              <div className="w-full rounded-2xl p-4 text-center"
                style={{ background: roundWinner ? 'rgba(62,207,142,0.1)' : 'rgba(255,79,79,0.1)', border: `1px solid ${roundWinner ? 'rgba(62,207,142,0.3)' : 'rgba(255,79,79,0.3)'}` }}>
                {roundWinner ? (
                  <>
                    <p className="font-bold text-sm" style={{ color: '#3ecf8e' }}>🏆 {winnerName} solved it!</p>
                    <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{roundWinner.expr} = {target}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#3ecf8e' }}>+{roundWinner.pts} pts</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm" style={{ color: '#ff4f4f' }}>Nobody solved it in time</p>
                    <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Example: {example}</p>
                  </>
                )}
              </div>
            )}

            {/* Scores */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[...players].sort((a, b) => (scores[b.player_id] ?? 0) - (scores[a.player_id] ?? 0)).map(p => (
                <div key={p.player_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: p.player_id === myId ? 'rgba(255,77,139,0.1)' : 'var(--surface2)', color: p.player_id === myId ? '#ff4d8b' : 'var(--text-dim)', border: `1px solid ${p.player_id === myId ? 'rgba(255,77,139,0.3)' : 'transparent'}` }}>
                  {(p.display_name || p.username).split(' ')[0]}
                  <span className="font-mono">{scores[p.player_id] ?? 0}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading puzzle…</p>
        )}
      </div>
    </div>
  )
}
