// src/features/games/favorites.ts
// Pinned/favorite games for the Games lobby. Starring a game in the detail
// sheet pins its card to the top of its section (and shows a star badge on
// the card). Persisted on `profiles.pinned_games` — a private per-user
// column, separate from the existing public `favorite_game` (singular)
// showcased on the profile page. Don't conflate the two.
import { supabase } from '../../shared/lib/supabase'
import type { GameId } from './games'

export async function savePinnedGames(userId: string, pinned: Set<GameId>): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ pinned_games: [...pinned] })
    .eq('id', userId)

  if (error) console.error('savePinnedGames error:', error)
  return !error
}

// Stable partition: favorited games first (in their existing relative
// order), then the rest — so a section's own internal ordering never
// scrambles, favorites just float to the top of it.
export function withFavoritesFirst<T extends { id: GameId }>(games: T[], favorites: Set<GameId>): T[] {
  const favs = games.filter(g => favorites.has(g.id))
  const rest = games.filter(g => !favorites.has(g.id))
  return [...favs, ...rest]
}
