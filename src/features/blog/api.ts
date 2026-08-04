// src/features/blog/api.ts
import { supabase } from '../../shared/lib/supabase'
import type {
  BlogAuthor, BlogCategory, BlogCategoryRow, BlogLocale, BlogMediaItem, BlogPersona, BlogPost,
  BlogPostInput, BlogPostRevision, BlogSearchResult, BlogTagRow,
} from '../../shared/types'

const BLOG_IMAGES_BUCKET = 'blog-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

function extensionForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^(jpg|jpeg|png|gif|webp)$/.test(fromName)) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/** Uploads a hero image for a blog post to the public `blog-images` bucket
 *  and returns its public URL to store in `blog_posts.hero_image_url`.
 *  Path convention `<author_id>/<uuid>.<ext>` matches the storage RLS
 *  policy in migration 0053, which only allows staff to write here. */
export async function uploadBlogImage(uploaderId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be used for the hero image.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large — please use a file under 5MB.')
  }

  const path = `${uploaderId}/${crypto.randomUUID()}.${extensionForFile(file)}`
  const { error } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export interface BlogPostsPage {
  posts: BlogPost[]
  hasMore: boolean
}

/**
 * Fetches a page of published posts, optionally filtered by category, ordered
 * newest-first. Used by the main /blog grid's initial load and "Load More".
 */
export async function fetchBlogPosts(params: {
  category?: BlogCategory | null
  locale?: BlogLocale
  offset: number
  limit: number
}): Promise<BlogPostsPage> {
  const { category, locale = 'en', offset, limit } = params

  let query = supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .eq('locale', locale)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit) // fetch one extra row to detect "has more"

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error

  const rows = (data as BlogPost[]) ?? []
  const hasMore = rows.length > limit
  return { posts: hasMore ? rows.slice(0, limit) : rows, hasMore }
}

/** Fetches a single published post by slug, or null if it doesn't exist / isn't published. */
export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw error
  return (data as BlogPost | null) ?? null
}

/**
 * Given a translation_group_id, returns the published post in that group
 * matching the target locale (if a translation exists), excluding the
 * currently-viewed post itself.
 */
export async function fetchTranslationCounterpart(
  translationGroupId: string,
  targetLocale: BlogLocale,
  excludePostId: string
): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('translation_group_id', translationGroupId)
    .eq('locale', targetLocale)
    .eq('is_published', true)
    .neq('id', excludePostId)
    .maybeSingle()

  if (error) throw error
  return (data as BlogPost | null) ?? null
}

/** Fetches every published post in a given series, oldest-first (timeline order). */
export async function fetchPostsBySeries(series: string, locale: BlogLocale = 'en'): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('series', series)
    .eq('locale', locale)
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (error) throw error
  return (data as BlogPost[]) ?? []
}

/**
 * "Explore Further" — related posts by shared category or overlapping tags,
 * most recent first, excluding the post itself. No ML, just recency (v1 per spec).
 */
export async function fetchRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  let query = supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .eq('locale', post.locale)
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (post.tags.length > 0) {
    query = query.or(`category.eq.${post.category},tags.ov.{${post.tags.join(',')}}`)
  } else {
    query = query.eq('category', post.category)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as BlogPost[]) ?? []
}

/** Ranked full-text search over published posts via the search_blog_posts RPC. */
export async function searchBlogPosts(query: string, locale: BlogLocale = 'en'): Promise<BlogSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const { data, error } = await supabase.rpc('search_blog_posts', { p_query: trimmed, p_locale: locale })
  if (error) throw error
  return (data as BlogSearchResult[]) ?? []
}

// ── Admin: friendly errors for the CV_BLOG_* codes raised by migration 0096 ─

export function friendlyBlogError(error: { message: string } | null | undefined): string {
  const msg = error?.message ?? ''
  if (msg.includes('CV_BLOG_FORBIDDEN')) return "You don't have staff access to the blog CMS."
  if (msg.includes('CV_BLOG_OWN_ONLY')) return 'Writers can only create or edit their own posts.'
  if (msg.includes('CV_BLOG_WRITER_DRAFT_ONLY')) return 'Writers can save drafts only — ask an editor to publish, schedule, or archive this post.'
  if (msg.includes('CV_BLOG_SCHEDULE_REQUIRED')) return 'Choose a publish date and time before scheduling.'
  if (msg.includes('CV_BLOG_PIN_FORBIDDEN')) return 'Only moderators/admins can pin or unpin a post.'
  return error?.message || 'Something went wrong. Please try again.'
}

// ── Admin: articles ──────────────────────────────────────────────────────

/** Fetches every post (any status) for the admin management list, newest-first. */
export async function fetchAllBlogPostsForAdmin(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as BlogPost[]) ?? []
}

function inputToRow(input: BlogPostInput) {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    excerpt: input.excerpt.trim() || null,
    content: input.content,
    hero_image_url: input.heroImageUrl.trim() || null,
    category: input.category,
    series: input.series.trim() || null,
    tags: input.tags,
    locale: input.locale,
    translation_group_id: input.translationGroupId,
    author_id: input.authorId,
    persona_author_id: input.personaAuthorId,
    status: input.status,
    scheduled_at: input.status === 'scheduled' ? input.scheduledAt : null,
    seo_title: input.seoTitle.trim() || null,
    meta_description: input.metaDescription.trim() || null,
  }
}

