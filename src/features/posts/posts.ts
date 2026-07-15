// src/features/posts/posts.ts
import { supabase } from '../../shared/lib/supabase'
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from '../../shared/lib/profanityFilter'
import type { Post, Comment, PostTag, PostingEligibility } from './types'

/** Shape of a raw row straight off `posts`, before the author/like-status
 *  joins that turn it into a display-ready `Post`. Exported so other
 *  modules querying `posts` directly (e.g. staffPosts.ts) can type their
 *  results consistently instead of falling back to `any`. */
export type PostRow = Omit<Post, 'author' | 'liked_by_me'>

// ── Shared hydration: attach author profile + "did I like this" flag ───
// Pulled out of fetchFeed so fetchAnnouncements (staffPosts.ts) can reuse
// the exact same join logic instead of duplicating it.
export async function hydratePosts(rows: PostRow[], userId: string | null): Promise<Post[]> {
  if (rows.length === 0) return []

  const authorIds = [...new Set(rows.map(p => p.author_id).filter(Boolean))] as string[]
  const authorsById = new Map<string, { id: string; username: string; display_name: string | null; avatar: string }>()

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .in('id', authorIds)
    for (const a of authors ?? []) authorsById.set(a.id, a)
  }

  let likedPostIds = new Set<string>()
  if (userId) {
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', rows.map(p => p.id))
    likedPostIds = new Set((likes ?? []).map(l => l.post_id))
  }

  return rows.map(p => ({
    ...p,
    author: p.author_id ? authorsById.get(p.author_id) : undefined,
    liked_by_me: likedPostIds.has(p.id),
  }))
}

// ── Feed ──────────────────────────────────────────────────────
// Sorted by influence first (the whole point of the metric), then recency.
export async function fetchFeed(userId: string | null, limit = 30): Promise<Post[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('influence', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !posts) {
    console.error('fetchFeed error:', error)
    return []
  }

  return hydratePosts(posts as PostRow[], userId)
}

// ── Posts by a single author (moderator showcase profile feed) ──
export async function fetchPostsByAuthor(authorId: string, userId: string | null, limit = 30): Promise<Post[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !posts) {
    console.error('fetchPostsByAuthor error:', error)
    return []
  }

  return hydratePosts(posts as PostRow[], userId)
}

// ── Single post (for share links) ───────────────────────────────
export async function fetchPostById(postId: string, userId: string | null): Promise<Post | null> {
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle()
  if (error || !post) {
    console.error('fetchPostById error:', error)
    return null
  }

  let author: { id: string; username: string; display_name: string | null; avatar: string } | undefined
  if (post.author_id) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar').eq('id', post.author_id).maybeSingle()
    author = data ?? undefined
  }

  let likedByMe = false
  if (userId) {
    const { data } = await supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
    likedByMe = !!data
  }

  return { ...post, author, liked_by_me: likedByMe } as Post
}

// ── Delete ────────────────────────────────────────────────────
// RLS (see migrations 0008 and 0028) allows an author to delete their own
// posts, and staff to delete any staff-authored post.
export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) console.error('deletePost error:', error)
  return !error
}

// ── Create ────────────────────────────────────────────────────
export async function createPost(input: {
  authorId: string
  body: string
  tags: PostTag[]
  commentable: boolean
}) {
  if (containsProfanity(input.body)) {
    return { data: null, error: { message: PROFANITY_BLOCKED_MESSAGE } }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      author_type: 'user',
      body: input.body,
      tags: input.tags,
      commentable: input.commentable,
    })
    .select()
    .single()

  if (error) {
    console.error('createPost error:', error)
    if (error.message?.includes('CV_PROFANITY')) {
      return { data, error: { message: PROFANITY_BLOCKED_MESSAGE } }
    }
    return { data, error }
  }

  // Fire-and-forget: don't block the composer closing on notification delivery.
  notifyFollowersOfNewPost(input.authorId, data.id, input.body).catch(e => console.error('notifyFollowersOfNewPost error:', e))
  notifyTaggedUsers(input.tags, input.authorId, data.id).catch(e => console.error('notifyTaggedUsers error:', e))

  return { data, error }
}

// ── Notifications ─────────────────────────────────────────────
// Same insert_notification RPC contract used by notifyFollow / notifyFollowersRankUp
// in achievements.ts — kept here since these are post-specific triggers.
async function notifyFollowersOfNewPost(authorId: string, postId: string, body: string) {
  const { data: author } = await supabase
    .from('profiles').select('display_name, username').eq('id', authorId).single()
  if (!author) return
  const name = author.display_name || author.username

  const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', authorId)
  if (!followers?.length) return

  const preview = body.length > 80 ? `${body.slice(0, 80)}…` : body

  for (const { follower_id } of followers) {
    await supabase.rpc('insert_notification', {
      p_user_id: follower_id,
      p_type:    'new_post',
      p_title:   `${name} just posted`,
      p_body:    preview,
      p_icon:    'sparkles',
      p_meta:    { post_id: postId, author_id: authorId },
    })
  }
}

async function notifyTaggedUsers(tags: PostTag[], authorId: string, postId: string) {
  const userTags = tags.filter(t => t.type === 'user' && t.ref_id !== authorId)
  if (!userTags.length) return

  const { data: author } = await supabase
    .from('profiles').select('display_name, username').eq('id', authorId).single()
  const name = author?.display_name || author?.username || 'Someone'

  for (const tag of userTags) {
    await supabase.rpc('insert_notification', {
      p_user_id: tag.ref_id,
      p_type:    'post_tag',
      p_title:   `${name} tagged you in a post`,
      p_body:    'Tap to view it in the Feed.',
      p_icon:    'message-circle',
      p_meta:    { post_id: postId, author_id: authorId },
    })
  }
}

// ── Likes (toggle) ───────────────────────────────────────────
export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    if (error) console.error('unlike error:', error)
    return !error
  }
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  if (error) console.error('like error:', error)
  return !error
}

// ── Comments ──────────────────────────────────────────────────
export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error || !comments) {
    console.error('fetchComments error:', error)
    return []
  }

  const authorIds = [...new Set(comments.map(c => c.author_id))]
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, username, display_name, avatar').in('id', authorIds)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar: string }[] }

  const authorsById = new Map((authors ?? []).map(a => [a.id, a]))
  return comments.map(c => ({ ...c, author: authorsById.get(c.author_id) })) as Comment[]
}

export async function addComment(postId: string, authorId: string, body: string, isNotice = false) {
  if (containsProfanity(body)) {
    return { data: null, error: { message: PROFANITY_BLOCKED_MESSAGE } }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: authorId, body, is_notice: isNotice })
    .select()
    .single()

  if (error) {
    console.error('addComment error:', error)
    if (error.message?.includes('CV_PROFANITY')) {
      return { data, error: { message: PROFANITY_BLOCKED_MESSAGE } }
    }
  }
  return { data, error }
}

// ── Posting eligibility (server-checked, see migration 0007) ───
export async function checkPostingEligibility(userId: string): Promise<PostingEligibility | null> {
  const { data, error } = await supabase
    .rpc('check_posting_eligibility', { p_user_id: userId })
    .maybeSingle<PostingEligibility>()

  if (error) {
    console.error('checkPostingEligibility error:', error)
    return null
  }
  return data ?? null
}
