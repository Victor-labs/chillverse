// src/shared/components/Avatar.tsx
//
// Central avatar renderer used everywhere a user's profile picture shows up.
// Always renders SOMETHING: a real image if we have one and it loads, and a
// deterministic letter+colour fallback otherwise (no avatar set, broken URL,
// failed fetch, etc). Also optionally wires taps into the global profile
// preview overlay (see src/context/ProfilePreview.tsx) — pass a `userId` and
// it "just works" unless you supply your own onClick.
import { useState, useEffect } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { useProfilePreviewOptional } from '../../context/ProfilePreview'

// A handful of Discord-like gradient pairs. Picked deterministically from
// the user's id/name so the same person always gets the same colour.
const PALETTES: Array<[string, string]> = [
  ['var(--accent)', 'var(--accent2)'], // accent (brand default)
  ['#7c5cff', '#4d8dff'], // purple/blue
  ['#ff4d8b', '#ff8fb3'], // pink
  ['#3ecf8e', '#2fa8ff'], // green/blue
  ['#f5c542', '#ff8a3c'], // gold
  ['#4d8dff', '#3ecf8e'], // blue/green
  ['#a855f7', '#ec4899'], // violet/pink
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function paletteFor(seed: string): [string, string] {
  if (!seed) return PALETTES[0]
  return PALETTES[hashString(seed) % PALETTES.length]
}

function initialFor(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export interface AvatarProps {
  /** The stored avatar value — may be a real URL, an empty string, or null/undefined. */
  src?: string | null
  /** Display name / username used for the letter fallback + colour seed. */
  name: string
  /** If provided (and onClick isn't), tapping the avatar opens the quick profile preview. */
  userId?: string | null
  size?: number
  /** Border radius — defaults to a Discord-style rounded-square (28% of size). */
  radius?: number | string
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLDivElement>) => void
  style?: CSSProperties
  className?: string
  disabled?: boolean
  ring?: string
}

export default function Avatar({
  src, name, userId, size = 40, radius, onClick, style, className, disabled, ring,
}: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const preview = useProfilePreviewOptional()

  // Reset "broken" state if the src changes (e.g. after an upload).
  useEffect(() => { setBroken(false) }, [src])

  const isUrl = !!src && /^https?:\/\//.test(src)
  const hasImage = isUrl && !broken
  const isEmojiGlyph = !!src && !isUrl // e.g. equipped avatar items stored as a literal emoji/glyph
  const [c1, c2] = paletteFor(userId || name || '')
  const rad = radius ?? Math.round(size * 0.28)

  const commonStyle: CSSProperties = {
    width: size, height: size, borderRadius: rad, flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: Math.max(11, Math.round(size * 0.42)), color: '#fff',
    background: (hasImage || isEmojiGlyph) ? undefined : `linear-gradient(135deg, ${c1}, ${c2})`,
    border: ring ? `2px solid ${ring}` : 'none',
    ...style,
  }

  const content = hasImage ? (
    <img
      src={src as string}
      alt={name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      onError={() => setBroken(true)}
    />
  ) : isEmojiGlyph ? (
    <span>{src}</span>
  ) : (
    <span>{initialFor(name)}</span>
  )

  const handleClick = onClick ?? (userId
    ? (e: MouseEvent<HTMLButtonElement | HTMLDivElement>) => { e.stopPropagation(); preview?.openProfilePreview(userId) }
    : undefined)

  if (handleClick && !disabled) {
    return (
      <button
        type="button"
        className={className}
        onClick={handleClick}
        style={{ ...commonStyle, padding: 0, cursor: 'pointer' }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} style={commonStyle}>
      {content}
    </div>
  )
}
