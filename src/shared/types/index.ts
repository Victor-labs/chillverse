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
  longest_streak: number
  last_streak_date: string | null
  created_at: string
  connected_platform: string | null
  // ── Edit Profile fields ──
  bio: string | null
  gender: string | null
  play_time: 'morning' | 'night' | null
  info_tags: string[]            // up to 2 of: 'gender' | 'play_time' | 'country' | 'presence'
  favorite_game: string | null   // matches a game's dbKey — showcased on the profile page
  grid_cards: string[]           // up to 3 of: 'achievements' | 'rank' | 'leaderboard'
  pinned_games: string[]         // Games lobby star/pin list — matches games.ts `id` values (hyphenated), NOT dbKey. Private, not shown on the profile.
  show_follow_counts: boolean | null
  // ── Halo AI ──
  halo_messages_today: number            // default 0
  halo_last_message_date: string | null  // ISO date string YYYY-MM-DD or null
  version_level: number | null           // 0 = v1.0 (free), 1 = v2.0, 2 = v3.0, etc.
  // ── Premium (Orbit / Void) ──
  is_pro: boolean                        // default false
  pro_tier: 'orbit' | 'void' | null
  pro_billing_interval: 'monthly' | 'yearly' | null
  pro_expires_at: string | null          // ISO timestamp; renewed by webhook on each successful charge
  pro_cancel_at_period_end: boolean      // true once the player has cancelled — keeps access until pro_expires_at, just won't renew
  // ── Presence / account housekeeping ──
  presence: string | null                // 'online' | 'away' | 'invisible' etc.; nullable, defaults to 'online'
  username_changed_at: string | null     // ISO timestamp of last username change, null if never changed
  original_username: string              // set once at signup, never changed again — powers the "Legacy Username" badge
  banner_url: string | null              // equipped profile banner image, null if none equipped
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

// ── Support center ──────────────────────────────────────────────────────────

export interface SupportCategory {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string
  sort_order: number
  created_at: string
}

/** Row shape returned by the `list_support_categories_with_counts` RPC. */
export interface SupportCategoryWithCount extends SupportCategory {
  article_count: number
}

export interface SupportArticle {
  id: string
  category_id: string
  slug: string
  title: string
  summary: string | null
  content: string
  tags: string[]
  is_published: boolean
  view_count: number
  helpful_count: number
  not_helpful_count: number
  sort_order: number
  created_at: string
  updated_at: string
}

/** Row shape returned by the `search_support_articles` RPC. */
export interface SupportArticleSearchResult {
  id: string
  category_id: string
  slug: string
  title: string
  summary: string | null
  tags: string[]
  view_count: number
  helpful_count: number
  not_helpful_count: number
  rank: number
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface SupportTicket {
  id: string
  user_id: string
  category_id: string | null
  subject: string
  message: string
  contact_email: string | null
  status: SupportTicketStatus
  priority: SupportTicketPriority
  created_at: string
  updated_at: string
}

export interface NewSupportTicketInput {
  categoryId: string | null
  subject: string
  message: string
  contactEmail: string | null
}

// ── Blog ───────────────────────────────────────────────────────────────────

export type BlogCategory =
  | 'game-updates'
  | 'community-spotlight'
  | 'chillverse-hq'
  | 'how-to'
  | 'safety'

export type BlogLocale = 'en' | 'pcm'

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  hero_image_url: string | null
  category: BlogCategory
  series: string | null
  tags: string[]
  locale: BlogLocale
  translation_group_id: string | null
  author_id: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Row shape returned by the `search_blog_posts` RPC. */
export interface BlogSearchResult {
  id: string
  slug: string
  title: string
  excerpt: string | null
  hero_image_url: string | null
  category: BlogCategory
  series: string | null
  tags: string[]
  locale: BlogLocale
  published_at: string | null
  rank: number
}

/** Fields an admin can set when creating or editing a post. */
export interface BlogPostInput {
  slug: string
  title: string
  excerpt: string
  content: string
  heroImageUrl: string
  category: BlogCategory
  series: string
  tags: string[]
  locale: BlogLocale
  translationGroupId: string | null
  isPublished: boolean
}
