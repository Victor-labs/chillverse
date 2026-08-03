// src/pages/Ranks.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Star, ChevronRight, Crown, Shield, Target } from 'lucide-react'
import { useProfile } from './useProfile'
import { supabase } from '../../shared/lib/supabase'
import { nameStyleFor } from '../../shared/lib/displayNameStyle'
import { ripple } from '../../shared/lib/ripple'
import {
  RANK_TIERS, getUserRankTier, getNextRankTier,
  getRankProgress, fmtXP,
  isRankDecayed, getDecayedRankProgress,
  type RankTier,
} from './ranks'
import PageOnboarding from '../onboarding/PageOnboarding'
import Avatar from '../../shared/components/Avatar'
import RankBadge from '../../shared/components/RankBadge'
import ScrollFadeRow from '../../shared/components/ScrollFadeRow'

// ─── Tab type ────────────────────────────────────────
type Tab = 'my-rank' | 'all-ranks'

// Hero background art (trophy) — sits behind the "My Rank" summary card
const RANK_HERO_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Ranks/ranks.png'

// Shared "panel" look used for Rank Journey + Coming Up Next — a dark,
// slightly-elevated surface (mirrors the raised-button treatment elsewhere)
// instead of each row floating as its own separate card.
function panelStyle(accentColor: string): React.CSSProperties {
  return {
    position: 'relative',
    background: `linear-gradient(160deg, var(--surface2) 0%, var(--surface) 75%)`,
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '16px 16px 14px',
    marginBottom: 20,
    boxShadow: `4px 4px 14px var(--neu-dark), -2px -2px 8px var(--neu-light), inset 0 0 30px ${accentColor}0a`,
    overflow: 'hidden',
  }
}

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
  tier, isUnlocked, isCurrent, progressXp,
}: {
  tier: RankTier
  isUnlocked: boolean
  isCurrent: boolean
  /** XP value to compute "X XP to next" against — active_rank_xp, since isCurrent is keyed off the active tier. */
  progressXp: number
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
        transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
      }}
    >
      {/* Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Rank badge */}
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: `${tier.color}18`,
          border: `1.5px solid ${tier.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isUnlocked ? `0 0 12px ${tier.glowColor}` : 'none',
        }}>
          <RankBadge tier={tier} size={34} locked={!isUnlocked} />
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
              const { xpIntoTier, xpNeeded } = getRankProgress(progressXp)
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
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  active_rank_xp: number
  level: number
  streak: number
  avatar: string | null
  display_name_font?: string | null
  display_name_color?: string | null
}

function LeaderboardRow({ entry, position, isMe, innerRef }: { entry: LeaderboardEntry; position: number; isMe: boolean; innerRef?: React.Ref<HTMLDivElement> }) {
  // Leaderboard order + badges are driven by active_rank_xp — the XP shown
  // in each row matches that same number so sort order never looks "wrong".
  const tier = getUserRankTier(entry.active_rank_xp)
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

      {/* Name + rank + level */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...nameStyleFor(entry) }}>
            {name}
          </span>
          {isMe && <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '1px 5px' }}>YOU</span>}
        </div>
        <div style={{ fontSize: 11, color: tier.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <RankBadge tier={tier} size={14} /> {tier.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lv {entry.level}</div>
      </div>

      {/* XP (lifetime) + Rank Score (active_rank_xp — drives sort order & badge) */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: 'monospace' }}>{fmtXP(entry.xp)} <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>XP</span></div>
        <div style={{ fontSize: 12, fontWeight: 700, color: tier.color, fontFamily: 'monospace', marginTop: 2 }}>{fmtXP(entry.active_rank_xp)} <span style={{ fontSize: 9, fontWeight: 700 }}>RS</span></div>
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
  const [pinnedMe, setPinnedMe] = useState<{ entry: LeaderboardEntry; position: number } | null>(null)
  const [lbLoading, setLbLoading] = useState(false)
  const [lbMode, setLbMode] = useState<'tier' | 'global'>('tier')
  const myRowRef = useRef<HTMLDivElement>(null)
  const currentRankCardRef = useRef<HTMLDivElement>(null)

  const userXp       = profile?.xp ?? 0
  const activeRankXp = profile?.active_rank_xp ?? userXp
  const lifetimeTier = getUserRankTier(userXp)
  const activeTier   = getUserRankTier(activeRankXp)
  const decayed      = isRankDecayed(userXp, activeRankXp)
  // userTier represents the ACTIVE/displayed rank — it drives colors, the
  // "Current Rank" pointer in the Rank Journey track, and the leaderboard
  // toggle button theming across this whole page. Lifetime standing (the
  // permanent achievement) is shown separately, greyed, when decayed.
  const userTier = activeTier
  const nextTier = getNextRankTier(userTier)
  const { pct, xpIntoTier, xpNeeded } = decayed
    ? getDecayedRankProgress(activeRankXp)
    : getRankProgress(userXp)

  // Center the current rank's card in the Rank Journey scroller on load,
  // instead of leaving the user to scroll all the way from Rookie.
  useEffect(() => {
    if (tab === 'my-rank') {
      currentRankCardRef.current?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' })
    }
  }, [tab, userTier.id])

  // Load leaderboard — either everyone in the user's own rank tier (normal
  // view), or the full global ranking across all players (triggered by the
  // "Check My Global Rank" toggle below). Team/staff accounts are always
  // excluded (see getLeaderboardExclusionIds above) — leaderboard is
  // players only. Both modes are capped to the top 50; if the player isn't
  // in that top 50, their exact position is computed separately and pinned
  // below the list instead of padding out a huge fetch.
  useEffect(() => {
    if (!showLeaderboard) return
    setLbLoading(true)
    setPinnedMe(null)

    const LB_SELECT = 'id, display_name, username, xp, active_rank_xp, level, streak, avatar, display_name_font, display_name_color'
    const myActiveRankXp = profile?.active_rank_xp ?? userXp

    getLeaderboardExclusionIds().then(excludedIds => {
      const excludeFilter = <T,>(q: T) =>
        excludedIds.length > 0
          ? (q as any).not('id', 'in', `(${excludedIds.join(',')})`)
          : q

      if (lbMode === 'global') {
        excludeFilter(
          supabase
            .from('profiles')
            .select(LB_SELECT)
        )
          .order('active_rank_xp', { ascending: false })
          .limit(50)
          .then(({ data }: { data: LeaderboardEntry[] | null }) => {
            const top50 = data ?? []
            setLeaderboard(top50)
            setLbLoading(false)

            if (profile && !top50.some(p => p.id === profile.id)) {
              excludeFilter(
                supabase
                  .from('profiles')
                  .select('id', { count: 'exact', head: true })
                  .gt('active_rank_xp', myActiveRankXp)
              )
                .then(({ count }: { count: number | null }) => {
                  setPinnedMe({ entry: profile, position: (count ?? 0) + 1 })
                })
            }
          })
        return
      }

      // Tier mode — bound the query to the user's tier bucket directly
      // (xp >= tier floor, xp < next tier floor) rather than over-fetching
      // and filtering client-side. Tier-bucket boundaries stay on lifetime
      // xp (per spec — only sort order + position use active_rank_xp).
      const tier = getUserRankTier(userXp)
      const tierNextTier = RANK_TIERS.find(t => t.xpRequired > tier.xpRequired)

      let tierQuery = supabase
        .from('profiles')
        .select(LB_SELECT)
        .gte('xp', tier.xpRequired)
      if (tierNextTier) tierQuery = tierQuery.lt('xp', tierNextTier.xpRequired)

      excludeFilter(tierQuery)
        .order('active_rank_xp', { ascending: false })
        .limit(50)
        .then(({ data }: { data: LeaderboardEntry[] | null }) => {
          const top50 = data ?? []
          setLeaderboard(top50)
          setLbLoading(false)

          if (profile && !top50.some(p => p.id === profile.id)) {
            let countQuery = supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .gt('active_rank_xp', myActiveRankXp)
              .gte('xp', tier.xpRequired)
            if (tierNextTier) countQuery = countQuery.lt('xp', tierNextTier.xpRequired)

            excludeFilter(countQuery)
              .then(({ count }: { count: number | null }) => {
                setPinnedMe({ entry: profile, position: (count ?? 0) + 1 })
              })
          }
        })
    })
  }, [showLeaderboard, userXp, lbMode, profile])

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
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      {/* Hero header — trophy art background: bright at top, fading down, never fully opaque */}
      <div style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.68) 100%), url(${RANK_HERO_IMG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        border: `1px solid ${userTier.color}30`,
        borderRadius: 24, padding: '28px 24px', marginBottom: 20,
        boxShadow: '6px 6px 18px var(--neu-dark), -3px -3px 10px var(--neu-light)',
        animation: 'feedIn 0.4s ease-out both',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* BG glow orb */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${userTier.color}30 0%, transparent 70%)`, pointerEvents: 'none', animation: 'rankGlow 3s ease-in-out infinite' }} />


        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          {/* Lifetime badge — greyed out, only shown while decayed. Your
              permanent achievement, currently inactive. */}
          {decayed && (
            <div style={{
              width: 46, height: 46, borderRadius: 16, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(255,255,255,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: 'grayscale(1)', opacity: 0.5,
            }}>
              <RankBadge tier={lifetimeTier} size={32} />
            </div>
          )}

          {/* Active rank badge — highlighted, this is the currently-displayed rank */}
          <div style={{
            width: 72, height: 72, borderRadius: 22, flexShrink: 0,
            background: `linear-gradient(135deg, ${userTier.color}40, ${userTier.color}15)`,
            border: `2px solid ${userTier.color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 28px ${userTier.glowColor}, 4px 4px 12px var(--neu-dark)`,
          }}>
            <RankBadge tier={userTier} size={54} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: userTier.color, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              My Rank
            </div>
            <div style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px',
              color: userTier.color,
              marginBottom: 4,
            }}>
              {userTier.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
              Level {profile?.level ?? 1}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
              {fmtXP(userXp)} <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'inherit' }}>XP</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: userTier.color, fontFamily: 'monospace', marginTop: 2 }}>
              {fmtXP(activeRankXp)} <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Rank Score</span>
            </div>
            {decayed && (
              <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 700, color: '#ffb44d' }}>
                ⚠ Decayed from {lifetimeTier.name} — earn XP to restore it
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface)', borderRadius: 16, padding: 5, boxShadow: 'var(--elev-raise-sm)' }}>
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
              transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
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
            transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
          }}
        >
          <Trophy size={14} /> Leaderboard
        </button>
      </div>

      {/* ── MY RANK tab ─────────────────────────────── */}
      {tab === 'my-rank' && (
        <div style={{ animation: 'feedIn 0.3s ease-out both' }}>

          {/* Rank Journey — compact scrollable step track + rank cards, auto-centered on current rank */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Rank Journey</p>
          <div style={{ ...panelStyle(userTier.color), padding: '12px 12px 12px' }}>
            <ScrollFadeRow style={{ marginBottom: nextTier ? 14 : 2 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, justifyContent: 'center' }}>
                {RANK_TIERS.map((tier, i) => {
                  const unlocked = unlockedIds.has(tier.id)
                  const isCur    = tier.id === userTier.id
                  const isLifetimeBest = decayed && tier.id === lifetimeTier.id
                  const stepDone = unlocked // step number is "reached" once unlocked
                  const CARD_W = 88

                  return (
                    <div
                      key={tier.id}
                      ref={isCur ? currentRankCardRef : undefined}
                      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: CARD_W, marginRight: i < RANK_TIERS.length - 1 ? 8 : 0 }}
                    >
                      {/* Step number + connector */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{
                          width: 19, height: 19, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800,
                          background: stepDone ? tier.color : 'var(--surface3)',
                          color: stepDone ? '#111' : 'var(--text-muted)',
                          border: isCur ? `2px solid ${tier.color}` : 'none',
                          boxShadow: isCur ? `0 0 8px ${tier.glowColor}` : 'none',
                        }}>
                          {i + 1}
                        </div>
                        {i < RANK_TIERS.length - 1 && (
                          <div style={{ flex: 1, height: 2, background: stepDone ? tier.color : 'var(--surface3)', marginLeft: 3 }} />
                        )}
                      </div>

                      {/* Rank card */}
                      <div style={{
                        position: 'relative',
                        background: isCur
                          ? `linear-gradient(160deg, ${tier.color}28, ${tier.color}0c)`
                          : unlocked
                            ? `linear-gradient(160deg, ${tier.color}14, ${tier.color}05)`
                            : 'var(--surface2)',
                        border: isCur ? `1.5px solid ${tier.color}70` : isLifetimeBest ? `1.5px dashed ${tier.color}50` : unlocked ? `1px solid ${tier.color}30` : '1px solid var(--border)',
                        borderRadius: 13,
                        padding: '10px 6px 9px',
                        textAlign: 'center',
                        opacity: isLifetimeBest ? 0.7 : unlocked ? 1 : 0.55,
                        filter: isLifetimeBest ? 'grayscale(0.4)' : 'none',
                        boxShadow: isCur ? `0 0 16px ${tier.glowColor}, 4px 4px 12px var(--neu-dark)` : 'none',
                        marginBottom: (isCur || isLifetimeBest) ? 9 : 0,
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, margin: '0 auto 7px',
                          background: `${tier.color}18`, border: `1.5px solid ${tier.color}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: unlocked ? `0 0 8px ${tier.glowColor}` : 'none',
                        }}>
                          <RankBadge tier={tier} size={24} locked={!unlocked} />
                        </div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: unlocked ? tier.color : 'var(--text-muted)', marginBottom: 4, lineHeight: 1.2 }}>
                          {tier.name}
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {fmtXP(tier.xpRequired)} XP
                        </div>

                        {isCur && (
                          <div style={{
                            position: 'absolute', left: '50%', bottom: -9, transform: 'translateX(-50%)',
                            background: tier.color, color: '#111', fontSize: 7, fontWeight: 800,
                            letterSpacing: '0.3px', textTransform: 'uppercase',
                            borderRadius: 7, padding: '3px 8px', whiteSpace: 'nowrap',
                            boxShadow: `0 2px 8px ${tier.glowColor}`,
                          }}>
                            Current Rank
                          </div>
                        )}
                        {isLifetimeBest && (
                          <div style={{
                            position: 'absolute', left: '50%', bottom: -9, transform: 'translateX(-50%)',
                            background: 'var(--surface3)', color: 'var(--text-muted)', fontSize: 7, fontWeight: 800,
                            letterSpacing: '0.3px', textTransform: 'uppercase',
                            borderRadius: 7, padding: '3px 8px', whiteSpace: 'nowrap',
                            border: `1px solid ${tier.color}40`,
                          }}>
                            Lifetime Best
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollFadeRow>

            {/* XP progress to next rank */}
            {nextTier ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 7 }}>
                  <span style={{ fontWeight: 600 }}>{fmtXP(xpIntoTier)} / {fmtXP(xpNeeded)} XP</span>
                  <span>
                    {decayed ? 'Recover to: ' : 'Next: '}
                    <span style={{ color: nextTier.color, fontWeight: 700 }}>{nextTier.name}</span> · {fmtXP(xpNeeded - xpIntoTier)} XP away
                  </span>
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
                  {decayed
                    ? <span>Earn XP to restore your <strong style={{ color: nextTier.color }}>{nextTier.name}</strong> rank</span>
                    : nextTier.rewards.some(r => r.type !== 'nothing')
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

          {/* Your rewards unlocked so far — progressive strip, unlocked-only */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Rewards You've Unlocked</p>
          {(() => {
            const unlockedRewards = RANK_TIERS
              .filter(t => unlockedIds.has(t.id) && t.rewards.some(r => r.type !== 'nothing'))
              .flatMap(t => t.rewards.filter(r => r.type !== 'nothing').map(reward => ({ tier: t, reward })))

            if (unlockedRewards.length === 0) {
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🏆</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No rewards yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rewards start at Gold I ({fmtXP(RANK_TIERS.find(t => t.id === 'gold_1')!.xpRequired)} XP). You're on your way.</p>
                </div>
              )
            }

            return (
              <ScrollFadeRow style={{ marginBottom: 20 }}>
                {unlockedRewards.map(({ tier: t, reward }, i) => (
                  <div
                    key={`${t.id}-${i}`}
                    style={{
                      flexShrink: 0, width: 104, scrollSnapAlign: 'start',
                      background: `linear-gradient(160deg, ${t.color}14, ${t.color}05)`,
                      border: `1px solid ${t.color}35`, borderRadius: 16, padding: '12px 10px',
                      boxShadow: `0 0 12px ${t.glowColor}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    }}
                  >
                    {reward.imageUrl
                      ? <img src={reward.imageUrl} alt={reward.label} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, marginBottom: 8, border: `1px solid ${t.color}40` }} />
                      : (
                        <div style={{ width: 56, height: 56, borderRadius: 10, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          <RewardIcon type={reward.type} />
                        </div>
                      )
                    }
                    <div style={{ fontSize: 9, fontWeight: 700, color: t.color, marginBottom: 2, lineHeight: 1.3 }}>{reward.label}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{t.name}</div>
                  </div>
                ))}
              </ScrollFadeRow>
            )
          })()}

          {/* Upcoming rewards — same raised dark-panel treatment throughout */}
          {upcomingRewards.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Coming Up Next</p>
              <div style={panelStyle(userTier.color)}>
                {upcomingRewards.map((tier, i) => (
                  <div
                    key={tier.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '10px 4px',
                      borderBottom: i < upcomingRewards.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${tier.color}15`, border: `1px solid ${tier.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RankBadge tier={tier} size={30} />
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
              </div>
            </>
          )}
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
                style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}
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
                      const podiumHeights = [112, 155, 90]
                      const medals = ['🥈', '🥇', '🥉']
                      const isFirst = i === 1
                      const entryTier = getUserRankTier(entry.active_rank_xp)
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
                          <div style={{ fontSize: isFirst ? 12 : 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...nameStyleFor(entry) }}>{name}</div>
                          {/* Podium block */}
                          <div style={{ width: '100%', height: podiumHeights[i], borderRadius: '10px 10px 0 0', background: `linear-gradient(180deg, ${entryTier.color}30, ${entryTier.color}10)`, border: `1px solid ${entryTier.color}40`, boxShadow: isFirst ? `0 -4px 18px ${entryTier.glowColor}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                            <RankBadge tier={entryTier} size={isFirst ? 22 : 18} />
                            <div style={{ fontSize: isFirst ? 14 : 12, fontWeight: 800, color: entryTier.color, fontFamily: 'monospace' }}>{fmtXP(entry.xp)}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>XP</div>
                            <div style={{ fontSize: isFirst ? 11 : 9.5, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', marginTop: 1 }}>{fmtXP(entry.active_rank_xp)} <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)' }}>RS</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {leaderboard.slice(3).map((entry, i) => (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    position={i + 4}
                    isMe={entry.id === profile?.id}
                    innerRef={entry.id === profile?.id ? myRowRef : undefined}
                  />
                ))}
                {leaderboard.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No players yet. Be the first!
                  </div>
                )}
                {pinnedMe && (
                  <>
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, letterSpacing: 3, margin: '10px 0' }}>· · ·</div>
                    <LeaderboardRow
                      entry={pinnedMe.entry}
                      position={pinnedMe.position}
                      isMe
                      innerRef={myRowRef}
                    />
                  </>
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
              progressXp={activeRankXp}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
