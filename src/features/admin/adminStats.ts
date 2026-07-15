// src/features/admin/adminStats.ts
import { supabase } from '../../shared/lib/supabase'
import type { StaffRole } from '../moderation/moderation'

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
  /** Wallets over the 3,000 diamond threshold — added in migration 0034
   *  alongside admin_list_users()/admin_get_user_detail() so a suspicious
   *  cluster is visible without opening the Users drill-down. */
  flagged_balance_count: number
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

// ── User drill-down (list + detail) ──────────────────────────────────
// Backs admin_list_users() / admin_get_user_detail() from migration
// 0030 — both SECURITY DEFINER + is_admin_role()-gated server-side, same
// posture as admin_dashboard_stats() above.

export interface AdminUserRow {
  id: string
  username: string
  display_name: string | null
  email: string
  avatar: string
  gem_balance: number
  balance_flagged: boolean
  is_pro: boolean
  pro_tier: string | null
  staff_role: StaffRole | null
  is_banned: boolean
  created_at: string
  last_seen_at: string | null
}

export interface AdminUserListResult {
  rows: AdminUserRow[]
  total: number
  page: number
  page_size: number
}

/** Fetches one page of the admin user list, optionally filtered by a
 *  username / display name / email search term. `search` is trimmed and
 *  sent as `null` when empty so the RPC's `p_search is null or p_search = ''`
 *  short-circuit returns everyone rather than matching on an empty string. */
export async function fetchAdminUserList(
  page: number,
  pageSize: number,
  search: string,
): Promise<{ data: AdminUserListResult | null; error: string | null }> {
  const trimmed = search.trim()
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_page: page,
    p_page_size: pageSize,
    p_search: trimmed === '' ? null : trimmed,
  })

  if (error) {
    console.error('fetchAdminUserList error:', error)
    if (error.message?.includes('CV_ADMIN_FORBIDDEN')) {
      return { data: null, error: "You don't have permission to view this." }
    }
    return { data: null, error: 'Failed to load users. Please try again.' }
  }

  return { data: data as AdminUserListResult, error: null }
}

export interface AdminUserWalletBreakdown {
  gem_balance: number
  balance_flagged: boolean
  total_purchased: number
  total_earned_ledger: number
  total_spent_ledger: number
}

export interface AdminUserWalletActivity {
  type: string
  label: string
  amount: number
  created_at: string
}

export interface AdminUserDetail {
  id: string
  username: string
  display_name: string | null
  email: string
  avatar: string
  country: string | null
  bio: string | null
  xp: number
  level: number
  streak: number
  is_pro: boolean
  pro_tier: string | null
  pro_expires_at: string | null
  staff_role: StaffRole | null
  is_banned: boolean
  banned_until: string | null
  ban_reason: string | null
  created_at: string
  last_login_at: string | null
  last_seen_at: string | null
  referral_count: number
  wallet: AdminUserWalletBreakdown
  recent_wallet_activity: AdminUserWalletActivity[]
}

/** Fetches the full detail record — profile, role/ban status, and a
 *  wallet breakdown (current balance, lifetime purchased/earned/spent,
 *  and the last 15 ledger entries) — for a single user. */
export async function fetchAdminUserDetail(
  userId: string,
): Promise<{ data: AdminUserDetail | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_get_user_detail', { p_user_id: userId })

  if (error) {
    console.error('fetchAdminUserDetail error:', error)
    if (error.message?.includes('CV_ADMIN_FORBIDDEN')) {
      return { data: null, error: "You don't have permission to view this." }
    }
    if (error.message?.includes('CV_USER_NOT_FOUND')) {
      return { data: null, error: 'That user no longer exists.' }
    }
    return { data: null, error: 'Failed to load user detail. Please try again.' }
  }

  return { data: data as AdminUserDetail, error: null }
}
