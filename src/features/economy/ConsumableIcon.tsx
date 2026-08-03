// src/features/economy/ConsumableIcon.tsx
import type React from 'react'
import { Package } from 'lucide-react'
import type { MallItemCategory } from '../../shared/types'

/**
 * The 3 mall categories that get a signature idle animation layered over
 * their artwork. Every other category (avatar_skin, profile_pic,
 * chat_theme, banner) renders as a plain static image everywhere in the
 * app and is untouched by this component.
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

const SNOWFLAKE_COUNT = 6

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
 * Renders a consumable's artwork with its signature idle animation on top:
 *  - rank_shield:    a light glint sweeps diagonally across the shield
 *  - xp_booster:     a pulsing flame glow animates beneath the rocket
 *  - streak_freeze:  snowflakes drift down around the icon
 *
 * Each effect's active motion lasts ~1.5s. Shield and streak_freeze pause
 * between sweeps (so it reads as a periodic flourish, not a distraction
 * sitting in a grid); the XP booster flame flickers continuously since
 * that's how fire actually reads.
 *
 * Drop-in replacement for a plain `background: url(...) center/cover` div
 * — used anywhere these 3 items render an icon (Mall grid cards, Featured
 * strip, the buy-sheet preview, and Inventory cards/modal).
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

      {category === 'rank_shield' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          <div className="consumable-shield-glint" />
        </div>
      )}

      {category === 'streak_freeze' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          {Array.from({ length: SNOWFLAKE_COUNT }).map((_, i) => (
            <span
              key={i}
              className="consumable-snowflake"
              style={{
                left: `${8 + i * (84 / (SNOWFLAKE_COUNT - 1))}%`,
                fontSize: 7 + (i % 3) * 2,
                animationDelay: `${i * 0.27}s`,
                animationDuration: `${1.5 + (i % 3) * 0.3}s`,
              }}
            >
              ❄
            </span>
          ))}
        </div>
      )}

      {category === 'xp_booster' && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: '4%',
            transform: 'translateX(-50%)', pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div className="consumable-xp-flame" />
        </div>
      )}

      <style>{`
        @keyframes consumableShieldGlint {
          0%   { transform: translate(-140%, -140%) rotate(35deg); opacity: 0; }
          8%   { opacity: 0.95; }
          46%  { transform: translate(140%, 140%) rotate(35deg); opacity: 0; }
          100% { transform: translate(140%, 140%) rotate(35deg); opacity: 0; }
        }
        .consumable-shield-glint {
          position: absolute; top: -60%; left: -60%;
          width: 42%; height: 220%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(170,215,255,0.45), transparent);
          filter: blur(2px);
          animation: consumableShieldGlint 3.3s ease-in-out infinite;
        }

        @keyframes consumableSnowfall {
          0%   { transform: translateY(-25%) translateX(0); opacity: 0; }
          12%  { opacity: 0.95; }
          82%  { opacity: 0.85; }
          100% { transform: translateY(230%) translateX(5px); opacity: 0; }
        }
        .consumable-snowflake {
          position: absolute; top: 0; color: #eaf6ff; line-height: 1;
          text-shadow: 0 0 4px rgba(120,190,255,0.9);
          animation-name: consumableSnowfall;
          animation-timing-function: ease-in;
          animation-iteration-count: infinite;
        }

        @keyframes consumableXpFlame {
          0%   { transform: scaleY(0.7) scaleX(0.85); opacity: 0.55; }
          25%  { transform: scaleY(1.15) scaleX(1.05); opacity: 0.95; }
          50%  { transform: scaleY(0.82) scaleX(0.92); opacity: 0.68; }
          75%  { transform: scaleY(1.3) scaleX(1); opacity: 1; }
          100% { transform: scaleY(0.7) scaleX(0.85); opacity: 0.55; }
        }
        .consumable-xp-flame {
          width: 22px; height: 18px;
          border-radius: 50% 50% 45% 45%;
          background: radial-gradient(circle at 50% 65%, #fff2b8 0%, #ffb347 35%, #ff7b1c 65%, rgba(255,90,0,0) 100%);
          filter: blur(1.5px);
          transform-origin: 50% 100%;
          animation: consumableXpFlame 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
