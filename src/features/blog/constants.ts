// src/features/blog/constants.ts
import type { LucideIcon } from 'lucide-react'
import { Gamepad2, Users, Building2, BookOpen, ShieldCheck } from 'lucide-react'
import type { BlogCategory, BlogLocale } from '../../shared/types'

export interface BlogCategoryMeta {
  slug: BlogCategory
  label: string
  icon: LucideIcon
  color: string
}

/** Ordered for display — this order drives the category tab bar. */
export const BLOG_CATEGORIES: BlogCategoryMeta[] = [
  { slug: 'game-updates',        label: 'Game Updates',        icon: Gamepad2,  color: 'var(--blue)' },
  { slug: 'community-spotlight', label: 'Community Spotlight', icon: Users,     color: 'var(--pink)' },
  { slug: 'chillverse-hq',       label: 'Chillverse HQ',       icon: Building2, color: 'var(--accent)' },
  { slug: 'how-to',              label: 'How-To',              icon: BookOpen,  color: 'var(--green)' },
  { slug: 'safety',              label: 'Safety',              icon: ShieldCheck, color: 'var(--red)' },
]

const CATEGORY_BY_SLUG = new Map(BLOG_CATEGORIES.map(c => [c.slug, c]))

export function getBlogCategoryMeta(category: BlogCategory): BlogCategoryMeta {
  return CATEGORY_BY_SLUG.get(category) ?? BLOG_CATEGORIES[0]
}

export const BLOG_LOCALES: { code: BlogLocale; label: string; shortLabel: string }[] = [
  { code: 'en',  label: 'English', shortLabel: 'EN' },
  { code: 'pcm', label: 'Pidgin',  shortLabel: 'PCM' },
]

export const BLOG_LOCALE_STORAGE_KEY = 'cv_blog_locale'

/** Human-readable label for a series slug (falls back to a title-cased version of the slug). */
const SERIES_LABELS: Record<string, string> = {
  'update-log': 'Update Log',
  'top-of-the-ladder': 'Top of the Ladder',
  'streak-spotlight': 'Streak Spotlight',
}

export function getSeriesLabel(series: string): string {
  return SERIES_LABELS[series] ?? series
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const BLOG_PAGE_SIZE = 9
