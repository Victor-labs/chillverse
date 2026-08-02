// src/features/marketing/announcementSummary.ts
// A small, purely-client-side "auto summary" for announcement posts on the
// public /editorial-room reader page. Deliberately NOT a call out to an
// LLM/edge function — announcements are short staff posts to begin with,
// so a real model call would be overkill (and a recurring cost) for what's
// really just "condense this into one clean line." This is plain text
// processing: strip noise, split into sentences, and keep the first ones
// that fit a target length — good enough to give a reader the gist before
// they drop into the full text underneath.

/** Strips raw URLs and collapses whitespace, so a summary line never ends
 *  up truncated mid-link or full of double spaces from removed content. */
function cleanBody(body: string): string {
  return body
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Naive sentence splitter — good enough for short staff posts (no abbreviation
 *  handling needed, these aren't long-form articles). Splits on . ! ? followed
 *  by whitespace, keeping the punctuation on the sentence it ends. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g)
  if (matches && matches.length > 0) return matches.map(s => s.trim()).filter(Boolean)
  return text ? [text] : []
}

export interface AnnouncementSummary {
  /** True when the body was already short enough that no shortening was needed —
   *  the reader page skips the "Quick summary" block entirely in that case. */
  isFullBody: boolean
  summary: string
}

const SUMMARY_TARGET_LENGTH = 200

/**
 * Produces a short "quick summary" line from an announcement's full body.
 * Keeps whole sentences (never cuts one off mid-way) up to roughly
 * SUMMARY_TARGET_LENGTH characters. If the whole body already fits, the
 * summary IS the body — nothing to condense.
 */
export function summarizeAnnouncement(body: string): AnnouncementSummary {
  const cleaned = cleanBody(body)

  if (cleaned.length <= SUMMARY_TARGET_LENGTH) {
    return { isFullBody: true, summary: cleaned }
  }

  const sentences = splitSentences(cleaned)
  let summary = ''
  for (const sentence of sentences) {
    const next = summary ? `${summary} ${sentence}` : sentence
    if (next.length > SUMMARY_TARGET_LENGTH && summary) break
    summary = next
    if (summary.length >= SUMMARY_TARGET_LENGTH) break
  }

  // Sentence splitting found nothing usable (e.g. no terminal punctuation
  // at all) — fall back to a hard character truncation at a word boundary.
  if (!summary) {
    const slice = cleaned.slice(0, SUMMARY_TARGET_LENGTH)
    summary = `${slice.slice(0, slice.lastIndexOf(' ') > 0 ? slice.lastIndexOf(' ') : slice.length)}…`
  }

  return { isFullBody: summary.trim() === cleaned, summary: summary.trim() }
}
