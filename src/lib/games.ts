// src/lib/games.ts
// ─── Shared, lightweight game catalog ───────────────────────────
// Pulled out of Games.tsx so other pages (Edit Profile, leaderboards,
// etc.) can reference game metadata — name, icon, accent color, dbKey —
// without importing the full game lobby page and its game components.
import {
  Move, Brain, Drama, BookOpen, Grid3X3,
  Eye, Calculator, LayoutGrid, Hash, Target, Sparkles, Spade, Blocks,
  type LucideIcon,
} from 'lucide-react'
import type { GameKey } from './gameSession'

export type GameId =
  | 'arrow-dash' | 'pattern-memory' | 'rapid-sort'
  | 'trivia-clash' | 'tac-zone'
  | 'two-truths' | 'speed-math' | 'liars-grid'
  | 'hangman'
  | 'close-call'
  | 'pattern-king'
  | 'uno'
  | 'colour-block'

export interface GameMeta {
  id: GameId
  dbKey: GameKey
  name: string
  tagline: string
  accent: string
  unlimitedPlays?: boolean
  sessionCost?: number
  icon: LucideIcon
}

// Standard games — default session cost (1)
const STANDARD_GAMES: GameMeta[] = [
  { id: 'arrow-dash',     dbKey: 'arrow_dash',     name: 'Arrow Dash',            tagline: 'Tap the arrow direction. Fast.',                  accent: '#4f8ef7', icon: Move         },
  { id: 'pattern-memory', dbKey: 'pattern_memory', name: 'Pattern Memory',        tagline: 'Watch the sequence, then repeat it.',             accent: '#9b6dff', icon: Brain        },
  { id: 'rapid-sort',     dbKey: 'rapid_sort',     name: 'Anime Trivia',          tagline: 'Test your anime knowledge. Time shrinks as your streak grows.', accent: '#9b6dff', icon: Drama       },
  { id: 'tac-zone',       dbKey: 'tac_zone',       name: 'Tac Zone',              tagline: 'Three in a row. No mercy.',                      accent: '#3ecf8e', icon: Grid3X3, unlimitedPlays: true },
  { id: 'two-truths',     dbKey: 'two_truths',     name: 'Two Truths, One False', tagline: 'Spot the lie among three claims.',                accent: '#9b6dff', icon: Eye          },
  { id: 'speed-math',     dbKey: 'speed_math',     name: 'Speed Math',            tagline: 'Solve as many equations as you can.',             accent: '#3ecf8e', icon: Calculator   },
  { id: 'liars-grid',     dbKey: 'liars_grid',     name: "Liar's Grid",           tagline: 'Find the one wrong equation. One is lying.',      accent: '#ff4f4f', icon: LayoutGrid   },
]

// Higher session games — cost more sessions
const PREMIUM_GAMES: GameMeta[] = [
  { id: 'trivia-clash',   dbKey: 'trivia_clash',   name: 'Trivia Clash',          tagline: 'Drop knowledge. Wreck the scoreboard.',           accent: '#ff9a3c', icon: BookOpen, sessionCost: 6 },
  { id: 'hangman',        dbKey: 'hangman',        name: 'Hangman',               tagline: 'Guess the word. One letter at a time.',           accent: '#ff6b00', icon: Hash,     sessionCost: 3 },
  { id: 'close-call',     dbKey: 'close_call',     name: 'Close Call',            tagline: 'Type the closest answer you can. Fast.',          accent: '#ff4d8b', icon: Target,   sessionCost: 4 },
  { id: 'pattern-king',   dbKey: 'pattern_king',   name: 'Pattern King',          tagline: 'Memorize the grid. Clear every pattern before time runs out.', accent: '#00e5ff', icon: Sparkles, sessionCost: 3 },
  { id: 'uno',            dbKey: 'uno',            name: 'Chillverse_Uno',        tagline: 'Classic UNO against Halo — a smart AI that remembers your weaknesses.', accent: '#9b6dff', icon: Spade, sessionCost: 4 },
  { id: 'colour-block',   dbKey: 'colour_block',   name: 'Colour Block',          tagline: "Memorize the safe tile, survive the shuffle, don't get caught out.", accent: '#ff5fa2', icon: Blocks, sessionCost: 3 },
]

export const GAMES: GameMeta[] = [...STANDARD_GAMES, ...PREMIUM_GAMES]

export function getGameMeta(dbKey: string): GameMeta | undefined {
  return GAMES.find(g => g.dbKey === dbKey)
}
