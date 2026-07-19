// src/features/badges/BadgeToast.tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BadgeIcon } from './badgeIcons'
import { BADGE_RARITY_COLOR } from './badges'

// A small "notification-style" toast, but anchored to the TOP of the
// screen (not the bottom, like MiniToast) and shorter. Slides down on
// mount, auto-dismisses after ~2.6s, and can be swiped up to dismiss
// early. Shows only the badge icon + name — nothing else.
export default function BadgeToast({
  title, icon, rarity, onDone, colorOverride, customIcon,
}: {
  title: string
  // icon/rarity stay required for every existing (real badge) caller.
  // colorOverride/customIcon are optional escape hatches so the rank
  // tap can reuse this exact same toast — its own tier color and emoji
  // — without touching how any badge toast looks or behaves.
  icon: string
  rarity: string
  onDone: () => void
  colorOverride?: string
  customIcon?: React.ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const [entered, setEntered] = useState(false)
  const startY = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const enter = requestAnimationFrame(() => setEntered(true))
    timerRef.current = setTimeout(() => close(), 2600)
    return () => { cancelAnimationFrame(enter); if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDismissing(true)
    setTimeout(onDone, 220)
  }

  function handleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
    if (timerRef.current) clearTimeout(timerRef.current)
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    setDragY(Math.min(0, delta)) // only allow dragging up
  }
  function handleTouchEnd() {
    if (dragY < -30) { close(); return }
    setDragY(0)
    timerRef.current = setTimeout(() => close(), 1600)
  }

  const color = colorOverride ?? BADGE_RARITY_COLOR[rarity] ?? '#888899'
  const translateY = dismissing ? -120 : entered ? dragY : -120

  return createPortal(
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', top: 14, left: '50%',
        transform: `translate(-50%, 0) translateY(${translateY}px)`,
        zIndex: 20500, display: 'flex', alignItems: 'center', gap: 9,
        padding: '10px 16px 10px 12px', borderRadius: 16,
        background: 'rgba(20,20,24,0.96)', border: `1px solid ${color}55`,
        boxShadow: 'var(--elev-raise)', backdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap', transition: dragY === 0 && !dismissing ? 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' : dismissing ? 'transform 0.22s ease-in' : 'none',
        touchAction: 'none',
      }}
    >
      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '20' }}>
        {customIcon ?? <BadgeIcon iconKey={icon} size={14} color={color} />}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{title}</span>
    </div>,
    document.body,
  )
}
