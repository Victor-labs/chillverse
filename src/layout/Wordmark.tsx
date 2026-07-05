// src/layout/Wordmark.tsx
import type { CSSProperties } from 'react'

interface WordmarkProps {
  /** Base font size in px for the wordmark. Default 20 (nav-sized). */
  size?: number
  /** Whether the orbit accent spins (nav = true) or holds a fixed resting angle (footer = false, cheaper). */
  animated?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * The "Chillverse" wordmark — a custom lockup, not a plain gradient word.
 *
 * - "Chill" is set bold and tightly tracked; "verse" steps down a weight
 *   with slightly looser tracking, giving the mark two deliberate registers
 *   instead of one flat run of text.
 * - A small orbiting planet + ring sits above the final "e" — a literal,
 *   permanent nod to "universe" built into the mark itself, not a generic
 *   icon bolted on beside the word.
 * - A faint scattered star field sits behind the wordmark at very low
 *   opacity, reinforcing the theme without ever competing with legibility.
 */
export default function Wordmark({ size = 20, animated = true, className = '', style }: WordmarkProps) {
  const orbitSize = Math.round(size * 0.62)
  const planetSize = Math.max(2, Math.round(size * 0.11))

  return (
    <span className={`wordmark ${className}`} style={{ fontSize: size, ...style }}>
      <span className="wordmark-stars" aria-hidden="true">
        <i className="ws1" />
        <i className="ws2" />
        <i className="ws3" />
        <i className="ws4" />
      </span>

      <span className="wordmark-text">
        <span className="wordmark-chill">Chill</span>
        <span className="wordmark-verse">verse</span>

        <span
          className={`wordmark-orbit-wrap ${animated ? 'is-animated' : 'is-static'}`}
          style={{ width: orbitSize, height: orbitSize }}
          aria-hidden="true"
        >
          <span className="wordmark-ring" />
          <span className="wordmark-orbit-spin">
            <span className="wordmark-planet" style={{ width: planetSize, height: planetSize }} />
          </span>
        </span>
      </span>
    </span>
  )
}
