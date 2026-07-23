// src/features/halo-moments/useDailyCheckIn.ts
//
// Replaces useDailyFortune.ts as the once-per-load overlay driver. Fetches
// all three "first thing today" Halo moments in parallel — Daily Fortune,
// Daily Mystery Box, Halo's Daily Challenge — and hands them to
// DailyCheckInSheet.tsx as one combined flow instead of three separate
// popups (plan §4.3's recommendation, build-order step 6).
//
// No localStorage cooldown needed, same reasoning as the old
// useDailyFortune: idempotency for each piece already lives server-side
// (get_or_create_daily_fortune / get_or_create_daily_mystery_box /
// get_or_create_halo_challenge are all safe to re-call), so a reload just
// re-fetches today's already-decided state. `dismissed` only tracks whether
// the sheet has been closed THIS session — it does not gate re-opening the
// box or claiming the challenge, which stay available from the dashboard
// cards (MysteryBoxCard / HaloChallengeCard) after the sheet is dismissed,
// since the challenge in particular is completed gradually over the day and
// can't be finished inside a one-time login modal.

import { useEffect, useRef, useState } from 'react'
import {
  getOrCreateDailyFortune, getOrCreateDailyMysteryBox, openMysteryBox,
  getOrCreateHaloChallenge, claimHaloChallenge,
  type DailyFortune, type MysteryBoxState, type MysteryBoxResult, type HaloChallengeState,
} from './haloMoments'

export interface DailyCheckInData {
  fortune: DailyFortune | null
  mysteryBox: MysteryBoxState | null
  challenge: HaloChallengeState | null
}

export function useDailyCheckIn(userId: string | null) {
  const [data, setData] = useState<DailyCheckInData>({ fortune: null, mysteryBox: null, challenge: null })
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      getOrCreateDailyFortune(),
      getOrCreateDailyMysteryBox(),
      getOrCreateHaloChallenge(),
    ]).then(([fortune, mysteryBox, challenge]) => {
      setData({ fortune, mysteryBox, challenge })
      setLoaded(true)
    })
  }, [userId])

  /** Opens today's box (no-op if already opened) and folds the reward into
   *  local state so the sheet's step re-renders in "result" phase. */
  async function openBox(): Promise<MysteryBoxResult | null> {
    const { result } = await openMysteryBox()
    if (!result) return null
    setData(prev => prev.mysteryBox
      ? { ...prev, mysteryBox: { ...prev.mysteryBox, opened: true, rewardType: result.rewardType, rewardAmount: result.rewardAmount, rewardRef: result.rewardRef } }
      : prev)
    return result
  }

  async function claimChallenge(): Promise<{ xpReward: number } | null> {
    const reward = await claimHaloChallenge()
    if (reward) {
      setData(prev => prev.challenge ? { ...prev, challenge: { ...prev.challenge, claimed: true } } : prev)
    }
    return reward
  }

  function dismiss() {
    setDismissed(true)
  }

  return {
    ...data,
    // Sheet only shows once loaded, not dismissed this session, and there's
    // at least a fortune to show (mirrors the old hook's gate — a totally
    // failed fetch shouldn't show an empty sheet).
    shouldShow: loaded && !dismissed && !!data.fortune,
    openBox,
    claimChallenge,
    dismiss,
  }
}
