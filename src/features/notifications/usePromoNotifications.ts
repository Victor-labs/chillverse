// src/hooks/usePromoNotifications.ts
//
// Checks promo modal conditions in priority order, first match wins per visit.
// Cooldowns are tracked in localStorage per user, per notification id.
//
import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import type { PromoNotification } from './PromoOverlay'

const COOLDOWN_KEY_PREFIX = 'cv_promo_seen_'

function getLastSeen(userId: string, id: string): number {
  const raw = localStorage.getItem(`${COOLDOWN_KEY_PREFIX}${userId}_${id}`)
  return raw ? parseInt(raw, 10) : 0
}

function markSeen(userId: string, id: string) {
  localStorage.setItem(`${COOLDOWN_KEY_PREFIX}${userId}_${id}`, Date.now().toString())
}

function daysSince(timestamp: number): number {
  if (!timestamp) return Infinity
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
}

// ── Stub checks — replace once real fields/tables exist ──────────────────
async function hasPremium(_userId: string): Promise<boolean> {
  // TODO: wire to real premium/subscription field once it exists
  return false
}

async function hasMultiplayerUnlocked(_userId: string): Promise<boolean> {
  // TODO: wire to real unlock condition once it exists
  return true
}

async function hasPlayedToday(userId: string): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('played_at', startOfDay.toISOString())
  return (count ?? 0) > 0
}

export function usePromoNotifications(userId: string | null) {
  const [active, setActive] = useState<PromoNotification | null>(null)

  useEffect(() => {
    if (!userId) return
    const uid: string = userId
    let cancelled = false

    async function checkAll() {
      // 1. No game played today
      const playedToday = await hasPlayedToday(uid)
      if (!cancelled && !playedToday) {
        setActive({
          id: 'no_game_today',
          videoUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/ca09e963f7065cdecc73bdcdd8b70a80.mp4',
          title: 'Game pads are ready, get username.',
          bodyBefore: 'Getusername, you haven\u2019t played any ',
          bodyHighlight: 'game',
          bodyAfter: ' today, remember the grind is real.',
          badgeText: 'TAP',
        })
        return
      }

      // 2. No premium subscription — show once every 3 days
      const premium = await hasPremium(uid)
      if (!cancelled && !premium) {
        const last = getLastSeen(uid, 'no_premium')
        if (daysSince(last) >= 3) {
          setActive({
            id: 'no_premium',
            videoUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/d84c62862868176ebe5d1c4e2cd9a5b8_720w.mp4',
            title: 'Animations does exist in chillverse',
            bodyBefore: 'Want an avatar in this live style, they are in mall already, you just can\u2019t see them because of your ',
            bodyHighlight: 'version',
            bodyAfter: '.',
            badgeText: 'TAP',
          })
          return
        }
      }

      // 3. Multiplayer not unlocked — show once every 5 days
      const multiplayer = await hasMultiplayerUnlocked(uid)
      if (!cancelled && !multiplayer) {
        const last = getLastSeen(uid, 'no_multiplayer')
        if (daysSince(last) >= 5) {
          setActive({
            id: 'no_multiplayer',
            videoUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/f9bbe82f401bcffe62ff93e09da11b87_720w.mp4',
            title: 'Multiplayer is live',
            bodyBefore: 'What are you still waiting for',
            bodyHighlight: '',
            bodyAfter: '',
            badgeText: 'TAP',
          })
          return
        }
      }
    }

    checkAll()
    return () => { cancelled = true }
  }, [userId])

  function dismiss() {
    if (active && userId) markSeen(userId, active.id)
    setActive(null)
  }

  return { active, dismiss }
}
