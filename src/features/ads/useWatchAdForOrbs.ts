// src/features/ads/useWatchAdForOrbs.ts
//
// Orchestrates the full reward flow: mint a ticket server-side, show the ad,
// then redeem the ticket server-side. See supabase/functions/start-ad-reward
// and claim-ad-reward for why the ticket exists (stops faking the ad-complete
// event from devtools).

import { useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { showRewardedAd } from './rewardedAd'

type Status = 'idle' | 'loading_ticket' | 'playing' | 'crediting' | 'success' | 'error' | 'capped'

interface Result {
  status: Status
  errorMessage: string | null
  orbsEarned: number | null
  secondsRemaining: number | null
  watchAd: () => Promise<void>
  reset: () => void
}

export function useWatchAdForOrbs(onCredited?: (newBalance: number) => void): Result {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [orbsEarned, setOrbsEarned] = useState<number | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  const reset = () => {
    setStatus('idle')
    setErrorMessage(null)
    setOrbsEarned(null)
    setSecondsRemaining(null)
  }

  const watchAd = async () => {
    setErrorMessage(null)
    setStatus('loading_ticket')

    // ── 1. Get a single-use ticket before showing anything ────────────────
    const { data: startData, error: startErr } = await supabase.functions.invoke('start-ad-reward', {
      body: {},
    })

    if (startErr || !startData?.ok) {
      const msg = (startData as { error?: string } | null)?.error ?? 'Could not start ad — try again shortly.'
      if (startErr && (startErr as { context?: { status?: number } }).context?.status === 429) {
        setStatus('capped')
        setErrorMessage(msg)
      } else {
        setStatus('error')
        setErrorMessage(msg)
      }
      return
    }

    const ticketId: string = startData.ticket_id

    // ── 2. Show the ad ──────────────────────────────────────────────────────
    setStatus('playing')
    const watched = await showRewardedAd((remaining) => setSecondsRemaining(remaining))
    setSecondsRemaining(null)

    if (!watched) {
      setStatus('error')
      setErrorMessage('Ad was closed early or is unavailable right now — no Orbs earned.')
      return
    }

    // ── 3. Redeem the ticket ────────────────────────────────────────────────
    setStatus('crediting')
    const { data: claimData, error: claimErr } = await supabase.functions.invoke('claim-ad-reward', {
      body: { ticket_id: ticketId },
    })

    if (claimErr || !claimData?.ok) {
      const msg = (claimData as { error?: string } | null)?.error ?? 'Could not credit Orbs — contact support if this repeats.'
      setStatus('error')
      setErrorMessage(msg)
      return
    }

    setOrbsEarned(claimData.orbs_credited)
    setStatus('success')
    onCredited?.(claimData.new_balance)
  }

  return { status, errorMessage, orbsEarned, secondsRemaining, watchAd, reset }
}
