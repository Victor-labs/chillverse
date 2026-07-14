// src/features/moderation/moderation.ts
import { supabase } from '../../shared/lib/supabase'

export type StaffRole = 'user' | 'moderator' | 'admin'

export interface UserModerationRow {
  user_id: string
  role: StaffRole
  is_banned: boolean
  banned_until: string | null
  ban_reason: string | null
  banned_by: string | null
  banned_at: string | null
}

export interface ContentReport {
  id: string
  reporter_id: string
  target_type: 'user' | 'post' | 'comment' | 'message'
  target_id: string
  reason: string
  details: string | null
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed'
  created_at: string
  reporter?: { username: string } | null
}

export interface ModerationLogEntry {
  id: string
  moderator_id: string | null
  action: string
  target_type: string
  target_id: string | null
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  moderator?: { username: string } | null
}

function friendlyError(error: { message: string } | null): string | null {
  if (!error) return null
  const msg = error.message
  if (msg.includes('CV_MOD_FORBIDDEN')) return "You don't have permission to do that."
  if (msg.includes('CV_MOD_SELF')) return "You can't do that to your own account."
  if (msg.includes('CV_MOD_NOT_FOUND')) return 'That could not be found — it may have already been removed.'
  if (msg.includes('CV_MOD_REASON_REQUIRED')) return 'Please enter a reason.'
  if (msg.includes('CV_MOD_INSUFFICIENT')) return 'Only admins can action other staff members.'
  if (msg.includes('CV_MOD_BAD_ROLE')) return 'Invalid role.'
  if (msg.includes('CV_MOD_BAD_STATUS')) return 'Invalid status.'
  if (msg.includes('CV_MOD_SELF_DEMOTE')) return 'Ask another admin to change your own role.'
  return 'Something went wrong. Please try again.'
}

/** My own staff role + ban status, used to gate the UI. Falls back to 'user' / not banned if no row exists yet. */
export async function getMyModerationStatus(userId: string): Promise<{ role: StaffRole; isBanned: boolean; bannedUntil: string | null; banReason: string | null }> {
  const { data } = await supabase
    .from('user_moderation')
    .select('role, is_banned, banned_until, ban_reason')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return { role: 'user', isBanned: false, bannedUntil: null, banReason: null }

  const currentlyBanned = data.is_banned && (!data.banned_until || new Date(data.banned_until) > new Date())
  return { role: data.role as StaffRole, isBanned: currentlyBanned, bannedUntil: data.banned_until, banReason: data.ban_reason }
}

export async function fetchOpenReports(): Promise<{ data: ContentReport[]; error: string | null }> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('*, reporter:profiles!content_reports_reporter_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(100)

  return { data: (data as ContentReport[] | null) ?? [], error: friendlyError(error) }
}

export async function getReportContext(reportId: string): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.rpc('mod_get_report_context', { p_report_id: reportId })
  return { data: data as Record<string, unknown> | null, error: friendlyError(error) }
}

export async function reviewReport(reportId: string, status: 'reviewed' | 'actioned' | 'dismissed'): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_review_report', { p_report_id: reportId, p_status: status })
  return { error: friendlyError(error) }
}

export async function searchUserByUsername(username: string): Promise<{ data: (UserModerationRow & { username: string; display_name: string | null }) | null; error: string | null }> {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', username.trim())
    .maybeSingle()

  if (pErr || !profile) return { data: null, error: pErr ? 'Search failed.' : 'No user found with that username.' }

  const { data: mod } = await supabase
    .from('user_moderation')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle()

  return {
    data: {
      user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      role: (mod?.role as StaffRole) ?? 'user',
      is_banned: mod?.is_banned ?? false,
      banned_until: mod?.banned_until ?? null,
      ban_reason: mod?.ban_reason ?? null,
      banned_by: mod?.banned_by ?? null,
      banned_at: mod?.banned_at ?? null,
    },
    error: null,
  }
}

export async function banUser(targetId: string, reason: string, durationHours: number | null): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_ban_user', { p_target_id: targetId, p_reason: reason, p_duration_hours: durationHours })
  return { error: friendlyError(error) }
}

export async function unbanUser(targetId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_unban_user', { p_target_id: targetId })
  return { error: friendlyError(error) }
}

export async function setUserRole(targetId: string, role: StaffRole): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_set_role', { p_target_id: targetId, p_role: role })
  return { error: friendlyError(error) }
}

export async function deleteMessage(messageId: string, reason?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_delete_message', { p_message_id: messageId, p_reason: reason ?? null })
  return { error: friendlyError(error) }
}

export async function deletePost(postId: string, reason?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_delete_post', { p_post_id: postId, p_reason: reason ?? null })
  return { error: friendlyError(error) }
}

export async function deleteComment(commentId: string, reason?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mod_delete_comment', { p_comment_id: commentId, p_reason: reason ?? null })
  return { error: friendlyError(error) }
}

export async function fetchModerationLog(): Promise<{ data: ModerationLogEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('moderation_log')
    .select('*, moderator:profiles!moderation_log_moderator_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(100)

  return { data: (data as ModerationLogEntry[] | null) ?? [], error: friendlyError(error) }
}
