// src/features/halo-moments/useHaloDailyFlow.ts
//
// Replaces useDailyCheckIn.ts under the redesigned flow (no more combined
// sheet). Sequencing:
//   1. Fetch today's challenge. If status === 'offered', show
//      HaloChallengeModal and wait for Accept/Decline.
//   2. Once responded to (or if it was already accepted/declined earlier
//      today, e.g. a page reload) fetch the mystery box and let the
//      floating button appear.
// Daily Fortune has no client-side piece at all anymore — it's a scheduled
// push notification (migration 0079), not something this hook fetches.

import { useEffect, useRef, useState } from 'react'
import {
  getOrCreateHaloChallenge, respondToHaloChallenge,
  getOrCreateDailyMysteryBox,
  type HaloChallengeState, type MysteryBoxState, type MysteryBoxResult,
} from './haloMoments'

export function useHaloDailyFlow(userId: string | null) {
  const [challenge, setChallenge] = useState<HaloChallengeState | null>(null)
  const [box, setBox] = useState<MysteryBoxState | null>(null)
  const [boxGateOpen, setBoxGateOpen] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true
    getOrCreateHaloChallenge().then(c => {
      setChallenge(c)
      // No challenge today, or already responded to in an earlier session
      // today — nothing blocking the mystery box, fetch it right away.
      if (!c || c.status !== 'offered') {
        setBoxGateOpen(true)
      }
    })
  }, [userId])

  useEffect(() => {
    if (!boxGateOpen || !userId) return
    getOrCreateDailyMysteryBox().then(setBox)
  }, [boxGateOpen, userId])

  async function respond(accept: boolean) {
    if (!challenge) return
    await respondToHaloChallenge(accept)
    setChallenge(prev => prev ? { ...prev, status: accept ? 'accepted' : 'declined' } : prev)
    setBoxGateOpen(true)
  }

  /** MysteryBoxModal calls openMysteryBox() itself internally — this just
   *  syncs local state once it reports the result back via onOpened. */
  function handleBoxOpened(result: MysteryBoxResult) {
    setBox(prev => prev
      ? { ...prev, opened: true, rewardType: result.rewardType, rewardAmount: result.rewardAmount, rewardRef: result.rewardRef }
      : prev)
  }

  return {
    showChallengeModal: !!challenge && challenge.status === 'offered',
    challenge,
    acceptChallenge: () => respond(true),
    declineChallenge: () => respond(false),
    box,
    boxButtonVisible: boxGateOpen,
    handleBoxOpened,
  }
}
