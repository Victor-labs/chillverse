// src/features/badges/BadgeNudge.tsx
//
// A small thought-bubble that points at another player's badge row the
// first time it's seen, hinting that badges can be tapped-and-held.
// Dismisses itself on tap, on its own after a few seconds, or the first
// time the player actually long-presses a badge row anywhere — whichever
// comes first — and never shows again after that (localStorage flag).
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cv_badge_nudge_seen'

export function hasSeenBadgeNudge(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return true }
}
export function markBadgeNudgeSeen(): void {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
}

export default function BadgeNudge({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(dismiss, 4200)
    return () => { cancelAnimationFrame(enter); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    markBadgeNudgeSeen()
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-4px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'absolute', top: -5, left: 14, width: 9, height: 9, background: 'rgba(28,28,32,0.98)', transform: 'rotate(45deg)', borderRadius: 2 }} />
      <div style={{
        background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(10px)', borderRadius: 12,
        padding: '8px 12px', boxShadow: 'var(--elev-popover)', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>Tap &amp; hold badges ✨</span>
      </div>
    </div>
  )
}
