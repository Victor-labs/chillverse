// src/features/clubs/clubIcons.tsx
// Clubs get one of these 10 icons, assigned randomly and permanently by
// create_club() server-side (see 0085_club_icon_random_lucide.sql) — not
// user-chosen, no uploaded art. Keep this list's keys in sync with the
// v_icons array in that migration if it's ever changed.

import { Rocket, Star, Flame, Crown, Gamepad2, Music, Heart, Sparkles, Trophy, Moon, type LucideIcon } from 'lucide-react'

export const CLUB_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  star: Star,
  flame: Flame,
  crown: Crown,
  gamepad: Gamepad2,
  music: Music,
  heart: Heart,
  sparkles: Sparkles,
  trophy: Trophy,
  moon: Moon,
}

interface ClubIconProps {
  iconKey: string | null
  size?: number
}

export default function ClubIcon({ iconKey, size = 18 }: ClubIconProps) {
  const Icon = (iconKey && CLUB_ICONS[iconKey]) || Sparkles
  return <Icon size={size} />
}
