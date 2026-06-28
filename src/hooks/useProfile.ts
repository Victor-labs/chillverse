// src/hooks/useProfile.ts
import { useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '../types'

interface UseProfileState {
  profile: Profile | null
  loading: boolean
  error: PostgrestError | null
  refetch: () => void
}

/**
 * Fetches the signed-in user's row from `profiles`, keyed off the session
 * exposed by useAuth(). Re-fetches whenever the underlying user changes
 * (e.g. login/logout).
 */
export function useProfile(): UseProfileState {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = () => setTick(t => t + 1)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        setProfile((data as Profile | null) ?? null)
        setError(fetchError ?? null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, tick])

  return { profile, loading, error, refetch }
}
