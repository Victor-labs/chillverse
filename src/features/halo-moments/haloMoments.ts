// src/features/halo-moments/haloMoments.ts
//
// Client API layer for the "Halo Moments" pre-generated content pool
// (halo_lines / halo_line_history, see migration 0063). Every feature that
// wants a Halo line goes through here rather than querying halo_lines
// directly, so the picking logic (and any future swap from Tier A
// pre-generated to Tier B live-AI for a given moment type) stays in one
// place. Mirrors the client-API-layer style of weeklyMissions.ts.
//
// Currently wired up: 'fortune' (Daily Fortune), 'streak_milestone'
// (Streak tie-in), 'halo_saw_that' (achievement-unlock reaction toast),
// 'mystery_box_win'/'mystery_box_empty' (Daily Mystery Box),
// 'challenge_intro' (Halo's Daily Challenge), 'random_surprise' (Random
// Surprise Popup — claimed server-side, see claim_random_surprise() RPC).
// Remaining: 'lucky_user', 'inactivity_nudge' — content-ready, not yet
// wired to a feature.

import { supabase } from '../../shared/lib/supabase'

export type HaloMomentType =
  | 'fortune'
  | 'mystery_box_win'
  | 'mystery_box_empty'
  | 'streak_milestone'
  | 'challenge_intro'
  | 'halo_saw_that'
  | 'random_surprise'
  | 'lucky_user'
  | 'inactivity_nudge'

export interface HaloLine {
  id: string
  text: string
}

// Icon + toast type shared by every Halo moment that surfaces as a
// realtime notification toast (see useNotificationToast.ts / 'halo' entry
// in its TYPE_COLOR map).
const HALO_NOTIFICATION_ICON = 'sparkles'
const HALO_NOTIFICATION_TYPE = 'halo'

/**
 * Picks the next unseen line for a moment type via the get_next_halo_line()
 * RPC (migration 0063) — excludes whichever line this user was shown last
 * for that type, and records the new pick as "last shown".
 */
