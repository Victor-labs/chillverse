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

/** Stashes an incoming ?ref= code so Signup.tsx can apply it after the account is created. */
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

/** Links a new signup to whoever referred them. Safe to call even if no code is pending. */
export async function applyReferralCode(userId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('apply_referral_code', { p_user_id: userId, p_code: code })
  if (error) {
    console.error('applyReferralCode error:', error)
    return false
  }
  return !!data
}

/**
 * Call after every completed game. Server-side function is idempotent —
 * it only pays out once per referred user, so it's safe to fire on every
 * game completion without tracking "is this their first game" client-side.
 */
export async function completeReferralIfEligible(userId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_referral', { p_user_id: userId })
  if (error) console.error('completeReferralIfEligible error:', error)
}
