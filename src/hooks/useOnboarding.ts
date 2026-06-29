// src/hooks/useOnboarding.ts
//
// Tracks which pages a player has already dismissed onboarding for.
// Backed by profiles.onboarding_seen (jsonb), so it's tied to the ACCOUNT,
// not the device — it survives logout/login and only ever resets if the
// profile row itself is deleted and recreated (i.e. account deletion).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type OnboardingSeenMap = Record<string, boolean>

export function useOnboarding(pageKey: string) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [seen, setSeen] = useState(true) // default true while loading, so nothing flashes open

  useEffect(() => {
    let active = true

    if (!user) {
      setLoading(false)
      return
    }

    supabase
      .from('profiles')
      .select('onboarding_seen')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          // Fail safe: don't block the page behind a popup if the read fails.
          setSeen(true)
          setLoading(false)
          return
        }
        const map = (data?.onboarding_seen ?? {}) as OnboardingSeenMap
        setSeen(map[pageKey] === true)
        setLoading(false)
      })

    return () => { active = false }
  }, [user, pageKey])

  const markSeen = useCallback(async () => {
    if (!user) return
    setSeen(true) // optimistic — popup closes immediately

    // Merge into existing jsonb rather than overwrite, so other pages'
    // flags already stored aren't clobbered by a stale local read.
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_seen')
      .eq('id', user.id)
      .single()

    const current = (data?.onboarding_seen ?? {}) as OnboardingSeenMap
    const updated = { ...current, [pageKey]: true }

    await supabase
      .from('profiles')
      .update({ onboarding_seen: updated })
      .eq('id', user.id)
  }, [user, pageKey])

  return { loading, seen, markSeen }
}
