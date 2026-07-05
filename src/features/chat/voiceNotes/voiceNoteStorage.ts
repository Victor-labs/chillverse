// src/features/chat/voiceNotes/voiceNoteStorage.ts
import { supabase } from '../../../shared/lib/supabase'

const BUCKET = 'voice-notes'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour — long enough to play, short enough not to leak indefinitely if copied

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('aac')) return 'aac'
  return 'webm'
}

/** Uploads a recorded voice note. Path convention `<room_id>/<message_id>.<ext>`
 *  matches the storage RLS policy in migration 0009, which authorizes room
 *  members by parsing the room_id out of the object path. Returns the storage
 *  path to persist in `messages.audio_path` — NOT a public URL, since the
 *  bucket is private and playback goes through a signed URL instead. */
export async function uploadVoiceNote(roomId: string, messageId: string, blob: Blob, mimeType: string): Promise<string> {
  const path = `${roomId}/${messageId}.${extensionForMimeType(mimeType)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mimeType, upsert: false })
  if (error) throw new Error(`Failed to upload voice note: ${error.message}`)
  return path
}

/** Generates a short-lived signed URL for playback. Called on demand (first
 *  play tap) rather than for every message on room load, to avoid issuing a
 *  signed-URL request for clips the person never actually plays. */
export async function getVoiceNoteSignedUrl(audioPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    console.error('Failed to create signed URL for voice note:', error?.message)
    return null
  }
  return data.signedUrl
}
