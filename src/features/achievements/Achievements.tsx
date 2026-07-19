// src/pages/Achievements.tsx
import { useState, useEffect } from 'react'
import {
  Trophy, Lock, Star, Zap, Flame, Shield, Users, Gamepad2, Sparkles,
  Target, Layers, Moon, Calendar, Activity, Sword, Crown, TrendingUp,
  Flag, Plus, ArrowRight, Grid, Search, Brain, Award, Settings,
  CheckCircle, Rocket, Eye, Gem, MessageCircle, UserPlus, Heart,
  Mail, Sprout, User, Home, BarChart2,
  ShoppingBag, Tag, Clapperboard, Gift, Zap as FlashZap,
  Tv2, UserCheck, Repeat2, Package, Swords, Film,
  ShoppingCart, Wifi, Sparkle, Image, Spade,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getAllAchievements, getPlayerAchievements } from './achievements'
import type { Achievement, PlayerAchievement } from './achievements'
import type React from 'react'
import PageOnboarding from '../onboarding/PageOnboarding'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

// Map icon key strings (stored in DB) → Lucide components
export const ICON_MAP: Record<string, LucideIcon> = {
  'zap': Zap, 'flame': Flame, 'star': Star, 'settings': Settings,
  'award': Award, 'diamond': Gem, 'crown': Crown, 'trending-up': TrendingUp,
  'target': Target, 'layers': Layers, 'moon': Moon, 'trophy': Trophy,
  'calendar': Calendar, 'activity': Activity, 'sword': Sword,
  'brain': Brain, 'flag': Flag, 'plus': Plus, 'arrow-right': ArrowRight,
  'grid': Grid, 'search': Search, 'shield': Shield, 'gamepad-2': Gamepad2,
  'check-circle': CheckCircle, 'rocket': Rocket, 'eye': Eye, 'gem': Gem,
  'home': Home, 'message-circle': MessageCircle, 'user-plus': UserPlus,
  'users': Users, 'heart': Heart, 'mail': Mail, 'sprout': Sprout,
  'user': User, 'bar-chart': BarChart2,
  // ── New achievement icons ──
  'shopping-bag': ShoppingBag, 'tag': Tag, 'clapperboard': Clapperboard,
  'gift': Gift, 'tv-2': Tv2, 'user-check': UserCheck, 'repeat-2': Repeat2,
  'package': Package, 'swords': Swords, 'film': Film, 'hand-coins': Gift,
  'shopping-cart': ShoppingCart, 'wifi': Wifi, 'sparkle': Sparkle,
  'image': Image, 'flash-zap': FlashZap, 'spade': Spade,
}

export function AchIcon({ iconKey, size = 22, color }: { iconKey: string; size?: number; color?: string }) {
  const Icon = ICON_MAP[iconKey] ?? Sparkles
  return <Icon size={size} style={color ? { color } : undefined} />
}

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  xp:      { label: 'XP & Levels', icon: Zap,         color: '#f5c542' },
  streak:  { label: 'Streaks',     icon: Flame,        color: 'var(--accent)' },
  games:   { label: 'Games',       icon: Gamepad2,     color: '#4f8ef7' },
  rank:    { label: 'Ranks',       icon: Shield,       color: '#9b6dff' },
  social:  { label: 'Social',      icon: Users,        color: '#3ecf8e' },
  special: { label: 'Special',     icon: Sparkles,     color: '#ff4d8b' },
  mall:    { label: 'Mall',        icon: ShoppingBag,  color: '#f97316' },
  premium: { label: 'Premium',     icon: Gem,          color: '#06b6d4' },
  cinema:  { label: 'Cinema',      icon: Film,         color: '#a855f7' },
}

export const RARITY_COLOR: Record<string, string> = {
  common: '#888899', rare: '#4f8ef7', epic: '#9b6dff', legendary: '#f5c542',
}
export const RARITY_GLOW: Record<string, string> = {
  common: 'transparent', rare: 'rgba(79,142,247,0.18)',
  epic: 'rgba(155,109,255,0.18)', legendary: 'rgba(245,197,66,0.22)',
}

