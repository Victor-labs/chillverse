// src/features/clubs/clubs.ts
// Thin typed layer over the Clubs RPCs (see supabase/migrations/0083_clubs_schema_and_rpcs.sql).
// Clubs are `chat_rooms` with type = 'club'. All mutations go through
// these RPCs — direct table writes to chat_rooms are blocked by RLS for
// this room type. Reading rooms/members/messages still goes straight to
// the tables, same as everywhere else in the app.

import { supabase } from '../../shared/lib/supabase'

export type ClubRole = 'member' | 'vp' | 'president'

export interface ClubSummary {
  id: string
  name: string
  member_count: number
  icon_key: string | null
  created_at: string
}

export interface ClubRoom {
  id: string
  name: string
  created_by: string
  is_private: boolean
  max_members: number
  icon_key: string | null
  join_code: string | null
  archived_at: string | null
  grace_started_at: string | null
  created_at: string
  pinned_message_id: string | null
  description: string | null
  welcome_message: string | null
  muted: boolean
  awaiting_list_enabled: boolean
}

export interface MyClub extends ClubRoom {
  my_role: ClubRole
  member_count: number
}

export interface ClubMemberRow {
  room_id: string
  user_id: string
  role: ClubRole
  joined_at: string
  username: string
  display_name: string | null
  avatar: string
  presence: string | null
  muted_until: string | null
}

// Errors raised by the RPCs come through as e.message straight from
// Postgres' `raise exception`. A couple are worth surfacing with
// friendlier copy; everything else passes through as-is.
const FRIENDLY_ERRORS: Record<string, string> = {
  club_limit_reached: "You've reached the 2-club limit for free accounts. Go Pro to create more.",
  club_vp_limit_reached: 'This club already has 2 VPs — demote one before promoting another.',
  'this club is invite-only': 'This club is invite-only — ask a member for the join code.',
  'club is full': 'This club is full.',
  'club not found': "That club doesn't exist, or the code is wrong.",
}

function friendlyError(e: any): Error {
  const msg = e?.message ?? 'Something went wrong'
  return new Error(FRIENDLY_ERRORS[msg] ?? msg)
}

export async function listPublicClubs(): Promise<ClubSummary[]> {
  const { data, error } = await supabase.rpc('list_public_clubs')
  if (error) throw friendlyError(error)
  return (data ?? []) as ClubSummary[]
}

export async function fetchMyClubs(userId: string): Promise<MyClub[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('role, chat_rooms!inner(id,name,created_by,is_private,max_members,icon_key,join_code,archived_at,grace_started_at,created_at,pinned_message_id,description,welcome_message,muted,awaiting_list_enabled)')
    .eq('user_id', userId)
    .eq('chat_rooms.type', 'club')
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as any[]
  if (rows.length === 0) return []

  const roomIds = rows.map(r => r.chat_rooms.id)
  const { data: counts, error: countErr } = await supabase
    .from('room_members')
    .select('room_id')
    .in('room_id', roomIds)
  if (countErr) throw new Error(countErr.message)

  const countByRoom = new Map<string, number>()
  for (const c of counts ?? []) countByRoom.set(c.room_id, (countByRoom.get(c.room_id) ?? 0) + 1)

  return rows
    .map(r => ({
      ...(r.chat_rooms as ClubRoom),
      my_role: r.role as ClubRole,
      member_count: countByRoom.get(r.chat_rooms.id) ?? 1,
    }))
    .sort((a, b) => (a.archived_at ? 1 : 0) - (b.archived_at ? 1 : 0))
}

export async function fetchClub(roomId: string): Promise<ClubRoom | null> {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id,name,created_by,is_private,max_members,icon_key,join_code,archived_at,grace_started_at,created_at,pinned_message_id,description,welcome_message,muted,awaiting_list_enabled')
    .eq('id', roomId)
    .eq('type', 'club')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ClubRoom | null
}

