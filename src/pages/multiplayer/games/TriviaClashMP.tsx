// src/pages/multiplayer/games/TriviaClashMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import { TRIVIA_QUESTIONS } from '../../games/gameData'
import { calcRaceRoundScore, getRoundTimeState, broadcastRaceEvent } from '../raceEngine'
import type { RoundRevealPayload, PlayerRoundResult } from '../raceEngine'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

const ROUNDS      = 10
const ROUND_SEC   = 8
const REVEAL_SEC  = 2200
const ACCENT      = '#4f8ef7'

interface TriviaQuestion {
  question: string
  options: string[]
  answer: number
}

function pickQuestions(count: number): TriviaQuestion[] {
  const pool = [...TRIVIA_QUESTIONS]
  const picked: TriviaQuestion[] = []
  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    const q   = pool.splice(idx, 1)[0]
    picked.push({
      question: q.q,
      options:  q.a,
      answer:   q.correct,
    })
  }
  return picked
}

type Phase = 'playing' | 'reveal' | 'ended'

interface RaceEvent {
  type: 'trivia_start' | 'trivia_answer' | 'trivia_reveal' | 'trivia_end'
  roundIndex?: number
  serverTs?: string
  questionData?: TriviaQuestion
  playerId?: string
  answerIdx?: number
  results?: PlayerRoundResult[]
  correctAnswer?: number
  finalScores?: Record<string, number>
  finalCorrect?: Record<string, number>
  questions?: TriviaQuestion[]
}

