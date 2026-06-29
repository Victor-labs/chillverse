// src/components/AchievementToast.tsx
//
// Listens to the player_achievements realtime channel for the current user
// and shows an animated "Achievement Unlocked!" banner whenever a new row
// is inserted (i.e. whenever triggerAchievementCheck fires a new unlock).
//
// Swipe right to dismiss. Mount once in AppLayout.

import { useEffect, useState, useCallback, useRef } from 'react'
import { Trophy, Zap, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface ToastItem {
  id: string
  title: string
  description: string
  icon: string
  xp_reward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

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
function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const color = RARITY_COLOR[toast.rarity] ?? '#888899'
  const glow  = RARITY_GLOW[toast.rarity]  ?? 'transparent'

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
          Achievement Unlocked · {toast.rarity}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {toast.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f5c542', fontWeight: 700 }}>
          <Zap size={10} /> +{toast.xp_reward} XP
        </div>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => triggerDismiss()}
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
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

// ── Container ────────────────────────────────────────────────────
export default function AchievementToast() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [queue, setQueue] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setQueue(q => q.filter(t => t.id !== id))
  }, [])

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

          setQueue(q => [...q, item])
          // Auto-dismiss after 5s
          setTimeout(() => dismiss(item.id), 5000)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, dismiss])

  if (queue.length === 0) return null

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
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
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
