// src/features/clubs/invites.ts
// Phase 2 of the Clubs redesign (see /areas/chillverse-clubs-redesign.md):
// Global Chat now joins the same invite-link model clubs already use.
// This module is the shared "paste a link, preview it, join it" layer —
// it works for club links and the global-chat link alike, since invite
// codes are unique across every room type (see supabase/migrations/0093).
//
// Users only ever handle full links here, never a bare code — there's no
// manual code-entry path anymore for anything.

import { supabase } from '../../shared/lib/supabase'
import { joinClub } from './clubs'

export interface InvitePreview {
  roomId: string
  roomType: string
  name: string
  iconKey: string | null
  memberCount: number
}

/** Pulls the `code` query param out of a pasted invite link. Returns null
 *  if the pasted text isn't a recognizable link with a code on it. */
export function parseInviteCode(pasted: string): string | null {
  const trimmed = pasted.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed, window.location.origin)
    return url.searchParams.get('code')
  } catch {
    return null
  }
}

export async function getInvitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_code: code })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    roomId: row.room_id,
    roomType: row.room_type,
    name: row.name,
    iconKey: row.icon_key,
    memberCount: row.member_count,
  }
}

/** Joins whatever room a code resolves to (club or global) and returns
 *  the room id to navigate to. */
export async function joinByInviteCode(code: string, roomType: string): Promise<string> {
  if (roomType === 'global') return joinGlobal(code)
  return joinClub({ code })
}

export async function joinGlobal(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_global', { p_code: code })
  if (error) throw new Error(error.message)
  return data as string
}

/** Used by the in-app "Suggested: Global Chat" tile — no code needed
 *  client-side, the server checks the admin invite toggle itself. */
export async function joinGlobalDirect(): Promise<string> {
  const { data, error } = await supabase.rpc('join_global_direct')
  if (error) throw new Error(error.message)
  return data as string
}

/** Reads whether Global Chat invites are currently open, its id, and
 *  whether the current user is already a member — used to decide whether
 *  to show the "Suggested: Global Chat" tile at all. Note: the
 *  `chat_rooms` row for type='global' is readable by anyone per existing
 *  RLS (it always was, so people could see the room existed before
 *  joining) — so this isn't a secret lookup, just a convenience read. */
export async function fetchGlobalSuggestion(userId: string): Promise<{ roomId: string; open: boolean; memberCount: number; isMember: boolean } | null> {
  const { data: room, error } = await supabase
    .from('chat_rooms').select('id, join_code').eq('type', 'global').single()
  if (error || !room) return null

  const [{ count: memberCount }, { data: myMembership }] = await Promise.all([
    supabase.from('room_members').select('user_id', { count: 'exact', head: true }).eq('room_id', room.id),
    supabase.from('room_members').select('user_id').eq('room_id', room.id).eq('user_id', userId).maybeSingle(),
  ])

  return { roomId: room.id, open: !!room.join_code, memberCount: memberCount ?? 0, isMember: !!myMembership }
}

/** Reads whether Global Chat invites are currently open. Note: the
 *  `chat_rooms` row for type='global' is readable by anyone per existing
 *  RLS (it always was, so people could see the room existed before
 *  joining) — so this isn't a secret lookup, just a convenience read to
 *  decide whether to show the Suggested tile. */
export async function fetchGlobalInviteStatus(): Promise<{ open: boolean; joinCode: string | null }> {
  const { data, error } = await supabase.from('chat_rooms').select('join_code').eq('type', 'global').single()
  if (error) throw new Error(error.message)
  return { open: !!data?.join_code, joinCode: data?.join_code ?? null }
}

/** Staff-only. Enabling generates a fresh code; disabling nulls it out. */
export async function toggleGlobalInvite(enabled: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('toggle_global_invite', { p_enabled: enabled })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

export function buildGlobalInviteLink(joinCode: string): string {
  return `${window.location.origin}/chat?code=${joinCode}`
}
