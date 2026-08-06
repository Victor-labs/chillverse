// src/features/support/admin/api.ts
//
// Staff-only writes for the help center. Everything here is guarded by RLS
// (migration 0100): is_staff() may create/update articles and categories,
// is_admin_role() may delete. Nothing in this file re-checks permissions —
// the UI hides what you can't do, but the database is what enforces it.
import { supabase } from '../../../shared/lib/supabase'
import type {
  SupportArticle,
  SupportCategory,
  SupportFeedbackStatus,
} from '../../../shared/types'

// ── Article media ───────────────────────────────────────────────────────

const SUPPORT_VIDEOS_BUCKET = 'support-videos'
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB — matches the bucket's own file_size_limit

function extensionForVideoFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^(mp4|webm|ogg|mov)$/.test(fromName)) return fromName
  if (file.type.includes('webm')) return 'webm'
  if (file.type.includes('ogg')) return 'ogg'
  if (file.type.includes('quicktime')) return 'mov'
  return 'mp4'
}

/** Uploads a video into the public `support-videos` bucket (migration 0107,
 *  staff-only write, same pattern as blog-images) and returns its public
 *  URL to embed in article content via the `{{video:URL}}` block. */
export async function uploadSupportVideo(uploaderId: string, file: File): Promise<string> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Only video files can be embedded here.')
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video is too large — please use a file under 50MB.')
  }

  const path = `${uploaderId}/${crypto.randomUUID()}.${extensionForVideoFile(file)}`
  const { error } = await supabase.storage
    .from(SUPPORT_VIDEOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Failed to upload video: ${error.message}`)

  const { data } = supabase.storage.from(SUPPORT_VIDEOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ── Articles ────────────────────────────────────────────────────────────

/** Every article including unpublished drafts — staff read policy allows this. */
export async function fetchAllArticles(): Promise<SupportArticle[]> {
  const { data, error } = await supabase
    .from('support_articles')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as SupportArticle[]) ?? []
}

export interface ArticleDraft {
  category_id: string
  /** At most one of these is set — a DB check constraint enforces it. */
  author_id: string | null
  persona_author_id: string | null
  slug: string
  title: string
  summary: string | null
  content: string
  tags: string[]
  is_published: boolean
  sort_order: number
}

export async function createArticle(draft: ArticleDraft): Promise<SupportArticle> {
  const { data, error } = await supabase
    .from('support_articles')
    .insert(draft)
    .select('*')
    .single()

  if (error) throw error
  return data as SupportArticle
}

export async function updateArticle(
  id: string,
  patch: Partial<ArticleDraft>
): Promise<SupportArticle> {
  const { data, error } = await supabase
    .from('support_articles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as SupportArticle
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('support_articles').delete().eq('id', id)
  if (error) throw error
}

/**
 * Slugs must be unique per category, and a clash surfaces as a Postgres
 * unique violation rather than anything readable, so check first. Excludes
 * the article being edited so re-saving without a slug change is fine.
 */
export async function isSlugTaken(
  categoryId: string,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from('support_articles')
    .select('id')
    .eq('category_id', categoryId)
    .eq('slug', slug)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// ── Categories ──────────────────────────────────────────────────────────

export async function fetchAllCategories(): Promise<SupportCategory[]> {
  const { data, error } = await supabase
    .from('support_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data as SupportCategory[]) ?? []
}

export type CategoryDraft = Omit<SupportCategory, 'id' | 'created_at'>

export async function createCategory(draft: CategoryDraft): Promise<SupportCategory> {
  const { data, error } = await supabase
    .from('support_categories')
    .insert(draft)
    .select('*')
    .single()

  if (error) throw error
  return data as SupportCategory
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryDraft>
): Promise<void> {
  const { error } = await supabase.from('support_categories').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Deleting a category orphans its articles (support_articles.category_id is
 * NOT NULL, so Postgres will refuse if any remain). The UI blocks this ahead
 * of time; this is the backstop.
 */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('support_categories').delete().eq('id', id)
  if (error) throw error
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('support_categories').update({ sort_order: i }).eq('id', id)
    )
  )
}

// ── Feedback moderation ─────────────────────────────────────────────────

export interface ModeratedFeedbackPost {
  id: string
  topic_id: string
  title: string
  body: string
  status: SupportFeedbackStatus
  vote_count: number
  is_hidden: boolean
  created_at: string
  author_id: string
  author?: { username: string } | null
}

/**
 * Reads the table directly rather than via list_support_feedback_posts,
 * because that RPC deliberately filters out hidden posts — moderators need
 * to see exactly what it excludes.
 */
export async function fetchFeedbackForModeration(
  options: { includeHidden?: boolean; limit?: number } = {}
): Promise<ModeratedFeedbackPost[]> {
  const { includeHidden = true, limit = 100 } = options

  let query = supabase
    .from('support_feedback_posts')
    .select('id, topic_id, title, body, status, vote_count, is_hidden, created_at, author_id, author:profiles(username)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeHidden) query = query.eq('is_hidden', false)

  const { data, error } = await query
  if (error) throw error
  return (data as unknown as ModeratedFeedbackPost[]) ?? []
}

/** Status and visibility are staff-only fields — a DB trigger enforces that. */
export async function setFeedbackStatus(
  postId: string,
  status: SupportFeedbackStatus
): Promise<void> {
  const { error } = await supabase
    .from('support_feedback_posts')
    .update({ status })
    .eq('id', postId)

  if (error) throw error
}

export async function setFeedbackHidden(postId: string, isHidden: boolean): Promise<void> {
  const { error } = await supabase
    .from('support_feedback_posts')
    .update({ is_hidden: isHidden })
    .eq('id', postId)

  if (error) throw error
}
