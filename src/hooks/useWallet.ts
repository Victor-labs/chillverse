// src/hooks/useWallet.ts
import { useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { UserWallet } from '../types'

interface UseWalletState {
  wallet: UserWallet | null
  loading: boolean
  error: PostgrestError | null
}

/**
 * Fetches the signed-in user's row from `user_wallets`.
 *
 * NOTE on naming: the column is `gem_balance` in the database (left
 * unchanged on purpose — do not rename), but every place this value is
 * RENDERED to the user should display the word "Diamonds", not "gems".
 * This hook just exposes the raw wallet row; the display label is a
 * presentation-layer concern handled wherever wallet.gem_balance is shown.
 *
 * If no wallet row exists yet for this user (e.g. user_wallets has no
 * insert policy and no row was ever created for them), `wallet` resolves
 * to null rather than throwing — callers should treat null as "0 Diamonds".
 */
export function useWallet(): UseWalletState {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<UserWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  useEffect(() => {
    if (!user) {
      setWallet(null)
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        setWallet((data as UserWallet | null) ?? null)
        setError(fetchError ?? null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  return { wallet, loading, error }
}
