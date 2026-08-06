// src/features/support/feedback/api.ts
//
// Data layer for the public feedback board (support.chillverse.com.ng/feedback).
// Reads go through security-definer RPCs so anonymous visitors can browse
// posts and vote counts without any RLS gymnastics — `support_feedback_votes`
// is deliberately readable only by its owner, so `has_voted` is computed
// server-side inside the RPC rather than fetched as a second query.
import { supabase } from '../../../shared/lib/supabase'
import type {
  SupportFeedbackTopic,
  SupportFeedbackPost,
  SupportFeedbackPostDetail,
  SupportFeedbackSort,
  SupportFeedbackStatus,
  NewSupportFeedbackInput,
} from '../../../shared/types'

/** All active topics with their published post counts. */
export async function fetchFeedbackTopics(): Promise<SupportFeedbackTopic[]> {
  const { data, error } = await supabase.rpc('list_support_feedback_topics')
  if (error) throw error
  return (data as SupportFeedbackTopic[]) ?? []
}

export interface FetchFeedbackPostsOptions {
  topicSlug?: string | null
  sort?: SupportFeedbackSort
  status?: SupportFeedbackStatus | null
  limit?: number
  offset?: number
}

/** Paginated posts, optionally scoped to one topic and/or status. */
export async function fetchFeedbackPosts(
  options: FetchFeedbackPostsOptions = {}
): Promise<SupportFeedbackPost[]> {
  const { topicSlug = null, sort = 'newest', status = null, limit = 20, offset = 0 } = options

  const { data, error } = await supabase.rpc('list_support_feedback_posts', {
    p_topic_slug: topicSlug,
    p_sort: sort,
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) throw error
  return (data as SupportFeedbackPost[]) ?? []
}

/** A single post, or null if it doesn't exist / is hidden from this viewer. */
export async function fetchFeedbackPost(postId: string): Promise<SupportFeedbackPostDetail | null> {
  const { data, error } = await supabase.rpc('get_support_feedback_post', { p_post_id: postId })
  if (error) throw error
  const rows = (data as SupportFeedbackPostDetail[]) ?? []
  return rows[0] ?? null
}

/**
 * Adds or removes the current user's vote and returns the fresh state.
 * Throws if the visitor isn't signed in — callers should send them to
 * the main site's login with a `next` param rather than pre-checking.
 */
export async function toggleFeedbackVote(
  postId: string
): Promise<{ vote_count: number; has_voted: boolean }> {
  const { data, error } = await supabase.rpc('toggle_support_feedback_vote', { p_post_id: postId })
  if (error) throw error
  const rows = (data as { vote_count: number; has_voted: boolean }[]) ?? []
  return rows[0] ?? { vote_count: 0, has_voted: false }
}

/**
 * Creates a post. The DB caps this at 5 per author per hour and forces
 * status/vote_count to their defaults, so nothing here needs re-checking.
 */
export async function submitFeedbackPost(
  userId: string,
  input: NewSupportFeedbackInput
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('support_feedback_posts')
    .insert({
      topic_id: input.topicId,
      author_id: userId,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .select('id')
    .single()

  if (error) throw error
  return data as { id: string }
}

/** Edits the caller's own post. A DB trigger ignores any other field. */
export async function updateFeedbackPost(
  postId: string,
  patch: { title: string; body: string }
): Promise<void> {
  const { error } = await supabase
    .from('support_feedback_posts')
    .update({ title: patch.title.trim(), body: patch.body.trim() })
    .eq('id', postId)

  if (error) throw error
}
