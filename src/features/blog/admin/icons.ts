// src/features/blog/admin/icons.ts
// Small, curated icon set for admin-managed blog categories. Category rows
// store the icon as a name string (blog_categories.icon); this maps that
// name back to a component for the CMS UI. Falls back to BookOpen for any
// unrecognized name (e.g. if an icon is ever renamed/removed from the set).
import {
  Gamepad2, Users, Building2, BookOpen, ShieldCheck, Megaphone, Star, Heart,
  Trophy, Newspaper, Rocket, Sparkles, Flag, Palette, Music, Camera, Coffee, Globe,
  type LucideIcon,
} from 'lucide-react'

export const BLOG_ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Users', icon: Users },
  { name: 'Building2', icon: Building2 },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'Megaphone', icon: Megaphone },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Trophy', icon: Trophy },
  { name: 'Newspaper', icon: Newspaper },
  { name: 'Rocket', icon: Rocket },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Flag', icon: Flag },
  { name: 'Palette', icon: Palette },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Coffee', icon: Coffee },
  { name: 'Globe', icon: Globe },
]

const ICON_MAP = new Map(BLOG_ICON_OPTIONS.map(o => [o.name, o.icon]))

export function getBlogIconComponent(name: string | null | undefined): LucideIcon {
  return (name && ICON_MAP.get(name)) || BookOpen
}

export const CATEGORY_COLOR_OPTIONS = [
  '#4C8EF5', '#F565A8', '#7C66FF', '#39C67B', '#F55A5A', '#F5A623', '#22C3D6', '#B084F0',
]
