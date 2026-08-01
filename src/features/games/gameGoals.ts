// src/features/games/gameGoals.ts
// Player-facing data layer for the Games Zone banner and the "Activity
// Goals" milestone track. Writes (progress) happen server-side via the
// record_game_goal_progress RPC, already hooked into saveGameSession —
// this file is read-only from the client's perspective.
import { supabase } from '../../shared/lib/supabase'

export async function fetchGamesZoneBanner(): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('games_zone_config')
    .select('banner_image_url')
    .eq('id', 1)
    .maybeSingle<{ banner_image_url: string | null }>()
  if (error) return { data: null, error: error.message }
  return { data: data?.banner_image_url ?? null, error: null }
}

export interface GameGoalMallItem {
  id: string
  name: string
  image_url: string | null
  category: string
  rarity: string
}

export interface GameGoalCycle {
  id: string
  status: 'draft' | 'live' | 'ended'
  thresholds: [number, number, number, number]
  xp_rewards: [number, number, number]
  final_reward_item_id: string | null
  rolled_out_at: string | null
  ends_at: string | null
}

export interface GameGoalProgress {
  id: string
  user_id: string
  cycle_id: string
  games_played: number
  completed_milestones: number[]
  total_xp_earned: number
  item_granted: boolean
}

export interface ActiveGameGoal {
  cycle: GameGoalCycle | null
  progress: GameGoalProgress | null
  final_item: GameGoalMallItem | null
}

/** Also creates the caller's progress row for the live cycle if it doesn't
 *  exist yet. Returns all nulls when no cycle is currently live (either
 *  none was ever rolled out, or the live one has expired). */
export async function fetchActiveGameGoal(): Promise<{ data: ActiveGameGoal; error: string | null }> {
  const { data, error } = await supabase.rpc('get_active_game_goal')
  if (error) return { data: { cycle: null, progress: null, final_item: null }, error: error.message }
  return { data: (data ?? { cycle: null, progress: null, final_item: null }) as ActiveGameGoal, error: null }
}