export default function Achievements() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [allAchs, setAllAchs] = useState<Achievement[]>([])
  const [playerAchs, setPlayerAchs] = useState<PlayerAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [totalXpEarned, setTotalXpEarned] = useState(0)

  useEffect(() => {
    if (!userId) return
    Promise.all([getAllAchievements(), getPlayerAchievements(userId)]).then(([achs, player]) => {
      setAllAchs(achs)
      setPlayerAchs(player)
      setUnlockedCount(player.length)
      const unlockedIds = new Set(player.map(p => p.achievement_id))
      const earned = achs.filter(a => unlockedIds.has(a.id)).reduce((s, a) => s + a.xp_reward, 0)
      setTotalXpEarned(earned)
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`achievements:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'player_achievements',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const newAch = payload.new as PlayerAchievement
        setPlayerAchs(prev => [...prev, newAch])
        setUnlockedCount(c => c + 1)
        const ach = allAchs.find(a => a.id === newAch.achievement_id)
        if (ach) setTotalXpEarned(x => x + ach.xp_reward)
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId, allAchs])

  const unlockedSet = new Set(playerAchs.map(p => p.achievement_id))
  const unlockedMap = new Map(playerAchs.map(p => [p.achievement_id, p.unlocked_at]))
  const categories = ['all', ...Object.keys(CATEGORY_META)]
  const filtered = activeCategory === 'all' ? allAchs : allAchs.filter(a => a.category === activeCategory)
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 }
  const sorted = [...filtered].sort((a, b) => {
    const aU = unlockedSet.has(a.id) ? 0 : 1
    const bU = unlockedSet.has(b.id) ? 0 : 1
    if (aU !== bU) return aU - bU
    return (rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 3) - (rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 3)
  })
  const pct = allAchs.length ? Math.round((unlockedCount / allAchs.length) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <PageOnboarding pageKey="achievements" />

      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#f5c542,var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Achievements</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unlockedCount} / {allAchs.length} unlocked</div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Unlocked', value: unlockedCount, color: '#3ecf8e', icon: <CheckCircle size={14} /> },
            { label: 'Completion', value: `${pct}%`, color: '#4f8ef7', icon: <BarChart2 size={14} /> },
            { label: 'XP Earned', value: totalXpEarned >= 1000 ? `${(totalXpEarned/1000).toFixed(1)}k` : totalXpEarned, color: '#f5c542', icon: <Zap size={14} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', boxShadow: 'var(--elev-raise-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: s.color }}>{s.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="xp-track" style={{ marginBottom: 18 }}>
          <div className="xp-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#f5c542,var(--accent))', transition: 'width 1s ease', boxShadow: '0 0 10px rgba(245,197,66,0.4)' }} />
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat]
            const CatIcon = meta?.icon
            const isActive = activeCategory === cat
            const catColor = meta?.color ?? 'var(--accent)'
            return (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', flexShrink: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: isActive ? catColor : 'var(--surface)', color: isActive ? '#fff' : 'var(--text-dim)', boxShadow: isActive ? `0 4px 14px ${catColor}44` : '2px 2px 6px var(--neu-dark)', transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)' }}>
                {CatIcon && <CatIcon size={12} />}
                {meta?.label ?? 'All'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Achievement list */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sorted.map(ach => {
          const isUnlocked = unlockedSet.has(ach.id)
          const unlockedAt = unlockedMap.get(ach.id)
          const rarityColor = RARITY_COLOR[ach.rarity]
          const catMeta = CATEGORY_META[ach.category]

          return (
            <div key={ach.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: isUnlocked ? RARITY_GLOW[ach.rarity] : 'var(--surface)', border: isUnlocked ? `1px solid ${rarityColor}33` : '1px solid rgba(255,255,255,0.04)', borderRadius: 16, boxShadow: isUnlocked ? `0 4px 20px ${rarityColor}22, 2px 2px 8px var(--neu-dark)` : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)', opacity: isUnlocked ? 1 : 0.6 }}>

              {/* Icon bubble */}
              <div style={{ width: 52, height: 52, borderRadius: 16, background: isUnlocked ? `linear-gradient(135deg,${rarityColor}33,${rarityColor}11)` : 'var(--surface)', border: isUnlocked ? `1.5px solid ${rarityColor}44` : '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isUnlocked ? `0 0 16px ${rarityColor}33` : 'none', filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.4)' }}>
                {isUnlocked
                  ? <AchIcon iconKey={ach.icon} size={22} color={rarityColor} />
                  : <Lock size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isUnlocked ? 'var(--text)' : 'var(--text-dim)' }}>{ach.title}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: `${rarityColor}22`, color: rarityColor, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{ach.rarity}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 4 }}>{ach.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#f5c542', fontWeight: 700 }}>
                    <Zap size={10} /> +{ach.xp_reward} XP
                  </span>
                  {catMeta && (
                    <span style={{ fontSize: 10, color: catMeta.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <catMeta.icon size={9} /> {catMeta.label}
                    </span>
                  )}
                  {ach.reward_type === 'profile_pic' && (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(168,85,247,0.18)', color: '#a855f7', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Image size={8} /> PROF PIC
                    </span>
                  )}
                  {ach.reward_type === 'banner' && (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(6,182,212,0.18)', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Sparkle size={8} /> BANNER
                    </span>
                  )}
                  {isUnlocked && unlockedAt && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(unlockedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Unlocked check */}
              {isUnlocked && (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${rarityColor}22`, border: `1.5px solid ${rarityColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={13} style={{ color: rarityColor }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
