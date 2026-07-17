// src/lib/achievements.ts
import { supabase } from '../../shared/lib/supabase'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  category: 'xp' | 'streak' | 'games' | 'social' | 'rank' | 'special' | 'mall' | 'premium' | 'cinema'
  xp_reward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  reward_type: 'xp' | 'profile_pic' | 'banner' | null
  reward_url: string | null
  reward_item_id: string | null
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

// ── Fetch a single achievement (used for post tag previews) ──
const achievementCache = new Map<string, Achievement | null>()
export async function getAchievementById(id: string): Promise<Achievement | null> {
  if (achievementCache.has(id)) return achievementCache.get(id) ?? null
  const { data } = await supabase.from('achievements').select('*').eq('id', id).single()
  const ach = (data as Achievement) ?? null
  achievementCache.set(id, ach)
  return ach
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

  // Fetch achievement details for notification + reward granting
  const { data: ach } = await supabase
    .from('achievements')
    .select('title, description, icon, xp_reward, reward_type, reward_item_id')
    .eq('id', achievementId)
    .single()

  if (ach) {
    // ── Grant the XP reward ──
    // award_xp is SECURITY DEFINER and only allows auth.uid() = p_user_id,
    // so this only ever runs for the currently-logged-in player.
    if (ach.xp_reward > 0) {
      const { error: xpError } = await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_xp: ach.xp_reward,
      })
      if (xpError) console.error('[unlockAchievement] award_xp failed:', xpError)
    }

    // ── Grant the profile_pic / banner reward into inventory ──
    if ((ach.reward_type === 'profile_pic' || ach.reward_type === 'banner') && ach.reward_item_id) {
      const { error: invError } = await supabase.from('user_inventory').insert({
        user_id: userId,
        item_id: ach.reward_item_id,
        is_equipped: false,
        quantity: 1,
      })
      // Ignore unique-violation (already owns it) — anything else is worth logging
      if (invError && invError.code !== '23505') {
        console.error('[unlockAchievement] inventory grant failed:', invError)
      }
    }

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
  // ── New fields ──
  mallItemCount: number          // total mall items owned
  modelCount: number             // models owned (sub_category = 'model')
  diamondPurchaseCount: number   // total diamond purchase transactions
  diamondTopUpCount: number      // total top-up events
  ownsAllWilliamItems: boolean   // owns all items with brand = 'william'
  animeTriviaWins: number        // times won anime_trivia game
  totalGameWins: number          // total wins across all games
  chillverseVersion: number      // profile app version (2 = v2)
  completedWeeklyMission: boolean
  ownsSabrina: boolean           // owns item named 'Sabrina'
  totalGameLosses: number        // total game losses
  moviesWatched: number          // movies watched count
  giftsGiven: number             // gifts sent to other users
  flashSalesUsed: number         // flash sale purchases made
  // ── UNO / Pattern King ──
  unoMatchesWon: number          // total UNO wins
  unoFastestWinSec: number       // fastest UNO win, in seconds (Infinity if none)
  patternKingFastestWinSec: number // fastest Pattern King clear, in seconds (Infinity if none)
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
    trivia_clash: 'play_trivia',
    speed_math: 'play_speed_math', rapid_sort: 'play_rapid_sort',
    arrow_dash: 'play_arrow_dash', pattern_memory: 'play_pattern',
    two_truths: 'play_two_truths', tac_zone: 'play_tac_zone',
    liars_grid: 'play_liars_grid',
    uno: 'uno_first_draw', pattern_king: 'pk_memory_rookie',
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
  if (payload.xp >= 1500)    await tryUnlock('tier_bronze')
  if (payload.xp >= 15000)   await tryUnlock('tier_silver')
  if (payload.xp >= 63000)   await tryUnlock('tier_gold')
  if (payload.xp >= 165000)  await tryUnlock('tier_platinum')
  if (payload.xp >= 345000)  await tryUnlock('tier_diamond')
  if (payload.xp >= 675000)  await tryUnlock('tier_legend')

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

  // ── Mall & Inventory ──
  if (payload.mallItemCount >= 20)    await tryUnlock('mall_hoarder')
  if (payload.modelCount >= 5)        await tryUnlock('brands_active')
  if (payload.ownsAllWilliamItems)    await tryUnlock('willamtronic')
  if (payload.ownsSabrina)            await tryUnlock('sabrina_fan')

  // ── Premium / Diamonds ──
  if (payload.diamondPurchaseCount >= 1)  await tryUnlock('diamond_purse')
  if (payload.diamondTopUpCount >= 5)     await tryUnlock('premium_lifestyle')

  // ── Games extended ──
  if (payload.animeTriviaWins >= 10)  await tryUnlock('animatron')
  if (payload.totalGameWins >= 50)    await tryUnlock('counting_stars')
  if (payload.totalGameLosses >= 10)  await tryUnlock('badluck')

  // ── App / Platform ──
  if (payload.chillverseVersion >= 2) await tryUnlock('gen2')
  if (payload.completedWeeklyMission) await tryUnlock('runner_up')

  // ── Social extended ──
  if (payload.followerCount >= 100)   await tryUnlock('super_star')
  if (payload.followerCount >= 20)    await tryUnlock('lone_star')
  if (payload.followingCount >= 30)   await tryUnlock('that_one_follow_up')
  if (payload.giftsGiven >= 5)        await tryUnlock('blessed_hands')

  // ── Cinema ──
  if (payload.moviesWatched >= 5)     await tryUnlock('cinema_sim')

  // ── Shop / Sales ──
  if (payload.flashSalesUsed >= 5)    await tryUnlock('smart_sim')

  // ── UNO ──
  if (payload.unoMatchesWon >= 1)              await tryUnlock('uno_beginners_luck')
  if (payload.unoFastestWinSec <= 120)         await tryUnlock('uno_speed_demon')
  if (payload.unoMatchesWon >= 5)              await tryUnlock('uno_fire')
  if (payload.unoMatchesWon >= 30)             await tryUnlock('uno_master')

  // ── Pattern King ──
  if (payload.patternKingFastestWinSec <= 30)  await tryUnlock('pk_quick_thinker')
  if (payload.gameRanks['pattern_king'] === 'master') await tryUnlock('pk_memory_genius')
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