export default function TriviaClashMP({ roomId, myId, players, onGameOver }: MPGameProps) {
  const isOrchestrator = players[0]?.player_id === myId

  const [questions,    setQuestions]    = useState<TriviaQuestion[]>([])
  const [roundIndex,   setRoundIndex]   = useState(0)
  const [phase,        setPhase]        = useState<Phase>('playing')
  const [roundServerTs,setRoundServerTs]= useState<string | null>(null)
  const [currentQ,     setCurrentQ]     = useState<TriviaQuestion | null>(null)
  const [selected,     setSelected]     = useState<number | null>(null)
  const [revealData,   setRevealData]   = useState<RoundRevealPayload | null>(null)
  const [scores,       setScores]       = useState<Record<string, number>>({})
  const [correctCount, setCorrectCount] = useState<Record<string, number>>({})
  const [results,      setResults]      = useState<PlayerResult[] | null>(null)
  const [timeLeft,     setTimeLeft]     = useState(ROUND_SEC)

  const channelRef    = useRef<RealtimeChannel | null>(null)
  const answersRef    = useRef<Record<string, { answerIdx: number; responseMs: number }>>({})
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Timer display ──
  function runDisplayTimer(serverTs: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const { remainingMs } = getRoundTimeState(serverTs, ROUND_SEC)
      setTimeLeft(Math.ceil(remainingMs / 1000))
      if (remainingMs <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setTimeLeft(0)
      }
    }, 100)
  }

  // ── Resolve round (orchestrator) ──
  const resolveRound = useCallback((idx: number, qs: TriviaQuestion[]) => {
    if (!channelRef.current) return
    const q       = qs[idx]
    const results: PlayerRoundResult[] = players.map(p => {
      const a = answersRef.current[p.player_id]
      const correct = a !== undefined && a.answerIdx === q.answer
      const points  = a ? calcRaceRoundScore(correct, a.responseMs) : 0
      return {
        playerId:    p.player_id,
        answer:      a?.answerIdx ?? null,
        responseMs:  a?.responseMs ?? ROUND_SEC * 1000,
        pointsEarned: points,
        correct,
      }
    })

    broadcastRaceEvent(channelRef.current, {
      type: 'round_reveal',
      roundIndex: idx,
      correctAnswer: q.answer,
      results,
    })

    answersRef.current = {}
  }, [players])

  // ── Start a round (orchestrator) ──
  const startRound = useCallback((idx: number, qs: TriviaQuestion[]) => {
    if (!channelRef.current || idx >= qs.length) return
    const serverTs = new Date().toISOString()
    channelRef.current.send({
      type: 'broadcast', event: 'trivia_event',
      payload: {
        type: 'trivia_start',
        roundIndex: idx,
        serverTs,
        questionData: qs[idx],
      } as RaceEvent,
    })
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    roundTimerRef.current = setTimeout(() => resolveRound(idx, qs), (ROUND_SEC + 0.5) * 1000)
  }, [resolveRound])

  // ── End match ──
  const endMatch = useCallback((finalScores: Record<string, number>, finalCorrect: Record<string, number>) => {
    if (!channelRef.current) return
    channelRef.current.send({
      type: 'broadcast', event: 'trivia_event',
      payload: { type: 'trivia_end', finalScores, finalCorrect } as RaceEvent,
    })
  }, [])

  // ── Channel ──
  useEffect(() => {
    const channel = supabase.channel(`trivia:${roomId}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel.on('broadcast', { event: 'trivia_event' }, ({ payload }) => {
      const ev = payload as RaceEvent

      if (ev.type === 'trivia_start' && ev.questionData && ev.serverTs !== undefined) {
        setRoundIndex(ev.roundIndex ?? 0)
        setCurrentQ(ev.questionData)
        setRoundServerTs(ev.serverTs)
        setSelected(null)
        setRevealData(null)
        setPhase('playing')
        runDisplayTimer(ev.serverTs)
      }

      if (ev.type === 'trivia_answer' && ev.playerId) {
        if (isOrchestrator) {
          answersRef.current[ev.playerId] = {
            answerIdx:  ev.answerIdx ?? -1,
            responseMs: ev.serverTs ? Date.now() - new Date(ev.serverTs).getTime() : ROUND_SEC * 1000,
          }
          if (Object.keys(answersRef.current).length >= players.length) {
            if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
            resolveRound(ev.roundIndex ?? 0, questions.length > 0 ? questions : [])
          }
        }
      }

      if (ev.type === 'trivia_reveal' || (payload as { type: string }).type === 'round_reveal') {
        const reveal = payload as unknown as RoundRevealPayload
        setPhase('reveal')
        setRevealData(reveal)
        if (timerRef.current) clearInterval(timerRef.current)

        // Accumulate scores
        setScores(prev => {
          const next = { ...prev }
          for (const r of reveal.results) next[r.playerId] = (next[r.playerId] ?? 0) + r.pointsEarned
          return next
        })
        setCorrectCount(prev => {
          const next = { ...prev }
          for (const r of reveal.results) if (r.correct) next[r.playerId] = (next[r.playerId] ?? 0) + 1
          return next
        })

        setTimeout(() => {
          const nextIdx = reveal.roundIndex + 1
          if (nextIdx >= ROUNDS) {
            setPhase('ended')
            if (isOrchestrator) endMatch(scores, correctCount)
          } else if (isOrchestrator) {
            setQuestions(prev => { startRound(nextIdx, prev); return prev })
          }
        }, REVEAL_SEC)
      }

      if (ev.type === 'trivia_end' && ev.finalScores && ev.finalCorrect) {
        const rank: GameRank = 'beginner'
        const rankCfg = getRankConfig(rank)
        const playerResults: PlayerResult[] = players.map(p => {
          const score   = ev.finalScores![p.player_id] ?? 0
          const correct = ev.finalCorrect![p.player_id] ?? 0
          const xp      = calcSessionXP(correct, ROUNDS, 0, rankCfg.xpBase)
          return {
            playerId:    p.player_id,
            displayName: p.display_name || p.username,
            score, correct, total: ROUNDS, streak: 0, rank, xpEarned: xp,
          }
        })
        setResults(playerResults)
        onGameOver()
      }
    })

    channel.subscribe(() => {
      if (isOrchestrator) {
        const qs = pickQuestions(ROUNDS)
        setQuestions(qs)
        startRound(0, qs)
      }
    })

    return () => {
      channel.unsubscribe()
      if (timerRef.current) clearInterval(timerRef.current)
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function handleAnswer(idx: number) {
    if (selected !== null || phase !== 'playing' || !roundServerTs) return
    setSelected(idx)
    const responseMs = Date.now() - new Date(roundServerTs).getTime()
    channelRef.current?.send({
      type: 'broadcast', event: 'trivia_event',
      payload: {
        type: 'trivia_answer',
        roundIndex,
        playerId: myId,
        answerIdx: idx,
        serverTs: roundServerTs,
      } as RaceEvent,
    })
    // Optimistic answer store for orchestrator self-tracking
    answersRef.current[myId] = { answerIdx: idx, responseMs }
  }

  if (results) {
    return (
      <MultiplayerResults
        gameName="Trivia Clash"
        gameEmoji="🧠"
        myId={myId}
        players={results}
        teamMode="ffa"
        onPlayAgain={() => window.location.reload()}
      />
    )
  }

  const answeredIds = revealData?.results.map(r => r.playerId) ?? []

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* HUD */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          🧠 Trivia Clash
        </span>
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--surface2)', color: ACCENT }}>
          Q {roundIndex + 1}/{ROUNDS}
        </span>
        <div className="flex gap-1">
          {players.map(p => (
            <div
              key={p.player_id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                background: answeredIds.includes(p.player_id) ? '#3ecf8e' : 'var(--surface2)',
                border: `1.5px solid ${p.player_id === myId ? ACCENT : 'transparent'}`,
                opacity: p.player_id === myId ? 1 : 0.7,
              }}
              title={p.display_name || p.username}
            >
              {(p.display_name || p.username).charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-1" style={{ background: 'var(--surface2)' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${(timeLeft / ROUND_SEC) * 100}%`,
            background: timeLeft <= 3 ? '#ff4f4f' : ACCENT,
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">
        {currentQ ? (
          <>
            <div
              className="w-full rounded-2xl p-5 text-center"
              style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="font-bold text-base leading-snug" style={{ color: 'var(--text)' }}>
                {currentQ.question}
              </p>
              <p className="text-xs mt-2 font-mono" style={{ color: timeLeft <= 3 ? '#ff4f4f' : 'var(--text-muted)' }}>
                {timeLeft}s
              </p>
            </div>

            <div className="w-full grid grid-cols-1 gap-3">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selected === idx
                const isCorrect  = revealData && idx === revealData.correctAnswer
                const isWrong    = revealData && isSelected && !isCorrect

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswer(idx)}
                    disabled={selected !== null || phase === 'reveal'}
                    className="w-full rounded-xl px-4 py-3 text-left font-semibold text-sm transition-all duration-150"
                    style={{
                      background: isCorrect
                        ? 'rgba(62,207,142,0.2)'
                        : isWrong
                        ? 'rgba(255,79,79,0.15)'
                        : isSelected
                        ? `rgba(79,142,247,0.2)`
                        : 'var(--surface)',
                      border: isCorrect
                        ? '1.5px solid #3ecf8e'
                        : isWrong
                        ? '1.5px solid #ff4f4f'
                        : isSelected
                        ? `1.5px solid ${ACCENT}`
                        : '1.5px solid rgba(255,255,255,0.07)',
                      color: 'var(--text)',
                      cursor: selected !== null ? 'default' : 'pointer',
                    }}
                  >
                    <span
                      className="inline-block w-6 h-6 rounded-lg mr-2 text-center text-xs font-bold leading-6"
                      style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
                    >
                      {['A','B','C','D'][idx]}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Reveal: show who got it right */}
            {revealData && (
              <div className="w-full rounded-2xl p-4 space-y-2"
                style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Results</p>
                {revealData.results
                  .sort((a, b) => b.pointsEarned - a.pointsEarned)
                  .map(r => {
                    const p = players.find(pl => pl.player_id === r.playerId)
                    return (
                      <div key={r.playerId} className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: r.playerId === myId ? ACCENT : 'var(--text-dim)' }}>
                          {p?.display_name || p?.username || 'Player'}
                        </span>
                        <span className="text-sm font-bold font-mono" style={{ color: r.correct ? '#3ecf8e' : '#ff4f4f' }}>
                          {r.correct ? `+${r.pointsEarned}` : '0'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Live scores */}
            <div className="w-full flex gap-2 flex-wrap justify-center">
              {[...players]
                .sort((a, b) => (scores[b.player_id] ?? 0) - (scores[a.player_id] ?? 0))
                .map(p => (
                  <div
                    key={p.player_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{
                      background: p.player_id === myId ? `rgba(79,142,247,0.12)` : 'var(--surface2)',
                      color: p.player_id === myId ? ACCENT : 'var(--text-dim)',
                      border: `1px solid ${p.player_id === myId ? `rgba(79,142,247,0.3)` : 'transparent'}`,
                    }}
                  >
                    {(p.display_name || p.username).split(' ')[0]}
                    <span className="font-mono">{scores[p.player_id] ?? 0}</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading questions…</p>
        )}
      </div>
    </div>
  )
}
