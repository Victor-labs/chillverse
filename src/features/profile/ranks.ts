// src/lib/ranks.ts

const BADGE_BASE_URL = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Ranks'

export interface RankTier {
  id: string
  name: string
  group: 'rookie' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend' | 'og'
  xpRequired: number
  color: string
  glowColor: string
  emoji: string
  /** Rank badge image (128px WebP, Supabase Storage). Undefined only for Rookie, which has no badge art. */
  badgeUrl?: string
  rewards: Reward[]
}

export interface Reward {
  type:
    | 'badge'
    | 'profile_pic'
    | 'album_pic'
    | 'chat_name_glow'
    | 'profile_border_glow'
    | 'mall_pick'
    | 'nothing'
  label: string
  description: string
  imageUrl?: string
  glowColor?: string
}

export const RANK_TIERS: RankTier[] = [
  // ── Rookie ──────────────────────────────────────────────────
  {
    id: 'rookie',
    name: 'Rookie',
    group: 'rookie',
    xpRequired: 0,
    color: '#888899',
    glowColor: 'rgba(136,136,153,0.35)',
    emoji: '🌱',
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Keep grinding — rewards start at Gold.' }],
  },

  // ── Bronze ───────────────────────────────────────────────────
  {
    id: 'bronze_1',
    name: 'Bronze I',
    group: 'bronze',
    xpRequired: 1_500,
    color: '#cd7f32',
    glowColor: 'rgba(205,127,50,0.35)',
    emoji: '🔶',
    badgeUrl: `${BADGE_BASE_URL}/bronze-1.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },
  {
    id: 'bronze_2',
    name: 'Bronze II',
    group: 'bronze',
    xpRequired: 4_000,
    color: '#cd7f32',
    glowColor: 'rgba(205,127,50,0.35)',
    emoji: '🔶',
    badgeUrl: `${BADGE_BASE_URL}/bronze-2.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },
  {
    id: 'bronze_3',
    name: 'Bronze III',
    group: 'bronze',
    xpRequired: 8_000,
    color: '#cd7f32',
    glowColor: 'rgba(205,127,50,0.35)',
    emoji: '🔶',
    badgeUrl: `${BADGE_BASE_URL}/bronze-3.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },

  // ── Silver ───────────────────────────────────────────────────
  {
    id: 'silver_1',
    name: 'Silver I',
    group: 'silver',
    xpRequired: 15_000,
    color: '#b0b8c8',
    glowColor: 'rgba(176,184,200,0.35)',
    emoji: '⚪',
    badgeUrl: `${BADGE_BASE_URL}/silver-1.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },
  {
    id: 'silver_2',
    name: 'Silver II',
    group: 'silver',
    xpRequired: 27_000,
    color: '#b0b8c8',
    glowColor: 'rgba(176,184,200,0.35)',
    emoji: '⚪',
    badgeUrl: `${BADGE_BASE_URL}/silver-2.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },
  {
    id: 'silver_3',
    name: 'Silver III',
    group: 'silver',
    xpRequired: 42_000,
    color: '#b0b8c8',
    glowColor: 'rgba(176,184,200,0.35)',
    emoji: '⚪',
    badgeUrl: `${BADGE_BASE_URL}/silver-3.webp`,
    rewards: [{ type: 'nothing', label: 'No rewards yet', description: 'Rewards begin at Gold I. Keep earning XP.' }],
  },

  // ── Gold ─────────────────────────────────────────────────────
  {
    id: 'gold_1',
    name: 'Gold I',
    group: 'gold',
    xpRequired: 63_000,
    color: '#f5c542',
    glowColor: 'rgba(245,197,66,0.4)',
    emoji: '🟡',
    badgeUrl: `${BADGE_BASE_URL}/gold-1.webp`,
    rewards: [{
      type: 'badge',
      label: 'Gold Spark Badge',
      description: 'An exclusive Gold Spark badge displayed on your profile — earned by fewer than 20% of players.',
    }],
  },
  {
    id: 'gold_2',
    name: 'Gold II',
    group: 'gold',
    xpRequired: 90_000,
    color: '#f5c542',
    glowColor: 'rgba(245,197,66,0.4)',
    emoji: '🟡',
    badgeUrl: `${BADGE_BASE_URL}/gold-2.webp`,
    rewards: [{ type: 'nothing', label: 'Milestone rank', description: 'No new reward — but you\'re closing in on Gold III.' }],
  },
  {
    id: 'gold_3',
    name: 'Gold III',
    group: 'gold',
    xpRequired: 125_000,
    color: '#f5c542',
    glowColor: 'rgba(245,197,66,0.4)',
    emoji: '🟡',
    badgeUrl: `${BADGE_BASE_URL}/gold-3.webp`,
    rewards: [{ type: 'nothing', label: 'Milestone rank', description: 'Almost Platinum — keep the grind going.' }],
  },

  // ── Platinum ─────────────────────────────────────────────────
  {
    id: 'platinum_1',
    name: 'Platinum I',
    group: 'platinum',
    xpRequired: 165_000,
    color: '#a0d8ef',
    glowColor: 'rgba(160,216,239,0.4)',
    emoji: '💜',
    badgeUrl: `${BADGE_BASE_URL}/platinum-1.webp`,
    rewards: [{
      type: 'profile_pic',
      label: 'Platinum Profile Pic',
      description: 'A free exclusive Platinum profile picture you can enable from your profile settings.',
      imageUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/Normal%20tier/Platinum.jpg',
    }],
  },
  {
    id: 'platinum_2',
    name: 'Platinum II',
    group: 'platinum',
    xpRequired: 220_000,
    color: '#a0d8ef',
    glowColor: 'rgba(160,216,239,0.4)',
    emoji: '💜',
    badgeUrl: `${BADGE_BASE_URL}/platinum-2.webp`,
    rewards: [{ type: 'nothing', label: 'Milestone rank', description: 'Grinding through Platinum — respect.' }],
  },
  {
    id: 'platinum_3',
    name: 'Platinum III',
    group: 'platinum',
    xpRequired: 280_000,
    color: '#a0d8ef',
    glowColor: 'rgba(160,216,239,0.4)',
    emoji: '💜',
    badgeUrl: `${BADGE_BASE_URL}/platinum-3.webp`,
    rewards: [{ type: 'nothing', label: 'Milestone rank', description: 'Diamond is right around the corner.' }],
  },

  // ── Diamond ──────────────────────────────────────────────────
  {
    id: 'diamond_1',
    name: 'Diamond I',
    group: 'diamond',
    xpRequired: 345_000,
    color: '#a8f0ff',
    glowColor: 'rgba(168,240,255,0.45)',
    emoji: '💎',
    badgeUrl: `${BADGE_BASE_URL}/diamond-1.webp`,
    rewards: [{
      type: 'album_pic',
      label: 'Diamond Album Pic',
      description: 'A rare Diamond image added to your album — a special collection of pics you can show off on your profile.',
      imageUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/Normal%20tier/Diamond.jpg',
    }],
  },
  {
    id: 'diamond_2',
    name: 'Diamond II',
    group: 'diamond',
    xpRequired: 430_000,
    color: '#a8f0ff',
    glowColor: 'rgba(168,240,255,0.45)',
    emoji: '💎',
    badgeUrl: `${BADGE_BASE_URL}/diamond-2.webp`,
    rewards: [{ type: 'nothing', label: 'Milestone rank', description: 'Elite territory. Almost Diamond III.' }],
  },
  {
    id: 'diamond_3',
    name: 'Diamond III',
    group: 'diamond',
    xpRequired: 525_000,
    color: '#a8f0ff',
    glowColor: 'rgba(168,240,255,0.45)',
    emoji: '💎',
    badgeUrl: `${BADGE_BASE_URL}/diamond-3.webp`,
    rewards: [{
      type: 'chat_name_glow',
      label: 'Diamond Name Glow',
      description: 'Your name glows with a cyan diamond shimmer in all chats. Everyone will notice.',
      glowColor: '#a8f0ff',
    }],
  },

  // ── Legend ───────────────────────────────────────────────────
  {
    id: 'legend',
    name: 'Legend',
    group: 'legend',
    xpRequired: 675_000,
    color: '#ff6b00',
    glowColor: 'rgba(255,107,0,0.5)',
    emoji: '👑',
    badgeUrl: `${BADGE_BASE_URL}/legend.webp`,
    rewards: [
      {
        type: 'profile_border_glow',
        label: 'Legend Border Glow',
        description: 'A fiery glow surrounds your profile border — visible to everyone who views your profile.',
        glowColor: '#ff6b00',
      },
      {
        type: 'profile_pic',
        label: 'Legend Profile Pic',
        description: 'Exclusive Legend profile picture, free to enable on your profile.',
        imageUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/Normal%20tier/Legend.jpg',
      },
    ],
  },

  // ── Chillverse OG ────────────────────────────────────────────
  {
    id: 'chillverse_og',
    name: 'Chillverse OG',
    group: 'og',
    xpRequired: 900_000,
    color: '#f5c542',
    glowColor: 'rgba(245,197,66,0.6)',
    emoji: '🌌',
    badgeUrl: `${BADGE_BASE_URL}/chillverse-og.webp`,
    rewards: [
      {
        type: 'mall_pick',
        label: 'Free Mall Pick',
        description: 'Pick any one item from the Mall — completely free. One-time reward.',
      },
      {
        type: 'chat_name_glow',
        label: 'OG Yellow Name Glow',
        description: 'Your name glows gold in every chat. The rarest flex in Chillverse.',
        glowColor: '#f5c542',
      },
      {
        type: 'album_pic',
        label: 'Chillverse OG Album Pic',
        description: 'The rarest album picture in existence. Less than 1% of players will ever see this.',
        imageUrl: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/Normal%20tier/ChillverseOG.jpg',
      },
    ],
  },
]

/** Get a user's current rank tier based on their total XP */
export function getUserRankTier(xp: number): RankTier {
  let current = RANK_TIERS[0]
  for (const tier of RANK_TIERS) {
    if (xp >= tier.xpRequired) current = tier
    else break
  }
  return current
}

/** Get the next rank tier above the current one */
export function getNextRankTier(current: RankTier): RankTier | null {
  const idx = RANK_TIERS.findIndex(t => t.id === current.id)
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null
}

/** XP progress toward next rank (0–100) */
export function getRankProgress(xp: number): { pct: number; xpIntoTier: number; xpNeeded: number } {
  const current = getUserRankTier(xp)
  const next    = getNextRankTier(current)
  if (!next) return { pct: 100, xpIntoTier: 0, xpNeeded: 0 }
  const xpIntoTier = xp - current.xpRequired
  const xpNeeded   = next.xpRequired - current.xpRequired
  return { pct: Math.min(100, Math.round((xpIntoTier / xpNeeded) * 100)), xpIntoTier, xpNeeded }
}

/** Format large XP numbers nicely */
export function fmtXP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** Same shortening as fmtXP but without the k/M unit letter — for use next to an explicit "XP" label. */
export function fmtXPValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1)
  if (n >= 1_000)     return (n / 1_000).toFixed(1)
  return String(n)
}

// ── Rank groups — used by Rank Tags (Chat + Posts) ───────────────────────
// The 8 broad groups a Staff/Moderator/Admin can @tag (e.g. "@Gold" notifies
// everyone from Gold I to Gold III). Derived from RANK_TIERS so the group
// list, labels, and colors can never drift out of sync with the tier table.
export const RANK_GROUP_IDS = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend', 'og'] as const
export type RankGroupId = (typeof RANK_GROUP_IDS)[number]

export interface RankGroupInfo {
  id: RankGroupId
  label: string
  color: string
}

export const RANK_GROUPS: RankGroupInfo[] = RANK_GROUP_IDS.map(id => {
  const tier = RANK_TIERS.find(t => t.group === id)!
  return { id, label: tier.name.replace(/ (I{1,3})$/, ''), color: tier.color }
})

const RANK_GROUP_BY_ID = new Map(RANK_GROUPS.map(g => [g.id, g]))

/** Display label + color for a rank group id (e.g. 'gold' → "Gold", '#f5c542'). */
export function getRankGroupInfo(group: RankGroupId): RankGroupInfo {
  return RANK_GROUP_BY_ID.get(group) ?? RANK_GROUPS[0]
}

/** Which rank group a given XP total currently falls into. */
export function getUserRankGroup(xp: number): RankGroupId {
  return getUserRankTier(xp).group
}

// ── Rank Decay ────────────────────────────────────────────────────
// `xp` is the permanent lifetime total — it never decreases and is what
// getUserRankTier/getUserRankGroup above always operate on. `active_rank_xp`
// is a second, decaying number (see supabase/migrations/0098_rank_decay.sql)
// that drives the leaderboard and the *displayed* rank badge everywhere
// except rank tags/reward unlocking, which stay on lifetime xp.

/** Get the rank tier one full step below the given tier (clamped at Rookie). */
export function getTierOneBelow(tier: RankTier): RankTier {
  const idx = RANK_TIERS.findIndex(t => t.id === tier.id)
  return RANK_TIERS[Math.max(idx - 1, 0)]
}

/**
 * Is the player's displayed/active rank currently decayed below their
 * permanent lifetime tier? True once active_rank_xp has dropped enough
 * that it now resolves to a lower tier than lifetime xp does.
 */
export function isRankDecayed(xp: number, activeRankXp: number): boolean {
  return getUserRankTier(activeRankXp).id !== getUserRankTier(xp).id
}

/**
 * Progress (0–100) for the "My Rank" dual-badge decayed state — progress
 * within the active (one-tier-below) bracket, but capped at a maximum of
 * 50% fill while decayed, regardless of how close active_rank_xp actually
 * is to the lifetime tier's threshold.
 */
export function getDecayedRankProgress(activeRankXp: number): { pct: number; xpIntoTier: number; xpNeeded: number } {
  const { pct, xpIntoTier, xpNeeded } = getRankProgress(activeRankXp)
  return { pct: Math.min(50, pct), xpIntoTier, xpNeeded }
}
