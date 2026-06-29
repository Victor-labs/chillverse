// src/hooks/useChallengeListener.ts
//
// Runs globally in App.tsx (inside AppLayout).
// Listens for:
//   1. Incoming challenge invites  → shows IncomingChallengeOverlay
//   2. Accepted / declined updates → passed back via callbacks
//
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface IncomingChallenge {
  id: string
  challenger_id: string
  challenger_name: string
  challenger_avatar: string | null
  game: string
  expires_at: string
}

export interface ChallengeUpdate {
  id: string
  status: 'accepted' | 'declined' | 'timeout' | 'completed'
  winner_id?: string | null
  loser_id?: string | null
  xp_awarded?: number
}

interface UseChallengeListenerReturn {
  incoming: IncomingChallenge | null
  update: ChallengeUpdate | null
  clearIncoming: () => void
  clearUpdate: () => void
}

export function useChallengeListener(): UseChallengeListenerReturn {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null)
  const [update, setUpdate]     = useState<ChallengeUpdate | null>(null)

  const clearIncoming = useCallback(() => setIncoming(null), [])
  const clearUpdate   = useCallback(() => setUpdate(null),   [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`challenge-listener:${userId}`)
      // ── New invite arrives (I am challenged_id) ──
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'challenges',
        filter: `challenged_id=eq.${userId}`,
      }, async (payload) => {
        const row = payload.new as {
          id: string; challenger_id: string; game: string; expires_at: string
        }
        // Fetch challenger profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, display_name, avatar')
          .eq('id', row.challenger_id)
          .single()

        if (!prof) return

        const inv: IncomingChallenge = {
          id:               row.id,
          challenger_id:    row.challenger_id,
          challenger_name:  prof.display_name ?? prof.username,
          challenger_avatar: prof.avatar ?? null,
          game:             row.game,
          expires_at:       row.expires_at,
        }
        setIncoming(inv)
      })
      // ── Status update on a challenge I sent or received ──
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'challenges',
        // We'll filter client-side since Supabase filter only allows one column
      }, (payload) => {
        const row = payload.new as {
          id: string; status: string;
          challenger_id: string; challenged_id: string;
          winner_id?: string | null; loser_id?: string | null; xp_awarded?: number
        }
        // Only care if this user is a participant
        if (row.challenger_id !== userId && row.challenged_id !== userId) return

        if (['accepted','declined','timeout','completed'].includes(row.status)) {
          setUpdate({
            id:         row.id,
            status:     row.status as ChallengeUpdate['status'],
            winner_id:  row.winner_id,
            loser_id:   row.loser_id,
            xp_awarded: row.xp_awarded,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return { incoming, update, clearIncoming, clearUpdate }
}
