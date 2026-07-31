// src/shared/lib/themes.ts
// Central theme registry. Accent stays constant across themes so branding
// (buttons, badges, links) never shifts — only surface/bg/text change.

export type ThemeId = 'white' | 'grey' | 'midnight' | 'aurora' | 'sunset' | 'emerald'

export interface ThemeDef {
  id: ThemeId
  label: string
  /** true if this theme requires Premium to select */
  locked: boolean
  /** small swatch preview shown in the picker — solid color or gradient */
  swatch: string
}

export const THEMES: ThemeDef[] = [
  { id: 'white',    label: 'White',    locked: false, swatch: '#f4f4f7' },
  { id: 'grey',     label: 'Grey',     locked: false, swatch: '#3a3a42' },
  { id: 'midnight', label: 'Midnight', locked: false, swatch: '#0a0a0c' },
  { id: 'aurora',   label: 'Aurora',   locked: true,  swatch: 'linear-gradient(135deg,#6c50ff,#00e5ff)' },
  { id: 'sunset',   label: 'Sunset',   locked: true,  swatch: 'linear-gradient(135deg,#ff4ecd,#ffb800)' },
  { id: 'emerald',  label: 'Emerald',  locked: true,  swatch: 'linear-gradient(135deg,#0d3b30,#00ff87)' },
]

export const DEFAULT_THEME: ThemeId = 'midnight'
export const THEME_STORAGE_KEY = 'chillverse-theme'

export function isValidTheme(value: string | null): value is ThemeId {
  return !!value && THEMES.some(t => t.id === value)
}

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME)!
}
