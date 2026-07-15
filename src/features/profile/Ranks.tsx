// src/pages/Ranks.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Star, ChevronRight, Crown, Shield, Lock, Target } from 'lucide-react'
import { useProfile } from './useProfile'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import {
  RANK_TIERS, getUserRankTier, getNextRankTier,
  getRankProgress, fmtXP,
  type RankTier,
} from './ranks'
import PageOnboarding from '../onboarding/PageOnboarding'
import Avatar from '../../shared/components/Avatar'

// ─── Tab type ────────────────────────────────────────
type Tab = 'my-rank' | 'all-ranks'

// ─── Reward icon map ─────────────────────────────────
function RewardIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    badge: '🏅',
    profile_pic: '🖼️',
    album_pic: '📸',
    chat_name_glow: '✨',
    profile_border_glow: '💫',
    mall_pick: '🛍️',
    nothing: '—',
  }
  return <span style={{ fontSize: 18 }}>{icons[type] ?? '🎁'}</span>
}

// ─── Single rank card (for All Ranks tab) ────────────
function RankCard({
  tier, isUnlocked, isCurrent, userXp,
}: {
  tier: RankTier
  isUnlocked: boolean
  isCurrent: boolean
  userXp: number
}) {
  const [open, setOpen] = useState(false)
  const hasRealReward = tier.rewards.some(r => r.type !== 'nothing')

  return (
    <div
      onClick={(e) => { ripple(e); setOpen(o => !o) }}
      className="ripple-wrap"
      style={{
        background: isCurrent
          ? `linear-gradient(135deg, ${tier.color}18, ${tier.color}08)`
          : 'var(--surface)',
        border: isCurrent
          ? `1.5px solid ${tier.color}55`
          : isUnlocked
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(255,255,255,0.03)',
        borderRadius: 18,
        padding: '16px 18px',
        marginBottom: 10,
        cursor: 'pointer',
        opacity: isUnlocked ? 1 : 0.5,
        boxShadow: isCurrent
          ? `0 0 20px ${tier.glowColor}, 4px 4px 12px var(--neu-dark)`
          : '3px 3px 9px var(--neu-dark), -2px -2px 7px var(--neu-light)',
        transition: 'all 0.2s',
      }}
    >
      {/* Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Emoji badge */}
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: `${tier.color}18`,
          border: `1.5px solid ${tier.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          boxShadow: isUnlocked ? `0 0 12px ${tier.glowColor}` : 'none',
        }}>
          {isUnlocked ? tier.emoji : <Lock size={16} color="var(--text-muted)" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: isUnlocked ? tier.color : 'var(--text-muted)' }}>
              {tier.name}
            </span>
            {isCurrent && (
              <span style={{ fontSize: 9, fontWeight: 800, background: tier.color, color: '#111', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.5px' }}>
                YOU
              </span>
            )}
            {hasRealReward && (
              <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(245,197,66,0.15)', color: '#f5c542', borderRadius: 6, padding: '2px 7px', border: '1px solid rgba(245,197,66,0.3)' }}>
                REWARD
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {fmtXP(tier.xpRequired)} XP required
            {isCurrent && (() => {
              const next = getNextRankTier(tier)
              if (!next) return <span style={{ color: tier.color, fontWeight: 700 }}> · MAX RANK</span>
              const { xpIntoTier, xpNeeded } = getRankProgress(userXp)
              return <span style={{ color: 'var(--text-dim)' }}> · {fmtXP(xpNeeded - xpIntoTier)} XP to next</span>
            })()}
          </div>
        </div>

        <ChevronRight
          size={15}
          color="var(--text-muted)"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </div>

      {/* Expanded rewards */}
      {open && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tier.rewards.map((reward, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {reward.imageUrl && (
                <img
                  src={reward.imageUrl}
                  alt={reward.label}
                  style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: `1.5px solid ${tier.color}40`, flexShrink: 0, boxShadow: `0 0 10px ${tier.glowColor}` }}
                />
              )}
              {!reward.imageUrl && (
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${tier.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RewardIcon type={reward.type} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: reward.type === 'nothing' ? 'var(--text-muted)' : 'var(--text)', marginBottom: 3 }}>{reward.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{reward.description}</div>
                {reward.glowColor && (
                  <div style={{ marginTop: 6, display: 'inline-block', fontSize: 12, fontWeight: 800, color: reward.glowColor, textShadow: `0 0 8px ${reward.glowColor}, 0 0 20px ${reward.glowColor}` }}>
                    YourName
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Leaderboard row ─────────────────────────────────
interface LeaderboardEntry {
  id: string
  display_name: string | null
  username: string
  xp: number
  level: number
  streak: number
  avatar: string | null
}

function LeaderboardRow({ entry, position, isMe, innerRef }: { entry: LeaderboardEntry; position: number; isMe: boolean; innerRef?: React.Ref<HTMLDivElement> }) {
  const tier = getUserRankTier(entry.xp)
  const posColor = position === 1 ? '#f5c542' : position === 2 ? '#b0b8c8' : position === 3 ? '#cd7f32' : 'var(--text-muted)'
  const name = entry.display_name || entry.username

  return (
    <div ref={innerRef} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      background: isMe ? `${tier.color}10` : 'var(--surface)',
      border: isMe ? `1px solid ${tier.color}40` : '1px solid rgba(255,255,255,0.05)',
      borderRadius: 16,
      marginBottom: 8,
      boxShadow: isMe ? `0 0 14px ${tier.glowColor}` : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
    }}>
      {/* Position */}
      <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
        {position <= 3
          ? <span style={{ fontSize: 18 }}>{['🥇','🥈','🥉'][position - 1]}</span>
          : <span style={{ fontSize: 13, fontWeight: 700, color: posColor }}>#{position}</span>
        }
      </div>

      {/* Avatar */}
      <div style={{
        borderRadius: 11, flexShrink: 0,
        boxShadow: `0 0 10px ${tier.glowColor}`,
      }}>
        <Avatar
          src={entry.avatar} name={name} userId={entry.id} size={38} radius={11}
          style={{ background: `linear-gradient(135deg, ${tier.color}60, ${tier.color}30)` }}
        />
      </div>

      {/* Name + rank */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {isMe && <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '1px 5px' }}>YOU</span>}
        </div>
        <div style={{ fontSize: 11, color: tier.color, fontWeight: 600 }}>{tier.emoji} {tier.name}</div>
      </div>

      {/* XP */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: 'monospace' }}>{fmtXP(entry.xp)}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>XP · Lv {entry.level}</div>
      </div>
    </div>
  )
}

// ─── Leaderboard exclusions ───────────────────────────
// Dev/team accounts should never show up on the leaderboard — normal
// players only. Two mechanisms, belt-and-suspenders:
//  1. Anyone with a staff/moderator/admin role in `user_moderation` is
//     excluded automatically (covers current + future team accounts).
//  2. A hardcoded id backstop for specific accounts, in case a role ever
//     gets reset/removed by accident. Confirmed via email lookup:
//       - moderator.chillverse@gmail.com  → a7b1a79c-cd56-425d-b5e1-d8bcadf9b125 (moderator)
//       - yungpresido76@gmail.com         → 5f971630-c7af-4aca-baab-d1f1f6571d12 (staff)
//     "onyebobo@gmail.com" was a typo for onyebobo1234@gmail.com
//     (username Victor_00) → e2a08967-976b-4abe-8e0f-df87ffbf5a18 (admin) — confirmed.
const HARDCODED_EXCLUDED_IDS = [
  'a7b1a79c-cd56-425d-b5e1-d8bcadf9b125',
  '5f971630-c7af-4aca-baab-d1f1f6571d12',
  'e2a08967-976b-4abe-8e0f-df87ffbf5a18',
]

async function getLeaderboardExclusionIds(): Promise<string[]> {
  const { data } = await supabase
    .from('user_moderation')
    .select('user_id')
    .in('role', ['staff', 'moderator', 'admin'])
  const staffIds = (data ?? []).map(r => r.user_id)
  return [...new Set([...staffIds, ...HARDCODED_EXCLUDED_IDS])]
}

// ══════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════
export default function Ranks() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [tab, setTab] = useState<Tab>('my-rank')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [lbMode, setLbMode] = useState<'tier' | 'global'>('tier')
  const myRowRef = useRef<HTMLDivElement>(null)

  const userXp   = profile?.xp ?? 0
  const userTier = getUserRankTier(userXp)
  const nextTier = getNextRankTier(userTier)
  const { pct, xpIntoTier, xpNeeded } = getRankProgress(userXp)

  // Load leaderboard — either everyone in the user's own rank tier (normal
  // view), or the full global ranking across all players (triggered by the
  // "Check My Global Rank" toggle below). Team/staff accounts are always
  // excluded (see getLeaderboardExclusionIds above) — leaderboard is
  // players only.
  useEffect(() => {
    if (!showLeaderboard) return
    setLbLoading(true)

    getLeaderboardExclusionIds().then(excludedIds => {
      const excludeFilter = <T,>(q: T) =>
        excludedIds.length > 0
          ? (q as any).not('id', 'in', `(${excludedIds.join(',')})`)
          : q

      if (lbMode === 'global') {
        excludeFilter(
          supabase
            .from('profiles')
            .select('id, display_name, username, xp, level, streak, avatar')
        )
          .order('xp', { ascending: false })
          .limit(200)
          .then(({ data }: { data: LeaderboardEntry[] | null }) => {
            setLeaderboard(data ?? [])
            setLbLoading(false)
          })
        return
      }

      // Find user's rank tier bounds
      const tier = getUserRankTier(userXp)
      excludeFilter(
        supabase
          .from('profiles')
          .select('id, display_name, username, xp, level, streak, avatar')
          .gte('xp', tier.xpRequired)
      )
        .order('xp', { ascending: false })
        .limit(100)
        .then(({ data }: { data: LeaderboardEntry[] | null }) => {
          const all = data ?? []
          // filter to only this tier (xp < next tier threshold)
          const nextTier = RANK_TIERS.find(t => t.xpRequired > tier.xpRequired)
          const sameRank = nextTier
            ? all.filter(p => p.xp < nextTier.xpRequired)
            : all
          setLeaderboard(sameRank)
          setLbLoading(false)
        })
    })
  }, [showLeaderboard, userXp, lbMode])

  // In global mode, once the (potentially long) full list loads, jump
  // straight to the player's own row instead of leaving them to scroll.
  useEffect(() => {
    if (lbMode === 'global' && !lbLoading && myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [lbMode, lbLoading])

  // Which tiers has the user unlocked
  const unlockedIds = new Set(RANK_TIERS.filter(t => userXp >= t.xpRequired).map(t => t.id))

  // Upcoming reward tiers locked tiers that have real rewards
  const upcomingRewards = RANK_TIERS
    .filter(t => !unlockedIds.has(t.id) && t.rewards.some(r => r.type !== 'nothing'))
    .slice(0, 3)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 48 }}>
      <PageOnboarding pageKey="ranks" />
      <style>{`
        @keyframes rankGlow { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes feedIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
      `}</style>

      {/* Back */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      {/* Hero header */}
      <div style={{
        background: `linear-gradient(135deg, ${userTier.color}18, ${userTier.color}06)`,
        border: `1px solid ${userTier.color}30`,
        borderRadius: 24, padding: '28px 24px', marginBottom: 20,
        boxShadow: `0 0 40px ${userTier.glowColor}, 6px 6px 18px var(--neu-dark), -3px -3px 10px var(--neu-light)`,
        animation: 'feedIn 0.4s ease-out both',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* BG glow orb */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${userTier.color}22 0%, transparent 70%)`, pointerEvents: 'none', animation: 'rankGlow 3s ease-in-out infinite' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
          {/* Big rank badge */}
          <div style={{
            width: 72, height: 72, borderRadius: 22, flexShrink: 0,
            background: `linear-gradient(135deg, ${userTier.color}40, ${userTier.color}15)`,
            border: `2px solid ${userTier.color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34,
            boxShadow: `0 0 28px ${userTier.glowColor}, 4px 4px 12px var(--neu-dark)`,
          }}>
            {userTier.emoji}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: userTier.color, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Your Rank
            </div>
            <div style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px',
              color: userTier.color,
              marginBottom: 4,
            }}>
              {userTier.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {fmtXP(userXp)} XP · Level {profile?.level ?? 1}
            </div>
          </div>
        </div>

        {/* XP Progress to next rank */}
        {nextTier ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 7 }}>
              <span style={{ fontWeight: 600 }}>{fmtXP(xpIntoTier)} / {fmtXP(xpNeeded)} XP</span>
              <span>Next: <span style={{ color: nextTier.color, fontWeight: 700 }}>{nextTier.name}</span> · {fmtXP(xpNeeded - xpIntoTier)} XP away</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.3)', overflow: 'hidden', boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.4)' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${pct}%`,
                background: `linear-gradient(90deg, ${userTier.color}, ${nextTier.color})`,
                boxShadow: `0 0 10px ${userTier.glowColor}`,
                transition: 'width 1s ease',
              }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
              {nextTier.rewards.some(r => r.type !== 'nothing')
                ? <span>🎁 <strong style={{ color: nextTier.color }}>{nextTier.name}</strong> unlocks: {nextTier.rewards[0].label}</span>
                : <span>Keep earning XP to reach <strong style={{ color: nextTier.color }}>{nextTier.name}</strong></span>
              }
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,197,66,0.1)', border: '1px solid rgba(245,197,66,0.3)', borderRadius: 12, padding: '10px 14px' }}>
            <Crown size={16} style={{ color: '#f5c542' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f5c542' }}>You've reached the highest rank in Chillverse. Legendary.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface)', borderRadius: 16, padding: 5, boxShadow: '3px 3px 10px var(--neu-dark), -2px -2px 8px var(--neu-light)' }}>
        {([
          { id: 'my-rank',   label: 'My Rank',   icon: <Star size={14} /> },
          { id: 'all-ranks', label: 'All Ranks', icon: <Shield size={14} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={(e) => { ripple(e); setTab(t.id) }}
            className="ripple-wrap"
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 700,
              background: tab === t.id ? userTier.color : 'transparent',
              color: tab === t.id ? '#111' : 'var(--text-dim)',
              transition: 'all 0.2s',
              boxShadow: tab === t.id ? `0 4px 14px ${userTier.glowColor}` : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          onClick={(e) => { ripple(e); setShowLeaderboard(true) }}
          className="ripple-wrap"
          style={{
            flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 12, fontWeight: 700,
            background: 'transparent',
            color: 'var(--text-dim)',
            transition: 'all 0.2s',
          }}
        >
          <Trophy size={14} /> Leaderboard
        </button>
      </div>

      {/* ── MY RANK tab ─────────────────────────────── */}
      {tab === 'my-rank' && (
        <div style={{ animation: 'feedIn 0.3s ease-out both' }}>

          {/* Your rewards unlocked so far */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Rewards You've Unlocked</p>
          {(() => {
            const unlocked = RANK_TIERS
              .filter(t => unlockedIds.has(t.id) && t.rewards.some(r => r.type !== 'nothing'))
            if (unlocked.length === 0) {
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🏆</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No rewards yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rewards start at Gold I ({fmtXP(RANK_TIERS.find(t => t.id === 'gold_1')!.xpRequired)} XP). You're on your way.</p>
                </div>
              )
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {unlocked.flatMap(t => t.rewards.filter(r => r.type !== 'nothing').map((reward, i) => (
                  <div key={`${t.id}-${i}`} style={{ background: `${t.color}10`, border: `1px solid ${t.color}30`, borderRadius: 16, padding: 14, boxShadow: `0 0 12px ${t.glowColor}` }}>
                    {reward.imageUrl
                      ? <img src={reward.imageUrl} alt={reward.label} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 10, marginBottom: 8, border: `1px solid ${t.color}40` }} />
                      : <div style={{ fontSize: 28, marginBottom: 8 }}><RewardIcon type={reward.type} /></div>
                    }
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.color, marginBottom: 3 }}>{reward.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{reward.description.slice(0, 60)}…</div>
                  </div>
                )))}
              </div>
            )
          })()}

          {/* Upcoming rewards */}
          {upcomingRewards.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Coming Up Next</p>
              {upcomingRewards.map(tier => (
                <div key={tier.id} style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '3px 3px 8px var(--neu-dark),-2px -2px 6px var(--neu-light)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${tier.color}15`, border: `1px solid ${tier.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {tier.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: tier.color, marginBottom: 2 }}>{tier.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      🎁 {tier.rewards.filter(r => r.type !== 'nothing').map(r => r.label).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{fmtXP(tier.xpRequired)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>XP needed</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Rank history - tiers passed */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12, marginTop: 20 }}>Rank Journey</p>
          <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0, paddingBottom: 8 }}>
            {RANK_TIERS.map((tier, i) => {
              const unlocked = unlockedIds.has(tier.id)
              const isCur    = tier.id === userTier.id
              return (
                <div key={tier.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: unlocked ? `${tier.color}30` : 'var(--surface2)',
                      border: isCur ? `2px solid ${tier.color}` : '1.5px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      boxShadow: isCur ? `0 0 12px ${tier.glowColor}` : 'none',
                      margin: '0 auto 5px',
                    }}>
                      {unlocked ? tier.emoji : <Lock size={12} color="var(--text-muted)" />}
                    </div>
                    <div style={{ fontSize: 8, color: unlocked ? tier.color : 'var(--text-muted)', fontWeight: 700, maxWidth: 44, textAlign: 'center', lineHeight: 1.2 }}>
                      {tier.name}
                    </div>
                  </div>
                  {i < RANK_TIERS.length - 1 && (
                    <div style={{ width: 16, height: 2, background: unlocked ? tier.color : 'var(--surface3)', margin: '0 2px', marginBottom: 16, borderRadius: 1 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LEADERBOARD inner page ──────────────────── */}
      {showLeaderboard && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg, #0e0e12)', overflowY: 'auto', animation: 'feedIn 0.25s ease-out both' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 48px' }}>

            {/* Back button — sticky, always on top with its own background strip */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, paddingTop: 16, paddingBottom: 10, background: 'var(--bg, #0e0e12)' }}>
              <button
                onClick={() => { setShowLeaderboard(false); setLbMode('tier') }}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}
              >
                <ArrowLeft size={15} />
              </button>
            </div>

            {/* Banner — sits in normal flow BELOW the sticky back button, never over it */}
            <div style={{ width: '100%', height: 'clamp(130px, 28vw, 190px)', borderRadius: 16, overflow: 'hidden', marginBottom: 28, flexShrink: 0 }}>
              <img
                src="https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/Normal%20tier/Leadboard.png"
                alt="Leaderboard banner"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }}
              />
            </div>

            {lbLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: userTier.color, animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Loading leaderboard…
              </div>
            ) : (
              <>
                {leaderboard.length >= 3 && (
                  /* Podium rendered fully after banner — all three medals visible */
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 28, height: 190 }}>
                    {/* Layout order: 2nd · 1st · 3rd */}
                    {([leaderboard[1], leaderboard[0], leaderboard[2]] as LeaderboardEntry[]).map((entry, i) => {
                      const podiumHeights = [100, 140, 78]
                      const medals = ['🥈', '🥇', '🥉']
                      const isFirst = i === 1
                      const entryTier = getUserRankTier(entry.xp)
                      const name = entry.display_name || entry.username
                      return (
                        <div key={entry.id} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Medal emoji — always rendered, never hidden */}
                          <div style={{ fontSize: isFirst ? 22 : 18, marginBottom: 4, lineHeight: 1 }}>{medals[i]}</div>
                          {/* Avatar */}
                          <div style={{ width: isFirst ? 52 : 44, height: isFirst ? 52 : 44, borderRadius: 14, marginBottom: 5, border: `2px solid ${entryTier.color}70`, overflow: 'hidden', boxShadow: `0 0 ${isFirst ? 22 : 14}px ${entryTier.glowColor}`, flexShrink: 0 }}>
                            <Avatar
                              src={entry.avatar} name={name} userId={entry.id} size={isFirst ? 48 : 40} radius={12}
                              style={{ background: `linear-gradient(135deg, ${entryTier.color}50, ${entryTier.color}20)` }}
                            />
                          </div>
                          {/* Name */}
                          <div style={{ fontSize: isFirst ? 12 : 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          {/* Podium block */}
                          <div style={{ width: '100%', height: podiumHeights[i], borderRadius: '10px 10px 0 0', background: `linear-gradient(180deg, ${entryTier.color}30, ${entryTier.color}10)`, border: `1px solid ${entryTier.color}40`, boxShadow: isFirst ? `0 -4px 18px ${entryTier.glowColor}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontSize: isFirst ? 14 : 12, fontWeight: 800, color: entryTier.color, fontFamily: 'monospace' }}>{fmtXP(entry.xp)}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>XP</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {leaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    position={i + 1}
                    isMe={entry.id === profile?.id}
                    innerRef={entry.id === profile?.id ? myRowRef : undefined}
                  />
                ))}
                {leaderboard.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No players yet. Be the first!
                  </div>
                )}

                {/* Toggle between the normal (same-tier) board and the full global ranking */}
                <button
                  type="button"
                  onClick={(e) => { ripple(e); setLbMode(m => m === 'global' ? 'tier' : 'global') }}
                  className="ripple-wrap"
                  style={{
                    width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 13, fontWeight: 700, color: '#111',
                    background: userTier.color,
                    boxShadow: `0 4px 16px ${userTier.glowColor}`,
                  }}
                >
                  {lbMode === 'global'
                    ? <><Trophy size={15} /> Back to Leaderboard</>
                    : <><Target size={15} /> Check My Global Rank</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ALL RANKS tab ───────────────────────────── */}
      {tab === 'all-ranks' && (
        <div style={{ animation: 'feedIn 0.3s ease-out both' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Tap any rank to see its rewards. Rewards begin at <strong style={{ color: '#f5c542' }}>Gold I</strong>.
          </p>
          {RANK_TIERS.map(tier => (
            <RankCard
              key={tier.id}
              tier={tier}
              isUnlocked={unlockedIds.has(tier.id)}
              isCurrent={tier.id === userTier.id}
              userXp={userXp}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
