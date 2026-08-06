// src/features/clubs/clubIcons.tsx
// Clubs get a random lucide icon by default (assigned server-side in
// create_club, see icon_key). Phase 4 added real image uploads — when a
// club has icon_url set (uploaded at creation, storage bucket
// 'club-icons'), that image is shown instead. icon_key stays as the
// fallback for clubs that never uploaded one.

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
  iconUrl?: string | null
  size?: number
}

export default function ClubIcon({ iconKey, iconUrl, size = 18 }: ClubIconProps) {
  if (iconUrl) {
    return <img src={iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
  }
  const Icon = (iconKey && CLUB_ICONS[iconKey]) || Sparkles
  return <Icon size={size} />
}
