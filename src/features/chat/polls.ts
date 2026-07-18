// src/features/chat/polls.ts
// Data layer for Polls (Global Chat only — see migration 0033). Every
// mutation goes through a SECURITY DEFINER RPC (create_poll/vote_poll/
// end_poll); this file is just the typed wrappers plus a read-side
// hydration helper for rendering.
import { supabase } from '../../shared/lib/supabase'
import type { StaffRole } from '../moderation/moderation'

export type PollVoteMode = 'single' | 'multi'

export interface PollOption {
  id: string
  label: string
  position: number
}

export interface PollData {
  id: string
  room_id: string
  creator_id: string
  question: string
  vote_mode: PollVoteMode
  hide_results: boolean
  closes_at: string
  closed_at: string | null
  options: PollOption[]
  /** option_id → vote count. Only meaningful when resultsVisible is true —
   *  see that field's doc below. */
  voteCounts: Record<string, number>
  totalVotes: number
  /** option ids the current viewer has voted for, if any. */
  myVotes: string[]
  /** False only while hide_results is on, the poll is still open, and the
   *  viewer isn't Staff/Moderator/Admin — in that case RLS only returns the
   *  viewer's own vote row, so voteCounts/totalVotes above are NOT a
   *  trustworthy total and the UI must not render them as one. */
  resultsVisible: boolean
  /** Creator's display name (falls back to username) — only meaningful for
   *  rendering when creatorRole is 'user' (i.e. a Verified, non-staff
   *  creator). Staff/Moderator/Admin creators are shown as a role tag
   *  instead of a name, per product decision — see PollMessage. */
  creatorName: string
  /** 'user' here always means a Verified (non-staff) creator — create_poll
   *  requires the creator be either Staff/Moderator/Admin or Verified, so a
   *  'user'-role creator is Verified by construction. */
  creatorRole: StaffRole
}

function friendlyPollError(error: { message?: string } | null): string | null {
  if (!error) return null
  const msg = error.message || ''
  if (msg.includes('CV_MOD_FORBIDDEN')) return "You don't have permission to do that."
  if (msg.includes('CV_MOD_BAD_ROLE:')) return msg.split('CV_MOD_BAD_ROLE:')[1]?.trim() || 'That poll setting is invalid.'
  if (msg.includes('CV_MOD_NOT_FOUND')) return 'That poll could not be found.'
  if (msg.includes('CV_PROFANITY')) return 'That message contains language that isn\'t allowed here.'
  return 'Something went wrong. Please try again.'
}

export async function createPoll(input: {
  roomId: string
  question: string
  options: string[]
  voteMode: PollVoteMode
  durationHours: number
  hideResults: boolean
}): Promise<{ messageId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_poll', {
    p_room_id: input.roomId,
    p_question: input.question,
    p_options: input.options,
    p_vote_mode: input.voteMode,
    p_duration_hours: input.durationHours,
    p_hide_results: input.hideResults,
  })
  return { messageId: (data as string | null) ?? null, error: friendlyPollError(error) }
}

export async function votePoll(pollId: string, optionIds: string[]): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('vote_poll', { p_poll_id: pollId, p_option_ids: optionIds })
  return { error: friendlyPollError(error) }
}

export async function endPoll(pollId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('end_poll', { p_poll_id: pollId })
  return { error: friendlyPollError(error) }
}

/** Hydrates a poll for rendering: its options, current vote counts (as far
 *  as RLS/hide_results lets this viewer see), and which option(s) the
 *  viewer picked. `isStaffViewer` must be passed in (this module doesn't
 *  know the caller's role) since it decides whether a hidden-results poll's
 *  counts can be trusted for display — see PollData.resultsVisible. */
export async function fetchPoll(pollId: string, myId: string | null, isStaffViewer: boolean): Promise<PollData | null> {
  const { data: poll } = await supabase.from('polls').select('*').eq('id', pollId).maybeSingle()
  if (!poll) return null

  // profiles and user_moderation are both publicly readable, so this is a
  // plain client-side lookup — no RPC needed. user_moderation may have no
  // row yet for a brand-new account, hence maybeSingle + the 'user' fallback
  // (though in practice create_poll already guarantees the creator is
  // Verified or Staff/Moderator/Admin, so that row will exist).
  const [{ data: options }, { data: votes }, { data: creatorProfile }, { data: creatorMod }] = await Promise.all([
    supabase.from('poll_options').select('id, label, position').eq('poll_id', pollId).order('position'),
    supabase.from('poll_votes').select('option_id, user_id').eq('poll_id', pollId),
    supabase.from('profiles').select('username, display_name').eq('id', poll.creator_id).maybeSingle(),
    supabase.from('user_moderation').select('role').eq('user_id', poll.creator_id).maybeSingle(),
  ])

  const resultsVisible = poll.closed_at !== null || !poll.hide_results || isStaffViewer

  const voteCounts: Record<string, number> = {}
  const myVotes: string[] = []
  let totalVotes = 0
  for (const v of votes ?? []) {
    voteCounts[v.option_id] = (voteCounts[v.option_id] ?? 0) + 1
    totalVotes += 1
    if (myId && v.user_id === myId) myVotes.push(v.option_id)
  }

  return {
    id: poll.id,
    room_id: poll.room_id,
    creator_id: poll.creator_id,
    question: poll.question,
    vote_mode: poll.vote_mode,
    hide_results: poll.hide_results,
    closes_at: poll.closes_at,
    closed_at: poll.closed_at,
    options: options ?? [],
    voteCounts,
    totalVotes,
    myVotes,
    resultsVisible,
    creatorName: creatorProfile ? (creatorProfile.display_name || creatorProfile.username) : 'Unknown',
    creatorRole: (creatorMod?.role as StaffRole) ?? 'user',
  }
}
