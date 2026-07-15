import { supabase } from '../../shared/lib/supabase'
import { getPlayerRank, getRecentSessions, type GameKey, type PlayerRankRow } from '../games/gameSession'

interface GameSessionRow {
  id: string
  user_id: string
  game: GameKey
  score: number | null
  xp_earned: number | null
  played_at: string
}

interface ProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
}

export interface PersonalGameStats {
  sessionsPlayed: number
  bestScore: number
  recentRank: PlayerRankRow['rank'] | 'unranked'
  currentStreak: number
  xpEarned: number
}

export interface LeaderboardEntry {
  userId: string
  name: string
  avatar: string | null
  sessionsPlayed: number
  bestScore: number
  xpEarned: number
  rank: PlayerRankRow['rank'] | 'unranked'
  currentStreak: number
  lastPlayedAt: string
}

const PAGE_SIZE = 200

export async function fetchPersonalGameStats(userId: string, game: GameKey): Promise<PersonalGameStats> {
  const [rankRow, recentResult, countResult, bestResult, xpResult] = await Promise.all([
    getPlayerRank(userId, game),
    getRecentSessions(userId, 1),
    supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game', game),
    supabase
      .from('game_sessions')
      .select('score')
      .eq('user_id', userId)
      .eq('game', game)
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle<{ score: number | null }>(),
    supabase
      .from('game_sessions')
      .select('xp_earned')
      .eq('user_id', userId)
      .eq('game', game)
      .limit(1000),
  ])

  const recentForGame = (recentResult.data ?? []).find(row => row.game === game)
  const xpEarned = (xpResult.data ?? []).reduce((sum, row) => sum + (Number(row.xp_earned) || 0), 0)

  return {
    sessionsPlayed: countResult.count ?? 0,
    bestScore: Number(bestResult.data?.score) || 0,
    recentRank: rankRow?.rank ?? (recentForGame?.metadata?.rank as PersonalGameStats['recentRank'] | undefined) ?? 'unranked',
    currentStreak: rankRow?.current_streak ?? (Number(recentForGame?.metadata?.streak) || 0),
    xpEarned,
  }
}

export async function fetchGlobalLeaderboard(game: GameKey): Promise<LeaderboardEntry[]> {
  const { data: sessions, error } = await supabase
    .from('game_sessions')
    .select('id, user_id, game, score, xp_earned, played_at')
    .eq('game', game)
    .order('score', { ascending: false })
    .order('played_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) throw error

  const sessionRows = (sessions ?? []) as GameSessionRow[]
  const userIds = Array.from(new Set(sessionRows.map(row => row.user_id)))

  const [profilesResult, ranksResult] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, username, display_name, avatar').in('id', userIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    userIds.length
      ? supabase.from('player_game_ranks').select('*').eq('game', game).in('user_id', userIds)
      : Promise.resolve({ data: [] as PlayerRankRow[], error: null }),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (ranksResult.error) throw ranksResult.error

  const profilesById = new Map((profilesResult.data ?? []).map(profile => [profile.id, profile as ProfileRow]))
  const ranksByUser = new Map((ranksResult.data ?? []).map(rank => [rank.user_id, rank as PlayerRankRow]))
  const byUser = new Map<string, LeaderboardEntry>()

  for (const row of sessionRows) {
    const existing = byUser.get(row.user_id)
    const profile = profilesById.get(row.user_id)
    const rank = ranksByUser.get(row.user_id)
    const score = Number(row.score) || 0
    const xp = Number(row.xp_earned) || 0

    if (!existing) {
      byUser.set(row.user_id, {
        userId: row.user_id,
        name: profile?.display_name || profile?.username || 'Player',
        avatar: profile?.avatar ?? null,
        sessionsPlayed: 1,
        bestScore: score,
        xpEarned: xp,
        rank: rank?.rank ?? 'unranked',
        currentStreak: rank?.current_streak ?? 0,
        lastPlayedAt: row.played_at,
      })
      continue
    }

    existing.sessionsPlayed += 1
    existing.bestScore = Math.max(existing.bestScore, score)
    existing.xpEarned += xp
    if (new Date(row.played_at).getTime() > new Date(existing.lastPlayedAt).getTime()) existing.lastPlayedAt = row.played_at
  }

  return Array.from(byUser.values()).sort((a, b) =>
    b.bestScore - a.bestScore || b.xpEarned - a.xpEarned || b.sessionsPlayed - a.sessionsPlayed,
  )
}
