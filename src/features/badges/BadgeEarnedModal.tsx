// src/features/badges/BadgeEarnedModal.tsx
//
// Listens to the player_badges realtime channel for the current user and
// pops a celebratory modal whenever a new row is inserted — i.e. whenever
// ANY badge is granted, old ("OG") badges (Tester, CV, Peak Performer,
// dynamic-username, etc.) and the new Leaderboard Legend / Runner-Up
// Elite / Relic Master badges alike.
//
// Layout: big box (hero image) on top, small box (the badge itself —
// icon, title, rarity, task) below, "You have received a badge." message,
// then a single Close button. A slow trail of sparkle dots drifts up and
// around behind the card for the whole time the modal is open.
//
// Mount once in AppLayout, next to AchievementToast.

import { useEffect, useState, useCallback } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { BadgeIcon } from './badgeIcons'
import { BADGE_RARITY_COLOR, type BadgeDef } from './badges'
import { updateMissionProgress } from '../missions/weeklyMissions'

const HERO_IMAGE_URL =
  'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/ff178ea65f5ba64cc52d5b6ae36081ad.jpg'

// Fixed set of sparkle dots — varied position/size/delay/drift so the
// trail doesn't look mechanical, but stable across renders (no Math.random
// re-roll on every re-render).
const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 47) % 100,
  size: 3 + ((i * 7) % 5),
  delay: (i * 0.35) % 5,
  duration: 4 + ((i * 3) % 4),
  drift: ((i % 2 === 0 ? 1 : -1) * (10 + (i * 5) % 30)),
}))

function SparkleField() {
  return (
    <div style={{ position: 'absolute', inset: -40, overflow: 'hidden', pointerEvents: 'none', borderRadius: 28 }}>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            bottom: -20,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,197,66,0.6) 55%, transparent 100%)',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
            animation: `badgeSparkleRise ${s.duration}s ease-in infinite`,
            animationDelay: `${s.delay}s`,
            ['--sparkle-drift' as unknown as string]: `${s.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function BadgeSmallBox({ badge }: { badge: BadgeDef }) {
  const color = BADGE_RARITY_COLOR[badge.rarity] ?? '#888899'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      background: `${color}14`, border: `1px solid ${color}33`,
      borderRadius: 16, boxShadow: `0 4px 20px ${color}22`,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
        background: `linear-gradient(135deg,${color}33,${color}11)`, border: `1.5px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${color}33`,
      }}>
        <BadgeIcon iconKey={badge.icon} size={24} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{badge.title}</p>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: `${color}22`, color, textTransform: 'uppercase' }}>
            {badge.rarity}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{badge.description}</p>
      </div>
    </div>
  )
}

export default function BadgeEarnedModal() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [queue, setQueue] = useState<BadgeDef[]>([])

  const dismiss = useCallback(() => {
    setQueue(q => q.slice(1))
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`badge_earned:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'player_badges',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const badgeId = (payload.new as { badge_id: string }).badge_id
          const { data: badge } = await supabase.from('badges').select('*').eq('id', badgeId).single()
          if (!badge) return
          setQueue(q => [...q, badge as BadgeDef])
          updateMissionProgress(userId, 'badges_earned', 1).catch(console.error)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const current = queue[0]
  if (!current) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="neu-card"
        style={{
          position: 'relative', width: '100%', maxWidth: 360, padding: 18,
          animation: 'badgeModalPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <SparkleField />

        {/* Big box — hero image */}
        <div style={{
          position: 'relative', width: '100%', height: 160, borderRadius: 18, overflow: 'hidden',
          marginBottom: 16, border: '1px solid var(--border)',
        }}>
          <img
            src={HERO_IMAGE_URL}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <p style={{
          fontSize: 15, fontWeight: 800, color: 'var(--text)', textAlign: 'center', marginBottom: 12,
        }}>
          You have received a badge.
        </p>

        {/* Small box — the badge itself */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <BadgeSmallBox badge={current} />
        </div>

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes badgeSparkleRise {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.4; }
          100% { transform: translate(var(--sparkle-drift), -220px) scale(1); opacity: 0; }
        }
        @keyframes badgeModalPop {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  )
}
