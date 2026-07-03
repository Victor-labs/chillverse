// src/features/posts/usePostEligibility.ts
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { checkPostingEligibility } from './posts'
import type { PostingEligibility } from './types'

interface UsePostEligibilityState {
  eligibility: PostingEligibility | null
  loading: boolean
}

/**
 * Only queried when the user actually opens the composer (see Composer.tsx) —
 * viewing the feed itself is never gated.
 */
export function usePostEligibility(active: boolean): UsePostEligibilityState {
  const { user } = useAuth()
  const [eligibility, setEligibility] = useState<PostingEligibility | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!active || !user) return
    let alive = true
    setLoading(true)
    checkPostingEligibility(user.id).then(result => {
      if (alive) {
        setEligibility(result)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [active, user])

  return { eligibility, loading }
}

/** Short, concise reason string for the locked state — e.g. "Gold Rank · 50 games · Profile pic" */
export function lockedReasonText(e: PostingEligibility): string {
  const missing: string[] = []
  if (!e.is_gold_rank) missing.push('Gold Rank')
  if (e.games_completed < e.games_required) missing.push(`${e.games_required} games`)
  if (!e.has_profile_pic) missing.push('Profile pic')
  return missing.length ? `Locked · ${missing.join(' · ')}` : 'Locked'
}
