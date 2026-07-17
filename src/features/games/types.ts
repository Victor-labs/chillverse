// src/pages/games/types.ts

export type GameRank = 'beginner' | 'intermediate' | 'advanced' | 'master'

export type GameId =
  | 'arrow-dash'
  | 'pattern-memory'
  | 'rapid-sort'
  | 'trivia-clash'
  | 'tac-zone'
  | 'two-truths'
  | 'speed-math'
  | 'liars-grid'
  | 'hangman'
  | 'pattern-king'
  | 'uno'
  | 'tile-merge'

export type GameKey =
  | 'arrow_dash'
  | 'pattern_memory'
  | 'rapid_sort'
  | 'trivia_clash'
  | 'tac_zone'
  | 'two_truths'
  | 'speed_math'
  | 'liars_grid'
  | 'hangman'
  | 'pattern_king'
  | 'uno'
  | 'tile_merge'

export interface RankConfig {
  rank: GameRank
  label: string
  color: string
  streakRequired: number
  xpBase: number
  xpStreakMax: number
}

export const RANK_CONFIGS: RankConfig[] = [
  { rank: 'beginner',     label: 'Beginner',     color: '#3ecf8e', streakRequired: 10, xpBase: 4, xpStreakMax: 70 },
  { rank: 'intermediate', label: 'Intermediate', color: '#4f8ef7', streakRequired: 10, xpBase: 5, xpStreakMax: 70 },
  { rank: 'advanced',     label: 'Advanced',     color: '#9b6dff', streakRequired: 10, xpBase: 6, xpStreakMax: 70 },
  { rank: 'master',       label: 'Master',       color: '#f5c542', streakRequired: 0,  xpBase: 7, xpStreakMax: 70 },
]

export function getRankConfig(rank: GameRank): RankConfig {
  return RANK_CONFIGS.find(r => r.rank === rank) ?? RANK_CONFIGS[0]
}

export function getNextRank(rank: GameRank): GameRank | null {
  const order: GameRank[] = ['beginner', 'intermediate', 'advanced', 'master']
  const idx = order.indexOf(rank)
  return idx < order.length - 1 ? order[idx + 1] : null
}

/** Cap XP to hard limit of 70 per session */
export function calcSessionXP(correct: number, total: number, streak: number, base: number): number {
  const accuracy = total > 0 ? correct / total : 0
  const streakBonus = Math.min(streak * 0.05, 0.4) // up to 40% bonus
  const raw = Math.round(correct * base * (1 + streakBonus) * accuracy * 10)
  return Math.min(raw, 70)
}

export interface GameEndPayload {
  gameId: GameId
  gameName: string
  rank: GameRank
  score: number
  xpEarned: number
  durationSec: number
  streak: number
  correct: number
  total: number
  detail: Record<string, string | number>
}

export interface PlayerRankState {
  rank: GameRank
  currentStreak: number
  bestStreak: number
}

export const DEFAULT_RANK_STATE: PlayerRankState = {
  rank: 'beginner',
  currentStreak: 0,
  bestStreak: 0,
}
