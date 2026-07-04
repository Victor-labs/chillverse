// src/features/highlights/types.ts

export type HighlightKind = 'game_result' | 'achievement'

export interface Highlight {
  id: string
  author_id: string
  kind: HighlightKind
  game_key: string | null
  body: string
  likes_count: number
  created_at: string
  // joined client-side, not a real column
  author?: {
    id: string
    username: string
    display_name: string | null
    avatar: string
  }
  liked_by_me?: boolean
}

/** How long a highlight stays visible before it's filtered out of every query. */
export const HIGHLIGHT_LIFETIME_DAYS = 5
