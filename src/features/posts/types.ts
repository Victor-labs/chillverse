// src/features/posts/types.ts

export type PostAuthorType = 'user' | 'admin' | 'system'

/** Distinguishes staff posts in the Announcements tab. Regular player
 *  posts (author_type 'user') are always 'general' and never surfaced
 *  with a kind badge. */
export type PostKind = 'general' | 'announcement' | 'feature_update'

export type PostMediaType = 'image'

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
  /** 'general' for every player post; staff posts (author_type admin/system)
   *  set this to 'announcement' or 'feature_update' to badge and filter them. */
  post_kind: PostKind
  /** Public URL of an attached image, or null. Currently image-only — see
   *  migration 0028. */
  media_url: string | null
  media_type: PostMediaType | null
  /** Staff-only: pins a post to the top of the Announcements tab. */
  pinned: boolean
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
  is_notice: boolean
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
