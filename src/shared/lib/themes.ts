// src/shared/lib/themes.ts
// Central theme registry. Accent stays constant across themes so branding
// (buttons, badges, links) never shifts — only surface/bg/text change.

export type ThemeId =
  | 'white' | 'grey' | 'midnight'
  | 'aurora' | 'sunset' | 'emerald'
  | 'morning-dew' | 'sakura' | 'peach' | 'lilac' | 'velvet' | 'cocoa'

export interface ThemeDef {
  id: ThemeId
  label: string
  /** true if this theme requires Premium to select */
  locked: boolean
  /** small swatch preview shown in the picker — solid color or gradient */
  swatch: string
}

export const THEMES: ThemeDef[] = [
  // Free
  { id: 'white',    label: 'White',    locked: false, swatch: '#f4f4f7' },
  { id: 'grey',     label: 'Grey',     locked: false, swatch: '#3a3a42' },
  { id: 'midnight', label: 'Midnight', locked: false, swatch: '#0a0a0c' },
  // Void — colored light
  { id: 'aurora',   label: 'Aurora',   locked: true,  swatch: 'linear-gradient(135deg,#6c50ff,#00e5ff)' },
  { id: 'sunset',   label: 'Sunset',   locked: true,  swatch: 'linear-gradient(135deg,#ff4ecd,#ffb800)' },
  { id: 'emerald',  label: 'Emerald',  locked: true,  swatch: 'linear-gradient(135deg,#0d3b30,#00ff87)' },
  // Void — pastel washes (light themes)
  { id: 'morning-dew', label: 'Morning Dew', locked: true, swatch: 'linear-gradient(180deg,#d6f5b4,#b9f0fb)' },
  { id: 'sakura',      label: 'Sakura',      locked: true, swatch: 'linear-gradient(180deg,#ffd9e8,#fff1f0)' },
  { id: 'peach',       label: 'Peach',       locked: true, swatch: 'linear-gradient(180deg,#ffe3cc,#fffaf0)' },
  { id: 'lilac',       label: 'Lilac',       locked: true, swatch: 'linear-gradient(180deg,#e9dcff,#eaf0ff)' },
  // Void — deep tones
  { id: 'velvet',   label: 'Velvet',   locked: true,  swatch: 'linear-gradient(135deg,#200b19,#e2408f)' },
  { id: 'cocoa',    label: 'Cocoa',    locked: true,  swatch: 'linear-gradient(135deg,#1f1712,#d69656)' },
]

export const DEFAULT_THEME: ThemeId = 'midnight'
export const THEME_STORAGE_KEY = 'chillverse-theme'

export function isValidTheme(value: string | null): value is ThemeId {
  return !!value && THEMES.some(t => t.id === value)
}

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME)!
}
