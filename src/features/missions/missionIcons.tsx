// src/features/missions/missionIcons.tsx
//
// Every mission_definitions.icon value is now a lucide icon key (kebab-case)
// instead of an emoji — this registry resolves that key to a real vector
// icon component. Falls back to Sparkles for any key not yet mapped, so an
// unrecognized/future icon key never renders a blank box.
import type { LucideIcon } from 'lucide-react'
import {
  Home, MessageCircle, CalendarDays, Flag, PenLine, Brain, Gamepad2,
  LayoutGrid, Globe, Calculator, Trophy, Flame, Clapperboard, Tv, Image,
  Shirt, UserCheck, Pencil, Handshake, Medal, Swords, Shield, Mail, Gift,
  Gem, ShoppingBag, Palette, Zap, Heart, Rocket, CalendarCheck, Compass,
  Map, Bot, Share2, UserPlus, Award, TrendingUp, Newspaper, Star, Camera,
  Sparkles, PartyPopper, Move, Drama, Grid3X3, Eye, BookOpen, Target,
  Spade, Blocks, Layers, SquarePen, MessageSquare,
} from 'lucide-react'

export const MISSION_ICONS: Record<string, LucideIcon> = {
  home: Home,
  'message-circle': MessageCircle,
  'calendar-days': CalendarDays,
  flag: Flag,
  'pen-line': PenLine,
  brain: Brain,
  'gamepad-2': Gamepad2,
  'layout-grid': LayoutGrid,
  globe: Globe,
  calculator: Calculator,
  trophy: Trophy,
  flame: Flame,
  clapperboard: Clapperboard,
  tv: Tv,
  image: Image,
  shirt: Shirt,
  'user-check': UserCheck,
  pencil: Pencil,
  handshake: Handshake,
  medal: Medal,
  swords: Swords,
  shield: Shield,
  mail: Mail,
  gift: Gift,
  gem: Gem,
  'shopping-bag': ShoppingBag,
  palette: Palette,
  zap: Zap,
  heart: Heart,
  rocket: Rocket,
  'calendar-check': CalendarCheck,
  compass: Compass,
  map: Map,
  bot: Bot,
  'share-2': Share2,
  'user-plus': UserPlus,
  award: Award,
  'trending-up': TrendingUp,
  newspaper: Newspaper,
  star: Star,
  camera: Camera,
  'party-popper': PartyPopper,
  move: Move,
  drama: Drama,
  'grid-3x3': Grid3X3,
  eye: Eye,
  'book-open': BookOpen,
  target: Target,
  sparkles: Sparkles,
  spade: Spade,
  blocks: Blocks,
  layers: Layers,
  'square-pen': SquarePen,
  'message-square': MessageSquare,
}

export function getMissionIcon(key: string): LucideIcon {
  return MISSION_ICONS[key] ?? Sparkles
}

/** Renders a mission's icon at a given pixel size/color — small convenience
 *  wrapper so callers don't have to look up + instantiate the component. */
export function MissionIcon({ iconKey, size = 18, color }: { iconKey: string; size?: number; color?: string }) {
  const Icon = getMissionIcon(iconKey)
  return <Icon size={size} color={color} strokeWidth={2.25} />
}
