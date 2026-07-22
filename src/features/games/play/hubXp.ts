// src/features/games/play/hubXp.ts
// Server-tracked daily XP cap for the Multiplayer hub games (Chess, Ludo,
// Water the Tree) — see supabase/migrations/0050_hub_game_daily_xp_cap.sql.
// Deliberately not localStorage: the cap has to hold even if the player
// clears site data or plays from a second device.
import { supabase } from '../../../shared/lib/supabase'

export const HUB_DAILY_XP_CAP = 2500

export interface HubXpStatus {
  xpToday: number
  capReached: boolean
}

export interface HubXpAwardResult extends HubXpStatus {
  xpAwarded: number
}

export async function getHubXpStatus(userId: string): Promise<HubXpStatus> {
  const { data, error } = await supabase
    .rpc('get_hub_xp_status', { p_user_id: userId, p_daily_cap: HUB_DAILY_XP_CAP })
    .maybeSingle<{ xp_today: number; cap_reached: boolean }>()

  if (error || !data) {
    console.error('getHubXpStatus error:', error)
    return { xpToday: 0, capReached: false }
  }
  return { xpToday: data.xp_today, capReached: data.cap_reached }
}

export async function awardHubXp(userId: string, amount: number): Promise<HubXpAwardResult> {
  const { data, error } = await supabase
    .rpc('award_hub_xp', { p_user_id: userId, p_amount: amount, p_daily_cap: HUB_DAILY_XP_CAP })
    .maybeSingle<{ xp_today: number; xp_awarded: number; cap_reached: boolean }>()

  if (error || !data) {
    console.error('awardHubXp error:', error)
    return { xpToday: 0, xpAwarded: 0, capReached: false }
  }
  return { xpToday: data.xp_today, xpAwarded: data.xp_awarded, capReached: data.cap_reached }
}
