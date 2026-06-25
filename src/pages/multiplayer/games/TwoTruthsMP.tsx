// src/pages/multiplayer/games/TwoTruthsMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import { calcRaceRoundScore, getRoundTimeState, calcTeamScores, teamXpMultiplier } from '../raceEngine'
import type { PlayerRoundResult } from '../raceEngine'
import { TWO_TRUTHS_DATA } from '../../games/gameData'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

const ROUNDS    = 8
const ROUND_SEC = 12
const REVEAL_MS = 2400

interface TTRound { statements: string[]; lieIndex: number }

function pickRounds(count: number): TTRound[] {
  const pool = [...TWO_TRUTHS_DATA]
  const out: TTRound[] = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    const item = pool.splice(idx, 1)[0]
    // TWO_TRUTHS_DATA shape: { statements: string[], lieIndex: number }
    out.push({ statements: item.statements, lieIndex: item.falseIdx })
  }
  return out
}

type Phase = 'playing' | 'reveal' | 'ended'

interface TTEvent {
  type: 'tt_start' | 'tt_answer' | 'tt_reveal' | 'tt_end'
  roundIndex?:   number
  serverTs?:     string
  round?:        TTRound
  playerId?:     string
  chosenIdx?:    number
  results?:      PlayerRoundResult[]
  lieIndex?:     number
  finalScores?:  Record<string, number>
  finalCorrect?: Record<string, number>
}

