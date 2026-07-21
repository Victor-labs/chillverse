// src/features/support/api.ts
import { supabase } from '../../shared/lib/supabase'
import type {
  SupportCategory,
  SupportCategoryWithCount,
  SupportArticle,
  SupportArticleSearchResult,
  SupportTicket,
  NewSupportTicketInput,
  SupportTicketReply,
} from '../../shared/types'

/** Fetches all support categories, ordered for display. */
export async function fetchSupportCategories(): Promise<SupportCategory[]> {
  const { data, error } = await supabase
    .from('support_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data as SupportCategory[]) ?? []
}

/** Fetches all support categories along with their published-article counts. */
export async function fetchSupportCategoriesWithCounts(): Promise<SupportCategoryWithCount[]> {
  const { data, error } = await supabase.rpc('list_support_categories_with_counts')

  if (error) throw error
  return (data as SupportCategoryWithCount[]) ?? []
}

/** Fetches a single category by its slug, or null if it doesn't exist. */
export async function fetchSupportCategoryBySlug(slug: string): Promise<SupportCategory | null> {
  const { data, error } = await supabase
    .from('support_categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return (data as SupportCategory | null) ?? null
}

/** Fetches all published articles belonging to a category. */
export async function fetchArticlesByCategory(categoryId: string): Promise<SupportArticle[]> {
  const { data, error } = await supabase
    .from('support_articles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data as SupportArticle[]) ?? []
}

/** Fetches a single published article by category id + article slug. */
export async function fetchArticleBySlug(
  categoryId: string,
  articleSlug: string
): Promise<SupportArticle | null> {
  const { data, error } = await supabase
    .from('support_articles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('slug', articleSlug)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw error
  return (data as SupportArticle | null) ?? null
}

/** Fetches the most-viewed published articles across all categories. */
export async function fetchPopularArticles(limit = 6): Promise<SupportArticle[]> {
  const { data, error } = await supabase
    .from('support_articles')
    .select('*')
    .eq('is_published', true)
    .order('view_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as SupportArticle[]) ?? []
}

/** Ranked full-text search over published articles via the search_support_articles RPC. */
export async function searchSupportArticles(query: string): Promise<SupportArticleSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const { data, error } = await supabase.rpc('search_support_articles', { p_query: trimmed })

  if (error) throw error
  return (data as SupportArticleSearchResult[]) ?? []
}

/** Bumps an article's view counter. Fire-and-forget; failures are non-fatal. */
export async function incrementArticleView(articleId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_support_article_view', { p_article_id: articleId })
  if (error) throw error
}

/**
 * Records (or updates) whether the current user found an article helpful, and
 * returns the article's fresh helpful/not-helpful counts after a re-fetch.
 */
export async function submitArticleFeedback(
  articleId: string,
  userId: string,
  isHelpful: boolean
): Promise<void> {
  const { error } = await supabase
    .from('support_article_feedback')
    .upsert(
      { article_id: articleId, user_id: userId, is_helpful: isHelpful },
      { onConflict: 'article_id,user_id' }
    )

  if (error) throw error

  // Recompute aggregate counts from the feedback table so the displayed
  // totals stay accurate even if the same user changes their vote.
  const { count: helpfulCount, error: helpfulError } = await supabase
    .from('support_article_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', articleId)
    .eq('is_helpful', true)
  if (helpfulError) throw helpfulError

  const { count: notHelpfulCount, error: notHelpfulError } = await supabase
    .from('support_article_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', articleId)
    .eq('is_helpful', false)
  if (notHelpfulError) throw notHelpfulError

  const { error: updateError } = await supabase
    .from('support_articles')
    .update({
      helpful_count: helpfulCount ?? 0,
      not_helpful_count: notHelpfulCount ?? 0,
    })
    .eq('id', articleId)
  if (updateError) throw updateError
}

/** Fetches the current user's existing feedback for an article, if any. */
export async function fetchMyArticleFeedback(
  articleId: string,
  userId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('support_article_feedback')
    .select('is_helpful')
    .eq('article_id', articleId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? (data as { is_helpful: boolean }).is_helpful : null
}

/** Submits a new support ticket for the given user. */
export async function submitSupportTicket(
  userId: string,
  input: NewSupportTicketInput
): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      subject: input.subject.trim(),
      message: input.message.trim(),
      contact_email: input.contactEmail,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as SupportTicket
}

/** Fetches all tickets submitted by the given user, most recent first. */
export async function fetchMyTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as SupportTicket[]) ?? []
}

/** Fetches the reply thread (both the user's own messages and staff replies) for one of the user's tickets. */
export async function fetchTicketReplies(ticketId: string): Promise<SupportTicketReply[]> {
  const { data, error } = await supabase
    .from('support_ticket_replies')
    .select('*, author:profiles!support_ticket_replies_author_id_fkey(username)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as SupportTicketReply[]) ?? []
}

/** Adds a follow-up message to the user's own ticket. Reopens the ticket if it was resolved/closed. */
export async function submitTicketReply(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('user_reply_ticket', { p_ticket_id: ticketId, p_body: body.trim() })
  if (error) throw error
}
