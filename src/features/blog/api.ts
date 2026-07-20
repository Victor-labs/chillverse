// src/features/blog/api.ts
import { supabase } from '../../shared/lib/supabase'
import type { BlogCategory, BlogLocale, BlogPost, BlogPostInput, BlogSearchResult } from '../../shared/types'

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

// ── Admin ─────────────────────────────────────────────────────────────────

/** Fetches every post (published or not) for the admin management list, newest-first. */
export async function fetchAllBlogPostsForAdmin(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false })

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
    is_published: input.isPublished,
    published_at: input.isPublished ? new Date().toISOString() : null,
  }
}

/** Creates a new post, attributed to the given (admin) author. */
export async function createBlogPost(input: BlogPostInput, authorId: string): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ ...inputToRow(input), author_id: authorId })
    .select('*')
    .single()

  if (error) throw error
  return data as BlogPost
}

/**
 * Updates an existing post. `published_at` is only (re)stamped the moment a
 * post transitions from unpublished to published — re-saving an already
 * published post must not bump its date to "now" and jump the feed order.
 */
export async function updateBlogPost(id: string, input: BlogPostInput, wasPublished: boolean): Promise<BlogPost> {
  const row = inputToRow(input)
  if (wasPublished && input.isPublished) {
    delete (row as { published_at?: string | null }).published_at
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(row)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as BlogPost
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) throw error
}
