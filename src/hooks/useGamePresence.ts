// src/hooks/useGamePresence.ts
//
// Broadcasts the current user's activity to their Realtime Presence channel
// so that other users viewing their profile see it instantly on the live ticker.
//
// Usage — call at the top of any game component:
//
//   useGamePresence('trivia-clash')   // while playing
//   useGamePresence(null)             // not playing (clears presence)
//
// The channel is automatically cleaned up when the component unmounts,
// so leaving a game always clears the status with no extra code needed.

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useGamePresence(gameId: string | null) {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  useEffect(() => {
    // No user or no active game — nothing to broadcast
    if (!myId || !gameId) return

    const channel = supabase.channel(`user-activity:${myId}`, {
      config: { presence: { key: myId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ activity: 'playing', game: gameId, since: Date.now() })
        }
      })

    // Unmount = game ended or user quit — presence disappears automatically
    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [myId, gameId])
}
