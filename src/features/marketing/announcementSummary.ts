// src/features/marketing/announcementSummary.ts
// A small, purely-client-side "auto summary" for announcement posts on the
// public /editorial-room reader page. Deliberately NOT a call out to an
// LLM/edge function — announcements are short staff posts to begin with,
// so a real model call would be overkill (and a recurring cost) for what's
// really just "surface the most informative sentences." This is plain text
// processing: strip noise, split into sentences, score each sentence by
// how many "important" (non-boilerplate, non-repeated-filler) words it
// carries, and keep the highest-scoring ones — not just whichever happen
// to come first. Chosen sentences are then put back in their original
// order so the summary still reads naturally.

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

// Common English function words carry no real signal about *what the
// announcement is about* — excluding them from the frequency count keeps
// the scorer from just rewarding whichever sentence has the most "the"s.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'without', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'us', 'our', 'you', 'your', 'they',
  'their', 'i', 'my', 'he', 'she', 'his', 'her', 'them', 'will', 'would', 'can', 'could',
  'should', 'may', 'might', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'yes',
  'up', 'out', 'into', 'about', 'over', 'again', 'more', 'most', 'some', 'any', 'all', 'just',
  'also', 'now', 'than', 'there', 'here', 'what', 'when', 'where', 'which', 'who', 'how', 'why',
])

function wordsOf(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

export interface AnnouncementSummary {
  /** True when the body was already short enough that no shortening was needed —
   *  the reader page skips the "Quick summary" block entirely in that case. */
  isFullBody: boolean
  summary: string
}

const SUMMARY_TARGET_LENGTH = 220

/**
 * Produces a short "quick summary" from an announcement's full body by
 * picking the most *informative* sentences rather than just the leading
 * ones. Each sentence is scored on the frequency of its meaningful
 * (non-stopword) words across the whole body — words that recur are
 * treated as the announcement's actual subject matter, so a sentence that
 * uses them scores higher. Sentences are added highest-score-first until
 * roughly SUMMARY_TARGET_LENGTH characters are covered, then re-sorted
 * back into original reading order. If the whole body already fits, the
 * summary IS the body — nothing to condense.
 */
export function summarizeAnnouncement(body: string): AnnouncementSummary {
  const cleaned = cleanBody(body)

  if (cleaned.length <= SUMMARY_TARGET_LENGTH) {
    return { isFullBody: true, summary: cleaned }
  }

  const sentences = splitSentences(cleaned)

  // Sentence splitting found nothing usable (e.g. no terminal punctuation
  // at all) — fall back to a hard character truncation at a word boundary.
  if (sentences.length === 0) {
    const slice = cleaned.slice(0, SUMMARY_TARGET_LENGTH)
    const summary = `${slice.slice(0, slice.lastIndexOf(' ') > 0 ? slice.lastIndexOf(' ') : slice.length)}…`
    return { isFullBody: false, summary }
  }

  // Word frequency across the whole announcement — this is what decides
  // which words count as "the point" of the post.
  const freq = new Map<string, number>()
  const sentenceWords = sentences.map(wordsOf)
  for (const words of sentenceWords) {
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  }

  // Score = sum of each unique meaningful word's frequency, normalized by
  // sentence length so one long run-on sentence can't win purely on word
  // count. A small bonus for earlier sentences breaks ties in favor of
  // context-setting lines (announcements tend to lead with what changed).
  const scored = sentences.map((sentence, i) => {
    const words = sentenceWords[i]
    const uniqueWords = new Set(words)
    const rawScore = [...uniqueWords].reduce((sum, w) => sum + (freq.get(w) ?? 0), 0)
    const normalized = words.length > 0 ? rawScore / Math.sqrt(words.length) : 0
    const positionBonus = i === 0 ? normalized * 0.15 : 0
    return { sentence, index: i, score: normalized + positionBonus }
  })

  const ranked = [...scored].sort((a, b) => b.score - a.score)

  const chosen: typeof scored = []
  let length = 0
  for (const candidate of ranked) {
    if (length > 0 && length + candidate.sentence.length > SUMMARY_TARGET_LENGTH) continue
    chosen.push(candidate)
    length += candidate.sentence.length + 1
    if (length >= SUMMARY_TARGET_LENGTH) break
  }
  // Always have at least the single best sentence, even if it alone
  // overshoots the target length slightly — an empty summary is worse.
  if (chosen.length === 0) chosen.push(ranked[0])

  const summary = chosen
    .sort((a, b) => a.index - b.index)
    .map(c => c.sentence)
    .join(' ')
    .trim()

  return { isFullBody: summary === cleaned, summary }
}
