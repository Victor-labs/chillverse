// src/pages/multiplayer/multiplayerTypes.ts

import type { MultiplayerGameId } from './multiplayerGameData'

// ──────────────────────────────────────────────────────
// Database row shapes
// ──────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'countdown' | 'in_progress' | 'completed'
export type TeamChoice = 'A' | 'B' | null

export interface GameRoomRow {
  id: string
  game_id: MultiplayerGameId
  room_name: string
  host_id: string
  is_private: boolean
  password_hash: string | null
  status: RoomStatus
  max_player_count: number
  min_player_count: number
  current_player_count: number
  team_mode: 'ffa' | '2v2' | null
  countdown_start_at: string | null
  created_at: string
}

export interface RoomPlayerRow {
  room_id: string
  player_id: string
  team: TeamChoice
  is_host: boolean
  joined_at: string
}

export interface RoomMessageRow {
  id: string
  room_id: string
  player_id: string
  message: string
  created_at: string
}

// ──────────────────────────────────────────────────────
// Enriched shapes (joined with profiles)
// ──────────────────────────────────────────────────────

export interface RoomPlayerProfile {
  player_id: string
  username: string
  display_name: string | null
  avatar: string
  team: TeamChoice
  is_host: boolean
  joined_at: string
}

export interface RoomMessageEnriched extends RoomMessageRow {
  senderName: string
  senderAvatar: string
}

// ──────────────────────────────────────────────────────
// Browse list shape (public room cards)
// ──────────────────────────────────────────────────────

export interface PublicRoomCard extends GameRoomRow {
  hostName: string
  teamA: number
  teamB: number
}

// ──────────────────────────────────────────────────────
// Realtime Broadcast event payloads
// ──────────────────────────────────────────────────────

export interface CountdownStartEvent {
  type: 'countdown_start'
  serverTimestamp: string  // ISO string — all clients compute elapsed from this
  roomId: string
}

export interface PlayerTeamChangeEvent {
  type: 'team_change'
  playerId: string
  team: TeamChoice
}

export interface ChatMessageEvent {
  type: 'chat_message'
  id: string
  playerId: string
  senderName: string
  message: string
  createdAt: string
}

export interface GameStateEvent {
  type: 'game_state'
  // Generic — individual game engines extend this
  payload: Record<string, unknown>
}

export type RealtimeBroadcastEvent =
  | CountdownStartEvent
  | PlayerTeamChangeEvent
  | ChatMessageEvent
  | GameStateEvent

// ──────────────────────────────────────────────────────
// Room creation form input
// ──────────────────────────────────────────────────────

export interface CreateRoomInput {
  gameId: MultiplayerGameId
  roomName: string
  isPrivate: boolean
  password: string
}

// ──────────────────────────────────────────────────────
// Join private room RPC response
// ──────────────────────────────────────────────────────

export interface JoinPrivateRoomResult {
  ok: boolean
  error?: string
  already_member?: boolean
}
