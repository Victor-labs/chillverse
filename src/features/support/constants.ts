// src/features/support/feedback/constants.ts
import type { SupportFeedbackStatus, SupportFeedbackSort } from '../../../shared/types'

export const FEEDBACK_STATUS_LABELS: Record<SupportFeedbackStatus, string> = {
  open: 'Open',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Not Planned',
}

export const FEEDBACK_STATUS_COLORS: Record<SupportFeedbackStatus, string> = {
  open: 'var(--text-muted)',
  planned: 'var(--blue, #4a9eff)',
  in_progress: 'var(--accent)',
  completed: 'var(--green, #35c46a)',
  declined: 'var(--text-muted)',
}

export const FEEDBACK_SORT_LABELS: Record<SupportFeedbackSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  top: 'Most votes',
}

/** Compact "3 days ago" style stamp — matches how the ticket list reads dates. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const seconds = Math.max(Math.floor((Date.now() - then) / 1000), 0)

  if (seconds < 45) return 'just now'

  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return plural(Math.max(minutes, 1), 'minute')

  const hours = Math.floor(seconds / 3600)
  if (hours < 24) return plural(hours, 'hour')

  const days = Math.floor(seconds / 86400)
  if (days < 30) return plural(days, 'day')

  const months = Math.floor(days / 30)
  if (months < 12) return plural(months, 'month')

  return plural(Math.floor(days / 365), 'year')
}
