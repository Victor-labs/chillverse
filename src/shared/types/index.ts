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
  // ── Edit Profile fields ──
  bio: string | null
  gender: string | null
  play_time: 'morning' | 'night' | null
  info_tags: string[]            // up to 2 of: 'gender' | 'play_time' | 'country' | 'presence'
  favorite_game: string | null   // matches a game's dbKey
  grid_cards: string[]           // up to 3 of: 'achievements' | 'rank' | 'leaderboard'
  show_follow_counts: boolean
  // ── Halo AI ──
  halo_messages_today: number            // default 0
  halo_last_message_date: string | null  // ISO date string YYYY-MM-DD or null
  version_level: number                  // 0 = v1.0 (free), 1 = v2.0, 2 = v3.0, etc.
  // ── Premium (Orbit / Void) ──
  is_pro: boolean                        // default false
  pro_tier: 'orbit' | 'void' | null
  pro_billing_interval: 'monthly' | 'yearly' | null
  pro_expires_at: string | null          // ISO timestamp; renewed by webhook on each successful charge
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

// ── Mall ────────────────────────────────────────────────────────────────────

export type MallRarity = 'Common' | 'Rare' | 'Epic' | 'Mythic'
export type MallItemCategory = 'avatar_skin' | 'profile_pic' | 'chat_theme' | 'xp_booster' | 'banner'

/** user_items.item_type — broader than MallItemCategory since some items
 *  (album pics, artifacts) are granted directly via rank rewards rather
 *  than purchased through the Mall. */
export type UserItemType = MallItemCategory | 'album_pic' | 'artifact'

export interface MallItem {
  id: string
  category: MallItemCategory
  sub_category: string | null
  name: string
  description: string | null
  rarity: MallRarity
  price_gems: number | null
  unlock_xp: number | null
  is_pro_locked: boolean
  unlocks_profile_pic_id: string | null
  grants_free_on_unlock: boolean
  image_url: string | null
  animated_url: string | null    // gif/mp4/webm shown only in the item detail modal
  is_consumable: boolean
  is_active: boolean
  created_at: string
}

export interface ProfilePicUnlockRequirement {
  id: string
  profile_pic_item_id: string
  required_avatar_item_id: string
}

export interface UserWallet {
  user_id: string
  gem_balance: number
}

export interface UserInventoryItem {
  id: string
  user_id: string
  item_id: string
  is_equipped: boolean
  quantity: number
}
