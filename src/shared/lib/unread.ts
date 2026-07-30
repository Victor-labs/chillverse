// src/shared/lib/unread.ts
// Single source of truth for "how many unread messages does this room have
// for this user" — used by features/chat/Chat.tsx (DM + Global rows),
// features/clubs/ClubsList.tsx (club rows), and features/chat/ChatHub.tsx
// (tab-level badges). Unread = messages from someone else, not deleted,
// newer than the later of my last_read_at / cleared_at for that room.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getUnreadCount(supabase: SupabaseClient, roomId: string, userId: string): Promise<number> {
  const { data: mem } = await supabase
    .from('room_members')
    .select('last_read_at, cleared_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!mem) return 0

  const since = [mem.last_read_at, mem.cleared_at].filter(Boolean).sort().pop() as string | undefined

  let q = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('deleted', false)
    .neq('sender_id', userId)
  if (since) q = q.gt('created_at', since)

  const { count } = await q
  return count ?? 0
}

/** Batched version — one query per room but run in parallel, for a list of rooms. */
export async function getUnreadCounts(supabase: SupabaseClient, roomIds: string[], userId: string): Promise<Map<string, number>> {
  const entries = await Promise.all(roomIds.map(async (id) => [id, await getUnreadCount(supabase, id, userId)] as const))
  return new Map(entries)
}
