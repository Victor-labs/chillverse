// src/features/badges/BadgeContextMenu.tsx
//
// The tiny popup that appears at the finger after a tap-hold on someone's
// badge row. Only one option today ("View badges"), but built as a list
// so more can be added later without changing the call site.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'

export default function BadgeContextMenu({
  x, y, onViewBadges, onClose,
}: {
  x: number
  y: number
  onViewBadges: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [onClose])

  // Keep it on screen — flip above the finger if it would run off the
  // bottom, and clamp horizontally so it never clips off either edge.
  const menuWidth = 168
  const left = Math.min(Math.max(x - menuWidth / 2, 12), window.innerWidth - menuWidth - 12)
  const openUpward = y > window.innerHeight - 120
  const top = openUpward ? y - 54 : y + 14

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20400 }}>
      <div
        ref={ref}
        style={{
          position: 'fixed', left, top, width: menuWidth,
          background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(10px)',
          borderRadius: 14, border: '1px solid var(--border-strong)',
          boxShadow: 'var(--elev-popover)', overflow: 'hidden',
          animation: 'badgeMenuPop 0.15s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <button
          type="button"
          onClick={() => { onClose(); onViewBadges() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 14px', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Sparkles size={14} color="var(--text)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>View badges</span>
        </button>
      </div>
      <style>{`@keyframes badgeMenuPop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>,
    document.body,
  )
}
