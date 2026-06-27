// src/lib/games.ts
// ─── Shared, lightweight game catalog ───────────────────────────
// Pulled out of Games.tsx so other pages (Edit Profile, leaderboards,
// etc.) can reference game metadata — name, icon, accent color, dbKey —
// without importing the full game lobby page and its game components.
import {
  Move, Brain, Layers, BookOpen, Grid3X3, Flag,
  Eye, Calculator, LayoutGrid, Hash, Target,
  type LucideIcon,
} from 'lucide-react'
import type { GameKey } from './gameSession'

export type GameId =
  | 'arrow-dash' | 'pattern-memory' | 'rapid-sort'
  | 'trivia-clash' | 'tac-zone' | 'flag-rush'
  | 'two-truths' | 'speed-math' | 'liars-grid'
  | 'hangman'
  | 'close-call'

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
  { id: 'rapid-sort',     dbKey: 'rapid_sort',     name: 'Rapid Sort',            tagline: 'Sort items into categories fast!',                accent: '#ff4d8b', icon: Layers       },
  { id: 'tac-zone',       dbKey: 'tac_zone',       name: 'Tac Zone',              tagline: 'Three in a row. No mercy.',                      accent: '#3ecf8e', icon: Grid3X3, unlimitedPlays: true },
  { id: 'flag-rush',      dbKey: 'flag_rush',      name: 'Flag Rush',             tagline: "Flags don't lie. Can you read them?",             accent: '#4f8ef7', icon: Flag         },
  { id: 'two-truths',     dbKey: 'two_truths',     name: 'Two Truths, One False', tagline: 'Spot the lie among three claims.',                accent: '#9b6dff', icon: Eye          },
  { id: 'speed-math',     dbKey: 'speed_math',     name: 'Speed Math',            tagline: 'Solve as many equations as you can.',             accent: '#3ecf8e', icon: Calculator   },
  { id: 'liars-grid',     dbKey: 'liars_grid',     name: "Liar's Grid",           tagline: 'Find the one wrong equation. One is lying.',      accent: '#ff4f4f', icon: LayoutGrid   },
]

// Higher session games — cost more sessions
const PREMIUM_GAMES: GameMeta[] = [
  { id: 'trivia-clash',   dbKey: 'trivia_clash',   name: 'Trivia Clash',          tagline: 'Drop knowledge. Wreck the scoreboard.',           accent: '#ff9a3c', icon: BookOpen, sessionCost: 6 },
  { id: 'hangman',        dbKey: 'hangman',        name: 'Hangman',               tagline: 'Guess the word. One letter at a time.',           accent: '#ff6b00', icon: Hash,     sessionCost: 3 },
  { id: 'close-call',     dbKey: 'close_call',     name: 'Close Call',            tagline: 'Type the closest answer you can. Fast.',          accent: '#ff4d8b', icon: Target,   sessionCost: 4 },
]

export const GAMES: GameMeta[] = [...STANDARD_GAMES, ...PREMIUM_GAMES]

export function getGameMeta(dbKey: string): GameMeta | undefined {
  return GAMES.find(g => g.dbKey === dbKey)
}