export async function getNextHaloLine(momentType: HaloMomentType): Promise<HaloLine | null> {
  const { data, error } = await supabase.rpc('get_next_halo_line', { p_moment_type: momentType })
  if (error) {
    console.error('[haloMoments] getNextHaloLine error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; text?: string } | null
  if (!row?.id || !row.text) return null
  return { id: row.id, text: row.text }
}

export interface DailyFortune {
  id: string
  text: string
  fortuneDate: string
}

/**
 * Idempotent per user/UTC-day — safe to call on every app load. Returns the
 * same fortune all day once one's been picked (migration 0065).
 */
export async function getOrCreateDailyFortune(): Promise<DailyFortune | null> {
  const { data, error } = await supabase.rpc('get_or_create_daily_fortune')
  if (error) {
    console.error('[haloMoments] getOrCreateDailyFortune error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id?: string; text?: string; fortune_date?: string }
    | null
  if (!row?.id || !row.text) return null
  return { id: row.id, text: row.text, fortuneDate: row.fortune_date ?? '' }
}

/**
 * Shared helper — inserts a 'halo' notification for `userId`, which the
 * existing realtime toast pipeline (useNotificationToast.ts, subscribed in
 * AppLayout via NotificationToastRenderer) picks up and shows automatically.
 * Never throws — a failed Halo flourish should never break the feature it's
 * attached to.
 */
async function pushHaloNotification(userId: string, line: HaloLine): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type: HALO_NOTIFICATION_TYPE,
    title: line.text,
    body: 'Halo',
    icon: HALO_NOTIFICATION_ICON,
  })
  if (error) console.error('[haloMoments] pushHaloNotification error:', error.message)
}

/**
 * Streak tie-in (plan §4.4) — call this alongside the existing
 * checkStreakMilestoneHighlight() when a streak milestone is hit. Doesn't
 * touch streak logic or rewards, purely adds Halo's voice on top via the
 * existing notification-toast pipeline.
 */
export async function notifyStreakMilestoneHalo(userId: string): Promise<void> {
  try {
    const line = await getNextHaloLine('streak_milestone')
    if (!line) return
    await pushHaloNotification(userId, line)
  } catch (err) {
    console.error('[haloMoments] notifyStreakMilestoneHalo error:', err)
  }
}

/**
 * "Halo Saw That" (plan §4.7) — fire-and-forget, low-frequency reaction
 * fired after a real achievement event. `chance` defaults to the plan's
 * "1-in-4" spec. Never awaited by callers for its result — always
 * fire-and-forget (`.catch(console.error)` at the call site), same
 * convention as triggerAchievementCheck.
 */
export async function notifyHaloSawThat(userId: string, chance = 0.25): Promise<void> {
  try {
    if (Math.random() >= chance) return
    const line = await getNextHaloLine('halo_saw_that')
    if (!line) return
    await pushHaloNotification(userId, line)
  } catch (err) {
    console.error('[haloMoments] notifyHaloSawThat error:', err)
  }
}

// ── Daily Mystery Box (plan §4.1) ──────────────────────────────────────────

export interface MysteryBoxState {
  boxDate: string
  opened: boolean
  rewardType: 'xp' | 'avatar_item' | 'nothing' | null
  rewardAmount: number | null
  rewardRef: string | null
}

/** Idempotent per user/UTC-day. Safe to call on load — doesn't open the box. */
export async function getOrCreateDailyMysteryBox(): Promise<MysteryBoxState | null> {
  const { data, error } = await supabase.rpc('get_or_create_daily_mystery_box')
  if (error) {
    console.error('[haloMoments] getOrCreateDailyMysteryBox error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { box_date?: string; opened?: boolean; reward_type?: MysteryBoxState['rewardType']; reward_amount?: number; reward_ref?: string }
    | null
  if (!row?.box_date) return null
  return {
    boxDate: row.box_date,
    opened: !!row.opened,
    rewardType: row.reward_type ?? null,
    rewardAmount: row.reward_amount ?? null,
    rewardRef: row.reward_ref ?? null,
  }
}

export interface MysteryBoxResult {
  rewardType: 'xp' | 'avatar_item' | 'nothing'
  rewardAmount: number
  rewardRef: string | null
  lineText: string | null
}

/** The actual "open" tap — rolls and grants the reward server-side. Throws
 *  (via the returned error) if already opened today; callers should disable
 *  the tap once `opened` is true rather than relying on this to reject. */
export async function openMysteryBox(): Promise<{ result: MysteryBoxResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('open_mystery_box')
  if (error) {
    console.error('[haloMoments] openMysteryBox error:', error.message)
    return { result: null, error: error.message }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { reward_type?: MysteryBoxResult['rewardType']; reward_amount?: number; reward_ref?: string; line_text?: string }
    | null
  if (!row?.reward_type) return { result: null, error: 'No reward returned' }
  return {
    result: {
      rewardType: row.reward_type,
      rewardAmount: row.reward_amount ?? 0,
      rewardRef: row.reward_ref ?? null,
      lineText: row.line_text ?? null,
    },
    error: null,
  }
}

// ── Halo's Daily Challenge (plan §4.2) ─────────────────────────────────────

/** Shared with HaloChallengeModal.tsx so the two challenge-progress displays
 *  (dashboard card + check-in sheet step) never drift out of sync. */
export const HALO_CHALLENGE_LABELS: Record<string, string> = {
  xp_earned: 'Earn {target} XP today',
  games_today: 'Play {target} games today',
  games_won: 'Win {target} games today',
}

export interface HaloChallengeState {
  challengeKey: string
  targetValue: number
  progress: number
  completed: boolean
  claimed: boolean
  xpReward: number
  introText: string | null
  /** 'offered' = shown in HaloChallengeModal, awaiting a response.
   *  'accepted' = tracked toward completion, visible on the dashboard card.
   *  'declined' = user passed — hidden everywhere for the rest of the day. */
  status: 'offered' | 'accepted' | 'declined'
}

/** Idempotent per user/UTC-day — the intro line is picked once and stored,
 *  so re-fetching the same day's challenge always returns the same intro. */
export async function getOrCreateHaloChallenge(): Promise<HaloChallengeState | null> {
  const { data, error } = await supabase.rpc('get_or_create_halo_challenge')
  if (error) {
    console.error('[haloMoments] getOrCreateHaloChallenge error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        challenge_key?: string; target_value?: number; progress?: number; completed?: boolean
        claimed?: boolean; xp_reward?: number; intro_text?: string; status?: string
      }
    | null
  if (!row?.challenge_key) return null
  return {
    challengeKey: row.challenge_key,
    targetValue: row.target_value ?? 0,
    progress: row.progress ?? 0,
    completed: !!row.completed,
    claimed: !!row.claimed,
    xpReward: row.xp_reward ?? 0,
    introText: row.intro_text ?? null,
    status: (row.status as HaloChallengeState['status']) ?? 'offered',
  }
}

/** Accept or decline today's challenge — only takes effect the first time
 *  (a challenge already responded to is left alone). */
export async function respondToHaloChallenge(accept: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('respond_halo_challenge', { p_accept: accept })
  if (error) {
    console.error('[haloMoments] respondToHaloChallenge error:', error.message)
    return false
  }
  return true
}

export async function claimHaloChallenge(): Promise<{ xpReward: number } | null> {
  const { data, error } = await supabase.rpc('claim_halo_challenge')
  if (error) {
    console.error('[haloMoments] claimHaloChallenge error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as { xp_reward?: number } | null
  if (!row) return null
  return { xpReward: row.xp_reward ?? 0 }
}

// ── Random Surprise Popup (plan §4.6) ──────────────────────────────────────
// No client-side line/toast handling needed — claim_random_surprise() grants
// the reward AND inserts the notification itself; the existing toast
// pipeline (Group 1) shows it automatically. This just reports whether
// today's grant was already used up, so useRandomSurprise.ts knows whether
// to keep the session-level timer running.

export async function claimRandomSurprise(): Promise<
  { alreadyClaimed: boolean; rewardType: 'diamonds' | 'xp' | 'nothing'; rewardAmount: number } | null
> {
  const { data, error } = await supabase.rpc('claim_random_surprise')
  if (error) {
    console.error('[haloMoments] claimRandomSurprise error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { already_claimed?: boolean; reward_type?: 'diamonds' | 'xp' | 'nothing'; reward_amount?: number }
    | null
  if (!row) return null
  return {
    alreadyClaimed: !!row.already_claimed,
    rewardType: row.reward_type ?? 'nothing',
    rewardAmount: row.reward_amount ?? 0,
  }
}

// ── Lucky User of the Day (plan §4.5) ──────────────────────────────────────
// Winner is picked server-side on a schedule (pick_lucky_user(), migration
// 0075) — the client never rolls or announces a winner. get_daily_lucky_user()
// only ever returns a row to the winner themselves (private by default per
// the plan), so an empty result here just means "not you today," not an error.

export interface LuckyUserState {
  xpReward: number
  diamondReward: number
  claimed: boolean
  lineText: string | null
}

/** Returns null for everyone except today's winner. */
export async function getDailyLuckyUser(): Promise<LuckyUserState | null> {
  const { data, error } = await supabase.rpc('get_daily_lucky_user')
  if (error) {
    console.error('[haloMoments] getDailyLuckyUser error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { xp_reward?: number; diamond_reward?: number; claimed?: boolean; line_text?: string }
    | null
  if (!row) return null
  return {
    xpReward: row.xp_reward ?? 0,
    diamondReward: row.diamond_reward ?? 0,
    claimed: !!row.claimed,
    lineText: row.line_text ?? null,
  }
}

export async function claimLuckyUserReward(): Promise<{ xpReward: number; diamondReward: number } | null> {
  const { data, error } = await supabase.rpc('claim_lucky_user_reward')
  if (error) {
    console.error('[haloMoments] claimLuckyUserReward error:', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as { xp_reward?: number; diamond_reward?: number } | null
  if (!row) return null
  return { xpReward: row.xp_reward ?? 0, diamondReward: row.diamond_reward ?? 0 }
}
