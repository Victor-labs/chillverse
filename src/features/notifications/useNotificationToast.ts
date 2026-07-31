// src/hooks/useNotificationToast.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'

export interface ToastNotif {
  id: string
  type: string
  title: string
  body: string
  icon: string
  color: string
  meta: Record<string, unknown> | null
}

const TYPE_COLOR: Record<string, string> = {
  achievement:      '#f5c542',
  follow:           '#3ecf8e',
  profile_view:     '#4f8ef7',
  profile_like:     '#ff4d8b',
  rank_up:          '#ff6b00',
  followed_rank_up: '#9b6dff',
  streak:           '#ff4d8b',
  message:          '#4f8ef7',
  level_up:         '#9b6dff',
  artifact:         '#9b6dff',
  session_reset:    '#4f8ef7',
  movies_open:      '#ff9a3c',
  come_back:        '#9b6dff',
  streak_warning:   '#ff4d8b',
  exploration_complete: '#3ecf8e',
  halo:             '#9b6dff',
  club_added:            '#3ecf8e',
  club_invite_pending:   '#f5c542',
  club_invite_accepted:  '#3ecf8e',
}

export function useNotificationToast() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [toasts, setToasts] = useState<ToastNotif[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`toast:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as { id: string; type: string; title: string; body: string; icon: string; meta?: Record<string, unknown> | null }
        // Achievement unlocks already get their own richer toast from
        // AchievementToast.tsx (subscribed to player_achievements inserts
        // directly, with batching for simultaneous unlocks). Showing this
        // generic toast too meant every single unlock produced two toasts
        // stacked on screen at once — skip it here.
        if (n.type === 'achievement') return
        const toast: ToastNotif = {
          id:    n.id,
          type:  n.type,
          title: n.title,
          body:  n.body,
          icon:  n.icon,
          color: TYPE_COLOR[n.type] ?? '#888899',
          meta:  n.meta ?? null,
        }
        setToasts(prev => [...prev, toast])
        // Auto-dismiss after 4s
        setTimeout(() => dismiss(toast.id), 4000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, dismiss])

  return { toasts, dismiss }
}
