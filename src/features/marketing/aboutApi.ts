// src/features/marketing/aboutApi.ts
// Read/write layer for the two admin-editable sections of the public
// About page: the "Chillverse History" card row and the "Our Events Held
// Across Platforms" carousel. Tables are public-read / admin-write via
// RLS (see supabase/migrations/0098_about_page_cms.sql) — no RPCs needed,
// same direct-table-access pattern as the Blog CMS (src/features/blog/api.ts).
import { supabase } from '../../shared/lib/supabase'

export interface HistoryCard {
  id: string
  yearLabel: string
  title: string
  body: string
  sortOrder: number
}

export interface AboutEvent {
  id: string
  name: string
  subtitle: string
  eventDate: string
  imageUrl: string
  sortOrder: number
}

const ADVERTS_BUCKET = 'Adverts'
const EVENT_IMAGE_FOLDER = 'Aboutpage'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

function rowToHistoryCard(row: any): HistoryCard {
  return { id: row.id, yearLabel: row.year_label, title: row.title, body: row.body, sortOrder: row.sort_order }
}

function rowToEvent(row: any): AboutEvent {
  return { id: row.id, name: row.name, subtitle: row.subtitle, eventDate: row.event_date, imageUrl: row.image_url, sortOrder: row.sort_order }
}

// ── Public reads ────────────────────────────────────────────────────────
export async function fetchHistoryCards(): Promise<HistoryCard[]> {
  const { data, error } = await supabase
    .from('about_history_cards')
    .select('id, year_label, title, body, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToHistoryCard)
}

export async function fetchAboutEvents(): Promise<AboutEvent[]> {
  const { data, error } = await supabase
    .from('about_events')
    .select('id, name, subtitle, event_date, image_url, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToEvent)
}

// ── Admin writes — RLS re-checks is_admin_role() server-side regardless
//    of what the client sends; these calls just surface a friendly error
//    if a non-admin's request gets rejected. ─────────────────────────────
export async function saveHistoryCard(card: Omit<HistoryCard, 'id'> & { id?: string }): Promise<void> {
  const row = { year_label: card.yearLabel.trim(), title: card.title.trim(), body: card.body.trim(), sort_order: card.sortOrder }
  if (card.id) {
    const { error } = await supabase.from('about_history_cards').update(row).eq('id', card.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('about_history_cards').insert(row)
    if (error) throw new Error(error.message)
  }
}

export async function deleteHistoryCard(id: string): Promise<void> {
  const { error } = await supabase.from('about_history_cards').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveAboutEvent(event: Omit<AboutEvent, 'id'> & { id?: string }): Promise<void> {
  const row = {
    name: event.name.trim(),
    subtitle: event.subtitle.trim(),
    event_date: event.eventDate.trim(),
    image_url: event.imageUrl.trim(),
    sort_order: event.sortOrder,
  }
  if (event.id) {
    const { error } = await supabase.from('about_events').update(row).eq('id', event.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('about_events').insert(row)
    if (error) throw new Error(error.message)
  }
}

export async function deleteAboutEvent(id: string): Promise<void> {
  const { error } = await supabase.from('about_events').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

function extensionForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^(jpg|jpeg|png|gif|webp)$/.test(fromName)) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/** Uploads an event image to Adverts/Aboutpage/ and returns its public URL,
 *  ready to drop straight into an about_events row's image_url. Storage RLS
 *  (migration 0098) restricts writes to this folder to admins only. */
export async function uploadEventImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be used for an event image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large — please use a file under 5MB.')

  const path = `${EVENT_IMAGE_FOLDER}/${crypto.randomUUID()}.${extensionForFile(file)}`
  const { error } = await supabase.storage.from(ADVERTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = supabase.storage.from(ADVERTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
