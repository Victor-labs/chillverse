// src/lib/gameSession.ts
import { supabase } from './supabase'
import { updateMissionProgress } from './weeklyMissions'
import type { GameRank } from '../pages/games/types'

export type GameKey =
  | 'arrow_dash'
  | 'pattern_memory'
  | 'rapid_sort'
  | 'trivia_clash'
  | 'tac_zone'
  | 'two_truths'
  | 'speed_math'
  | 'liars_grid'
  | 'hangman'
  | 'close_call'
  | 'pattern_king'
  | 'uno'
  | 'colour_block'

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

// ─── Global session limit (server-side, via Supabase) ─────────
// Previously stored in localStorage — trivially bypassed by clearing
// site data or switching browsers. Now backed by the `session_limits`
// table + RPCs (see migration 0006_session_limits.sql) so the limit
// is enforced server-side and resettable via SQL.
const GLOBAL_LIMIT         = 15
const SESSION_COOLDOWN_HRS = 4.5 // lock duration once all 15 are burned

interface SessionInfoRow {
  count: number
  reset_at: string | null
}

interface IncrementSessionRow {
  count: number
  reset_at: string | null
  limit_reached: boolean
}

export async function getGlobalSessionInfo(userId: string): Promise<{
  count: number
  limit: number
  limitReached: boolean
  resetAt: number
}> {
  const { data, error } = await supabase
    .rpc('get_session_info', { p_user_id: userId })
    .maybeSingle<SessionInfoRow>()

  if (error || !data) {
    console.error('getGlobalSessionInfo error:', error)
    return { count: 0, limit: GLOBAL_LIMIT, limitReached: false, resetAt: 0 }
  }

  const resetAt = data.reset_at ? new Date(data.reset_at).getTime() : 0
  return {
    count: data.count,
    limit: GLOBAL_LIMIT,
    limitReached: data.count >= GLOBAL_LIMIT,
    resetAt,
  }
}

export async function incrementGlobalSession(userId: string, by = 1) {
  const { data, error } = await supabase
    .rpc('increment_session_count', {
      p_user_id: userId,
      p_by: by,
      p_limit: GLOBAL_LIMIT,
      p_cooldown_hours: SESSION_COOLDOWN_HRS,
    })
    .maybeSingle<IncrementSessionRow>()

  if (error) {
    console.error('incrementGlobalSession error:', error)
    return null
  }
  if (!data) return null

  const resetAt = data.reset_at ? new Date(data.reset_at).getTime() : 0
  return { count: data.count, resetAt, limitReached: data.limit_reached }
}

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

  // XP award
  const { error: xpError } = await supabase
    .rpc('award_xp', { p_user_id: userId, p_xp: input.xpEarned })

  if (xpError) console.error('award_xp error:', xpError)

  // ── Weekly mission hooks ─────────────────────────────────────
  // xp_days: track days where XP was earned (1 per calendar day, de-duped by absolute mode)
  // We use the date string as a proxy — absolute=true means we only advance, never regress
  if ((input.xpEarned ?? 0) > 0) {
    updateMissionProgress(userId, 'xp_days', 1).catch(console.error)
  }

  // levels_gained: compare level before and after the XP award
  if ((input.xpEarned ?? 0) > 0) {
    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('level')
      .eq('id', userId)
      .single()

    const { data: prevSession } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(2)

    // If this is not the first ever session, check for a level gained
    if (freshProfile && prevSession && prevSession.length >= 1) {
      // We detect level-up by comparing: if a notification of type level_up
      // was inserted for this user in the last 30s (inserted by the award_xp trigger),
      // increment levels_gained. We do this lightweight check to avoid a second RPC.
      const since = new Date(Date.now() - 30_000).toISOString()
      const { count: levelUpCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'level_up')
        .gte('created_at', since)

      if ((levelUpCount ?? 0) > 0) {
        updateMissionProgress(userId, 'levels_gained', 1).catch(console.error)
      }
    }
  }

  return { error: xpError ?? null }
}

export async function getPlayerRank(userId: string, game: GameKey): Promise<PlayerRankRow | null> {
  const { data, error } = await supabase
    .from('player_game_ranks')
    .select('*')
    .eq('user_id', userId)
    .eq('game', game)
    .maybeSingle()
  if (error) { console.error('getPlayerRank error:', error); return null }
  return data as PlayerRankRow | null
}

export async function savePlayerRank(
  userId: string, game: GameKey, newRank: GameRank,
  currentStreak: number, allTimeStreak: number,
): Promise<void> {
  const RANK_ORDER: GameRank[] = ['beginner', 'intermediate', 'advanced', 'master']
  const existing = await getPlayerRank(userId, game)
  const existingRankIdx = existing ? RANK_ORDER.indexOf(existing.rank) : 0
  const newRankIdx      = RANK_ORDER.indexOf(newRank)
  const finalRank: GameRank = newRankIdx >= existingRankIdx ? newRank : (existing?.rank ?? 'beginner')
  const finalAllTime = Math.max(allTimeStreak, existing?.all_time_streak ?? 0)

  const { error } = await supabase
    .from('player_game_ranks')
    .upsert({
      user_id: userId, game, rank: finalRank,
      current_streak: currentStreak, all_time_streak: finalAllTime,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,game' })

  if (error) console.error('savePlayerRank error:', error)
}

export async function getPlaysToday(userId: string, game: GameKey): Promise<number> {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const { count, error } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game', game)
    .gte('played_at', startOfDay.toISOString())
  if (error) return 0
  return count ?? 0
}

export async function getRecentSessions(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
  return { data: data ?? [], error }
}

export async function getAllPlayerRanks(userId: string): Promise<Partial<Record<GameKey, PlayerRankRow>>> {
  const { data, error } = await supabase
    .from('player_game_ranks')
    .select('*')
    .eq('user_id', userId)
  if (error || !data) return {}
  const map: Partial<Record<GameKey, PlayerRankRow>> = {}
  for (const row of data as PlayerRankRow[]) { map[row.game] = row }
  return map
}
