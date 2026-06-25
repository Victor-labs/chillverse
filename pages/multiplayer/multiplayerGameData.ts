// src/pages/multiplayer/multiplayerGameData.ts
// Static config driving Create Room form + Room Card display

export type MultiplayerGameId =
  | 'tac-zone'
  | 'trivia-clash'
  | 'liars-grid'
  | 'two-truths'
  | 'bluff-bid'
  | 'number-rush'
  | 'word-chain'

export type TeamCapability = 'none' | 'optional-2v2'

export interface MultiplayerGame {
  id: MultiplayerGameId
  name: string
  emoji: string
  description: string
  minPlayers: number
  maxPlayers: number
  /** Whether the game has a fixed player count or a range */
  fixedCount: boolean
  /** Can this game run in 2v2 team mode? */
  teamCapability: TeamCapability
  /** 'turn' | 'race' | 'fixed-turn' */
  engineType: 'race' | 'turn-cycle' | 'fixed-turn'
  /** Rounds played per match */
  roundCount: number
  /** seconds per round/turn */
  turnTimerSec: number
}

export const MULTIPLAYER_GAMES: MultiplayerGame[] = [
  {
    id: 'tac-zone',
    name: 'Tac Zone',
    emoji: '⭕',
    description: 'Head-to-head Tic-Tac-Toe with a 15s move timer.',
    minPlayers: 2,
    maxPlayers: 2,
    fixedCount: true,
    teamCapability: 'none',
    engineType: 'fixed-turn',
    roundCount: 1,
    turnTimerSec: 15,
  },
  {
    id: 'trivia-clash',
    name: 'Trivia Clash',
    emoji: '🧠',
    description: '10 rapid-fire trivia questions — speed counts.',
    minPlayers: 4,
    maxPlayers: 4,
    fixedCount: true,
    teamCapability: 'none',
    engineType: 'race',
    roundCount: 10,
    turnTimerSec: 8,
  },
  {
    id: 'liars-grid',
    name: "Liar's Grid",
    emoji: '🔢',
    description: 'Find the wrong equation in a 3×3 grid before your rivals.',
    minPlayers: 2,
    maxPlayers: 4,
    fixedCount: false,
    teamCapability: 'optional-2v2',
    engineType: 'race',
    roundCount: 8,
    turnTimerSec: 12,
  },
  {
    id: 'two-truths',
    name: 'Two Truths & a Lie',
    emoji: '🤥',
    description: 'Spot the lie among three statements.',
    minPlayers: 2,
    maxPlayers: 4,
    fixedCount: false,
    teamCapability: 'optional-2v2',
    engineType: 'race',
    roundCount: 8,
    turnTimerSec: 12,
  },
  {
    id: 'bluff-bid',
    name: 'Bluff Bid',
    emoji: '🎯',
    description: 'Estimate real-world quantities — closest guess wins each round.',
    minPlayers: 2,
    maxPlayers: 4,
    fixedCount: false,
    teamCapability: 'optional-2v2',
    engineType: 'race',
    roundCount: 8,
    turnTimerSec: 15,
  },
  {
    id: 'number-rush',
    name: 'Number Rush',
    emoji: '🔥',
    description: 'First to crack the arithmetic puzzle wins the round.',
    minPlayers: 4,
    maxPlayers: 4,
    fixedCount: true,
    teamCapability: 'none',
    engineType: 'race',
    roundCount: 8,
    turnTimerSec: 20,
  },
  {
    id: 'word-chain',
    name: 'Word Chain',
    emoji: '🔤',
    description: 'Build a chain of words — last player standing wins.',
    minPlayers: 2,
    maxPlayers: 6,
    fixedCount: false,
    teamCapability: 'none',
    engineType: 'turn-cycle',
    roundCount: 3, // best of 3
    turnTimerSec: 10,
  },
]

export const MULTIPLAYER_GAME_MAP: Record<MultiplayerGameId, MultiplayerGame> =
  Object.fromEntries(MULTIPLAYER_GAMES.map(g => [g.id, g])) as Record<
    MultiplayerGameId,
    MultiplayerGame
  >

/** Returns true if the game CAN run 2v2 given the player count about to start */
export function resolveTeamMode(
  game: MultiplayerGame,
  playerCount: number,
  hostPreference: 'ffa' | '2v2' | null
): 'ffa' | '2v2' {
  if (game.teamCapability === 'none') return 'ffa'
  if (playerCount !== 4) return 'ffa' // 3 players always forces FFA per spec
  return hostPreference === '2v2' ? '2v2' : 'ffa'
}

/** Human-readable player count label, e.g. "2–4 players" or "4 players" */
export function playerCountLabel(game: MultiplayerGame): string {
  if (game.fixedCount) return `${game.maxPlayers} players`
  return `${game.minPlayers}–${game.maxPlayers} players`
}
