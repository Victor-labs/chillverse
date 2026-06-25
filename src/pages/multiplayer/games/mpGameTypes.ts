// src/pages/multiplayer/games/mpGameTypes.ts
// Shared types and hook consumed by all 7 multiplayer game components

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { GameRoomRow } from '../multiplayerTypes'
import type { RoomPlayerProfile } from '../multiplayerTypes'
import type { RaceEvent, RoundRevealPayload, RoundStartPayload } from '../raceEngine'
import { broadcastRaceEvent } from '../raceEngine'

// ─── Shared props all MP game components receive ──────────────

export interface MPGameProps {
  roomId: string
  myId: string
  players: RoomPlayerProfile[]
  room: GameRoomRow
  broadcast: (event: import('../multiplayerTypes').RealtimeBroadcastEvent) => void
  onGameOver: () => void
}

// ─── useRaceGame — orchestrates round lifecycle for race games ─

export interface UseRaceGameOptions {
  roomId: string
  myId: string
  totalRounds: number
  roundTimerSec: number
  isOrchestrator: boolean   // first-joined player drives round start broadcasts
  onRoundStart: (payload: RoundStartPayload) => void
  onRoundReveal: (payload: RoundRevealPayload) => void
  onMatchEnd: (finalScores: Record<string, number>, finalCorrect: Record<string, number>) => void
}

export interface UseRaceGameReturn {
  roundIndex: number
  phase: 'waiting' | 'playing' | 'reveal' | 'ended'
  roundServerTs: string | null
  submitAnswer: (answer: unknown, correct: boolean, points: number, responseMs: number) => void
  hasAnsweredThisRound: boolean
  channel: RealtimeChannel | null
  startRound: (idx: number, promptData: unknown) => void
}

export function useRaceGame({
  roomId,
  myId,
  totalRounds,
  roundTimerSec,
  isOrchestrator,
  onRoundStart,
  onRoundReveal,
  onMatchEnd,
}: UseRaceGameOptions): UseRaceGameReturn {
  const [roundIndex, setRoundIndex]       = useState(0)
  const [phase, setPhase]                 = useState<'waiting' | 'playing' | 'reveal' | 'ended'>('waiting')
  const [roundServerTs, setRoundServerTs] = useState<string | null>(null)
  const [hasAnswered, setHasAnswered]     = useState(false)

  const channelRef      = useRef<RealtimeChannel | null>(null)
  const answersRef      = useRef<Record<string, { answer: unknown; correct: boolean; points: number; responseMs: number }>>({})
  const playerCountRef  = useRef(0)
  const roundTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef       = useRef<Record<string, number>>({})
  const correctRef      = useRef<Record<string, number>>({})

  // Start a round (orchestrator only)
  const startRound = useCallback((idx: number, promptData: unknown) => {
    if (!channelRef.current) return
    const serverTs = new Date().toISOString()
    const payload: RoundStartPayload = { type: 'round_start', roundIndex: idx, serverTs, promptData }
    broadcastRaceEvent(channelRef.current, payload)

    // Auto-resolve after timer expires
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    roundTimerRef.current = setTimeout(() => resolveRound(idx), roundTimerSec * 1000 + 500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundTimerSec])

  // Resolve round — build reveal payload and broadcast
  const resolveRound = useCallback((idx: number) => {
    if (!channelRef.current) return
    const results = Object.entries(answersRef.current).map(([pid, a]) => ({
      playerId: pid,
      answer: a.answer,
      responseMs: a.responseMs,
      pointsEarned: a.points,
      correct: a.correct,
    }))

    // Accumulate scores
    for (const r of results) {
      scoresRef.current[r.playerId] = (scoresRef.current[r.playerId] ?? 0) + r.pointsEarned
      if (r.correct) correctRef.current[r.playerId] = (correctRef.current[r.playerId] ?? 0) + 1
    }

    const reveal: RoundRevealPayload = {
      type: 'round_reveal',
      roundIndex: idx,
      correctAnswer: null, // game sets this via onRoundReveal callback
      results,
    }
    broadcastRaceEvent(channelRef.current, reveal)

    answersRef.current = {}
  }, [])

  useEffect(() => {
    const channel = supabase.channel(`race:${roomId}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel
    playerCountRef.current = 0

    channel.on('broadcast', { event: 'race_event' }, ({ payload }) => {
      const ev = payload as RaceEvent

      if (ev.type === 'round_start') {
        setRoundIndex(ev.roundIndex)
        setRoundServerTs(ev.serverTs)
        setPhase('playing')
        setHasAnswered(false)
        onRoundStart(ev)
      }

      if (ev.type === 'player_answered') {
        // Orchestrator tracks who has answered
        if (isOrchestrator) {
          const total = playerCountRef.current
          const answered = Object.keys(answersRef.current).length
          if (total > 0 && answered >= total) {
            if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
            resolveRound(roundIndex)
          }
        }
      }

      if (ev.type === 'round_reveal') {
        setPhase('reveal')
        onRoundReveal(ev)

        // Advance to next round after 2s pause
        setTimeout(() => {
          const nextIdx = ev.roundIndex + 1
          if (nextIdx >= totalRounds) {
            setPhase('ended')
            onMatchEnd(scoresRef.current, correctRef.current)
          } else if (isOrchestrator) {
            // Signal game component to provide next prompt
            setRoundIndex(nextIdx)
            setPhase('waiting')
          }
        }, 2200)
      }

      if (ev.type === 'match_end') {
        setPhase('ended')
        onMatchEnd(ev.finalScores, ev.finalCorrect)
      }
    })

    channel.subscribe()

    return () => {
      channel.unsubscribe()
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const submitAnswer = useCallback((answer: unknown, correct: boolean, points: number, responseMs: number) => {
    if (hasAnswered || !channelRef.current) return
    setHasAnswered(true)

    // Store answer (orchestrator will collect from all players)
    answersRef.current[myId] = { answer, correct, points, responseMs }

    broadcastRaceEvent(channelRef.current, {
      type: 'player_answered',
      roundIndex,
      playerId: myId,
    })
  }, [hasAnswered, myId, roundIndex])

  return {
    roundIndex,
    phase,
    roundServerTs,
    submitAnswer,
    hasAnsweredThisRound: hasAnswered,
    channel: channelRef.current,
    startRound,
  }
}
