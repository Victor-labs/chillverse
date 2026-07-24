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

/** Short, concise reason string for the locked state — e.g. "Void plan · Profile pic" */
export function lockedReasonText(e: PostingEligibility): string {
  const missing: string[] = []
  if (!e.is_void_plan) missing.push('Void plan')
  if (!e.has_profile_pic) missing.push('Profile pic')
  return missing.length ? `Locked · ${missing.join(' · ')}` : 'Locked'
}
