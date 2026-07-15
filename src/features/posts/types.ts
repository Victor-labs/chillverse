// src/features/posts/types.ts

export type PostAuthorType = 'user' | 'admin' | 'system'

export type PostKind = 'announcement' | 'feature_update' | 'general'

export type TagType =
  | 'achievement'
  | 'game_result'
  | 'multiplayer_result'
  | 'rank'
  | 'streak'
  | 'mission'
  | 'user'
  | 'avatar'
  | 'artifact'
  | 'mall_item'

export interface PostTag {
  type: TagType
  ref_id: string
  label: string
  /** Extra data needed to make the tag clickable — currently just game navigation. */
  meta?: { gameId?: string }
}

export interface PostAuthor {
  id: string | null
  username: string
  display_name: string | null
  avatar: string
}

export interface Post {
  id: string
  author_id: string | null
  author_type: PostAuthorType
  body: string
  tags: PostTag[]
  likes_count: number
  comments_count: number
  influence: number
  commentable: boolean
  created_at: string
  hidden: boolean
  hidden_reason: string | null
  // attached image, if any (set by StaffComposer's uploadFeedImage — see staffPosts.ts)
  media_url?: string | null
  media_type?: 'image' | null
  // joined client-side, not a real column
  author?: PostAuthor
  liked_by_me?: boolean
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  hidden: boolean
  hidden_reason: string | null
  author?: PostAuthor
}

export interface PostingEligibility {
  eligible: boolean
  is_gold_rank: boolean
  games_completed: number
  games_required: number
  has_profile_pic: boolean
}

export interface TagSuggestion extends PostTag {
  /** true when this suggestion comes from something the user just did (shown first) */
  fromRecentEvent?: boolean
}
