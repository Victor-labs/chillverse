// src/features/referral/referral.ts
import { supabase } from '../../shared/lib/supabase'
import type { ReferralInfo } from './types'

export async function fetchReferralInfo(userId: string): Promise<ReferralInfo | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code, referral_count, referral_tier_paid')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    console.error('fetchReferralInfo error:', error)
    return null
  }

  return {
    referralCode: data.referral_code,
    referralCount: data.referral_count,
    referralTierPaid: data.referral_tier_paid,
  }
}

export function buildReferralLink(referralCode: string): string {
  return `${window.location.origin}/signup?ref=${referralCode}`
}

/** Stashes an incoming ?ref= code so Signup.tsx can pre-fill the field on load. */
const REF_STORAGE_KEY = 'cv_pending_referral_code'

export function stashReferralCode(code: string) {
  try { sessionStorage.setItem(REF_STORAGE_KEY, code.toUpperCase()) } catch { /* ignore */ }
}

export function consumePendingReferralCode(): string | null {
  try {
    const code = sessionStorage.getItem(REF_STORAGE_KEY)
    if (code) sessionStorage.removeItem(REF_STORAGE_KEY)
    return code
  } catch {
    return null
  }
}

/**
 * A persistent per-device identifier, generated once and kept in
 * localStorage (survives across accounts created on the same device,
 * unlike sessionStorage/cookies scoped to a single session). Sent as
 * signup metadata so the server can detect the same device creating
 * multiple accounts to farm referral rewards — see handle_new_user() /
 * migration 0093_signup_metadata_and_referral_on_signup.sql.
 */
const DEVICE_ID_KEY = 'cv_device_id'

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage unavailable (private mode, etc.) — fraud check is just
    // skipped server-side for this signup rather than blocking it.
    return crypto.randomUUID()
  }
}

/**
 * Links a new signup to whoever referred them. Referral linking + crediting
 * now happens immediately at account creation, server-side, in the
 * handle_new_user() trigger (see migration 0093) — this is kept only as a
 * harmless fallback for any pre-existing account created before that
 * migration that still has a pending code and no referred_by set.
 */
export async function applyReferralCode(userId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('apply_referral_code', { p_user_id: userId, p_code: code })
  if (error) {
    console.error('applyReferralCode error:', error)
    return false
  }
  return !!data
}

// ── Referral page visited flag ──────────────────────────────────
// Drives the "never visited the referral page" advert — once true,
// stays true forever, so the advert stops nagging that person.
export async function markReferralPageVisited(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ referral_page_visited: true })
    .eq('id', userId)
    .eq('referral_page_visited', false) // no-op write if already true
  if (error) console.error('markReferralPageVisited error:', error)
}

export async function hasVisitedReferralPage(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_page_visited')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) {
    console.error('hasVisitedReferralPage error:', error)
    return true // fail safe — don't nag if we can't tell
  }
  return data.referral_page_visited
}
