// src/features/careers/api.ts
import { supabase } from '../../shared/lib/supabase'

export type JobCategory =
  | 'Community' | 'Marketing' | 'Design' | 'Engineering'
  | 'Quality Assurance' | 'Editorial' | 'Support'

export type Compensation = 'paid' | 'voluntary'

export interface JobOpening {
  id: string
  slug: string
  title: string
  category: JobCategory
  compensation: Compensation
  summary: string
  description: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type JobOpeningInput = Omit<JobOpening, 'id' | 'created_at' | 'updated_at'>

const WORKERS_BUCKET = 'Adverts'
const WORKERS_FOLDER = 'Workers'

// ── Public reads ─────────────────────────────────────────────────────────

/** Active roles for the /work grid, in admin-defined display order. */
export async function fetchJobOpenings(): Promise<{ data: JobOpening[]; error: string | null }> {
  const { data, error } = await supabase
    .from('job_openings')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as JobOpening[], error: null }
}

/** A single active role by slug, for the /work/:slug detail page. */
export async function fetchJobBySlug(slug: string): Promise<{ data: JobOpening | null; error: string | null }> {
  const { data, error } = await supabase
    .from('job_openings')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as JobOpening | null, error: null }
}

/**
 * All images currently in the Adverts/Workers storage folder, for the
 * careers page carousel. Pulled live from storage (not hardcoded) so
 * dropping a new photo in the bucket is enough to add it to the carousel —
 * no code change needed.
 */
export async function fetchWorkerCarouselImages(): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase.storage.from(WORKERS_BUCKET).list(WORKERS_FOLDER, {
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) return { data: [], error: error.message }

  const urls = (data ?? [])
    // Storage .list() can return a placeholder row for an empty folder —
    // it has no id — filter that out rather than trying to render it.
    .filter(item => item.id && item.name)
    .map(item => supabase.storage.from(WORKERS_BUCKET).getPublicUrl(`${WORKERS_FOLDER}/${item.name}`).data.publicUrl)

  return { data: urls, error: null }
}

// ── Staff-only writes (RLS enforces is_staff on the table itself) ────────

/** Every role regardless of active state, for the /work/admin list. */
export async function fetchAllJobOpenings(): Promise<{ data: JobOpening[]; error: string | null }> {
  const { data, error } = await supabase
    .from('job_openings')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as JobOpening[], error: null }
}

export async function createJobOpening(input: JobOpeningInput): Promise<{ data: JobOpening | null; error: string | null }> {
  const { data, error } = await supabase.from('job_openings').insert(input).select('*').single()
  if (error) return { data: null, error: error.message }
  return { data: data as JobOpening, error: null }
}

export async function updateJobOpening(id: string, patch: Partial<JobOpeningInput>): Promise<{ data: JobOpening | null; error: string | null }> {
  const { data, error } = await supabase.from('job_openings').update(patch).eq('id', id).select('*').single()
  if (error) return { data: null, error: error.message }
  return { data: data as JobOpening, error: null }
}

export async function deleteJobOpening(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('job_openings').delete().eq('id', id)
  return { error: error ? error.message : null }
}

/** Persists a new relative display order after a drag/reorder in the CMS. */
export async function reorderJobOpenings(orderedIds: string[]): Promise<{ error: string | null }> {
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from('job_openings').update({ sort_order: i }).eq('id', id)),
  )
  const failed = results.find(r => r.error)
  return { error: failed?.error?.message ?? null }
}

// ── Shared helpers ────────────────────────────────────────────────────────

/** job_openings.description is plain text, paragraphs separated by blank
 *  lines — same convention as blog_posts.content. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
