// src/features/posts/types.ts

export type PostAuthorType = 'user' | 'admin' | 'system'

export type PostKind = 'announcement' | 'feature_update' | 'general' | 'rank_tag' | 'blog_feature'

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
  /** Optional headline (migration 0101) — mainly for staff/system posts,
   *  used as the article title in the public Editorial Room. Null on
   *  regular user posts and on older staff posts predating this column. */
  title?: string | null
  body: string
  tags: PostTag[]
  likes_count: number
  comments_count: number
  influence: number
  commentable: boolean
  created_at: string
  hidden: boolean
  hidden_reason: string | null
  /** Real DB column (set by StaffComposer) — not previously on this type. */
  post_kind?: PostKind
  /** Set only when post_kind === 'rank_tag' — one of the 8 rank groups (see
   *  RANK_GROUP_IDS in src/features/profile/ranks.ts). */
  rank_tag_group?: string | null
  // attached image, if any (set by StaffComposer's uploadFeedImage — see staffPosts.ts)
  media_url?: string | null
  media_type?: 'image' | null
  /** Set only when post_kind === 'blog_feature' — a snapshot of the source
   *  blog_posts row taken at share time (see migration 0092). These are
   *  plain copied values, not a live join: the source article can later be
   *  edited, unpublished, or deleted with zero effect on this post. */
  blog_slug?: string | null
  blog_title?: string | null
  blog_excerpt?: string | null
  blog_hero_image_url?: string | null
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
  is_void_plan: boolean
  has_profile_pic: boolean
}

export interface TagSuggestion extends PostTag {
  /** true when this suggestion comes from something the user just did (shown first) */
  fromRecentEvent?: boolean
}
