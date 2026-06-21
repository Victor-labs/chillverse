// src/types/index.ts
export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar: string
  country: string | null
  interests: string[]
  dob: string | null
  xp: number
  level: number
  streak: number
  created_at: string
  connected_platform: string | null
}

export interface SignupProfileInput {
  username: string
  displayName: string
  country: string
  interests: string[]
  dob: string
  connectedPlatform: string | null
}

export interface MockUser {
  id: number
  username: string
  displayName: string
  bio: string
  xp: number
  level: number
  streak: number
  followers: number
  following: number
  friends: number
  color: string
  joinDate: string
}

export interface GameDetail {
  score: string
  duration: string
  xpEarned: number
  players: string[]
  map: string
}

export interface StudioDetail {
  caption: string
  likes: number
  comments: number
  shares: number
}

export interface AchievementDetail {
  name: string
  desc: string
  xpEarned: number
  rarity: string
}

export interface FeedItem {
  id: number
  type: 'game' | 'studio' | 'achievement'
  time: string
  title: string
  sub: string
  detail: GameDetail | StudioDetail | AchievementDetail
}
