// src/lib/gameSession.ts
import { supabase } from './supabase'

export type GameKey =
  | 'neon_blitz' | 'grid_ghost' | 'flux_sort'
  | 'trivia_clash' | 'tac_zone' | 'flag_rush'

export interface SessionInput {
  game: GameKey
  score: number
  xpEarned: number
  durationSec: number
  metadata?: Record<string, unknown>
}

/** Write a completed game session and award XP to the profile. */
export async function saveGameSession(userId: string, input: SessionInput) {
  // 1. Insert session row
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

  // 2. Award XP via RPC (increments profile.xp + recalculates level)
  const { error: xpError } = await supabase
    .rpc('award_xp', { p_user_id: userId, p_xp: input.xpEarned })

  if (xpError) console.error('award_xp error:', xpError)

  return { error: xpError ?? null }
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
