// src/features/badges/badgeIcons.tsx
import {
  Laptop, Gift, Target, Compass, UserCircle2, Sparkles,
  Shield, Star, Crown, BadgeCheck, Megaphone, Orbit, Moon, Gem,
  HandMetal, Anchor, Medal,
} from 'lucide-react'
import type React from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

// Map icon key strings (stored in badges.icon) → Lucide components.
// Add new keys here whenever a new badge is introduced.
export const BADGE_ICON_MAP: Record<string, LucideIcon> = {
  'laptop': Laptop,
  'gift': Gift,
  'target': Target,
  'compass': Compass,
  'user-circle': UserCircle2,
  // Reserved for future manually-assigned badges (Admin, Founder, Verified, etc.)
  'shield': Shield,
  'star': Star,
  'crown': Crown,
  'badge-check': BadgeCheck,
  'megaphone': Megaphone,
  'orbit': Orbit,
  'moon': Moon,
  'gem': Gem,
  // Leaderboard / artifacts badges
  'hand-metal': HandMetal,
  'anchor': Anchor,
  'medal': Medal,
}

export function BadgeIcon({ iconKey, size = 16, color }: { iconKey: string; size?: number; color?: string }) {
  const Icon = BADGE_ICON_MAP[iconKey] ?? Sparkles
  return <Icon size={size} style={color ? { color } : undefined} />
}
