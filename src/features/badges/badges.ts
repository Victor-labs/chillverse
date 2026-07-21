// src/features/badges/badges.ts
import { supabase } from '../../shared/lib/supabase'

export interface BadgeDef {
  id: string
  title: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  grant_type: 'auto' | 'manual'
  is_dynamic_username: boolean
  // When true, tapping the badge (BadgeRow / BadgesModal toast) shows the
  // badge's `description` ("task") text instead of its `title`. Used for
  // badges whose title alone doesn't say what was accomplished (e.g.
  // "Leaderboard Legend" → shows "Top 1 on the leaderboard" on tap).
  // Defaults to false for older rows that predate this column (title shown).
  tap_shows_task?: boolean
  // Whether this badge can currently be earned (auto-awarded or manually
  // granted). Set by staff from the Moderation panel's Badges tab; once
  // false, nobody can newly acquire it — players who already have it keep it.
  is_available: boolean
}

export interface PlayerBadge {
  badge_id: string
  unlocked_at: string
  granted_by: string | null
}

// Lower is better — rarest badges are shown first when a player has more
// than fit on screen. Mirrors achievements' RARITY_RANK.
export const BADGE_RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

export const BADGE_RARITY_COLOR: Record<string, string> = {
  common: '#888899', rare: '#4f8ef7', epic: '#9b6dff', legendary: '#f5c542',
}

// ── Fetch the full badge catalog (for the Settings > Badges dex) ────────
export async function getAllBadges(): Promise<BadgeDef[]> {
  const { data } = await supabase.from('badges').select('*')
  return ((data ?? []) as BadgeDef[]).sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))
}

// ── Fetch which badges a player has unlocked ─────────────────────────────
export async function getPlayerBadges(userId: string): Promise<PlayerBadge[]> {
  const { data } = await supabase.from('player_badges').select('badge_id, unlocked_at, granted_by').eq('user_id', userId)
  return (data ?? []) as PlayerBadge[]
}

// ── Renders the display title, filling in the player's ORIGINAL username
//    for the one dynamic badge ("Originally known as {originalUsername}").
//    Callers must pass `profile.original_username` here — never the
//    live/current `profile.username`. That column is set once at account
//    creation and never updated again (see migration 0025), so the badge
//    stays fixed to the player's first-ever username even if they rename
//    themselves repeatedly afterwards. Passing the current username here
//    is the exact bug this was built to avoid: the badge text would
//    silently change on every rename instead of staying "legacy".
export function badgeDisplayTitle(def: BadgeDef, originalUsername: string): string {
  if (def.is_dynamic_username) return `${def.title} ${originalUsername}`
  if (def.tap_shows_task) return def.description
  return def.title
}

// ── Re-checks and awards any automatic badges the player now qualifies
//    for (gifting, streak, version upgrade). Safe to call often — the
//    server re-verifies each condition and inserts are idempotent. ──────
export async function checkAndAwardAutoBadges(userId: string): Promise<void> {
  await supabase.rpc('check_and_award_auto_badges', { p_user_id: userId })
}

// ── Translates the CV_MOD_* prefixed exception text raised by the badge
//    RPCs into copy a moderator can read directly, mirroring the
//    friendlyError() pattern in moderation.ts. Falls back to the raw
//    Postgres message for anything unrecognized.
function friendlyBadgeError(message: string): string {
  if (message.includes('CV_MOD_FORBIDDEN')) return "You don't have permission to do that."
  if (message.includes('CV_MOD_NOT_FOUND')) return 'That badge could not be found.'
  if (message.includes('CV_MOD_BADGE_UNAVAILABLE')) return 'This badge has been marked unavailable and cannot be granted.'
  if (message.includes('badge not found')) return 'That badge could not be found.'
  if (message.includes('cannot be manually granted')) return 'This badge is automatic and cannot be granted manually.'
  return message
}

// ── Staff-only: manually grant/revoke a manual-type badge (Tester, and
//    any future Admin/Founder/Verified-style badge). ─────────────────────
export async function grantManualBadge(targetUserId: string, badgeId: string) {
  const result = await supabase.rpc('grant_manual_badge', { p_target_user_id: targetUserId, p_badge_id: badgeId })
  if (result.error) result.error.message = friendlyBadgeError(result.error.message)

  // Leaderboard Legend / Runner-Up Elite are the only two badges that also
  // post a Highlight — checkLeaderboardBadgeHighlight no-ops for every
  // other badge id, so this is safe to call unconditionally.
  if (!result.error) {
    const { checkLeaderboardBadgeHighlight } = await import('../highlights/highlightTriggers')
    checkLeaderboardBadgeHighlight(targetUserId, badgeId).catch(console.error)
  }

  return result
}
export async function revokeManualBadge(targetUserId: string, badgeId: string) {
  return supabase.rpc('revoke_manual_badge', { p_target_user_id: targetUserId, p_badge_id: badgeId })
}

// ── Staff-only: flip whether a badge can currently be earned. Once
//    unavailable, check_and_award_auto_badges and grant_manual_badge both
//    refuse to hand it out server-side — this only toggles new awards,
//    players who already hold the badge are unaffected. ──────────────────
export async function setBadgeAvailability(badgeId: string, isAvailable: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_set_badge_availability', { p_badge_id: badgeId, p_is_available: isAvailable })
  return { error: error ? friendlyBadgeError(error.message) : null }
}
