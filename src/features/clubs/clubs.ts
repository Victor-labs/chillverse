// src/features/clubs/clubs.ts
// Thin typed layer over the Clubs RPCs. Clubs are `chat_rooms` with
// type = 'club'. All mutations go through these RPCs — direct table
// writes to chat_rooms/club_channels are blocked by RLS. Reading rooms/
// members/messages/channels still goes straight to the tables, same as
// everywhere else in the app.
//
// Phase 1 (see /areas/chillverse-clubs-redesign.md): every club is
// invite-only, always — join_club always needs a code.
//
// Phase 3: clubs are multi-channel now, capped at 4 (enforced server-
// side in create_club_channel). Every club gets a `general` channel on
// creation, set as chat_rooms.default_channel_id — that's the channel a
// new joiner lands in. See ClubChat.tsx for the channel switcher.
//
// Phase 4: creation supports an uploaded icon (uploadClubIcon, bucket
// 'club-icons') and picking up to 3 extra channels at creation time on
// top of the auto-created `general`. See CreateClubModal.tsx.

import { supabase } from '../../shared/lib/supabase'

export type ClubRole = 'member' | 'vp' | 'president'

export interface ClubRoom {
  id: string
  name: string
  created_by: string
  is_private: boolean
  max_members: number
  icon_key: string | null
  icon_url: string | null
  join_code: string | null
  archived_at: string | null
  grace_started_at: string | null
  created_at: string
  pinned_message_id: string | null
  description: string | null
  welcome_message: string | null
  muted: boolean
  default_channel_id: string | null
}

export interface ClubChannel {
  id: string
  room_id: string
  name: string
  position: number
  created_at: string
  created_by: string | null
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
  channel_limit_reached: 'A club can only have 4 channels.',
  'cannot delete the only channel': "You can't delete a club's last channel.",
  'this club is invite-only': 'This club is invite-only — you need a join code or link.',
  'club is full': 'This club is full.',
  'club not found': "That club doesn't exist, or the code is wrong.",
  'already a member of this club': "They're already a member of this club.",
  'not authorized': "Only the president or VP can do that.",
}

function friendlyError(e: any): Error {
  const msg = e?.message ?? 'Something went wrong'
  return new Error(FRIENDLY_ERRORS[msg] ?? msg)
}

/** The invite link for a club — tapping it from anywhere (WhatsApp, SMS,
 *  etc.) opens the app and, if the person is a member already or joins
 *  successfully, drops them straight into the club. See ClubChat.tsx for
 *  the auto-join-on-load side of this. */
export function buildClubInviteLink(roomId: string, joinCode: string): string {
  return `${window.location.origin}/clubs/${roomId}?code=${joinCode}`
}

export async function fetchMyClubs(userId: string): Promise<MyClub[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('role, chat_rooms!inner(id,name,created_by,is_private,max_members,icon_key,icon_url,join_code,archived_at,grace_started_at,created_at,pinned_message_id,description,welcome_message,muted,default_channel_id)')
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
    .select('id,name,created_by,is_private,max_members,icon_key,icon_url,join_code,archived_at,grace_started_at,created_at,pinned_message_id,description,welcome_message,muted,default_channel_id')
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

const MAX_ICON_BYTES = 5 * 1024 * 1024 // 5MB — matches the pattern used for feed images elsewhere

function extensionForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^(jpg|jpeg|png|gif|webp)$/.test(fromName)) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/** Uploads a club icon to the `club-icons` storage bucket and returns its
 *  public URL. Path is `{userId}/{uuid}.{ext}` — required by the bucket's
 *  RLS (folder[1] must equal auth.uid()). Called before createClub() so
 *  the URL can go straight into create_club's p_icon_url. */
export async function uploadClubIcon(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please pick an image file for the club icon.')
  if (file.size > MAX_ICON_BYTES) throw new Error('Icon image is too large — please use a file under 5MB.')

  const path = `${userId}/${crypto.randomUUID()}.${extensionForFile(file)}`
  const { error } = await supabase.storage
    .from('club-icons')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Failed to upload icon: ${error.message}`)

  const { data } = supabase.storage.from('club-icons').getPublicUrl(path)
  return data.publicUrl
}

export async function createClub(opts: { name: string; iconUrl?: string; extraChannels?: string[] }): Promise<string> {
  const { data, error } = await supabase.rpc('create_club', {
    p_name: opts.name,
    p_is_private: true,
    p_icon_url: opts.iconUrl ?? null,
    p_extra_channels: opts.extraChannels ?? [],
  })
  if (error) throw friendlyError(error)
  return data as string
}

export async function joinClub(opts: { roomId?: string; code: string }): Promise<string> {
  const { data, error } = await supabase.rpc('join_club', {
    p_room_id: opts.roomId ?? null,
    p_code: opts.code,
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
  name?: string; description?: string; welcomeMessage?: string; muted?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('update_club_settings', {
    p_room_id: roomId,
    p_name: opts.name ?? null,
    p_description: opts.description ?? null,
    p_welcome_message: opts.welcomeMessage ?? null,
    p_muted: opts.muted ?? null,
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

// ── Channels (Phase 3) ──────────────────────────────────────────────────

export async function fetchClubChannels(roomId: string): Promise<ClubChannel[]> {
  const { data, error } = await supabase
    .from('club_channels')
    .select('id, room_id, name, position, created_at, created_by')
    .eq('room_id', roomId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClubChannel[]
}

export async function createClubChannel(roomId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_club_channel', { p_room_id: roomId, p_name: name })
  if (error) throw friendlyError(error)
  return data as string
}

export async function renameClubChannel(channelId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_club_channel', { p_channel_id: channelId, p_name: name })
  if (error) throw friendlyError(error)
}

export async function deleteClubChannel(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_club_channel', { p_channel_id: channelId })
  if (error) throw friendlyError(error)
}

export async function setDefaultClubChannel(roomId: string, channelId: string): Promise<void> {
  const { error } = await supabase.rpc('set_default_club_channel', { p_room_id: roomId, p_channel_id: channelId })
  if (error) throw friendlyError(error)
}
