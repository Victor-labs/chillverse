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
