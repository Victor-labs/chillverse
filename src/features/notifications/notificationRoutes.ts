// src/features/notifications/notificationRoutes.ts
//
// Single source of truth for "where does tapping this notification go".
// Used by both the Notifications page and the in-app toast so the two
// stay consistent. `meta` shapes here match whatever each notify*()
// helper (achievements.ts / posts.ts / highlights.ts / haloMoments.ts /
// liveNotifications.ts) actually writes into notifications.meta.
//
// Returns null when there's nowhere sensible to send the user (unknown
// type, or a known type missing the id it needs) — callers should just
// no-op the tap in that case rather than navigating somewhere wrong.

type Meta = Record<string, unknown> | null | undefined

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function getNotificationRoute(type: string, meta: Meta): string | null {
  const m = meta ?? {}

  switch (type) {
    // ── Social — take you to the other person's profile ──────────
    case 'follow':       return str(m.follower_id) && `/profile/${str(m.follower_id)}`
    case 'profile_view': return str(m.viewer_id)   && `/profile/${str(m.viewer_id)}`
    case 'profile_like': return str(m.liker_id)     && `/profile/${str(m.liker_id)}`
    case 'followed_rank_up': return str(m.user_id) ? `/profile/${str(m.user_id)}` : '/ranks'
    case 'streak':           return str(m.user_id) ? `/profile/${str(m.user_id)}` : '/streak'

    // ── Your own progress ──────────────────────────────────────
    case 'rank_up':         return '/ranks'
    case 'achievement':     return '/achievements'
    case 'artifact':        return '/artifacts'
    case 'level_up':        return '/dashboard'
    case 'streak_warning':  return '/streak'
    case 'come_back':       return '/dashboard'

    // ── Content ────────────────────────────────────────────────
    case 'highlight_posted': return '/feed/highlights'
    case 'new_post':
    case 'post_tag':         return str(m.post_id) ? `/feed/${str(m.post_id)}` : '/feed'

    // ── Messaging ──────────────────────────────────────────────
    case 'message':
    case 'missed_call':
    case 'rank_tag':          return '/chat?tab=chats'

    // ── Clubs ──────────────────────────────────────────────────
    // Pending invites can't open the room yet (not a member) — send them
    // to the Clubs tab, where the "waiting list" banner already shows.
    case 'club_invite_pending': return '/chat?tab=clubs'
    case 'club_added':
    case 'club_invite_accepted': return str(m.room_id) ? `/clubs/${str(m.room_id)}` : '/chat?tab=clubs'

    // ── Live / system ──────────────────────────────────────────
    case 'session_reset':         return '/games'
    case 'movies_open':           return '/watch'
    case 'exploration_complete':  return '/exploration'
    case 'halo':                  return '/halo'

    // ── Mall (forward-compatible for when a mall-drop notifier ships) ──
    case 'mall_item':
    case 'mall_drop':             return '/mall'

    default: return null
  }
}
