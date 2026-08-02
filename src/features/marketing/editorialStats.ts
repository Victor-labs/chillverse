// src/features/marketing/editorialStats.ts
// Data layer for the public /editorial-room page's "The Stats" section.
// Backed by the get_editorial_room_stats() RPC (migration 0098) — a
// SECURITY DEFINER function so it works for anonymous visitors, and
// returns nothing but aggregate counts (see that migration for exactly
// what each number means).
import { supabase } from '../../shared/lib/supabase'

export interface EditorialRoomStats {
  activeUsers: number
  sessionsPlayed: number
  gamesPlayed: number
}

const FALLBACK_STATS: EditorialRoomStats = { activeUsers: 0, sessionsPlayed: 0, gamesPlayed: 0 }

export async function fetchEditorialRoomStats(): Promise<EditorialRoomStats> {
  const { data, error } = await supabase.rpc('get_editorial_room_stats')
  if (error || !data) {
    console.error('fetchEditorialRoomStats error:', error)
    return FALLBACK_STATS
  }
  return {
    activeUsers: Number(data.active_users) || 0,
    sessionsPlayed: Number(data.sessions_played) || 0,
    gamesPlayed: Number(data.games_played) || 0,
  }
}
