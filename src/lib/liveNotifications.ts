// src/lib/liveNotifications.ts
//
// Client-detected "state change" notifications that don't have a natural
// DB trigger to hang off of. Both are polled from AppLayout (on mount +
// on an interval) and de-duped per-device via localStorage so we only
// fire once per actual transition, not once per check.
//
// Because they go through the same `notifications` table as everything
// else, useNotificationToast picks them up instantly via Realtime if the
// person is already in the app, and they show up in the bell / Notifications
// page the next time they open it if they weren't.

import { supabase } from './supabase'
import { getGlobalSessionInfo } from './gameSession'

// Keep this in sync with OPEN_HOUR in src/pages/Watch.tsx
const MOVIES_OPEN_HOUR = 5

function sessionStateKey(userId: string) {
  return `cv_session_state_${userId}`
}
function moviesStateKey(userId: string) {
  return `cv_movies_state_${userId}`
}

// ── Session limit reset ─────────────────────────────────────────
// Fires once when the server-side session limit transitions from
// "capped" back to "open" for this user.
export async function checkSessionResetNotification(userId: string, username: string): Promise<void> {
  try {
    const info = await getGlobalSessionInfo(userId)
    const key = sessionStateKey(userId)
    const stored = localStorage.getItem(key) // 'capped' | 'ok' | null

    // First check ever on this device — just record state, don't notify.
    if (stored === null) {
      localStorage.setItem(key, info.limitReached ? 'capped' : 'ok')
      return
    }

    if (info.limitReached) {
      localStorage.setItem(key, 'capped')
      return
    }

    if (stored === 'capped') {
      localStorage.setItem(key, 'ok')
      await supabase.rpc('insert_notification', {
        p_user_id: userId,
        p_type:    'session_reset',
        p_title:   `${username}, your limit has been reset`,
        p_body:    'Your session limit just reset — jump back in and keep playing.',
        p_icon:    'wifi',
        p_meta:    {},
      })
    }
  } catch (err) {
    console.error('[liveNotifications] session reset check error:', err)
  }
}

// ── Movies (Watch) reopening ────────────────────────────────────
// Fires once when Movies transitions from closed to open (5:00 AM daily).
export async function checkMoviesOpenNotification(userId: string): Promise<void> {
  try {
    const isOpen = new Date().getHours() >= MOVIES_OPEN_HOUR
    const key = moviesStateKey(userId)
    const stored = localStorage.getItem(key) // 'open' | 'closed' | null

    // First check ever on this device — just record state, don't notify.
    if (stored === null) {
      localStorage.setItem(key, isOpen ? 'open' : 'closed')
      return
    }

    if (isOpen && stored === 'closed') {
      localStorage.setItem(key, 'open')
      await supabase.rpc('insert_notification', {
        p_user_id: userId,
        p_type:    'movies_open',
        p_title:   'Movies is now open',
        p_body:    "Movies is now open, let's watch series together.",
        p_icon:    'circle-play',
        p_meta:    {},
      })
    } else if (!isOpen && stored === 'open') {
      localStorage.setItem(key, 'closed')
    }
  } catch (err) {
    console.error('[liveNotifications] movies open check error:', err)
  }
}
