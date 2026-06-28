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

// ─── Global session limit ─────────────────────────────────────
const SESSION_LIMIT_KEY   = 'cv_session_limit'
const SESSION_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6hr lock when all 15 burned
const GLOBAL_LIMIT        = 15

interface SessionLimitStore {
  count: number
  resetAt: number      // epoch ms for 6hr lock (0 = no active lock)
  lastDate: string     // YYYY-MM-DD — for midnight daily reset
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function getSessionStore(userId: string): SessionLimitStore {
  try {
    const raw = localStorage.getItem(`${SESSION_LIMIT_KEY}_${userId}`)
    if (!raw) return { count: 0, resetAt: 0, lastDate: todayStr() }

    const parsed = JSON.parse(raw) as SessionLimitStore

    // 1. Midnight daily reset — new day = fresh slate regardless of count
    if (parsed.lastDate !== todayStr()) {
      const fresh = { count: 0, resetAt: 0, lastDate: todayStr() }
      localStorage.setItem(`${SESSION_LIMIT_KEY}_${userId}`, JSON.stringify(fresh))
      return fresh
    }

    // 2. 6hr lock expired
    if (parsed.resetAt > 0 && Date.now() >= parsed.resetAt) {
      const fresh = { count: 0, resetAt: 0, lastDate: todayStr() }
      localStorage.setItem(`${SESSION_LIMIT_KEY}_${userId}`, JSON.stringify(fresh))
      return fresh
    }

    return parsed
  } catch {
    return { count: 0, resetAt: 0, lastDate: todayStr() }
  }
}

function setSessionStore(userId: string, store: SessionLimitStore) {
  localStorage.setItem(`${SESSION_LIMIT_KEY}_${userId}`, JSON.stringify(store))
}

export function getGlobalSessionInfo(userId: string): {
  count: number
  limit: number
  limitReached: boolean
  resetAt: number
} {
  const store = getSessionStore(userId)
  return {
    count: store.count,
    limit: GLOBAL_LIMIT,
    limitReached: store.count >= GLOBAL_LIMIT,
    resetAt: store.resetAt,
  }
}

export function incrementGlobalSession(userId: string, by = 1) {
  const store   = getSessionStore(userId)
  const newCount = store.count + by
  // Start 6hr lock only when limit is fully reached
  const resetAt = newCount >= GLOBAL_LIMIT && store.resetAt === 0
    ? Date.now() + SESSION_COOLDOWN_MS
    : store.resetAt
  setSessionStore(userId, { count: newCount, resetAt, lastDate: todayStr() })
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
