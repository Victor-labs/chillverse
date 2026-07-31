// src/components/AchievementToast.tsx
//
// Listens to the player_achievements realtime channel for the current user
// and shows an animated "Achievement Unlocked!" banner whenever a new row
// is inserted (i.e. whenever triggerAchievementCheck fires a new unlock).
//
// Swipe right to dismiss. Mount once in AppLayout.

import { useEffect, useState, useCallback, useRef } from 'react'
import { Trophy, Zap, X, Camera, Check } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { createHighlight } from '../highlights/highlights'

interface ToastItem {
  id: string
  title: string
  description: string
  icon: string
  xp_reward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  /** Set when several achievements unlocked together and were collapsed
   *  into a single combined toast (see flushBuffer in the container below).
   *  Undefined/1 renders the normal single-achievement card. */
  count?: number
}

const RARITY_RANK: Record<ToastItem['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

const RARITY_COLOR: Record<string, string> = {
  common:    '#888899',
  rare:      '#4f8ef7',
  epic:      '#9b6dff',
  legendary: '#f5c542',
}

const RARITY_GLOW: Record<string, string> = {
  common:    'rgba(136,136,153,0.15)',
  rare:      'rgba(79,142,247,0.18)',
  epic:      'rgba(155,109,255,0.18)',
  legendary: 'rgba(245,197,66,0.22)',
}

// ── Single swipeable toast card ──────────────────────────────────
function ToastCard({ toast, userId, onDismiss }: { toast: ToastItem; userId: string; onDismiss: (id: string) => void }) {
  const color = RARITY_COLOR[toast.rarity] ?? '#888899'
  const glow  = RARITY_GLOW[toast.rarity]  ?? 'transparent'
  const [shared, setShared] = useState(false)
  const [sharing, setSharing] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    if (shared || sharing) return
    setSharing(true)
    const body = toast.count && toast.count > 1
      ? `Unlocked ${toast.count} achievements 🏆`
      : `Unlocked "${toast.title}" 🏆`
    const { error } = await createHighlight({
      authorId: userId,
      kind: 'achievement',
      gameKey: null,
      body,
    })
    setSharing(false)
    if (!error) setShared(true)
  }

  // Swipe state
  const startXRef   = useRef<number | null>(null)
  const currentXRef = useRef<number>(0)
  const cardRef     = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)

  const triggerDismiss = useCallback(() => {
    if (leaving) return
    setLeaving(true)
    // Slide out to the right, then remove from queue
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.28s ease'
      cardRef.current.style.transform  = 'translateX(110%)'
      cardRef.current.style.opacity    = '0'
    }
    setTimeout(() => onDismiss(toast.id), 300)
  }, [leaving, onDismiss, toast.id])

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current  = e.touches[0].clientX
    currentXRef.current = 0
    if (cardRef.current) {
      cardRef.current.style.transition = 'none'
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current
    // Only allow rightward swipe
    if (dx < 0) return
    currentXRef.current = dx
    if (cardRef.current) {
      const opacity = Math.max(0, 1 - dx / 200)
      cardRef.current.style.transform = `translateX(${dx}px)`
      cardRef.current.style.opacity   = String(opacity)
    }
  }

  const onTouchEnd = () => {
    if (startXRef.current === null) return
    startXRef.current = null
    // If dragged more than 80px → dismiss
    if (currentXRef.current > 80) {
      triggerDismiss()
    } else {
      // Snap back
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
        cardRef.current.style.transform  = 'translateX(0)'
        cardRef.current.style.opacity    = '1'
      }
    }
  }

  // Mouse drag (desktop fallback)
  const onMouseDown = (e: React.MouseEvent) => {
    startXRef.current  = e.clientX
    currentXRef.current = 0
    if (cardRef.current) cardRef.current.style.transition = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (startXRef.current === null) return
      const dx = ev.clientX - startXRef.current
      if (dx < 0) return
      currentXRef.current = dx
      if (cardRef.current) {
        cardRef.current.style.transform = `translateX(${dx}px)`
        cardRef.current.style.opacity   = String(Math.max(0, 1 - dx / 200))
      }
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (startXRef.current === null) return
      startXRef.current = null
      if (currentXRef.current > 80) {
        triggerDismiss()
      } else {
        if (cardRef.current) {
          cardRef.current.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
          cardRef.current.style.transform  = 'translateX(0)'
          cardRef.current.style.opacity    = '1'
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      ref={cardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 18,
        background: 'linear-gradient(135deg, #1a1a1e, #111113)',
        border: `1.5px solid ${color}44`,
        boxShadow: `0 8px 32px ${color}33, 0 2px 12px rgba(0,0,0,0.6)`,
        backdropFilter: 'blur(16px)',
        pointerEvents: 'all',
        animation: 'achSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        cursor: 'grab',
        userSelect: 'none',
        willChange: 'transform, opacity',
        touchAction: 'pan-y',
      }}
    >
      {/* Icon bubble */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: glow,
          border: `1.5px solid ${color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 16px ${color}33`,
        }}
      >
        <Trophy size={20} style={{ color }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 2,
          }}
        >
          {toast.count && toast.count > 1 ? `${toast.count} Achievements Unlocked` : `Achievement Unlocked · ${toast.rarity}`}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 2,
            whiteSpace: toast.count && toast.count > 1 ? 'normal' : 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: toast.count && toast.count > 1 ? '-webkit-box' : 'block',
            WebkitLineClamp: toast.count && toast.count > 1 ? 2 : undefined,
            WebkitBoxOrient: toast.count && toast.count > 1 ? 'vertical' : undefined,
          }}
        >
          {toast.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f5c542', fontWeight: 700 }}>
          <Zap size={10} /> +{toast.xp_reward} XP{toast.count && toast.count > 1 ? ' total' : ''}
        </div>
      </div>

      {/* Share button — posts a Highlight (text + trophy icon, no screenshot) */}
      <button
        type="button"
        onClick={handleShare}
        disabled={shared}
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: shared ? 'rgba(62,207,142,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${shared ? 'rgba(62,207,142,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: shared ? 'var(--green, #3ecf8e)' : 'var(--text-muted)',
          cursor: shared ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {shared ? <Check size={12} /> : <Camera size={12} />}
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => triggerDismiss()}
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

// How long to wait after the first unlock in a burst before flushing the
// buffer, to see whether any more unlocks land in the same batch (e.g. a
// new player clearing several easy conditions in one triggerAchievementCheck
// run). Achievements unlocked within this window of each other are shown as
// a single combined toast instead of one card per achievement.
const BATCH_WINDOW_MS = 900

// ── Container ────────────────────────────────────────────────────
export default function AchievementToast() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [queue, setQueue] = useState<ToastItem[]>([])
  const bufferRef = useRef<ToastItem[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback((id: string) => {
    setQueue(q => q.filter(t => t.id !== id))
  }, [])

  const flushBuffer = useCallback(() => {
    const items = bufferRef.current
    bufferRef.current = []
    flushTimerRef.current = null
    if (items.length === 0) return

    if (items.length === 1) {
      const only = items[0]
      setQueue(q => [...q, only])
      setTimeout(() => dismiss(only.id), 5000)
      return
    }

    // Multiple achievements landed in the same batch — collapse into one
    // combined toast rather than stacking a card per achievement.
    const totalXp = items.reduce((sum, i) => sum + i.xp_reward, 0)
    const topRarity = items.reduce<ToastItem['rarity']>(
      (top, i) => (RARITY_RANK[i.rarity] > RARITY_RANK[top] ? i.rarity : top),
      'common',
    )
    const grouped: ToastItem = {
      id:          `group-${Date.now()}`,
      title:       items.map(i => i.title).join(', '),
      description: items.map(i => i.description).join(' '),
      icon:        'trophy',
      xp_reward:   totalXp,
      rarity:      topRarity,
      count:       items.length,
    }
    setQueue(q => [...q, grouped])
    setTimeout(() => dismiss(grouped.id), 6500)
  }, [dismiss])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`ach_toast:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const achievementId = (payload.new as { achievement_id: string }).achievement_id
          const { data: ach } = await supabase
            .from('achievements')
            .select('id, title, description, icon, xp_reward, rarity')
            .eq('id', achievementId)
            .single()

          if (!ach) return

          const item: ToastItem = {
            id:          ach.id,
            title:       ach.title,
            description: ach.description,
            icon:        ach.icon,
            xp_reward:   ach.xp_reward,
            rarity:      ach.rarity,
          }

          // Buffer instead of showing immediately — if another unlock
          // arrives within BATCH_WINDOW_MS it'll be folded into the same
          // combined toast rather than showing as a separate card.
          bufferRef.current.push(item)
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
          flushTimerRef.current = setTimeout(flushBuffer, BATCH_WINDOW_MS)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      bufferRef.current = []
    }
  }, [userId, flushBuffer])

  if (queue.length === 0 || !userId) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 'calc(100% - 32px)',
        maxWidth: 380,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {queue.map(toast => (
        <ToastCard key={toast.id} toast={toast} userId={userId} onDismiss={dismiss} />
      ))}

      <style>{`
        @keyframes achSlideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