// ── Social notification senders ───────────────────────────────
export async function notifyFollow(followerId: string, targetId: string) {
  const { data: follower } = await supabase
    .from('profiles').select('display_name, username').eq('id', followerId).single()
  if (!follower) return
  const name = follower.display_name || follower.username
  await supabase.rpc('insert_notification', {
    p_user_id: targetId,
    p_type:    'follow',
    p_title:   `${name} followed you`,
    p_body:    `${name} is now following you on Chillverse.`,
    p_icon:    'user-plus',
    p_meta:    { follower_id: followerId },
  })
}

export async function notifyProfileView(viewerId: string, profileId: string) {
  if (viewerId === profileId) return
  const { data: viewer } = await supabase
    .from('profiles').select('display_name, username').eq('id', viewerId).single()
  if (!viewer) return
  const name = viewer.display_name || viewer.username
  await supabase.rpc('insert_notification', {
    p_user_id: profileId,
    p_type:    'profile_view',
    p_title:   `${name} viewed your profile`,
    p_body:    `${name} checked out your Chillverse profile.`,
    p_icon:    'eye',
    p_meta:    { viewer_id: viewerId },
  })
}

export async function notifyProfileLike(likerId: string, profileId: string) {
  if (likerId === profileId) return
  const { data: liker } = await supabase
    .from('profiles').select('display_name, username').eq('id', likerId).single()
  if (!liker) return
  const name = liker.display_name || liker.username
  await supabase.rpc('insert_notification', {
    p_user_id: profileId,
    p_type:    'profile_like',
    p_title:   `${name} liked your profile`,
    p_body:    `${name} gave your profile a like! 💖`,
    p_icon:    'heart',
    p_meta:    { liker_id: likerId },
  })
}

