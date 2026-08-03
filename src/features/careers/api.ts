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

// ── Phase 2: applications ─────────────────────────────────────────────────

const APPLICATIONS_BUCKET = 'job-applications'
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8MB

export type ApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'accepted'

export interface RequiredDocs {
  cv: boolean
  portfolio: boolean
  coverLetter: boolean
}

/**
 * Which optional uploads are actually required, by role category.
 * Profile pic is always required (spec). Everything else varies by what
 * the role needs to evaluate: Engineering/Design/Marketing need to see
 * work (CV/portfolio), Editorial needs a writing sample (cover letter).
 * Community/QA/Support stay fully optional beyond the profile pic.
 * This is a category-level default, not a per-role setting — adjust here
 * if a specific role needs something different.
 */
export function getRequiredDocs(category: JobCategory): RequiredDocs {
  switch (category) {
    case 'Engineering':
      return { cv: true, portfolio: true, coverLetter: false }
    case 'Design':
    case 'Marketing':
      return { cv: false, portfolio: true, coverLetter: false }
    case 'Editorial':
      return { cv: false, portfolio: false, coverLetter: true }
    default: // Community, Quality Assurance, Support
      return { cv: false, portfolio: false, coverLetter: false }
  }
}

export interface JobApplicationInput {
  jobId: string
  jobTitle: string
  jobCategory: JobCategory
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  country: string
  city: string
  dateOfBirth: string
  profilePicPath: string
  cvPath: string | null
  portfolioPath: string | null
  coverLetterPath: string | null
  whyChillverse: string
  familiarity: string
  linkedinUrl: string
  availableWhenNeeded: boolean
  communicatesInEnglish: boolean
  understandsNoGuarantee: boolean
  agreesCodeOfConduct: boolean
  confirmInfoAccurate: boolean
  confirmFalseInfoConsequence: boolean
  confirmProfessionalConduct: boolean
  confirmConsentStorage: boolean
  confirmReadyToContribute: boolean
}

export interface JobApplication {
  id: string
  job_id: string | null
  job_title: string
  job_category: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string
  phone: string
  country: string
  city: string
  date_of_birth: string
  profile_pic_path: string
  cv_path: string | null
  portfolio_path: string | null
  cover_letter_path: string | null
  why_chillverse: string
  familiarity: string
  linkedin_url: string | null
  available_when_needed: boolean
  communicates_in_english: boolean
  understands_no_guarantee: boolean
  agrees_code_of_conduct: boolean
  confirm_info_accurate: boolean
  confirm_false_info_consequence: boolean
  confirm_professional_conduct: boolean
  confirm_consent_storage: boolean
  confirm_ready_to_contribute: boolean
  status: ApplicationStatus
  staff_notes: string | null
  applicant_user_id: string | null
  created_at: string
  updated_at: string
}

function extensionForApplicationFile(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  return file.type.split('/').pop() ?? 'bin'
}

/**
 * Uploads one applicant file (profile pic / CV / portfolio / cover letter)
 * to the private job-applications bucket under a per-application folder,
 * and returns the storage path (not a public URL — the bucket is private,
 * staff view files via signed URLs). Caller generates `applicationId`
 * client-side before submission so all files for one application share a
 * folder.
 */
export async function uploadApplicationFile(
  applicationId: string,
  kind: 'profile-pic' | 'cv' | 'portfolio' | 'cover-letter',
  file: File,
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large — please use something under 8MB.')
  }
  const path = `${applicationId}/${kind}.${extensionForApplicationFile(file)}`
  const { error } = await supabase.storage
    .from(APPLICATIONS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(`Failed to upload ${kind.replace('-', ' ')}: ${error.message}`)
  return path
}

/** Submits the completed application. `id` must match the folder used for uploads. */
export async function submitApplication(
  id: string,
  input: JobApplicationInput,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('job_applications').insert({
    id,
    job_id: input.jobId,
    job_title: input.jobTitle,
    job_category: input.jobCategory,
    first_name: input.firstName,
    middle_name: input.middleName || null,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    city: input.city,
    date_of_birth: input.dateOfBirth,
    profile_pic_path: input.profilePicPath,
    cv_path: input.cvPath,
    portfolio_path: input.portfolioPath,
    cover_letter_path: input.coverLetterPath,
    why_chillverse: input.whyChillverse,
    familiarity: input.familiarity,
    linkedin_url: input.linkedinUrl || null,
    available_when_needed: input.availableWhenNeeded,
    communicates_in_english: input.communicatesInEnglish,
    understands_no_guarantee: input.understandsNoGuarantee,
    agrees_code_of_conduct: input.agreesCodeOfConduct,
    confirm_info_accurate: input.confirmInfoAccurate,
    confirm_false_info_consequence: input.confirmFalseInfoConsequence,
    confirm_professional_conduct: input.confirmProfessionalConduct,
    confirm_consent_storage: input.confirmConsentStorage,
    confirm_ready_to_contribute: input.confirmReadyToContribute,
    applicant_user_id: user?.id ?? null,
  })

  return { error: error ? error.message : null }
}

/** Staff-only: every application, newest first. RLS enforces is_staff. */
export async function fetchApplications(): Promise<{ data: JobApplication[]; error: string | null }> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as JobApplication[], error: null }
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('job_applications').update({ status }).eq('id', id)
  return { error: error ? error.message : null }
}

export async function updateApplicationNotes(
  id: string,
  staffNotes: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('job_applications').update({ staff_notes: staffNotes }).eq('id', id)
  return { error: error ? error.message : null }
}

/** Staff-only: time-limited signed URL to view/download a private applicant file. */
export async function getApplicationFileUrl(path: string): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(APPLICATIONS_BUCKET).createSignedUrl(path, 60 * 10)
  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}
