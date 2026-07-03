// src/lib/icons.ts
import type { LucideIcon } from 'lucide-react'
import {
  Rocket, Target, Zap, Puzzle, Trophy, MessageCircle, Dices,
  UserRound, Sunrise, Moon, Globe2,
} from 'lucide-react'

/**
 * Central lookup for the string-keyed values that used to be rendered as
 * raw emoji (profiles.avatar, signup interest tags). Components look icons
 * up here instead of printing emoji directly, so there's one place to add
 * a new key going forward.
 */

/** profiles.avatar -> icon. Every account currently gets 'rocket' (the
 *  fixed default set by the on_auth_user_created trigger); the map stays
 *  open-ended in case a real avatar choice ever comes back. */
export const avatarIcons: Record<string, LucideIcon> = {
  rocket: Rocket,
}

export function getAvatarIcon(key: string): LucideIcon {
  return avatarIcons[key] ?? Rocket
}

/** Signup "what are you into?" interest tag -> icon. */
export const interestIcons: Record<string, LucideIcon> = {
  Strategy: Target,
  Action: Zap,
  Puzzle: Puzzle,
  Compete: Trophy,
  Social: MessageCircle,
  Casual: Dices,
}

/** profiles.gender -> icon, shown as an "info tag" pill under the avatar.
 *  Icon-only by design — no emoji. */
export const genderIcons: Record<string, LucideIcon> = {
  male: UserRound,
  female: UserRound,
  other: UserRound,
}

/** profiles.play_time -> icon. Picking a time renders its icon on the
 *  profile in place of text. */
export const playTimeIcons: Record<string, LucideIcon> = {
  morning: Sunrise,
  night: Moon,
}

/** Generic "country" info-tag icon (the country name itself is text;
 *  this just marks the tag visually). */
export const countryIcon: LucideIcon = Globe2

