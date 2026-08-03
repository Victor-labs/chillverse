// src/features/games/gamesHomeData.ts
// Data for the new Games Home page: Trending Now (recent + "Hot" ranking)
// and the small catalog of multiplayer titles that can also surface there.
import { Crown, Dices } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { GAMES, type GameMeta } from './games'

const TRENDING_WINDOW_DAYS = 10
const HOT_TAG_TOP_N = 5

export interface TrendingEntry {
  key: string           // dbKey for solo games, route for multiplayer
  meta: GameMeta | MultiplayerTrendingGame
  isMultiplayer: boolean
  playerCount: number    // distinct players in the trending window
  isHot: boolean
  isNew: boolean         // no plays before the window started (just released, from this data's POV)
}

export interface MultiplayerTrendingGame {
  id: string
  name: string
  tagline: string
  tag: string
  accent: string
  icon: LucideIcon
  bannerUrl?: string
  route: string
  requiresActiveSub: boolean
}

// A couple of multiplayer titles surfaced in Trending Now, per spec ("even
// some picked from multiplayer"). Kept as a small local list rather than
// pulling in the full Multiplayer.tsx catalog, since only these need to be
// visible/deep-linkable from the Games Home page.
export const MULTIPLAYER_TRENDING: MultiplayerTrendingGame[] = [
  { id: 'chess', name: 'Chillverse Chess', tagline: 'Full rules, real AI — castling, en passant, the works.', tag: 'Multiplayer', accent: '#c9a24b', icon: Crown, route: '/play/chess', requiresActiveSub: false },
  { id: 'ludo',  name: 'Ludo',             tagline: 'Roll, race, and knock the AI back to base.',            tag: 'Multiplayer', accent: '#c79a3b', icon: Dices, route: '/play/ludo',  requiresActiveSub: false },
]

/**
 * Ranks the solo catalog by recent play volume (last TRENDING_WINDOW_DAYS)
 * and marks the top HOT_TAG_TOP_N by distinct player count as "Hot". Games
 * with zero prior sessions (ever) are marked "New" instead of ranked.
 */
export async function fetchTrendingGames(): Promise<TrendingEntry[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('game_sessions')
    .select('game, user_id')
    .gte('played_at', since)
    .limit(5000)

  const counts = new Map<string, Set<string>>()
  if (!error && data) {
    for (const row of data as { game: string; user_id: string }[]) {
      if (!counts.has(row.game)) counts.set(row.game, new Set())
      counts.get(row.game)!.add(row.user_id)
    }
  }

  const ranked = GAMES
    .map(g => ({ game: g, playerCount: counts.get(g.dbKey)?.size ?? 0 }))
    .sort((a, b) => b.playerCount - a.playerCount)

  const hotKeys = new Set(ranked.filter(r => r.playerCount > 0).slice(0, HOT_TAG_TOP_N).map(r => r.game.dbKey))

  const soloEntries: TrendingEntry[] = ranked.map(({ game, playerCount }) => ({
    key: game.dbKey,
    meta: game,
    isMultiplayer: false,
    playerCount,
    isHot: hotKeys.has(game.dbKey),
    isNew: playerCount === 0,
  }))

  const mpEntries: TrendingEntry[] = MULTIPLAYER_TRENDING.map(mp => ({
    key: mp.route,
    meta: mp,
    isMultiplayer: true,
    playerCount: 0,
    isHot: false,
    isNew: false,
  }))

  // Interleave a couple of multiplayer picks into the front of the row so
  // they're visible without pushing every solo game down. Capped at 5
  // total cards for Trending Now.
  return [...soloEntries.slice(0, 2), ...mpEntries, ...soloEntries.slice(2)].slice(0, 5)
}

export function isGameMeta(x: GameMeta | MultiplayerTrendingGame): x is GameMeta {
  return 'dbKey' in x
}
