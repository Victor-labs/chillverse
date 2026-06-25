// src/pages/multiplayer/raceEngine.ts
// Shared logic for all Simultaneous Race games:
// Trivia Clash, Liar's Grid MP, Two Truths MP, Bluff Bid, Number Rush

import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Scoring ──────────────────────────────────────────────────

/**
 * Standard race-round score for correct/incorrect answers with speed bonus.
 * responseMs = milliseconds from prompt broadcast to player answer.
 */
export function calcRaceRoundScore(correct: boolean, responseMs: number): number {
  if (!correct) return 0
  return Math.max(40, 100 - Math.floor(responseMs / 80))
}

/**
 * Bluff Bid scoring — closest-without-going-over wins 100pts.
 * Others score by proximity: 100 - floor(percentError * 100), min 0.
 * If ALL players go over, closest-overall wins instead.
 */
export function calcBluffBidRoundScores(
  guesses: Record<string, number>,  // playerId → guess
  trueValue: number
): Record<string, number> {
  const playerIds = Object.keys(guesses)

  // Separate under and over
  const under = playerIds.filter(id => guesses[id] <= trueValue)
  const over  = playerIds.filter(id => guesses[id] >  trueValue)

  let winnerId: string | null = null

  if (under.length > 0) {
    // Closest without going over
    winnerId = under.reduce((best, id) =>
      guesses[id] > guesses[best] ? id : best
    )
  } else {
    // All went over — closest overall wins
    winnerId = over.reduce((best, id) =>
      Math.abs(guesses[id] - trueValue) < Math.abs(guesses[best] - trueValue) ? id : best
    )
  }

  const scores: Record<string, number> = {}
  for (const id of playerIds) {
    if (id === winnerId) {
      scores[id] = 100
    } else {
      const pctError = Math.abs(guesses[id] - trueValue) / trueValue
      scores[id] = Math.max(0, 100 - Math.floor(pctError * 100))
    }
  }
  return scores
}

// ─── Server-timestamp timer ───────────────────────────────────

/**
 * Given a server-broadcast ISO timestamp (when the round started)
 * and a duration in seconds, returns elapsed ms and remaining ms.
 * Use this instead of client-side Date.now() to prevent timer drift.
 */
export function getRoundTimeState(serverStartTs: string, durationSec: number): {
  elapsedMs: number
  remainingMs: number
  pct: number           // 0–100, percentage of time remaining
  expired: boolean
} {
  const elapsedMs   = Date.now() - new Date(serverStartTs).getTime()
  const totalMs     = durationSec * 1000
  const remainingMs = Math.max(0, totalMs - elapsedMs)
  const pct         = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
  return { elapsedMs, remainingMs, pct, expired: remainingMs <= 0 }
}

// ─── Broadcast helpers ────────────────────────────────────────

export type RaceEventType =
  | 'round_start'
  | 'player_answered'
  | 'round_reveal'
  | 'match_end'
  | 'number_rush_solved'

export interface RoundStartPayload {
  type: 'round_start'
  roundIndex: number
  serverTs: string       // ISO — all clients compute timer from this
  promptData: unknown    // game-specific: question obj, grid, etc.
}

export interface PlayerAnsweredPayload {
  type: 'player_answered'
  roundIndex: number
  playerId: string
  // answer is intentionally opaque until reveal to prevent cheating
}

export interface RoundRevealPayload {
  type: 'round_reveal'
  roundIndex: number
  correctAnswer: unknown          // game-specific
  results: PlayerRoundResult[]    // all players' answers + scores
}

export interface PlayerRoundResult {
  playerId: string
  answer: unknown
  responseMs: number
  pointsEarned: number
  correct: boolean
}

export interface MatchEndPayload {
  type: 'match_end'
  finalScores: Record<string, number>   // playerId → total score
  finalCorrect: Record<string, number>  // playerId → correct count
}

export interface NumberRushSolvedPayload {
  type: 'number_rush_solved'
  roundIndex: number
  winnerId: string
  expression: string
  solveTimeMs: number
  pointsEarned: number
}

export type RaceEvent =
  | RoundStartPayload
  | PlayerAnsweredPayload
  | RoundRevealPayload
  | MatchEndPayload
  | NumberRushSolvedPayload

export function broadcastRaceEvent(channel: RealtimeChannel, event: RaceEvent) {
  channel.send({ type: 'broadcast', event: 'race_event', payload: event })
}

// ─── Expression validator (Number Rush) ──────────────────────

/**
 * Validates a Number Rush expression:
 * 1. Uses each of the 4 digits exactly once
 * 2. Evaluates to the target value
 * Returns { valid, value } — never throws.
 */
export function validateNumberRushExpression(
  expression: string,
  digits: [number, number, number, number],
  target: number
): { valid: boolean; value: number | null; reason?: string } {
  // Extract all numbers from expression
  const usedNums = (expression.match(/\d+/g) ?? []).map(Number)

  // Must use exactly 4 numbers
  if (usedNums.length !== 4) {
    return { valid: false, value: null, reason: 'Must use all 4 digits' }
  }

  // Must match digits exactly (order-independent)
  const sortedDigits  = [...digits].sort((a, b) => a - b)
  const sortedUsed    = [...usedNums].sort((a, b) => a - b)
  if (JSON.stringify(sortedDigits) !== JSON.stringify(sortedUsed)) {
    return { valid: false, value: null, reason: 'Wrong digits used' }
  }

  // Safely evaluate — only allow digits, operators, parentheses, spaces
  const safe = /^[\d\s+\-*/().]+$/.test(expression)
  if (!safe) {
    return { valid: false, value: null, reason: 'Invalid characters' }
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`'use strict'; return (${expression})`)() as number
    if (!isFinite(result)) return { valid: false, value: null, reason: 'Division by zero' }
    const valid = Math.abs(result - target) < 0.0001
    return { valid, value: result, reason: valid ? undefined : `Got ${result}, need ${target}` }
  } catch {
    return { valid: false, value: null, reason: 'Invalid expression' }
  }
}

// ─── Team scoring helpers ─────────────────────────────────────

export type TeamMode = 'ffa' | '2v2'

/**
 * Given per-player scores and team assignments, returns team totals.
 * Used by Liar's Grid, Two Truths, Bluff Bid in 2v2 mode.
 */
export function calcTeamScores(
  playerScores: Record<string, number>,
  teams: Record<string, 'A' | 'B' | null>
): { teamA: number; teamB: number } {
  let teamA = 0, teamB = 0
  for (const [pid, score] of Object.entries(playerScores)) {
    const t = teams[pid]
    if (t === 'A') teamA += score
    else if (t === 'B') teamB += score
  }
  return { teamA, teamB }
}

/**
 * XP multiplier for team games:
 * Winning team → 1.0 (full XP)
 * Losing team  → 0.25 of their calcSessionXP
 * Draw         → 0.6
 */
export function teamXpMultiplier(
  playerId: string,
  teams: Record<string, 'A' | 'B' | null>,
  winningTeam: 'A' | 'B' | 'draw' | null
): number {
  if (!winningTeam || winningTeam === 'draw') return 0.6
  const myTeam = teams[playerId]
  if (!myTeam) return 0.6   // FFA / unassigned
  return myTeam === winningTeam ? 1.0 : 0.25
}
