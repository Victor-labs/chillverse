// src/features/highlights/highlights.ts
import { supabase } from '../../shared/lib/supabase'
import type { Highlight, HighlightKind } from './types'
import { HIGHLIGHT_LIFETIME_DAYS } from './types'

function cutoffIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - HIGHLIGHT_LIFETIME_DAYS)
  return d.toISOString()
}

// ── Fetch ─────────────────────────────────────────────────────
// "Delete after 5 days" is enforced here via a created_at filter, not a
// hard delete — cheap for v1, can be swapped for a real cleanup job later
// (same pattern as supabase/functions/cleanup-rooms) if the table grows large.
export async function fetchHighlights(userId: string | null, limit = 40): Promise<Highlight[]> {
  const { data: rows, error } = await supabase
    .from('highlights')
    .select('*')
    .gte('created_at', cutoffIso())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !rows) {
    console.error('fetchHighlights error:', error)
    return []
  }

  const authorIds = [...new Set(rows.map(r => r.author_id).filter(Boolean))] as string[]
  const authorsById = new Map<string, { id: string; username: string; display_name: string | null; avatar: string }>()

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .in('id', authorIds)
    for (const a of authors ?? []) authorsById.set(a.id, a)
  }

  let likedIds = new Set<string>()
  if (userId) {
    const { data: likes } = await supabase
      .from('highlight_likes')
      .select('highlight_id')
      .eq('user_id', userId)
      .in('highlight_id', rows.map(r => r.id))
    likedIds = new Set((likes ?? []).map(l => l.highlight_id))
  }

  // leaderboard_badge highlights render the badge's real icon/title, so pull
  // the badge defs for whichever badge_ids show up in this batch.
  const badgeIds = [...new Set(rows.map(r => r.badge_id).filter(Boolean))] as string[]
  const badgesById = new Map<string, { id: string; title: string; description: string; icon: string }>()
  if (badgeIds.length > 0) {
    const { data: badges } = await supabase
      .from('badges')
      .select('id, title, description, icon')
      .in('id', badgeIds)
    for (const b of badges ?? []) badgesById.set(b.id, b)
  }

  return rows.map(r => ({
    ...r,
    author: r.author_id ? authorsById.get(r.author_id) : undefined,
    badge: r.badge_id ? badgesById.get(r.badge_id) : undefined,
    liked_by_me: likedIds.has(r.id),
  })) as Highlight[]
}

/** Small preview set for the strip shown at the top of the Feed page. */
export async function fetchHighlightsPreview(userId: string | null, limit = 8): Promise<Highlight[]> {
  return fetchHighlights(userId, limit)
}

// ── Create ────────────────────────────────────────────────────
export async function createHighlight(input: {
  authorId: string
  kind: HighlightKind
  gameKey: string | null
  body: string
  /** Accumulated XP total / streak day count / leaderboard rank — kind-dependent. */
  value?: number | null
  mapId?: number | null
  badgeId?: string | null
  /**
   * Set only for "fires once ever" milestones (xp_milestone, streak_milestone,
   * map_complete, leaderboard_badge). Backed by a unique (author_id, dedup_key)
   * index (migration 0036), so a race — two tabs, a retried request — can't
   * double-post the same milestone. personal_best/leaderboard_rank pass
   * nothing here since those are allowed to repeat as the player improves.
   */
  dedupKey?: string | null
}) {
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      author_id: input.authorId,
      kind: input.kind,
      game_key: input.gameKey,
      body: input.body,
      value: input.value ?? null,
      map_id: input.mapId ?? null,
      badge_id: input.badgeId ?? null,
      dedup_key: input.dedupKey ?? null,
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation — someone/something already created this
    // exact milestone highlight (dedup_key collision). Not a real error.
    if (error.code === '23505') return { data: null, error: null }
    console.error('createHighlight error:', error)
    return { data, error }
  }

  notifyFollowersOfHighlight(input.authorId, data.id).catch(e =>
    console.error('notifyFollowersOfHighlight error:', e)
  )

  return { data, error }
}

// ── Notifications ─────────────────────────────────────────────
// Same insert_notification RPC contract used everywhere else (posts.ts,
// achievements.ts) — shows as a live dropdown toast via Realtime and is
// saved to the notifications table for later, per the 📷 icon spec.
//
// highlight_notif_scope on the author's profile controls the audience:
//   'followers' (default before this change) — only followers, named.
//   'everyone'                               — followers get the named
//     version as before; everyone else gets an anonymized "Someone
//     posted a highlight" so non-followers can't be identity-mapped to
//     a specific author from a notification alone.
async function notifyFollowersOfHighlight(authorId: string, highlightId: string) {
  const { data: author } = await supabase
    .from('profiles')
    .select('display_name, username, highlight_notif_scope')
    .eq('id', authorId)
    .single()
  if (!author) return
  const name = author.display_name || author.username

  const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', authorId)
  const followerIds = new Set((followers ?? []).map(f => f.follower_id))

  for (const follower_id of followerIds) {
    await supabase.rpc('insert_notification', {
      p_user_id: follower_id,
      p_type:    'highlight_posted',
      p_title:   `${name} posted a highlight`,
      p_body:    'Tap to check it out.',
      p_icon:    'camera',
      p_meta:    { highlight_id: highlightId, author_id: authorId },
    })
  }

  if (author.highlight_notif_scope !== 'everyone') return

  const { data: everyone } = await supabase.from('profiles').select('id').neq('id', authorId)
  for (const { id } of everyone ?? []) {
    if (followerIds.has(id)) continue // already notified by name above
    await supabase.rpc('insert_notification', {
      p_user_id: id,
      p_type:    'highlight_posted',
      p_title:   'Someone posted a highlight',
      p_body:    'Tap to check it out.',
      p_icon:    'camera',
      p_meta:    { highlight_id: highlightId },
    })
  }
}

// ── Likes (toggle) ───────────────────────────────────────────
export async function toggleHighlightLike(highlightId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    const { error } = await supabase.from('highlight_likes').delete().eq('highlight_id', highlightId).eq('user_id', userId)
    return !error
  }
  const { error } = await supabase.from('highlight_likes').insert({ highlight_id: highlightId, user_id: userId })
  return !error
}
