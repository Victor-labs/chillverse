// src/lib/achievements.ts
import { supabase } from './supabase'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  category: 'xp' | 'streak' | 'games' | 'social' | 'rank' | 'special'
  xp_reward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface PlayerAchievement {
  achievement_id: string
  unlocked_at: string
}

// ── Fetch all achievement definitions ────────────────────────
export async function getAllAchievements(): Promise<Achievement[]> {
  const { data } = await supabase.from('achievements').select('*').order('category').order('xp_reward')
  return (data ?? []) as Achievement[]
}

// ── Fetch which ones a player has unlocked ───────────────────
export async function getPlayerAchievements(userId: string): Promise<PlayerAchievement[]> {
  const { data } = await supabase
    .from('player_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', userId)
  return (data ?? []) as PlayerAchievement[]
}

// ── Unlock an achievement + send notification ─────────────────
export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  // Idempotent — ignore if already unlocked
  const { error } = await supabase
    .from('player_achievements')
    .insert({ user_id: userId, achievement_id: achievementId })

  if (error) return false // already unlocked or DB error

  // Fetch achievement details for notification
  const { data: ach } = await supabase
    .from('achievements')
    .select('title, description, icon, xp_reward')
    .eq('id', achievementId)
    .single()

  if (ach) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'achievement',
      title: `Achievement Unlocked: ${ach.title}`,
      body: ach.description,
      icon: ach.icon,
      meta: { achievement_id: achievementId, xp_reward: ach.xp_reward },
    })
  }

  return true
}

// ── Check and unlock achievements based on current player state ──
export interface AchievementCheckPayload {
  userId: string
  xp: number
  level: number
  streak: number
  totalSessions: number
  gamesPlayed: Set<string>
  topScore: number
  gameRanks: Record<string, string>
  followingCount: number
  followerCount: number
  messagesSent: number
  dmSent: boolean
  profileComplete: boolean
  joinedEarly: boolean
  playedAfterMidnight: boolean
  completedIn30Sec: boolean
  perfectScore: boolean
}

export async function checkAndUnlockAchievements(payload: AchievementCheckPayload) {
  const { userId } = payload

  // Already unlocked set
  const { data: existing } = await supabase
    .from('player_achievements')
    .select('achievement_id')
    .eq('user_id', userId)
  const unlocked = new Set((existing ?? []).map((r: { achievement_id: string }) => r.achievement_id))

  async function tryUnlock(id: string) {
    if (!unlocked.has(id)) {
      const success = await unlockAchievement(userId, id)
      if (success) unlocked.add(id)
    }
  }

  // ── XP Milestones ──
  if (payload.xp >= 100)    await tryUnlock('xp_100')
  if (payload.xp >= 500)    await tryUnlock('xp_500')
  if (payload.xp >= 1000)   await tryUnlock('xp_1000')
  if (payload.xp >= 5000)   await tryUnlock('xp_5000')
  if (payload.xp >= 10000)  await tryUnlock('xp_10000')
  if (payload.xp >= 25000)  await tryUnlock('xp_25000')
  if (payload.xp >= 50000)  await tryUnlock('xp_50000')
  if (payload.xp >= 100000) await tryUnlock('xp_100000')

  // ── Level Milestones ──
  if (payload.level >= 5)  await tryUnlock('level_5')
  if (payload.level >= 10) await tryUnlock('level_10')
  if (payload.level >= 25) await tryUnlock('level_25')
  if (payload.level >= 50) await tryUnlock('level_50')

  // ── Streaks ──
  if (payload.streak >= 3)   await tryUnlock('streak_3')
  if (payload.streak >= 7)   await tryUnlock('streak_7')
  if (payload.streak >= 14)  await tryUnlock('streak_14')
  if (payload.streak >= 30)  await tryUnlock('streak_30')
  if (payload.streak >= 60)  await tryUnlock('streak_60')
  if (payload.streak >= 100) await tryUnlock('streak_100')

  // ── First plays ──
  const GAME_MAP: Record<string, string> = {
    trivia_clash: 'play_trivia', flag_rush: 'play_flag',
    speed_math: 'play_speed_math', rapid_sort: 'play_rapid_sort',
    arrow_dash: 'play_arrow_dash', pattern_memory: 'play_pattern',
    two_truths: 'play_two_truths', tac_zone: 'play_tac_zone',
    liars_grid: 'play_liars_grid',
  }
  for (const [game, achId] of Object.entries(GAME_MAP)) {
    if (payload.gamesPlayed.has(game)) await tryUnlock(achId)
  }
  if (Object.keys(GAME_MAP).every(g => payload.gamesPlayed.has(g))) await tryUnlock('play_all_games')

  // ── Score milestones ──
  if (payload.topScore >= 50)  await tryUnlock('score_50')
  if (payload.topScore >= 100) await tryUnlock('score_100')
  if (payload.topScore >= 250) await tryUnlock('score_250')
  if (payload.topScore >= 500) await tryUnlock('score_500')

  // ── Session counts ──
  if (payload.totalSessions >= 10)  await tryUnlock('sessions_10')
  if (payload.totalSessions >= 50)  await tryUnlock('sessions_50')
  if (payload.totalSessions >= 100) await tryUnlock('sessions_100')
  if (payload.totalSessions >= 500) await tryUnlock('sessions_500')

  // ── Game ranks ──
  const ranks = Object.values(payload.gameRanks)
  if (ranks.includes('intermediate') || ranks.includes('advanced') || ranks.includes('master')) await tryUnlock('rank_intermediate')
  if (ranks.includes('advanced') || ranks.includes('master')) await tryUnlock('rank_advanced')
  if (ranks.includes('master')) await tryUnlock('rank_master')
  if (Object.keys(GAME_MAP).length > 0 && Object.keys(GAME_MAP).every(g => payload.gameRanks[g] === 'master')) await tryUnlock('rank_master_all')

  // ── Global rank tiers (based on XP) ──
  if (payload.xp >= 1000)    await tryUnlock('tier_bronze')
  if (payload.xp >= 10000)   await tryUnlock('tier_silver')
  if (payload.xp >= 42000)   await tryUnlock('tier_gold')
  if (payload.xp >= 110000)  await tryUnlock('tier_platinum')
  if (payload.xp >= 230000)  await tryUnlock('tier_diamond')
  if (payload.xp >= 450000)  await tryUnlock('tier_legend')

  // ── Social ──
  if (payload.messagesSent >= 1)  await tryUnlock('social_first_msg')
  if (payload.followingCount >= 1)  await tryUnlock('social_follow_1')
  if (payload.followingCount >= 10) await tryUnlock('social_follow_10')
  if (payload.followerCount >= 1)   await tryUnlock('social_followed')
  if (payload.dmSent)               await tryUnlock('social_dm')

  // ── Special ──
  if (payload.joinedEarly)           await tryUnlock('special_early')
  if (payload.profileComplete)       await tryUnlock('special_profile')
  if (payload.playedAfterMidnight)   await tryUnlock('special_night_owl')
  if (payload.completedIn30Sec)      await tryUnlock('special_speed_run')
  if (payload.perfectScore)          await tryUnlock('special_perfect')
}

// ── Notification helpers ──────────────────────────────────────
export async function getNotifications(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function markNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  return count ?? 0
}