export default function TwoTruthsMP({ roomId, myId, players, room, onGameOver }: MPGameProps) {
  const isOrchestrator = players[0]?.player_id === myId
  const teamMode       = (room.team_mode ?? 'ffa') as 'ffa' | '2v2'
  const teams          = Object.fromEntries(players.map(p => [p.player_id, p.team ?? null])) as Record<string, 'A' | 'B' | null>

  const [roundIndex,   setRoundIndex]   = useState(0)
  const [currentRound, setCurrentRound] = useState<TTRound | null>(null)
  const [phase,        setPhase]        = useState<Phase>('playing')
  const [serverTs,     setServerTs]     = useState<string | null>(null)
  const [chosen,       setChosen]       = useState<number | null>(null)
  const [revealData,   setRevealData]   = useState<{ results: PlayerRoundResult[]; lie: number } | null>(null)
  const [scores,       setScores]       = useState<Record<string, number>>({})
  const [correctCount, setCorrectCount] = useState<Record<string, number>>({})
  const [timeLeft,     setTimeLeft]     = useState(ROUND_SEC)
  const [results,      setResults]      = useState<PlayerResult[] | null>(null)

  const channelRef    = useRef<RealtimeChannel | null>(null)
  const answersRef    = useRef<Record<string, { chosenIdx: number; responseMs: number }>>({})
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundsRef     = useRef<TTRound[]>([])

  function runDisplayTimer(ts: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const { remainingMs } = getRoundTimeState(ts, ROUND_SEC)
      setTimeLeft(Math.ceil(remainingMs / 1000))
      if (remainingMs <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 100)
  }

  const resolveRound = useCallback((idx: number, lieIdx: number) => {
    if (!channelRef.current) return
    const results: PlayerRoundResult[] = players.map(p => {
      const a       = answersRef.current[p.player_id]
      const correct = a !== undefined && a.chosenIdx === lieIdx
      const points  = a ? calcRaceRoundScore(correct, a.responseMs) : 0
      return { playerId: p.player_id, answer: a?.chosenIdx ?? null, responseMs: a?.responseMs ?? ROUND_SEC * 1000, pointsEarned: points, correct }
    })
    channelRef.current.send({
      type: 'broadcast', event: 'tt_event',
      payload: { type: 'tt_reveal', roundIndex: idx, results, lieIndex: lieIdx } as TTEvent,
    })
    answersRef.current = {}
  }, [players])

  const startRound = useCallback((idx: number, rnds: TTRound[]) => {
    if (!channelRef.current || idx >= rnds.length) return
    const ts = new Date().toISOString()
    channelRef.current.send({
      type: 'broadcast', event: 'tt_event',
      payload: { type: 'tt_start', roundIndex: idx, serverTs: ts, round: rnds[idx] } as TTEvent,
    })
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    roundTimerRef.current = setTimeout(() => resolveRound(idx, rnds[idx].lieIndex), (ROUND_SEC + 0.5) * 1000)
  }, [resolveRound])

  useEffect(() => {
    const channel = supabase.channel(`tt:${roomId}`, { config: { broadcast: { self: true } } })
    channelRef.current = channel

    channel.on('broadcast', { event: 'tt_event' }, ({ payload }) => {
      const ev = payload as TTEvent

      if (ev.type === 'tt_start' && ev.round && ev.serverTs) {
        setRoundIndex(ev.roundIndex ?? 0)
        setCurrentRound(ev.round)
        setServerTs(ev.serverTs)
        setChosen(null)
        setRevealData(null)
        setPhase('playing')
        runDisplayTimer(ev.serverTs)
      }

      if (ev.type === 'tt_answer' && ev.playerId && isOrchestrator) {
        answersRef.current[ev.playerId] = { chosenIdx: ev.chosenIdx ?? -1, responseMs: ev.serverTs ? Date.now() - new Date(ev.serverTs).getTime() : ROUND_SEC * 1000 }
        if (Object.keys(answersRef.current).length >= players.length) {
          if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
          resolveRound(ev.roundIndex ?? 0, roundsRef.current[ev.roundIndex ?? 0]?.lieIndex ?? 0)
        }
      }

      if (ev.type === 'tt_reveal' && ev.results) {
        setPhase('reveal')
        setRevealData({ results: ev.results, lie: ev.lieIndex ?? 0 })
        if (timerRef.current) clearInterval(timerRef.current)
        setScores(prev => { const n = { ...prev }; ev.results!.forEach(r => n[r.playerId] = (n[r.playerId] ?? 0) + r.pointsEarned); return n })
        setCorrectCount(prev => { const n = { ...prev }; ev.results!.forEach(r => { if (r.correct) n[r.playerId] = (n[r.playerId] ?? 0) + 1 }); return n })
        setTimeout(() => {
          const next = (ev.roundIndex ?? 0) + 1
          if (next >= ROUNDS) {
            if (isOrchestrator) channelRef.current?.send({ type: 'broadcast', event: 'tt_event', payload: { type: 'tt_end', finalScores: scores, finalCorrect: correctCount } as TTEvent })
          } else if (isOrchestrator) startRound(next, roundsRef.current)
        }, REVEAL_MS)
      }

      if (ev.type === 'tt_end') {
        const rank: GameRank = 'beginner'
        const rankCfg = getRankConfig(rank)
        const teamScores = teamMode === '2v2' ? calcTeamScores(scores, teams) : null
        const winTeam    = teamScores ? (teamScores.teamA > teamScores.teamB ? 'A' : teamScores.teamB > teamScores.teamA ? 'B' : 'draw') : null
        const playerResults: PlayerResult[] = players.map(p => {
          const score   = scores[p.player_id] ?? 0
          const correct = correctCount[p.player_id] ?? 0
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
        const rnds = pickRounds(ROUNDS)
        roundsRef.current = rnds
        startRound(0, rnds)
      }
    })

    return () => { channel.unsubscribe(); if (timerRef.current) clearInterval(timerRef.current); if (roundTimerRef.current) clearTimeout(roundTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function handleChoose(idx: number) {
    if (chosen !== null || phase !== 'playing' || !serverTs) return
    setChosen(idx)
    const responseMs = Date.now() - new Date(serverTs).getTime()
    answersRef.current[myId] = { chosenIdx: idx, responseMs }
    channelRef.current?.send({
      type: 'broadcast', event: 'tt_event',
      payload: { type: 'tt_answer', roundIndex, playerId: myId, chosenIdx: idx, serverTs } as TTEvent,
    })
  }

  if (results) {
    return <MultiplayerResults gameName="Two Truths & a Lie" gameEmoji="🤥" myId={myId} players={results} teamMode={teamMode} onPlayAgain={() => window.location.reload()} />
  }

  const STATEMENT_LABELS = ['Statement 1', 'Statement 2', 'Statement 3']

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>🤥 Two Truths & a Lie</span>
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--surface2)', color: '#9b6dff' }}>Round {roundIndex + 1}/{ROUNDS}</span>
        <span className="text-xs font-mono" style={{ color: timeLeft <= 3 ? '#ff4f4f' : 'var(--text-muted)' }}>{timeLeft}s</span>
      </div>

      <div className="h-1" style={{ background: 'var(--surface2)' }}>
        <div className="h-full" style={{ width: `${(timeLeft / ROUND_SEC) * 100}%`, background: timeLeft <= 3 ? '#ff4f4f' : '#9b6dff', transition: 'width 0.1s linear' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">
        <p className="font-bold text-base text-center" style={{ color: 'var(--text)' }}>
          Which one is the lie?
        </p>

        {currentRound ? (
          <div className="w-full space-y-3">
            {currentRound.statements.map((stmt, idx) => {
              const isChosen   = chosen === idx
              const isLie      = revealData && idx === revealData.lie
              const isWrong    = revealData && isChosen && !isLie
              const whoChose   = revealData?.results.filter(r => r.answer === idx).map(r => players.find(p => p.player_id === r.playerId)?.display_name?.charAt(0) ?? '?') ?? []

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChoose(idx)}
                  disabled={chosen !== null || phase === 'reveal'}
                  className="w-full rounded-2xl p-4 text-left transition-all duration-150"
                  style={{
                    background: isLie ? 'rgba(255,79,79,0.18)' : isWrong ? 'rgba(255,79,79,0.1)' : isChosen ? 'rgba(155,109,255,0.2)' : 'var(--surface)',
                    border: isLie ? '2px solid #ff4f4f' : isWrong ? '2px solid rgba(255,79,79,0.4)' : isChosen ? '2px solid #9b6dff' : '2px solid rgba(255,255,255,0.07)',
                    cursor: chosen !== null ? 'default' : 'pointer',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: isLie ? '#ff4f4f' : 'var(--text-muted)' }}>
                        {isLie ? '🤥 THE LIE' : STATEMENT_LABELS[idx]}
                      </p>
                      <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>{stmt}</p>
                    </div>
                    {whoChose.length > 0 && (
                      <div className="flex gap-0.5 flex-shrink-0 mt-0.5">
                        {whoChose.map((init, i) => (
                          <span key={i} className="text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold text-white" style={{ background: '#9b6dff' }}>{init}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        )}

        {/* Live scores */}
        <div className="flex gap-2 flex-wrap justify-center">
          {[...players].sort((a, b) => (scores[b.player_id] ?? 0) - (scores[a.player_id] ?? 0)).map(p => (
            <div key={p.player_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: p.player_id === myId ? 'rgba(155,109,255,0.12)' : 'var(--surface2)', color: p.player_id === myId ? '#9b6dff' : 'var(--text-dim)', border: `1px solid ${p.player_id === myId ? 'rgba(155,109,255,0.3)' : 'transparent'}` }}>
              {(p.display_name || p.username).split(' ')[0]}
              <span className="font-mono">{scores[p.player_id] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
