// src/pages/multiplayer/games/BluffBidMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import { calcBluffBidRoundScores, getRoundTimeState, calcTeamScores, teamXpMultiplier } from '../raceEngine'
import { BLUFF_BID_DATA } from '../../games/gameData'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

const ROUNDS    = 8
const ROUND_SEC = 15
const REVEAL_MS = 3000

type Phase = 'playing' | 'reveal' | 'ended'

interface BluffEvent {
  type:          'bluff_start' | 'bluff_answer' | 'bluff_reveal' | 'bluff_end'
  roundIndex?:   number
  serverTs?:     string
  fact?:         string
  unit?:         string
  trueValue?:    number
  playerId?:     string
  guess?:        number
  revealGuesses?: Record<string, number>
  revealScores?:  Record<string, number>
  finalScores?:  Record<string, number>
  finalCorrect?: Record<string, number>
}

function pickFacts(count: number) {
  const pool = [...BLUFF_BID_DATA]
  const out: typeof BLUFF_BID_DATA = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

export default function BluffBidMP({ roomId, myId, players, room, onGameOver }: MPGameProps) {
  const isOrchestrator = players[0]?.player_id === myId
  const teamMode       = (room.team_mode ?? 'ffa') as 'ffa' | '2v2'
  const teams          = Object.fromEntries(players.map(p => [p.player_id, p.team ?? null])) as Record<string, 'A' | 'B' | null>

  const [roundIndex,   setRoundIndex]   = useState(0)
  const [phase,        setPhase]        = useState<Phase>('playing')
  const [serverTs,     setServerTs]     = useState<string | null>(null)
  const [currentFact,  setCurrentFact]  = useState<{ fact: string; unit: string; trueValue: number } | null>(null)
  const [inputVal,     setInputVal]     = useState('')
  const [submitted,    setSubmitted]    = useState(false)
  const [revealGuesses,setRevealGuesses]= useState<Record<string, number> | null>(null)
  const [revealScores, setRevealScores] = useState<Record<string, number> | null>(null)
  const [scores,       setScores]       = useState<Record<string, number>>({})
  const [timeLeft,     setTimeLeft]     = useState(ROUND_SEC)
  const [results,      setResults]      = useState<PlayerResult[] | null>(null)

  const channelRef    = useRef<RealtimeChannel | null>(null)
  const guessesRef    = useRef<Record<string, number>>({})
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const factsRef      = useRef<typeof BLUFF_BID_DATA>([])
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

  const resolveRound = useCallback((idx: number) => {
    if (!channelRef.current) return
    const fact = factsRef.current[idx]
    if (!fact) return

    // Fill in missing players with worst penalty (0 guess → max distance)
    const allGuesses: Record<string, number> = {}
    for (const p of players) {
      allGuesses[p.player_id] = guessesRef.current[p.player_id] ?? 0
    }

    const roundScores = calcBluffBidRoundScores(allGuesses, fact.trueValue)

    channelRef.current.send({
      type: 'broadcast', event: 'bluff_event',
      payload: { type: 'bluff_reveal', roundIndex: idx, revealGuesses: allGuesses, revealScores: roundScores, trueValue: fact.trueValue } as BluffEvent,
    })
    guessesRef.current = {}
  }, [players])

  const startRound = useCallback((idx: number, fs: typeof BLUFF_BID_DATA) => {
    if (!channelRef.current || idx >= fs.length) return
    const f  = fs[idx]
    const ts = new Date().toISOString()
    channelRef.current.send({
      type: 'broadcast', event: 'bluff_event',
      payload: { type: 'bluff_start', roundIndex: idx, serverTs: ts, fact: f.fact, unit: f.unit, trueValue: f.trueValue } as BluffEvent,
    })
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    roundTimerRef.current = setTimeout(() => resolveRound(idx), (ROUND_SEC + 0.5) * 1000)
  }, [resolveRound])

  useEffect(() => {
    const channel = supabase.channel(`bluff:${roomId}`, { config: { broadcast: { self: true } } })
    channelRef.current = channel

    channel.on('broadcast', { event: 'bluff_event' }, ({ payload }) => {
      const ev = payload as BluffEvent

      if (ev.type === 'bluff_start' && ev.serverTs && ev.fact) {
        setRoundIndex(ev.roundIndex ?? 0)
        setCurrentFact({ fact: ev.fact, unit: ev.unit ?? '', trueValue: ev.trueValue ?? 0 })
        setServerTs(ev.serverTs)
        setInputVal('')
        setSubmitted(false)
        setRevealGuesses(null)
        setRevealScores(null)
        setPhase('playing')
        runDisplayTimer(ev.serverTs)
      }

      if (ev.type === 'bluff_answer' && ev.playerId && isOrchestrator) {
        guessesRef.current[ev.playerId] = ev.guess ?? 0
        if (Object.keys(guessesRef.current).length >= players.length) {
          if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
          resolveRound(ev.roundIndex ?? 0)
        }
      }

      if (ev.type === 'bluff_reveal' && ev.revealGuesses && ev.revealScores) {
        setPhase('reveal')
        setRevealGuesses(ev.revealGuesses)
        setRevealScores(ev.revealScores)
        if (timerRef.current) clearInterval(timerRef.current)

        // Accumulate
        const newScores = { ...scoresRef.current }
        const newWins   = { ...winsRef.current }
        for (const [pid, pts] of Object.entries(ev.revealScores)) {
          newScores[pid] = (newScores[pid] ?? 0) + pts
          if (pts === 100) newWins[pid] = (newWins[pid] ?? 0) + 1
        }
        scoresRef.current = newScores
        winsRef.current   = newWins
        setScores(newScores)

        setTimeout(() => {
          const next = (ev.roundIndex ?? 0) + 1
          if (next >= ROUNDS) {
            if (isOrchestrator) channelRef.current?.send({
              type: 'broadcast', event: 'bluff_event',
              payload: { type: 'bluff_end', finalScores: scoresRef.current, finalCorrect: winsRef.current } as BluffEvent,
            })
          } else if (isOrchestrator) startRound(next, factsRef.current)
        }, REVEAL_MS)
      }

      if (ev.type === 'bluff_end' && ev.finalScores && ev.finalCorrect) {
        const rank: GameRank = 'beginner'
        const rankCfg = getRankConfig(rank)
        const teamScores = teamMode === '2v2' ? calcTeamScores(ev.finalScores, teams) : null
        const winTeam    = teamScores ? (teamScores.teamA > teamScores.teamB ? 'A' : teamScores.teamB > teamScores.teamA ? 'B' : 'draw') : null
        const playerResults: PlayerResult[] = players.map(p => {
          const score   = ev.finalScores![p.player_id] ?? 0
          const correct = ev.finalCorrect![p.player_id] ?? 0
          const mult    = teamMode === '2v2' ? teamXpMultiplier(p.player_id, teams, winTeam as 'A' | 'B' | 'draw' | null) : 1.0
          const xp      = Math.round(calcSessionXP(correct, ROUNDS, 0, rankCfg.xpBase) * mult)
          return { playerId: p.player_id, displayName: p.display_name || p.username, score, correct, total: ROUNDS, streak: 0, rank, xpEarned: xp, team: p.team }
        })
        setResults(playerResults)
        onGameOver()
      }
    })

    channel.subscribe(() => {
      if (isOrchestrator) {
        const fs = pickFacts(ROUNDS)
        factsRef.current = fs
        startRound(0, fs)
      }
    })

    return () => { channel.unsubscribe(); if (timerRef.current) clearInterval(timerRef.current); if (roundTimerRef.current) clearTimeout(roundTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function handleSubmit() {
    if (submitted || phase !== 'playing' || !serverTs) return
    const num = parseFloat(inputVal.replace(/,/g, ''))
    if (isNaN(num)) return
    setSubmitted(true)
    guessesRef.current[myId] = num
    channelRef.current?.send({
      type: 'broadcast', event: 'bluff_event',
      payload: { type: 'bluff_answer', roundIndex, playerId: myId, guess: num, serverTs } as BluffEvent,
    })
  }

  if (results) {
    return <MultiplayerResults gameName="Bluff Bid" gameEmoji="🎯" myId={myId} players={results} teamMode={teamMode} onPlayAgain={() => window.location.reload()} />
  }

  const trueVal = currentFact?.trueValue ?? 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>🎯 Bluff Bid</span>
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--surface2)', color: '#f5c542' }}>Round {roundIndex + 1}/{ROUNDS}</span>
        <span className="text-xs font-mono" style={{ color: timeLeft <= 5 ? '#ff4f4f' : 'var(--text-muted)' }}>{timeLeft}s</span>
      </div>

      <div className="h-1" style={{ background: 'var(--surface2)' }}>
        <div className="h-full" style={{ width: `${(timeLeft / ROUND_SEC) * 100}%`, background: timeLeft <= 5 ? '#ff4f4f' : '#f5c542', transition: 'width 0.1s linear' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 max-w-md mx-auto w-full">
        {currentFact ? (
          <>
            <div className="w-full rounded-2xl p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid rgba(245,197,66,0.2)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#f5c542' }}>Estimate this</p>
              <p className="font-bold text-lg leading-snug" style={{ color: 'var(--text)' }}>{currentFact.fact}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>in {currentFact.unit}</p>
            </div>

            {/* Input */}
            {!revealGuesses ? (
              <div className="w-full flex gap-2">
                <input
                  type="number"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder={`Your guess (${currentFact.unit})`}
                  disabled={submitted}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-mono outline-none"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${submitted ? 'rgba(62,207,142,0.4)' : 'rgba(245,197,66,0.3)'}`,
                    color: 'var(--text)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitted || !inputVal.trim()}
                  className="px-5 py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: submitted ? 'var(--surface2)' : 'linear-gradient(135deg, #f5c542, #ff9a3c)',
                    color: submitted ? 'var(--text-muted)' : '#000',
                    border: 'none',
                    cursor: submitted ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitted ? '✓' : 'Lock In'}
                </button>
              </div>
            ) : (
              /* Reveal */
              <div className="w-full space-y-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.25)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>True answer</p>
                  <p className="font-extrabold text-2xl font-mono" style={{ color: '#3ecf8e' }}>
                    {trueVal.toLocaleString()} <span className="text-sm font-semibold">{currentFact.unit}</span>
                  </p>
                </div>

                {/* Number line / ranked list */}
                <div className="w-full rounded-2xl p-4 space-y-2" style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {players
                    .sort((a, b) => (revealScores?.[b.player_id] ?? 0) - (revealScores?.[a.player_id] ?? 0))
                    .map(p => {
                      const guess = revealGuesses[p.player_id] ?? 0
                      const pts   = revealScores?.[p.player_id] ?? 0
                      const isMe  = p.player_id === myId
                      const won   = pts === 100
                      return (
                        <div key={p.player_id} className="flex items-center justify-between gap-3">
                          <span className="text-sm truncate" style={{ color: isMe ? '#f5c542' : 'var(--text-dim)', fontWeight: isMe ? 700 : 400 }}>
                            {won ? '🏆 ' : ''}{p.display_name || p.username}
                          </span>
                          <span className="font-mono text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                            {guess.toLocaleString()}
                          </span>
                          <span className="font-bold text-sm font-mono flex-shrink-0" style={{ color: won ? '#3ecf8e' : pts > 0 ? '#f5c542' : '#ff4f4f' }}>
                            +{pts}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Running scores */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[...players].sort((a, b) => (scores[b.player_id] ?? 0) - (scores[a.player_id] ?? 0)).map(p => (
                <div key={p.player_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: p.player_id === myId ? 'rgba(245,197,66,0.1)' : 'var(--surface2)', color: p.player_id === myId ? '#f5c542' : 'var(--text-dim)', border: `1px solid ${p.player_id === myId ? 'rgba(245,197,66,0.3)' : 'transparent'}` }}>
                  {(p.display_name || p.username).split(' ')[0]}
                  <span className="font-mono">{scores[p.player_id] ?? 0}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        )}
      </div>
    </div>
  )
}
