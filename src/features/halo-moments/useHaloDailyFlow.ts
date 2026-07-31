// src/features/halo-moments/useHaloDailyFlow.ts
//
// Redesign: Halo's Daily Challenge and the Daily Mystery Box are now two
// independent icon buttons (HaloChallengeIcon / MysteryBoxIcon) rather than
// a blocking modal + a gated floating button. There is no more accept/
// decline step — a challenge is active the moment it's picked, so this
// hook just fetches both pieces of state in parallel on mount.
//
// Backward compatibility: a challenge row created before this change may
// still be sitting at status 'offered' (the old default). Rather than
// leaving it stuck — record_halo_challenge_progress() only accrues
// progress once status = 'accepted' — this hook silently auto-accepts it
// in the background the first time it's seen, with no UI step for the
// player. New challenge rows are inserted already 'accepted' server-side
// (migration 0095), so this path only matters for pre-existing rows.

import { useEffect, useRef, useState } from 'react'
import {
  getOrCreateHaloChallenge, respondToHaloChallenge,
  getOrCreateDailyMysteryBox,
  type HaloChallengeState, type MysteryBoxState, type MysteryBoxResult,
} from './haloMoments'

export function useHaloDailyFlow(userId: string | null) {
  const [challenge, setChallenge] = useState<HaloChallengeState | null>(null)
  const [box, setBox] = useState<MysteryBoxState | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true

    getOrCreateHaloChallenge().then(c => {
      if (!c) return
      if (c.status === 'offered') {
        // Silent self-heal for old rows — no modal, no user action.
        respondToHaloChallenge(true).catch(console.error)
        setChallenge({ ...c, status: 'accepted' })
      } else {
        setChallenge(c)
      }
    })

    getOrCreateDailyMysteryBox().then(setBox)
  }, [userId])

  /** HaloChallengeIcon calls claimHaloChallenge() itself — this just syncs
   *  local state once it reports the result back. */
  function handleChallengeClaimed() {
    setChallenge(prev => (prev ? { ...prev, claimed: true } : prev))
  }

  /** MysteryBoxModal calls openMysteryBox() itself internally — this just
   *  syncs local state once it reports the result back via onOpened. */
  function handleBoxOpened(result: MysteryBoxResult) {
    setBox(prev => prev
      ? { ...prev, opened: true, rewardType: result.rewardType, rewardAmount: result.rewardAmount, rewardRef: result.rewardRef }
      : prev)
  }

  return {
    challenge,
    handleChallengeClaimed,
    box,
    handleBoxOpened,
  }
}
