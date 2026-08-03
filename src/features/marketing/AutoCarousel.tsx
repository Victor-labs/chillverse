// src/features/marketing/AutoCarousel.tsx
// Generic auto-advancing, swipeable single-slide-at-a-time carousel.
// Same drag/auto-advance mechanics as games/HeroSlider.tsx, but content-
// agnostic (renderSlide) so it can host either plain text cards (History)
// or image cards with a tap-for-details overlay (Events) — see About.tsx.
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'

const TRANSITION_MS = 500

export default function AutoCarousel<T>({
  items,
  renderSlide,
  intervalMs = 5000,
  heightClassName = 'h-[280px] sm:h-[300px]',
  className = '',
  onSlideTap,
}: {
  items: T[]
  renderSlide: (item: T, index: number, active: boolean) => ReactNode
  intervalMs?: number
  /** Fixed slide height — needed since slides are absolutely stacked/flexed, not natural-height. */
  heightClassName?: string
  className?: string
  /** Fires on pointerup when the pointer barely moved — i.e. a tap, not a
   *  swipe — on the currently-active slide. Lets a slide react to "tap for
   *  details" without fighting the carousel's own drag-to-swipe handling. */
  onSlideTap?: (index: number, item: T) => void
}) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const movedRef = useRef(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (items.length <= 1) return
    timerRef.current = setInterval(() => setIndex(i => (i + 1) % items.length), intervalMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [items.length, intervalMs])

  function pauseAuto() {
    if (timerRef.current) clearInterval(timerRef.current)
  }
  function resumeAuto() {
    pauseAuto()
    if (items.length <= 1) return
    timerRef.current = setInterval(() => setIndex(i => (i + 1) % items.length), intervalMs)
  }

  function onPointerDown(e: ReactPointerEvent) {
    draggingRef.current = true
    movedRef.current = false
    startXRef.current = e.clientX
    pauseAuto()
    trackRef.current?.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!draggingRef.current) return
    const delta = e.clientX - startXRef.current
    if (Math.abs(delta) > 6) movedRef.current = true
    setDragOffset(delta)
  }
  function onPointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    const width = trackRef.current?.clientWidth || 1
    const threshold = width * 0.18
    if (dragOffset < -threshold) setIndex(i => (i + 1) % items.length)
    else if (dragOffset > threshold) setIndex(i => (i - 1 + items.length) % items.length)
    else if (!movedRef.current) onSlideTap?.(index, items[index])
    setDragOffset(0)
    resumeAuto()
  }

  const width = trackRef.current?.clientWidth || 0
  const basePct = -index * 100
  const dragPct = width ? (dragOffset / width) * 100 : 0

  if (items.length === 0) return null

  return (
    <div className={className}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative overflow-hidden ${heightClassName}`}
        style={{ touchAction: 'pan-y', cursor: items.length > 1 ? 'grab' : 'default' }}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(${basePct + dragPct}%)`,
            transition: draggingRef.current ? 'none' : `transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
          }}
        >
          {items.map((item, i) => (
            <div key={i} className="w-full h-full flex-shrink-0">
              {renderSlide(item, i, i === index)}
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => { setIndex(i); resumeAuto() }}
              className="p-0 border-none cursor-pointer transition-all duration-300 rounded-full"
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                background: i === index ? 'var(--violet-soft)' : 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
