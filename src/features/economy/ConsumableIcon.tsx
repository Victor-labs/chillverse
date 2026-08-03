// src/features/economy/ConsumableIcon.tsx
import type React from 'react'
import { Package } from 'lucide-react'
import type { MallItemCategory } from '../../shared/types'

/**
 * The 3 mall categories that route through this component instead of a
 * plain image div. Every other category (avatar_skin, profile_pic,
 * chat_theme, banner) is untouched.
 */
export const CONSUMABLE_ICON_CATEGORIES = ['rank_shield', 'xp_booster', 'streak_freeze'] as const
export type ConsumableIconCategory = (typeof CONSUMABLE_ICON_CATEGORIES)[number]

export function isConsumableIconCategory(category: MallItemCategory): category is ConsumableIconCategory {
  return (CONSUMABLE_ICON_CATEGORIES as readonly string[]).includes(category)
}

const FALLBACK_TINT: Record<ConsumableIconCategory, string> = {
  rank_shield: '#4f8ef7',
  xp_booster: '#f5c542',
  streak_freeze: '#6dd5ff',
}

interface ConsumableIconProps {
  category: ConsumableIconCategory
  imageUrl: string | null
  /** Merged onto the outer wrapper LAST, so callers control sizing
   *  (width, aspectRatio, borderRadius, margin, lock-state filter, etc.)
   *  exactly the way they do for a plain image div. */
  style?: React.CSSProperties
  /** 'cover' (default) fills square grid tiles edge-to-edge. 'contain' is
   *  for wider, non-square preview boxes (e.g. the buy-sheet mockup) where
   *  the whole 512×512 icon should stay uncropped and centered. */
  fit?: 'cover' | 'contain'
}

/**
 * Renders a consumable's artwork. No animation — plain static image with a
 * tinted-gradient + Package-icon fallback when there's no image_url yet.
 * Kept as its own component (rather than inlining a plain image div at
 * every call site) so Mall.tsx/Inventory.tsx don't need to change if a
 * category-specific treatment is wanted again later.
 */
export default function ConsumableIcon({ category, imageUrl, style, fit = 'cover' }: ConsumableIconProps) {
  const tint = FALLBACK_TINT[category]

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: imageUrl
          ? `url(${imageUrl}) center/${fit}${fit === 'contain' ? ' no-repeat' : ''}`
          : `linear-gradient(135deg, ${tint}22, ${tint}0a)`,
        ...style,
      }}
    >
      {!imageUrl && <Package size={22} style={{ color: `${tint}66` }} />}
    </div>
  )
}