/** Creates a new post. `is_published`/`published_at`/`archived_at` are stamped server-side by the status-sync trigger (migration 0096). */
export async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert(inputToRow(input))
    .select('*')
    .single()

  if (error) throw error
  return data as BlogPost
}

/** Updates an existing post. Publish-date stamping / unstamping is handled server-side, not here. */
export async function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .update(inputToRow(input))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as BlogPost
}

/** Flips a post's status only (used for Archive / Restore / one-click publish from the table view). */
export async function setBlogPostStatus(id: string, status: BlogPost['status'], scheduledAt?: string | null): Promise<BlogPost> {
  const patch: Record<string, unknown> = { status }
  if (status === 'scheduled') patch.scheduled_at = scheduledAt
  const { data, error } = await supabase.from('blog_posts').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as BlogPost
}

/** Pins/unpins a post so it leads the /blog hero slot. Moderator/admin only
 *  (enforced server-side); pinning a post automatically unpins any other
 *  pinned post — see migration 0100. */
export async function setBlogPostPinned(id: string, pinned: boolean): Promise<BlogPost> {
  const { data, error } = await supabase.rpc('set_blog_post_pinned', { p_post_id: id, p_pinned: pinned })
  if (error) throw error
  return data as BlogPost
}

/** Hard delete — Administrator only (enforced server-side by RLS). */
export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) throw error
}

/** Duplicates a post as a new draft under the current user's byline, with a unique slug. */
export async function duplicateBlogPost(post: BlogPost, currentUserId: string): Promise<BlogPost> {
  const baseSlug = `${post.slug}-copy`
  const slug = `${baseSlug}-${Date.now().toString(36)}`
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title: `${post.title} (Copy)`,
      excerpt: post.excerpt,
      content: post.content,
      hero_image_url: post.hero_image_url,
      category: post.category,
      series: post.series,
      tags: post.tags,
      locale: post.locale,
      translation_group_id: null,
      author_id: currentUserId,
      persona_author_id: null,
      status: 'draft',
      seo_title: post.seo_title,
      meta_description: post.meta_description,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as BlogPost
}

// ── Admin: dashboard ─────────────────────────────────────────────────────

export interface BlogDashboardStats {
  total: number
  published: number
  drafts: number
  scheduled: number
  archived: number
  recentlyEdited: BlogPost[]
}

export async function fetchBlogDashboardStats(): Promise<BlogDashboardStats> {
  const countFor = async (status?: BlogPost['status']) => {
    let query = supabase.from('blog_posts').select('*', { count: 'exact', head: true })
    if (status) query = query.eq('status', status)
    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }

  const [total, published, drafts, scheduled, archived, recentRes] = await Promise.all([
    countFor(),
    countFor('published'),
    countFor('draft'),
    countFor('scheduled'),
    countFor('archived'),
    supabase.from('blog_posts').select('*').order('updated_at', { ascending: false }).limit(5),
  ])

  if (recentRes.error) throw recentRes.error

  return { total, published, drafts, scheduled, archived, recentlyEdited: (recentRes.data as BlogPost[]) ?? [] }
}

// ── Admin: categories ────────────────────────────────────────────────────

export async function fetchBlogCategoryRows(): Promise<BlogCategoryRow[]> {
  const { data, error } = await supabase.from('blog_categories').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data as BlogCategoryRow[]) ?? []
}

export async function createBlogCategory(input: { slug: string; label: string; color: string; icon: string; sortOrder: number }): Promise<BlogCategoryRow> {
  const { data, error } = await supabase
    .from('blog_categories')
    .insert({ slug: input.slug, label: input.label, color: input.color, icon: input.icon, sort_order: input.sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data as BlogCategoryRow
}

export async function updateBlogCategory(id: string, patch: Partial<{ label: string; color: string; icon: string; sortOrder: number }>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.label !== undefined) row.label = patch.label
  if (patch.color !== undefined) row.color = patch.color
  if (patch.icon !== undefined) row.icon = patch.icon
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await supabase.from('blog_categories').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteBlogCategory(id: string): Promise<void> {
  const { error } = await supabase.from('blog_categories').delete().eq('id', id)
  if (error) throw error
}

export async function reorderBlogCategories(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => supabase.from('blog_categories').update({ sort_order: i }).eq('id', id)))
}

// ── Admin: tags ───────────────────────────────────────────────────────────

export async function fetchBlogTagRows(): Promise<BlogTagRow[]> {
  const { data, error } = await supabase.from('blog_tags').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data as BlogTagRow[]) ?? []
}

