// src/features/referral/types.ts

export interface ReferralMilestone {
  tier: number
  reward: number
}

/** 5 → 20, 10 → +40 (60 total), 15 → +60 (120 total), 20 → +80 (200 total). Stops at 20. */
export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { tier: 5,  reward: 20 },
  { tier: 10, reward: 40 },
  { tier: 15, reward: 60 },
  { tier: 20, reward: 80 },
]

export const REFERRAL_MAX_TOTAL = REFERRAL_MILESTONES.reduce((sum, m) => sum + m.reward, 0)

export interface ReferralInfo {
  referralCode: string
  referralCount: number
  referralTierPaid: number
}
