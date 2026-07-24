// src/features/highlights/types.ts

export type HighlightKind =
  | 'game_result'
  | 'achievement'
  // Duolingo-style automatic triggers (see highlightTriggers.ts) ──────────
  | 'xp_milestone'      // accumulated XP in one game crossed the threshold — custom PNG
  | 'personal_best'     // beat their own previous best score in a game — custom PNG
  | 'streak_milestone'  // hit a streak-ladder day count — custom PNG
  | 'leaderboard_rank'  // entered top 3 on a game's leaderboard — custom PNG
  | 'map_complete'      // fully cleared every chamber in an exploration map — author's own profile pic
  | 'leaderboard_badge' // granted the Leaderboard Legend / Runner-Up Elite badge — the badge's own icon
  | 'lucky_user'        // picked as Halo's Lucky User of the Day (server-side pick, migration 0076) — Clover icon

export interface Highlight {
  id: string
  author_id: string
  kind: HighlightKind
  game_key: string | null
  body: string
  likes_count: number
  created_at: string
  /** Generic payload number: accumulated XP total / streak day count / leaderboard rank. Null otherwise. */
  value: number | null
  /** Exploration map id — map_complete only. */
  map_id: number | null
  /** badges.id — leaderboard_badge only. */
  badge_id: string | null
  // joined client-side, not a real column
  author?: {
    id: string
    username: string
    display_name: string | null
    avatar: string
  }
  // joined client-side for leaderboard_badge highlights, not a real column
  badge?: {
    id: string
    title: string
    description: string
    icon: string
  }
  liked_by_me?: boolean
}

/** How long a highlight stays visible before it's filtered out of every query. */
export const HIGHLIGHT_LIFETIME_DAYS = 5
