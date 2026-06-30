// src/lib/triggerAchievements.ts
//
// Central helper that gathers all data required by checkAndUnlockAchievements
// and fires it. Call this after any action that could unlock achievements:
//   - after a game session ends (in Games.tsx handleResult)
//   - after login / app mount (for streak, social, profile achievements)
//   - after following someone (social achievements)
//   - after sending a message (social_first_msg)

import { supabase } from './supabase'
import { checkAndUnlockAchievements } from './achievements'

// Earliest date considered an "early adopter" — adjust as needed
const EARLY_ADOPTER_CUTOFF = new Date('2025-12-31T23:59:59Z')

export async function triggerAchievementCheck(userId: string): Promise<void> {
  try {
    // ── 1. Profile (xp, level, streak, created_at, profile completeness) ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, level, streak, created_at, username, display_name, avatar, country, dob, interests, connected_platform')
      .eq('id', userId)
      .single()

    if (!profile) return

    const xp      = profile.xp     ?? 0
    const level   = profile.level  ?? 1
    const streak  = profile.streak ?? 0

    // Profile is "complete" if they have set display_name, country, dob, and at least 1 interest
    const profileComplete =
      !!profile.display_name &&
      !!profile.country &&
      !!profile.dob &&
      Array.isArray(profile.interests) && profile.interests.length > 0

    const joinedEarly = profile.created_at
      ? new Date(profile.created_at) <= EARLY_ADOPTER_CUTOFF
      : false

    // ── 2. Game sessions (total count, games played set, top score) ──
    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('game, score, played_at')
      .eq('user_id', userId)

    const allSessions = sessions ?? []
    const totalSessions = allSessions.length
    const gamesPlayedSet = new Set(allSessions.map(s => s.game as string))
    const topScore = allSessions.reduce((max, s) => Math.max(max, s.score ?? 0), 0)

    // Check if any session happened between midnight and 4am (night owl)
    const playedAfterMidnight = allSessions.some(s => {
      if (!s.played_at) return false
      const h = new Date(s.played_at).getHours()
      return h >= 0 && h < 4
    })

    // ── 3. Game ranks ──
    const { data: rankRows } = await supabase
      .from('player_game_ranks')
      .select('game, rank')
      .eq('user_id', userId)

    const gameRanks: Record<string, string> = {}
    for (const row of rankRows ?? []) {
      gameRanks[row.game] = row.rank
    }

    // ── 4. Social counts ──
    const { data: followCounts } = await supabase
      .from('profile_follow_counts')
      .select('followers_count, following_count')
      .eq('id', userId)
      .maybeSingle()

    const followerCount  = Number(followCounts?.followers_count  ?? 0)
    const followingCount = Number(followCounts?.following_count  ?? 0)

    // ── 5. Messages sent ──
    // Messages are stored with sender_id, not user_id.
    const { count: messagesSentCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)

    const messagesSent = messagesSentCount ?? 0

    // DM = any message sent in a non-global room
    const { count: dmCount } = await supabase
      .from('messages')
      .select('*, chat_rooms!inner(type)', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .eq('chat_rooms.type', 'dm')

    const dmSent = (dmCount ?? 0) > 0

    // ── 6. Special: speed run + perfect score ──
    // speed run = any session completed in ≤ 30s with score > 0
    const completedIn30Sec = allSessions.some(s => {
      const dur = (s as unknown as { duration_sec?: number }).duration_sec
      return typeof dur === 'number' && dur <= 30 && (s.score ?? 0) > 0
    })

    // perfect score = a session where score hit ≥ 100 (adjust threshold if needed)
    const perfectScore = topScore >= 100

    // ── 7. Mall / Inventory ──
    const { data: inventoryItems } = await supabase
      .from('user_items')
      .select('item_id, quantity')
      .eq('user_id', userId)

    const ownedItemIds = (inventoryItems ?? []).map((r: { item_id: string }) => r.item_id)
    const mallItemCount = ownedItemIds.length

    // Models = items with sub_category = 'model'
    let modelCount = 0
    if (ownedItemIds.length > 0) {
      const { count: mc } = await supabase
        .from('mall_items')
        .select('*', { count: 'exact', head: true })
        .in('id', ownedItemIds)
        .eq('sub_category', 'model')
      modelCount = mc ?? 0
    }

    // William items — all items where brand = 'william' (or name contains 'william')
    let ownsAllWilliamItems = false
    const { data: williamItems } = await supabase
      .from('mall_items')
      .select('id')
      .ilike('name', '%william%')
    if (williamItems && williamItems.length > 0) {
      const williamIds = williamItems.map((w: { id: string }) => w.id)
      ownsAllWilliamItems = williamIds.every((id: string) => ownedItemIds.includes(id))
    }

    // Sabrina — owns item named 'Sabrina'
    let ownsSabrina = false
    const { data: sabrinaItem } = await supabase
      .from('mall_items')
      .select('id')
      .ilike('name', '%sabrina%')
      .maybeSingle()
    if (sabrinaItem) {
      ownsSabrina = ownedItemIds.includes(sabrinaItem.id)
    }

    // ── 8. Diamond / Premium ──
    const { count: diamondPurchaseCount } = await supabase
      .from('diamond_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: diamondTopUpCount } = await supabase
      .from('diamond_topups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // ── 9. Game wins / losses ──
    const { count: totalGameWinsCount } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('result', 'win')

    const { count: totalGameLossesCount } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('result', 'loss')

    const { count: animeTriviaWinsCount } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game', 'anime_trivia')
      .eq('result', 'win')

    // ── 10. App version ──
    const chillverseVersion = Number((profile as unknown as { app_version?: number }).app_version ?? 1)

    // ── 11. Weekly missions ──
    const { count: completedMissionSets } = await supabase
      .from('weekly_mission_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    const completedWeeklyMission = (completedMissionSets ?? 0) >= 1

    // ── 12. Movies watched ──
    const { count: moviesWatchedCount } = await supabase
      .from('movie_watches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // ── 13. Gifts given ──
    const { count: giftsGivenCount } = await supabase
      .from('gifts')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)

    // ── 14. Flash sales used ──
    const { count: flashSalesUsedCount } = await supabase
      .from('flash_sale_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // ── 15. UNO sessions (wins + fastest win) ──
    // UNO doesn't set game_sessions.result (always 'completed'), so we read
    // the win/loss flag out of the metadata blob saved by Uno.tsx's finishGame().
    const { data: unoSessions } = await supabase
      .from('game_sessions')
      .select('duration_sec, metadata')
      .eq('user_id', userId)
      .eq('game', 'uno')

    const unoWins = (unoSessions ?? []).filter(
      s => (s.metadata as { Result?: string } | null)?.Result === 'Win'
    )
    const unoMatchesWon = unoWins.length
    const unoFastestWinSec = unoWins.reduce(
      (min, s) => Math.min(min, s.duration_sec ?? Infinity), Infinity
    )

    // ── 16. Pattern King sessions (fastest clear) ──
    // Pattern King stores progress as "x/y" under metadata['Patterns Found'];
    // a clear/"win" is when matched === required and required > 0.
    const { data: pkSessions } = await supabase
      .from('game_sessions')
      .select('duration_sec, metadata')
      .eq('user_id', userId)
      .eq('game', 'pattern_king')

    const pkWins = (pkSessions ?? []).filter(s => {
      const raw = (s.metadata as Record<string, unknown> | null)?.['Patterns Found']
      if (typeof raw !== 'string') return false
      const [matched, required] = raw.split('/').map(Number)
      return Number.isFinite(matched) && Number.isFinite(required) && required > 0 && matched === required
    })
    const patternKingFastestWinSec = pkWins.reduce(
      (min, s) => Math.min(min, s.duration_sec ?? Infinity), Infinity
    )

    // ── 17. Fire the check ──
    await checkAndUnlockAchievements({
      userId,
      xp,
      level,
      streak,
      totalSessions,
      gamesPlayed: gamesPlayedSet,
      topScore,
      gameRanks,
      followingCount,
      followerCount,
      messagesSent,
      dmSent,
      profileComplete,
      joinedEarly,
      playedAfterMidnight,
      completedIn30Sec,
      perfectScore,
      mallItemCount,
      modelCount,
      diamondPurchaseCount: diamondPurchaseCount ?? 0,
      diamondTopUpCount: diamondTopUpCount ?? 0,
      ownsAllWilliamItems,
      animeTriviaWins: animeTriviaWinsCount ?? 0,
      totalGameWins: totalGameWinsCount ?? 0,
      chillverseVersion,
      completedWeeklyMission,
      ownsSabrina,
      totalGameLosses: totalGameLossesCount ?? 0,
      moviesWatched: moviesWatchedCount ?? 0,
      giftsGiven: giftsGivenCount ?? 0,
      flashSalesUsed: flashSalesUsedCount ?? 0,
      unoMatchesWon,
      unoFastestWinSec,
      patternKingFastestWinSec,
    })
  } catch (err) {
    // Non-critical — never let achievement errors bubble up and break the app
    console.error('[triggerAchievements] error:', err)
  }
}