export async function fetchClubMembers(roomId: string): Promise<ClubMemberRow[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('room_id, user_id, role, joined_at, muted_until, profiles!inner(username, display_name, avatar, presence)')
    .eq('room_id', roomId)
    .order('role', { ascending: true }) // president, vp, member — matches alphabetical only incidentally; re-sorted below
  if (error) throw new Error(error.message)

  const roleOrder: Record<ClubRole, number> = { president: 0, vp: 1, member: 2 }
  return (data ?? [])
    .map((r: any) => ({
      room_id: r.room_id,
      user_id: r.user_id,
      role: r.role as ClubRole,
      joined_at: r.joined_at,
      muted_until: r.muted_until,
      username: r.profiles.username,
      display_name: r.profiles.display_name,
      avatar: r.profiles.avatar,
      presence: r.profiles.presence,
    }))
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role])
}

export async function createClub(opts: { name: string; isPrivate: boolean }): Promise<string> {
  const { data, error } = await supabase.rpc('create_club', {
    p_name: opts.name,
    p_is_private: opts.isPrivate,
  })
  if (error) throw friendlyError(error)
  return data as string
}

export async function joinClub(opts: { roomId?: string; code?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('join_club', {
    p_room_id: opts.roomId ?? null,
    p_code: opts.code ?? null,
  })
  if (error) throw friendlyError(error)
  return data as string
}

export async function leaveClub(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_club', { p_room_id: roomId })
  if (error) throw friendlyError(error)
}

export async function deleteClub(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_club', { p_room_id: roomId })
  if (error) throw friendlyError(error)
}

export async function promoteClubMember(roomId: string, userId: string, newRole: 'member' | 'vp'): Promise<void> {
  const { error } = await supabase.rpc('promote_club_member', { p_room_id: roomId, p_user_id: userId, p_new_role: newRole })
  if (error) throw friendlyError(error)
}

export async function removeClubMember(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_club_member', { p_room_id: roomId, p_user_id: userId })
  if (error) throw friendlyError(error)
}

export async function muteClubMember(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('mute_club_member', { p_room_id: roomId, p_user_id: userId })
  if (error) throw friendlyError(error)
}

export async function unmuteClubMember(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('unmute_club_member', { p_room_id: roomId, p_user_id: userId })
  if (error) throw friendlyError(error)
}

export async function updateClubSettings(roomId: string, opts: {
  name?: string; isPrivate?: boolean; description?: string; welcomeMessage?: string;
  muted?: boolean; awaitingListEnabled?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('update_club_settings', {
    p_room_id: roomId,
    p_name: opts.name ?? null,
    p_is_private: opts.isPrivate ?? null,
    p_description: opts.description ?? null,
    p_welcome_message: opts.welcomeMessage ?? null,
    p_muted: opts.muted ?? null,
    p_awaiting_list_enabled: opts.awaitingListEnabled ?? null,
  })
  if (error) throw friendlyError(error)
}

export async function regenerateClubCode(roomId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_club_code', { p_room_id: roomId })
  if (error) throw friendlyError(error)
  return data as string
}

export async function transferClubOwnership(roomId: string, newPresidentId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_club_ownership', { p_room_id: roomId, p_new_president_id: newPresidentId })
  if (error) throw friendlyError(error)
}

export async function clearClubChat(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_club_chat', { p_room_id: roomId })
  if (error) throw friendlyError(error)
}

export async function clubPinMessage(roomId: string, messageId: string): Promise<void> {
  const { error } = await supabase.rpc('club_pin_message', { p_room_id: roomId, p_message_id: messageId })
  if (error) throw friendlyError(error)
}

export async function clubUnpinMessage(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('club_unpin_message', { p_room_id: roomId })
  if (error) throw friendlyError(error)
}

export async function clubDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('club_delete_message', { p_message_id: messageId })
  if (error) throw friendlyError(error)
}