export async function createBlogTag(input: { slug: string; label: string; sortOrder: number }): Promise<BlogTagRow> {
  const { data, error } = await supabase
    .from('blog_tags')
    .insert({ slug: input.slug, label: input.label, sort_order: input.sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data as BlogTagRow
}

export async function updateBlogTag(id: string, patch: Partial<{ label: string; sortOrder: number }>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.label !== undefined) row.label = patch.label
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await supabase.from('blog_tags').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteBlogTag(id: string): Promise<void> {
  const { error } = await supabase.from('blog_tags').delete().eq('id', id)
  if (error) throw error
}

export async function reorderBlogTags(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => supabase.from('blog_tags').update({ sort_order: i }).eq('id', id)))
}

// ── Admin: media library ─────────────────────────────────────────────────

/** Uploads an image into the shared media library (distinct path prefix from inline hero-image uploads, same bucket/policies). */
export async function uploadToMediaLibrary(uploaderId: string, file: File): Promise<BlogMediaItem> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be added to the media library.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large — please use a file under 5MB.')

  const path = `library/${uploaderId}/${crypto.randomUUID()}.${extensionForFile(file)}`
  const { error: uploadError } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('blog_media')
    .insert({ url: urlData.publicUrl, path, filename: file.name, size_bytes: file.size, uploaded_by: uploaderId })
    .select('*')
    .single()
  if (error) throw error
  return data as BlogMediaItem
}

export async function fetchMediaLibrary(): Promise<BlogMediaItem[]> {
  const { data, error } = await supabase.from('blog_media').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as BlogMediaItem[]) ?? []
}

export async function deleteMediaItem(item: BlogMediaItem): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BLOG_IMAGES_BUCKET).remove([item.path])
  if (storageError) throw new Error(`Failed to delete file: ${storageError.message}`)
  const { error } = await supabase.from('blog_media').delete().eq('id', item.id)
  if (error) throw error
}

// ── Admin: revision history ──────────────────────────────────────────────

export async function fetchPostRevisions(postId: string): Promise<BlogPostRevision[]> {
  const { data, error } = await supabase
    .from('blog_post_revisions')
    .select('*, editor:profiles!blog_post_revisions_edited_by_fkey(username)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as BlogPostRevision[]) ?? []
}

// ── Authors ──────────────────────────────────────────────────────────────
//
// A blog post's byline can point at either a real person (`profiles`, via
// `author_id`) or a "house" persona (`blog_personas`, via
// `persona_author_id`) — see migration 0099. Both are normalized into the
// same BlogAuthor shape so BlogEditorModal's picker and BlogPostPage's
// byline don't need to know which table a given author came from.

const AUTHOR_COLUMNS = 'id, username, display_name, avatar, bio, is_founder'

function personaToAuthor(p: BlogPersona): BlogAuthor {
  return {
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar: p.avatar ?? '',
    bio: p.bio,
    is_founder: false,
    is_persona: true,
  }
}

/** Real profiles eligible to be picked as a post's author (can_author = true). */
async function fetchAuthorProfileCandidates(): Promise<BlogAuthor[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(AUTHOR_COLUMNS)
    .eq('can_author', true)
    .order('username', { ascending: true })

  if (error) throw error
  return ((data ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar: string; bio: string | null; is_founder: boolean }>)
    .map(row => ({ ...row, is_persona: false }))
}

/** All house bylines (Willam, Engineering Crew, etc.), for the admin editor. */
export async function fetchPersonaCandidates(): Promise<BlogAuthor[]> {
  const { data, error } = await supabase
    .from('blog_personas')
    .select('*')
    .order('display_name', { ascending: true })

  if (error) throw error
  return ((data as BlogPersona[]) ?? []).map(personaToAuthor)
}

/**
 * The merged author picker list for BlogEditorModal: real staff (from
 * `profiles`) plus house personas (from `blog_personas`), personas last
 * and labeled "(house)" by the caller via `is_persona`.
 */
export async function fetchAuthorCandidates(): Promise<BlogAuthor[]> {
  const [authors, personas] = await Promise.all([fetchAuthorProfileCandidates(), fetchPersonaCandidates()])
  return [...authors, ...personas]
}

/** A single real author's byline info, for the post page. Null if removed/unset. */
export async function fetchAuthorById(authorId: string): Promise<BlogAuthor | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(AUTHOR_COLUMNS)
    .eq('id', authorId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return { ...(data as { id: string; username: string; display_name: string | null; avatar: string; bio: string | null; is_founder: boolean }), is_persona: false }
}

/** A single house persona's byline info, for the post page. Null if removed/unset. */
export async function fetchPersonaById(personaId: string): Promise<BlogAuthor | null> {
  const { data, error } = await supabase
    .from('blog_personas')
    .select('*')
    .eq('id', personaId)
    .maybeSingle()

  if (error) throw error
  return data ? personaToAuthor(data as BlogPersona) : null
}

/**
 * Resolves a post's byline from whichever of `persona_author_id` /
 * `author_id` is set (persona takes precedence, since the two are meant
 * to be mutually exclusive). Null if neither is set or the author was
 * removed.
 */
export async function fetchAuthorForPost(post: Pick<BlogPost, 'author_id' | 'persona_author_id'>): Promise<BlogAuthor | null> {
  if (post.persona_author_id) return fetchPersonaById(post.persona_author_id)
  if (post.author_id) return fetchAuthorById(post.author_id)
  return null
}
