// src/pages/Achievements.tsx
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Trophy, Lock, Star, Zap, Flame, Shield, Users, Gamepad2, Sparkles,
  Target, Layers, Moon, Calendar, Activity, Sword, Crown, TrendingUp,
  Flag, Plus, ArrowRight, Grid, Search, Brain, Award, Settings,
  CheckCircle, Rocket, Eye, Gem, MessageCircle, UserPlus, Heart,
  Mail, Sprout, User, Home, BarChart2, ChevronRight, Gift as GiftIcon,
  ShoppingBag, Tag, Clapperboard, Gift, Zap as FlashZap, ArrowLeft,
  Tv2, UserCheck, Repeat2, Package, Swords, Film, PartyPopper,
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
const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
const RARITY_LABEL: Record<string, string> = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' }

type Screen = 'hub' | 'rewards' | 'stats' | 'list'

export default function Achievements() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [allAchs, setAllAchs] = useState<Achievement[]>([])
  const [playerAchs, setPlayerAchs] = useState<PlayerAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>('hub')
  const [detailAch, setDetailAch] = useState<Achievement | null>(null)

  useEffect(() => {
    if (!userId) return
    Promise.all([getAllAchievements(), getPlayerAchievements(userId)]).then(([achs, player]) => {
      setAllAchs(achs)
      setPlayerAchs(player)
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
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  const unlockedSet = useMemo(() => new Set(playerAchs.map(p => p.achievement_id)), [playerAchs])
  const unlockedMap = useMemo(() => new Map(playerAchs.map(p => [p.achievement_id, p.unlocked_at])), [playerAchs])
  const unlockedCount = playerAchs.length
  const pct = allAchs.length ? Math.round((unlockedCount / allAchs.length) * 100) : 0

  // ── Best (highest rarity, most recent tie-break) unlocked achievement ──
  const bestAch = useMemo(() => {
    const unlocked = allAchs.filter(a => unlockedSet.has(a.id))
    if (!unlocked.length) return null
    return [...unlocked].sort((a, b) => {
      const r = (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9)
      if (r !== 0) return r
      const at = unlockedMap.get(a.id) ?? ''
      const bt = unlockedMap.get(b.id) ?? ''
      return bt.localeCompare(at)
    })[0]
  }, [allAchs, unlockedSet, unlockedMap])
  const bestAchDate = bestAch ? unlockedMap.get(bestAch.id) : null

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <PageOnboarding pageKey="achievements" />

      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#f5c542,var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Achievements</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unlockedCount} / {allAchs.length} unlocked</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Best achievement — big feature card */}
            <BestAchievementCard ach={bestAch} unlockedAt={bestAchDate} onTap={() => bestAch && setDetailAch(bestAch)} />

            {/* Rewards + Stats action cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <ActionCard
                icon={<GiftIcon size={18} />}
                iconColor="#a855f7"
                title="Rewards"
                subtitle="Claimable items"
                onTap={() => setScreen('rewards')}
              />
              <ActionCard
                icon={<BarChart2 size={18} />}
                iconColor="#4f8ef7"
                title="Stats"
                subtitle={`${pct}% complete`}
                onTap={() => setScreen('stats')}
              />
            </div>

            {/* See all achievements */}
            <button type="button" onClick={() => setScreen('list')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '15px 16px', background: 'var(--surface)', border: 'none', borderRadius: 16, boxShadow: 'var(--elev-raise-sm)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,197,66,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={18} style={{ color: '#f5c542' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>See All Achievements</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Browse every category</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          </>
        )}
      </div>

      {screen === 'rewards' && (
        <RewardsScreen allAchs={allAchs} unlockedSet={unlockedSet} unlockedMap={unlockedMap} onClose={() => setScreen('hub')} onSelect={setDetailAch} />
      )}
      {screen === 'stats' && (
        <StatsScreen allAchs={allAchs} playerAchs={playerAchs} unlockedSet={unlockedSet} onClose={() => setScreen('hub')} />
      )}
      {screen === 'list' && (
        <FullListScreen allAchs={allAchs} unlockedSet={unlockedSet} unlockedMap={unlockedMap} onClose={() => setScreen('hub')} onSelect={setDetailAch} />
      )}
      {detailAch && (
        <AchievementDetailModal
          ach={detailAch}
          unlockedAt={unlockedMap.get(detailAch.id) ?? null}
          isUnlocked={unlockedSet.has(detailAch.id)}
          onClose={() => setDetailAch(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  Best achievement — big feature card
// ══════════════════════════════════════════════════════════════
function BestAchievementCard({ ach, unlockedAt, onTap }: { ach: Achievement | null; unlockedAt: string | null | undefined; onTap: () => void }) {
  if (!ach) {
    return (
      <div style={{ padding: '28px 20px', borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--elev-raise-sm)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Trophy size={26} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dim)' }}>No achievements yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Play a game to unlock your first one</div>
      </div>
    )
  }

  const rarityColor = RARITY_COLOR[ach.rarity]
  const dateStr = unlockedAt ? new Date(unlockedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : null

  return (
    <button type="button" onClick={onTap}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        padding: '22px 20px', borderRadius: 22,
        background: `linear-gradient(155deg, ${rarityColor}26, var(--surface) 60%)`,
        border: `1px solid ${rarityColor}3d`,
        boxShadow: `0 10px 32px ${rarityColor}26, var(--elev-raise-sm)`,
      }}>
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%',
        background: `radial-gradient(circle, ${rarityColor}33, transparent 70%)`, pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Star size={12} style={{ color: rarityColor }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: rarityColor }}>Your Best Achievement</span>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, flexShrink: 0,
          background: `linear-gradient(135deg, ${rarityColor}44, ${rarityColor}14)`,
          border: `1.5px solid ${rarityColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 24px ${rarityColor}44`,
        }}>
          <AchIcon iconKey={ach.icon} size={34} color={rarityColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{ach.title}</span>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: `${rarityColor}22`, color: rarityColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ach.rarity}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {ach.description}
          </div>
          {dateStr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
              <Calendar size={11} /> Earned {dateStr}
            </div>
          )}
        </div>
        <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
//  Small action card (Rewards / Stats)
// ══════════════════════════════════════════════════════════════
function ActionCard({ icon, iconColor, title, subtitle, onTap }: { icon: React.ReactNode; iconColor: string; title: string; subtitle: string; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '16px 14px', background: 'var(--surface)', border: 'none', borderRadius: 18, boxShadow: 'var(--elev-raise-sm)', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${iconColor}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
          {icon}
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
//  Full-screen sub-page shell (slide-up portal, matches EditProfileModal pattern)
// ══════════════════════════════════════════════════════════════
function SubPageShell({ title, onClose, children, rightSlot }: { title: string; onClose: () => void; children: React.ReactNode; rightSlot?: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { cancelAnimationFrame(t); document.body.style.overflow = prevOverflow }
  }, [])

  function requestClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  return createPortal(
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', inset: 0, zIndex: 20001, background: 'var(--bg)',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.32s cubic-bezier(0.34,1.0,0.64,1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <button type="button" onClick={requestClose}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        <div style={{ width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rightSlot}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>,
    document.body
  )
}

// ══════════════════════════════════════════════════════════════
//  Achievement row (shared by list screen)
// ══════════════════════════════════════════════════════════════
function AchievementRow({ ach, isUnlocked, unlockedAt, onTap }: { ach: Achievement; isUnlocked: boolean; unlockedAt: string | null | undefined; onTap: () => void }) {
  const rarityColor = RARITY_COLOR[ach.rarity]
  const catMeta = CATEGORY_META[ach.category]

  return (
    <button type="button" onClick={onTap}
      style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: isUnlocked ? RARITY_GLOW[ach.rarity] : 'var(--surface)', borderRadius: 16, boxShadow: isUnlocked ? `0 4px 20px ${rarityColor}22, 2px 2px 8px var(--neu-dark)` : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', opacity: isUnlocked ? 1 : 0.6 }}>

      <div style={{ width: 52, height: 52, borderRadius: 16, background: isUnlocked ? `linear-gradient(135deg,${rarityColor}33,${rarityColor}11)` : 'var(--surface)', border: isUnlocked ? `1.5px solid ${rarityColor}44` : '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isUnlocked ? `0 0 16px ${rarityColor}33` : 'none', filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.4)' }}>
        {isUnlocked
          ? <AchIcon iconKey={ach.icon} size={22} color={rarityColor} />
          : <Lock size={18} style={{ color: 'var(--text-muted)' }} />}
      </div>

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

      {isUnlocked && (
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${rarityColor}22`, border: `1.5px solid ${rarityColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle size={13} style={{ color: rarityColor }} />
        </div>
      )}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
//  Full list screen — category picker + all achievements
// ══════════════════════════════════════════════════════════════
function FullListScreen({ allAchs, unlockedSet, unlockedMap, onClose, onSelect }: {
  allAchs: Achievement[]; unlockedSet: Set<string>; unlockedMap: Map<string, string>;
  onClose: () => void; onSelect: (a: Achievement) => void
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const categories = ['all', ...Object.keys(CATEGORY_META)]
  const filtered = activeCategory === 'all' ? allAchs : allAchs.filter(a => a.category === activeCategory)
  const sorted = [...filtered].sort((a, b) => {
    const aU = unlockedSet.has(a.id) ? 0 : 1
    const bU = unlockedSet.has(b.id) ? 0 : 1
    if (aU !== bU) return aU - bU
    return (RARITY_ORDER[a.rarity] ?? 3) - (RARITY_ORDER[b.rarity] ?? 3)
  })

  return (
    <SubPageShell title="All Achievements" onClose={onClose}>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat]
            const CatIcon = meta?.icon
            const isActive = activeCategory === cat
            const catColor = meta?.color ?? 'var(--accent)'
            return (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', flexShrink: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: isActive ? catColor : 'var(--surface)', color: isActive ? '#fff' : 'var(--text-dim)', boxShadow: isActive ? `0 4px 14px ${catColor}44` : '2px 2px 6px var(--neu-dark)' }}>
                {CatIcon && <CatIcon size={12} />}
                {meta?.label ?? 'All'}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(ach => (
          <AchievementRow key={ach.id} ach={ach} isUnlocked={unlockedSet.has(ach.id)} unlockedAt={unlockedMap.get(ach.id)} onTap={() => onSelect(ach)} />
        ))}
        {!sorted.length && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No achievements in this category</div>
        )}
      </div>
    </SubPageShell>
  )
}

// ══════════════════════════════════════════════════════════════
//  Rewards screen — achievements that grant items (profile pic / banner)
// ══════════════════════════════════════════════════════════════
function RewardsScreen({ allAchs, unlockedSet, unlockedMap, onClose, onSelect }: {
  allAchs: Achievement[]; unlockedSet: Set<string>; unlockedMap: Map<string, string>;
  onClose: () => void; onSelect: (a: Achievement) => void
}) {
  const rewardAchs = useMemo(
    () => allAchs.filter(a => a.reward_type === 'profile_pic' || a.reward_type === 'banner'),
    [allAchs]
  )
  const sorted = [...rewardAchs].sort((a, b) => {
    const aU = unlockedSet.has(a.id) ? 0 : 1
    const bU = unlockedSet.has(b.id) ? 0 : 1
    if (aU !== bU) return aU - bU
    return (RARITY_ORDER[a.rarity] ?? 3) - (RARITY_ORDER[b.rarity] ?? 3)
  })
  const claimedCount = rewardAchs.filter(a => unlockedSet.has(a.id)).length

  return (
    <SubPageShell title="Achievement Rewards" onClose={onClose}>
      <div style={{ padding: '18px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(168,85,247,0.04))', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GiftIcon size={18} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{claimedCount} / {rewardAchs.length} claimed</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Profile pics & banners earned from achievements</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(ach => {
          const isUnlocked = unlockedSet.has(ach.id)
          const unlockedAt = unlockedMap.get(ach.id)
          const rarityColor = RARITY_COLOR[ach.rarity]
          return (
            <button key={ach.id} type="button" onClick={() => onSelect(ach)}
              style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: isUnlocked ? RARITY_GLOW[ach.rarity] : 'var(--surface)', borderRadius: 16, boxShadow: isUnlocked ? `0 4px 20px ${rarityColor}22` : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)', opacity: isUnlocked ? 1 : 0.6 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: isUnlocked ? `linear-gradient(135deg,${rarityColor}33,${rarityColor}11)` : 'var(--surface)', border: isUnlocked ? `1.5px solid ${rarityColor}44` : '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.4)' }}>
                {isUnlocked ? <AchIcon iconKey={ach.icon} size={20} color={rarityColor} /> : <Lock size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: isUnlocked ? 'var(--text)' : 'var(--text-dim)' }}>{ach.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: ach.reward_type === 'profile_pic' ? 'rgba(168,85,247,0.18)' : 'rgba(6,182,212,0.18)', color: ach.reward_type === 'profile_pic' ? '#a855f7' : '#06b6d4', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {ach.reward_type === 'profile_pic' ? <Image size={8} /> : <Sparkle size={8} />}
                    {ach.reward_type === 'profile_pic' ? 'PROFILE PIC' : 'BANNER'}
                  </span>
                  {isUnlocked && unlockedAt && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Claimed {new Date(unlockedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
              {isUnlocked ? (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${rarityColor}22`, border: `1.5px solid ${rarityColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={13} style={{ color: rarityColor }} />
                </div>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>Locked</span>
              )}
            </button>
          )
        })}
        {!sorted.length && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No item rewards available yet</div>
        )}
      </div>
    </SubPageShell>
  )
}

// ══════════════════════════════════════════════════════════════
//  Stats screen — activity chart + category breakdown + peak moment
// ══════════════════════════════════════════════════════════════
function StatsScreen({ allAchs, playerAchs, unlockedSet, onClose }: {
  allAchs: Achievement[]; playerAchs: PlayerAchievement[]; unlockedSet: Set<string>; onClose: () => void
}) {
  // Group unlocks by calendar date
  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of playerAchs) {
      const day = p.unlocked_at.slice(0, 10)
      map.set(day, (map.get(day) ?? 0) + 1)
    }
    return map
  }, [playerAchs])

  const peak = useMemo(() => {
    let bestDay: string | null = null
    let bestCount = 0
    for (const [day, count] of byDate) {
      if (count > bestCount) { bestCount = count; bestDay = day }
    }
    return bestDay ? { day: bestDay, count: bestCount } : null
  }, [byDate])

  // Last 10 active days, chronological
  const chartDays = useMemo(() => {
    const entries = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return entries.slice(-10)
  }, [byDate])
  const maxDayCount = Math.max(1, ...chartDays.map(([, c]) => c))

  const categoryBreakdown = useMemo(() => {
    return Object.entries(CATEGORY_META).map(([key, meta]) => {
      const inCat = allAchs.filter(a => a.category === key)
      const unlocked = inCat.filter(a => unlockedSet.has(a.id)).length
      return { key, meta, unlocked, total: inCat.length }
    }).filter(c => c.total > 0)
  }, [allAchs, unlockedSet])

  return (
    <SubPageShell title="Achievement Stats" onClose={onClose}>
      <div style={{ padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Activity chart */}
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '18px 16px', boxShadow: 'var(--elev-raise-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Activity size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Unlock Activity</span>
          </div>

          {chartDays.length ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {chartDays.map(([day, count]) => {
                const isPeak = peak && day === peak.day
                const h = Math.max(10, (count / maxDayCount) * 100)
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: isPeak ? '#f5c542' : 'var(--text-dim)' }}>{count}</span>
                    <div style={{
                      width: '100%', maxWidth: 22, height: `${h}%`, borderRadius: 6,
                      background: isPeak ? 'linear-gradient(180deg,#f5c542,var(--accent))' : 'linear-gradient(180deg, var(--accent) 0%, var(--surface3) 140%)',
                      boxShadow: isPeak ? '0 0 14px rgba(245,197,66,0.5)' : 'none',
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {new Date(day).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
              No activity yet — unlock an achievement to see your chart
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '18px 16px', boxShadow: 'var(--elev-raise-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <BarChart2 size={14} style={{ color: '#4f8ef7' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>By Category</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryBreakdown.map(({ key, meta, unlocked, total }) => {
              const pct = total ? Math.round((unlocked / total) * 100) : 0
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                      <meta.icon size={11} style={{ color: meta.color }} /> {meta.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{unlocked}/{total}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: meta.color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Peak moment */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '18px 16px',
          background: 'linear-gradient(135deg, rgba(245,197,66,0.16), rgba(108,80,255,0.06))',
          border: '1px solid rgba(245,197,66,0.25)',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,197,66,0.25), transparent 70%)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(245,197,66,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PartyPopper size={20} style={{ color: '#f5c542' }} />
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#f5c542', marginBottom: 3 }}>Your Peak Moment</div>
              {peak ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    {new Date(peak.day).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {peak.count} achievement{peak.count > 1 ? 's' : ''} unlocked in one day
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Unlock an achievement to set your peak day</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SubPageShell>
  )
}

// ══════════════════════════════════════════════════════════════
//  Achievement detail popup modal
// ══════════════════════════════════════════════════════════════
function AchievementDetailModal({ ach, unlockedAt, isUnlocked, onClose }: {
  ach: Achievement; unlockedAt: string | null; isUnlocked: boolean; onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  function requestClose() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const rarityColor = RARITY_COLOR[ach.rarity]
  const catMeta = CATEGORY_META[ach.category]
  const dateStr = unlockedAt ? new Date(unlockedAt).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return createPortal(
    <div onClick={requestClose} style={{
      position: 'fixed', inset: 0, zIndex: 20010, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 340, background: 'var(--surface2)', borderRadius: 24,
        border: `1px solid ${rarityColor}3d`, boxShadow: `0 20px 60px ${rarityColor}26, var(--elev-popover)`,
        padding: '26px 22px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
        transition: 'transform 0.24s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${rarityColor}33, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', width: 84, height: 84, borderRadius: 24, margin: '0 auto 16px', background: isUnlocked ? `linear-gradient(135deg, ${rarityColor}44, ${rarityColor}14)` : 'var(--surface3)', border: isUnlocked ? `1.5px solid ${rarityColor}55` : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isUnlocked ? `0 0 30px ${rarityColor}44` : 'none', filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.5)' }}>
          {isUnlocked ? <AchIcon iconKey={ach.icon} size={38} color={rarityColor} /> : <Lock size={28} style={{ color: 'var(--text-muted)' }} />}
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{ach.title}</span>
          </div>
          <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 7, background: `${rarityColor}22`, color: rarityColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            {RARITY_LABEL[ach.rarity]}
          </span>

          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>{ach.description}</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: dateStr ? 14 : 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#f5c542', padding: '5px 10px', borderRadius: 10, background: 'rgba(245,197,66,0.12)' }}>
              <Zap size={11} /> +{ach.xp_reward} XP
            </span>
            {catMeta && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: catMeta.color, padding: '5px 10px', borderRadius: 10, background: `${catMeta.color}1f` }}>
                <catMeta.icon size={11} /> {catMeta.label}
              </span>
            )}
            {ach.reward_type === 'profile_pic' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#a855f7', padding: '5px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.12)' }}>
                <Image size={11} /> Profile Pic
              </span>
            )}
            {ach.reward_type === 'banner' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#06b6d4', padding: '5px 10px', borderRadius: 10, background: 'rgba(6,182,212,0.12)' }}>
                <Sparkle size={11} /> Banner
              </span>
            )}
          </div>

          {isUnlocked && dateStr ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              <CheckCircle size={12} style={{ color: rarityColor }} /> Earned {dateStr}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              <Lock size={12} /> Not yet unlocked
            </div>
          )}
        </div>

        <button type="button" onClick={requestClose}
          style={{ position: 'relative', width: '100%', padding: 13, borderRadius: 13, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  )
}
