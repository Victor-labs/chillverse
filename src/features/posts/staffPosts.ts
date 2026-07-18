// src/features/posts/staffPosts.ts
// Staff-only Announcements tab data layer. Every write here is also
// enforced server-side by the RLS policies added in migration 0028
// (is_staff(auth.uid())) — the client-side gating in StaffComposer.tsx
// is a UX convenience, not the security boundary.
import { supabase } from '../../shared/lib/supabase'
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from '../../shared/lib/profanityFilter'
import { hydratePosts, type PostRow } from './posts'
import type { Post, PostKind } from './types'
import type { RankGroupId } from '../profile/ranks'
import { notifyRankTag } from '../achievements/achievements'

const FEED_IMAGES_BUCKET = 'feed-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

function extensionForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^(jpg|jpeg|png|gif|webp)$/.test(fromName)) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/** Uploads an image for a staff announcement to the public `feed-images`
 *  bucket and returns its public URL to store in `posts.media_url`.
 *  Path convention `<author_id>/<uuid>.<ext>` matches the storage RLS
 *  policy in migration 0028, which only allows staff to write here. */
export async function uploadFeedImage(authorId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be attached to an announcement.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large — please use a file under 5MB.')
  }

  const path = `${authorId}/${crypto.randomUUID()}.${extensionForFile(file)}`
  const { error } = await supabase.storage
    .from(FEED_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = supabase.storage.from(FEED_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Creates a staff post (announcement / feature update / general).
 *  Always inserted with author_type 'admin' — RLS requires is_staff(). */
export async function createAnnouncement(input: {
  authorId: string
  body: string
  postKind: PostKind
  mediaUrl: string | null
  pinned: boolean
  commentable: boolean
  /** Required (and only meaningful) when postKind === 'rank_tag'. */
  rankTagGroup?: RankGroupId | null
}): Promise<{ data: Post | null; error: { message: string } | null }> {
  if (containsProfanity(input.body)) {
    return { data: null, error: { message: PROFANITY_BLOCKED_MESSAGE } }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      author_type: 'admin',
      body: input.body,
      tags: [],
      commentable: input.commentable,
      post_kind: input.postKind,
      media_url: input.mediaUrl,
      media_type: input.mediaUrl ? 'image' : null,
      pinned: input.pinned,
      rank_tag_group: input.postKind === 'rank_tag' ? input.rankTagGroup ?? null : null,
    })
    .select()
    .single()

  if (error) {
    console.error('createAnnouncement error:', error)
    if (error.message?.includes('CV_PROFANITY')) {
      return { data: null, error: { message: PROFANITY_BLOCKED_MESSAGE } }
    }
    return { data: null, error: { message: error.message } }
  }

  // Rank tag: fan out to every user currently in that rank group.
  if (input.postKind === 'rank_tag' && input.rankTagGroup) {
    notifyRankTag(input.authorId, input.rankTagGroup, { postId: data.id }).catch(console.error)
  }

  return { data: data as Post, error: null }
}

/** Fetches staff posts for the Announcements tab. Pinned posts sort
 *  first, then most recent — unlike the main Feed, which sorts by
 *  `influence`, since staff posts aren't meant to compete on that metric. */
export async function fetchAnnouncements(userId: string | null, limit = 30): Promise<Post[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .in('author_type', ['admin', 'system'])
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !posts) {
    console.error('fetchAnnouncements error:', error)
    return []
  }

  return hydratePosts(posts as PostRow[], userId)
}

/** Pins/unpins an announcement so it sorts to the top of the Announcements
 *  tab. Restricted to staff by the RLS update policy in migration 0028. */
export async function setAnnouncementPinned(postId: string, pinned: boolean): Promise<boolean> {
  const { error } = await supabase.from('posts').update({ pinned }).eq('id', postId)
  if (error) console.error('setAnnouncementPinned error:', error)
  return !error
}