// Notify the recipient of a new DM — body is truncated to roughly half
// the message length (min 20 chars) so the preview never shows the full text.
export async function notifyMessage(senderId: string, recipientId: string, content: string) {
  if (senderId === recipientId) return
  const { data: sender } = await supabase
    .from('profiles').select('display_name, username').eq('id', senderId).single()
  if (!sender) return
  const name = sender.display_name || sender.username

  const trimmed = content.trim()
  const halfLen = Math.max(20, Math.ceil(trimmed.length / 2))
  const preview = trimmed.length > halfLen ? `${trimmed.slice(0, halfLen).trimEnd()}…` : trimmed

  await supabase.rpc('insert_notification', {
    p_user_id: recipientId,
    p_type:    'message',
    p_title:   `${name} sent you a message`,
    p_body:    preview,
    p_icon:    'message-circle',
    p_meta:    { sender_id: senderId },
  })
}

// Notify the callee of a missed voice/video call. Only called for a genuine
// timeout (the caller rang for RING_TIMEOUT_MS with no answer) — not for a
// call the callee explicitly declined (they obviously know already) or one
// the caller canceled before it rang out, matching how phone/WhatsApp calling
// only surfaces a "missed call" notification for the unanswered case.
export async function notifyMissedCall(callerId: string, calleeId: string) {
  if (callerId === calleeId) return
  const { data: caller } = await supabase
    .from('profiles').select('display_name, username').eq('id', callerId).single()
  if (!caller) return
  const name = caller.display_name || caller.username

  await supabase.rpc('insert_notification', {
    p_user_id: calleeId,
    p_type:    'missed_call',
    p_title:   `Missed call from ${name}`,
    p_body:    `You missed a voice call from ${name}.`,
    p_icon:    'phone-missed',
    p_meta:    { caller_id: callerId },
  })
}

export async function notifyRankUp(userId: string, rankTitle: string) {
  await supabase.rpc('insert_notification', {
    p_user_id: userId,
    p_type:    'rank_up',
    p_title:   `You reached ${rankTitle}!`,
    p_body:    `Congrats — you've climbed to ${rankTitle} rank. Keep going!`,
    p_icon:    'zap',
    p_meta:    { rank: rankTitle },
  })
}

// Notify all followers when someone reaches a new rank
export async function notifyFollowersRankUp(userId: string, rankTitle: string) {
  const { data: person } = await supabase
    .from('profiles').select('display_name, username').eq('id', userId).single()
  if (!person) return
  const name = person.display_name || person.username
  const { data: followers } = await supabase
    .from('follows').select('follower_id').eq('following_id', userId)
  if (!followers?.length) return
  for (const { follower_id } of followers) {
    await supabase.rpc('insert_notification', {
      p_user_id: follower_id,
      p_type:    'followed_rank_up',
      p_title:   `${name} reached ${rankTitle}!`,
      p_body:    `${name}, someone you follow, just levelled up to ${rankTitle}.`,
      p_icon:    'crown',
      p_meta:    { user_id: userId, rank: rankTitle },
    })
  }
}

// Notify all followers when someone hits a high streak
export async function notifyFollowersStreak(userId: string, streak: number) {
  if (streak < 7) return // only notify for noteworthy streaks
  const { data: person } = await supabase
    .from('profiles').select('display_name, username').eq('id', userId).single()
  if (!person) return
  const name = person.display_name || person.username
  const { data: followers } = await supabase
    .from('follows').select('follower_id').eq('following_id', userId)
  if (!followers?.length) return
  for (const { follower_id } of followers) {
    await supabase.rpc('insert_notification', {
      p_user_id: follower_id,
      p_type:    'streak',
      p_title:   `${name} is on a ${streak}-day streak! 🔥`,
      p_body:    `${name} has been playing for ${streak} days straight. Can you beat that?`,
      p_icon:    'flame',
      p_meta:    { user_id: userId, streak },
    })
  }
}
