// src/features/badges/ProBadge.tsx
//
// The evolving Orbit/Void loyalty badge (Discord-Nitro-style). Color is
// driven entirely by profiles.pro_badge_color (server-computed — see
// migration 0056_pro_evolving_badge / credit_pro_period()), based on
// LIFETIME CUMULATIVE months of Pro membership across both tiers, never
// resetting on a lapse or tier switch:
//   Blue 0mo · Indigo 3mo · Holo 6mo · Green 12mo · Gold 24mo · Red 36mo
//
// The badge LABEL (not the color) always reflects whichever tier is
// currently active — "Orbit member since {date}" or "Void member since
// {date}" — where {date} is pro_first_subscribed_at (when they first
// ever went Pro, not when they hit the current color).
//
// Tapping the badge reuses BadgeToast via its customIcon/colorOverride
// escape hatch, same pattern as the rank-tier tap.
import { useState } from 'react'
import BadgeToast from './BadgeToast'

export type ProBadgeColor = 'blue' | 'indigo' | 'holo' | 'green' | 'gold' | 'red'

const BADGE_GLOW: Record<ProBadgeColor, string> = {
  blue: '#4f8ef7', indigo: '#6d5bff', holo: '#c9a7ff',
  green: '#3ecf8e', gold: '#f5c542', red: '#ff5c5c',
}

export function proBadgeSrc(color: ProBadgeColor | string | null | undefined): string {
  const c: ProBadgeColor = (color as ProBadgeColor) ?? 'blue'
  return `/pro-badges/orbit-badge-${c}.png`
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function ProBadge({
  tier, color, memberSince, size = 32,
}: {
  /** Current active tier — controls only the label text, not the icon color. */
  tier: 'orbit' | 'void'
  color: ProBadgeColor | string | null | undefined
  /** profiles.pro_first_subscribed_at */
  memberSince: string | null
  size?: number
}) {
  const [toast, setToast] = useState(false)
  const c: ProBadgeColor = (color as ProBadgeColor) ?? 'blue'
  const label = tier === 'void' ? 'Void' : 'Orbit'
  const title = memberSince ? `${label} member since ${formatMemberSince(memberSince)}` : `${label} member`

  return (
    <>
      <button
        type="button"
        onClick={() => setToast(true)}
        title={title}
        aria-label={title}
        style={{
          width: size, height: size, padding: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img src={proBadgeSrc(c)} alt={label} width={size} height={size} style={{ display: 'block' }} />
      </button>

      {toast && (
        <BadgeToast
          title={title}
          icon=""
          rarity=""
          colorOverride={BADGE_GLOW[c]}
          customIcon={<img src={proBadgeSrc(c)} alt={label} width={18} height={18} />}
          onDone={() => setToast(false)}
        />
      )}
    </>
  )
}
