// src/hooks/useMallItems.ts
import { useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { MallItem } from '../types'

interface UseMallItemsState {
  items: MallItem[]
  loading: boolean
  error: PostgrestError | null
}

/**
 * Fetches all active (is_active = true) Mall items. Items are filtered by
 * category/sub_category on the client side in the Mall page itself, since
 * the full catalog is small enough to fetch once and slice in memory
 * rather than re-querying per section/tab.
 */
export function useMallItems(): UseMallItemsState {
  const [items, setItems] = useState<MallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    supabase
      .from('mall_items')
      .select('*')
      .eq('is_active', true)
      .order('rarity', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (!active) return
        setItems((data as MallItem[] | null) ?? [])
        setError(fetchError ?? null)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { items, loading, error }
}
