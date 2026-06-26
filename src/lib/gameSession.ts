// src/lib/gameSession.ts
import { supabase } from './supabase'
import type { GameRank } from '../pages/games/types'

export type GameKey =
  | 'arrow_dash'
  | 'pattern_memory'
  | 'rapid_sort'
  | 'trivia_clash'
  | 'tac_zone'
  | 'flag_rush'
  | 'two_truths'
  | 'speed_math'
  | 'liars_grid'
  | 'hangman'

export interface SessionInput {
  game: GameKey
  score: number
  xpEarned: number
  durationSec: number
  rank?: GameRank
  streak?: number
  metadata?: Record<string, unknown>
}

export interface PlayerRankRow {
  user_id: string
  game: GameKey
  rank: GameRank
  current_streak: number
  all_time_streak: number
  updated_at: string
}

// ─── Global session limit (15 total across all games) ───────────────
const SESSION_LIMIT_KEY   = 'cv_session_limit'
const SESSION_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 hours

interface SessionLimitStore {
  count: number       // total sessions played this window
  resetAt: number     // epoch ms when the 3hr cooldown expires (0 = no cooldown)
}

function getSessionStore(userId: string): SessionLimitStore {
  try {
    const raw = localStorage.getItem(`${SESSION_LIMIT_KEY}_${userId}`)
    if (!raw) return { count: 0, resetAt: 0 }
    const parsed = JSON.parse(raw) as SessionLimitStore
    // If cooldown has passed, reset
    if (parsed.resetAt > 0 && Date.now() >= parsed.resetAt) {
      const fresh = { count: 0, resetAt: 0 }
      localStorage.setItem(`${SESSION_LIMIT_KEY}_${userId}`, JSON.stringify(fresh))
      return fresh
    }
    return parsed
  } catch {
    return { count: 0, resetAt: 0 }
  }
}

function setSessionStore(userId: string, store: SessionLimitStore) {
  localStorage.setItem(`${SESSION_LIMIT_KEY}_${userId}`, JSON.stringify(store))
}

/** Returns current global session info for a user. */
export function getGlobalSessionInfo(userId: string): {
  count: number
  limit: number
  limitReached: boolean
  resetAt: number
} {
  const store = getSessionStore(userId)
  return {
    count: store.count,
    limit: 15,
    limitReached: store.count >= 15,
    resetAt: store.resetAt,
  }
}

/** Increment the global session counter. Call when a game session is saved. */
function incrementGlobalSession(userId: string) {
  const store = getSessionStore(userId)
  const newCount = store.count + 1
  const resetAt  = newCount >= 15 && store.resetAt === 0
    ? Date.now() + SESSION_COOLDOWN_MS
    : store.resetAt
  setSessionStore(userId, { count: newCount, resetAt })
}

/** Write a completed game session and award XP to the profile. */
export async function saveGameSession(userId: string, input: SessionInput) {
  const { error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      user_id:      userId,
      game:         input.game,
      score:        input.score,
      xp_earned:    input.xpEarned,
      duration_sec: input.durationSec,
      metadata:     input.metadata ?? {},
      result:       'completed',
    })

  if (sessionError) {
    console.error('gameSession insert error:', sessionError)
    return { error: sessionError }
  }

  // Increment global session counter
  incrementGlobalSession(userId)

  const { error: xpError } = await supabase
    .rpc('award_xp', { p_user_id: userId, p_xp: input.xpEarned })

  if (xpError) console.error('award_xp error:', xpError)
  return { error: xpError ?? null }
}

/** Read a player's rank + streak state for a specific game. */
export async function getPlayerRank(userId: string, game: GameKey): Promise<PlayerRankRow | null> {
  const { data, error } = await supabase
    .from('player_game_ranks')
    .select('*')
    .eq('user_id', userId)
    .eq('game', game)
    .maybeSingle()

  if (error) {
    console.error('getPlayerRank error:', error)
    return null
  }
  return data as PlayerRankRow | null
}

/** Upsert a player's rank + streak after a game session. Rank never demotes. */
export async function savePlayerRank(
  userId: string,
  game: GameKey,
  newRank: GameRank,
  currentStreak: number,
  allTimeStreak: number,
): Promise<void> {
  const RANK_ORDER: GameRank[] = ['beginner', 'intermediate', 'advanced', 'master']

  const existing = await getPlayerRank(userId, game)
  const existingRankIdx = existing ? RANK_ORDER.indexOf(existing.rank) : 0
  const newRankIdx       = RANK_ORDER.indexOf(newRank)
  const finalRank: GameRank = newRankIdx >= existingRankIdx ? newRank : (existing?.rank ?? 'beginner')
  const finalAllTime = Math.max(allTimeStreak, existing?.all_time_streak ?? 0)

  const { error } = await supabase
    .from('player_game_ranks')
    .upsert({
      user_id:         userId,
      game,
      rank:            finalRank,
      current_streak:  currentStreak,
      all_time_streak: finalAllTime,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,game' })

  if (error) console.error('savePlayerRank error:', error)
}

/** Fetch how many times a user has played a specific game today. */
export async function getPlaysToday(userId: string, game: GameKey): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game', game)
    .gte('played_at', startOfDay.toISOString())

  if (error) return 0
  return count ?? 0
}

/** Fetch a user's recent game sessions for the profile activity feed. */
export async function getRecentSessions(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)

  return { data: data ?? [], error }
}

/** Batch-load rank states for all games at once. */
export async function getAllPlayerRanks(userId: string): Promise<Partial<Record<GameKey, PlayerRankRow>>> {
  const { data, error } = await supabase
    .from('player_game_ranks')
    .select('*')
    .eq('user_id', userId)

  if (error || !data) return {}
  const map: Partial<Record<GameKey, PlayerRankRow>> = {}
  for (const row of data as PlayerRankRow[]) {
    map[row.game] = row
  }
  return map
}
