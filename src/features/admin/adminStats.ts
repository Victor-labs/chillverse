// src/features/admin/adminStats.ts
import { supabase } from '../../shared/lib/supabase'

export interface AdminOverviewStats {
  total_users: number
  new_users_7d: number
  new_users_30d: number
  active_today: number
  active_7d: number
  pro_subscribers: number
  pro_orbit: number
  pro_void: number
  staff_count: number
  banned_users: number
}

export interface AdminEconomyStats {
  diamonds_in_circulation: number
  diamonds_credited_30d: number
  purchase_tx_30d: number
  top_mall_items: { name: string; category: string; owners: number }[]
}

export interface AdminGamesStats {
  total_sessions: number
  sessions_7d: number
  top_games: { game: string; sessions: number }[]
}

export interface AdminMultiplayerStats {
  active_rooms: number
  rooms_7d: number
  top_multiplayer_games: { game_id: string; rooms: number }[]
}

export interface AdminHaloAiStats {
  questions_7d: number
  questions_30d: number
  active_users_7d: number
  provider_split_30d: Record<string, number>
}

export interface AdminModerationStats {
  open_reports: number
  actions_7d: number
  currently_banned: number
}

export interface AdminSupportStats {
  open_tickets: number
  tickets_7d: number
}

export interface AdminDashboardStats {
  generated_at: string
  overview: AdminOverviewStats
  economy: AdminEconomyStats
  games: AdminGamesStats
  multiplayer: AdminMultiplayerStats
  halo_ai: AdminHaloAiStats
  moderation: AdminModerationStats
  support: AdminSupportStats
}

/** Fetches the full admin dashboard payload in one round trip. The RPC
 *  itself re-checks is_admin_role() server-side (see migration 0029) —
 *  this call fails safely for non-admins even if this function were
 *  somehow invoked without the AdminDashboard.tsx self-guard. */
export async function fetchAdminDashboardStats(): Promise<{ data: AdminDashboardStats | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats')

  if (error) {
    console.error('fetchAdminDashboardStats error:', error)
    if (error.message?.includes('CV_ADMIN_FORBIDDEN')) {
      return { data: null, error: "You don't have permission to view this." }
    }
    return { data: null, error: 'Failed to load dashboard stats. Please try again.' }
  }

  return { data: data as AdminDashboardStats, error: null }
}
