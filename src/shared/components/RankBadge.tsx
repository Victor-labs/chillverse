// src/shared/components/RankBadge.tsx
import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { RankTier } from '../../features/profile/ranks'

interface RankBadgeProps {
  tier: RankTier
  /** Rendered width/height in px. Emoji fallback and lock icon scale proportionally. */
  size: number
  /** Renders a lock icon instead of the badge (used for not-yet-unlocked tiers). */
  locked?: boolean
}

/**
 * Renders a rank's badge artwork (Supabase Storage WebP) at the given pixel
 * size. Falls back to the tier's emoji if the tier has no `badgeUrl` (e.g.
 * Rookie) or if the image fails to load, so a bad/missing upload never
 * breaks the UI. Single source of truth — used by the Ranks page, Profile,
 * ProfilePreviewModal, and PlayerProfile so badge art never drifts out of
 * sync across screens again.
 */
export default function RankBadge({ tier, size, locked }: RankBadgeProps) {
  const [failed, setFailed] = useState(false)
  const emojiSize = Math.round(size * 0.55)

  if (locked) {
    return <Lock size={Math.round(size * 0.36)} color="var(--text-muted)" />
  }
  if (tier.badgeUrl && !failed) {
    return (
      <img
        src={tier.badgeUrl}
        alt={tier.name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    )
  }
  return <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{tier.emoji}</span>
}
