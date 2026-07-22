// src/shared/lib/proPlans.ts
// Central config for Chillverse Premium (Orbit / Void). Plan codes come
// from the Paystack dashboard (Payments → Plans) — update PLAN_CODES if
// you ever recreate a plan there, since the code changes.
//
// UPDATE: pricing changed to monthly-only (yearly retired) — ₦1,400 Orbit,
// ₦3,500 Void — with new Paystack plan codes. This file previously still
// had the OLD ₦3,500/₦7,500 codes, which had drifted out of sync with
// supabase/functions/paystack-webhook/index.ts (already using the new
// codes) and supabase/functions/activate-premium/index.ts (fixed to match
// in the same pass as this file). The old codes are kept commented below
// for reference only — do NOT reuse them for new plans, they're retired
// but existing subscribers' renewals still recognize them server-side.
//
//   Old (retired):
//     orbit monthly PLN_9jnq69avo1tr60t  ₦3,500   orbit yearly PLN_iqt6skasttaqc79  ₦35,000
//     void  monthly PLN_aaz0myfn9x3s819  ₦7,500   void  yearly PLN_9bhvy7t70adfro9  ₦75,000

export type ProTier = 'orbit' | 'void'
export type BillingInterval = 'monthly' | 'yearly'

export interface ProPlanOption {
  tier: ProTier
  interval: BillingInterval
  planCode: string
  amountKobo: number      // Paystack amount in kobo (NGN × 100)
  priceDisplay: string    // "₦1,400"
}

// Yearly billing is retired — Pro.tsx only ever reads `.monthly` now. The
// `yearly` entries below are kept ONLY so PLAN_CODES keeps its existing
// Record<ProTier, Record<BillingInterval, ProPlanOption>> shape (nothing
// currently reads them, but removing the key would be a breaking type
// change for no benefit). They intentionally still point at the old
// legacy codes/prices, since nothing new is ever sold under them.
export const PLAN_CODES: Record<ProTier, Record<BillingInterval, ProPlanOption>> = {
  orbit: {
    monthly: { tier: 'orbit', interval: 'monthly', planCode: 'PLN_4jnmmlz3nslvwhy', amountKobo: 140_000,  priceDisplay: '₦1,400' },
    yearly:  { tier: 'orbit', interval: 'yearly',  planCode: 'PLN_iqt6skasttaqc79', amountKobo: 3_500_000, priceDisplay: '₦35,000' }, // retired, legacy-only
  },
  void: {
    monthly: { tier: 'void', interval: 'monthly', planCode: 'PLN_vdn3njvnkm67ci6', amountKobo: 350_000,  priceDisplay: '₦3,500' },
    yearly:  { tier: 'void', interval: 'yearly',  planCode: 'PLN_9bhvy7t70adfro9', amountKobo: 7_500_000, priceDisplay: '₦75,000' }, // retired, legacy-only
  },
}

export interface ProTierInfo {
  tier: ProTier
  name: string
  tagline: string
  color: string
  glow: string
  monthlyDisplay: string   // what's shown next to the toggle price, always monthly-equivalent
  badge?: string
  /** Card-header illustration (Discord-Nitro-card style), shown above the plan name/price. */
  image: string
  /** Short list shown on the pricing card itself — keep this to 4 items max. */
  cardFeatures: string[]
  /** Full feature list, shown only in the "Compare plans" table below the cards. */
  features: string[]
}

// Free tier removed from this array — Pro.tsx's pricing cards are Orbit +
// Void only now (per the redesign). isProActive/getSessionLimits below
// still handle a non-Pro profile fine without a 'free' entry existing here.
export const TIERS: ProTierInfo[] = [
  {
    tier: 'orbit',
    name: 'Orbit',
    tagline: 'For players who want more room to play',
    color: 'var(--blue)',
    glow: 'rgba(79,142,247,0.35)',
    monthlyDisplay: '₦1,400',
    badge: 'POPULAR',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Willam.png',
    cardFeatures: [
      'Everything in Free',
      '19 sessions a day (up from 15 on Free)',
      'Version 2.0 – 4.0 unlocked',
      'More games',
    ],
    features: [
      'Everything in Free',
      '19 sessions a day (up from 15 on Free)',
      'Version 2.0 – 4.0 unlocked',
      'More games',
      'Exclusive Orbit tag on your profile',
      'Ability to set polls',
    ],
  },
  {
    tier: 'void',
    name: 'Void',
    tagline: 'Full access, no limits worth mentioning',
    color: 'var(--purple)',
    glow: 'rgba(155,109,255,0.4)',
    monthlyDisplay: '₦3,500',
    badge: 'BEST VALUE',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Willam2.png',
    cardFeatures: [
      'Everything in Free + Orbit',
      '25 sessions a day (up from 19 on Orbit)',
      'Exclusive Void tag + profile pic added to your inventory',
      'Theme picker',
    ],
    features: [
      'Everything in Free + Orbit',
      '25 sessions a day (up from 19 on Orbit)',
      'Exclusive Void tag + profile pic added to your inventory',
      'Theme picker',
      'Full profile customisation',
      'Movie page never closes',
      'Multiplayer access',
      'Feed posting',
      'VN sending',
    ],
  },
]

// NOTE: the numbers above are real daily session counts (see
// getSessionLimits below), not multipliers — a previous version of this
// copy claimed "10×" (Orbit) and "20×+" (Void) more sessions, which never
// matched the actual 15 → 19 → 25/day figures. "Social Island" and a
// Void-exclusive "live session-limit tracker" were also advertised here
// at one point; neither was ever built (the session counter in Games.tsx
// is shown to every tier, not just Void), so both were removed rather than
// left as unfulfilled promises. Reintroduce them here only once they
// actually exist.

// ── Shared "is this user's Pro plan currently active" check ──────
// Single source of truth so Games.tsx, Version.tsx, Mall.tsx, Profile.tsx,
// Settings.tsx, Artifacts.tsx etc. all agree on what "Pro" means (is_pro
// flag AND not expired).
export function isProActive(
  profile: { is_pro?: boolean | null; pro_expires_at?: string | null } | null | undefined,
): boolean {
  if (!profile?.is_pro) return false
  if (!profile.pro_expires_at) return true
  return new Date(profile.pro_expires_at) > new Date()
}

// ── Daily session allowance + cooldown by tier ────────────────────
// Free: 15 sessions/day, 4.5h cooldown once burned out.
// Orbit: 19 sessions/day, 3.5h cooldown.
// Void:  25 sessions/day, 3.5h cooldown.
export interface SessionLimitConfig {
  limit: number
  cooldownHours: number
}

export function getSessionLimits(
  profile: { is_pro?: boolean | null; pro_tier?: ProTier | string | null; pro_expires_at?: string | null } | null | undefined,
): SessionLimitConfig {
  if (!isProActive(profile)) return { limit: 15, cooldownHours: 4.5 }
  if (profile?.pro_tier === 'void') return { limit: 25, cooldownHours: 3.5 }
  return { limit: 19, cooldownHours: 3.5 } // orbit (also the safe default for any active-but-unrecognized tier)
}

// Kept for any external caller still importing it (harmless — just no
// longer surfaced in the Pro.tsx UI since yearly billing is retired).
export function getYearlySavingsPct(tier: ProTier): number {
  const m = PLAN_CODES[tier].monthly.amountKobo * 12
  const y = PLAN_CODES[tier].yearly.amountKobo
  return Math.round(((m - y) / m) * 100)
}
