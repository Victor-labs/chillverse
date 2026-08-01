// src/features/games/HeroSlider.tsx
// 6-slide hero carousel for Games Home. Auto-advances every 4.5s, pauses
// while the user is actively dragging, and resumes after. Swipeable by
// touch/pointer drag as well.
import { useEffect, useRef, useState } from 'react'
import { ripple } from '../../shared/lib/ripple'

export interface SlideDef {
  img: string
  tag: string
  header: string
  text: string
  buttonLabel: string
  onAction: () => void
}

const AUTO_ADVANCE_MS = 4500
const TRANSITION_MS = 500

export default function HeroSlider({ slides }: { slides: SlideDef[] }) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex(i => (i + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [slides.length])

  function pauseAuto() {
    if (timerRef.current) clearInterval(timerRef.current)
  }
  function resumeAuto() {
    pauseAuto()
    timerRef.current = setInterval(() => setIndex(i => (i + 1) % slides.length), AUTO_ADVANCE_MS)
  }

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true
    startXRef.current = e.clientX
    pauseAuto()
    trackRef.current?.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    setDragOffset(e.clientX - startXRef.current)
  }
  function onPointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    const width = trackRef.current?.clientWidth || 1
    const threshold = width * 0.18
    if (dragOffset < -threshold) setIndex(i => (i + 1) % slides.length)
    else if (dragOffset > threshold) setIndex(i => (i - 1 + slides.length) % slides.length)
    setDragOffset(0)
    resumeAuto()
  }

  const width = trackRef.current?.clientWidth || 0
  const basePct = -index * 100
  const dragPct = width ? (dragOffset / width) * 100 : 0

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20,
          aspectRatio: '16/9', touchAction: 'pan-y', cursor: 'grab',
        }}
      >
        <div
          style={{
            display: 'flex', height: '100%',
            transform: `translateX(${basePct + dragPct}%)`,
            transition: draggingRef.current ? 'none' : `transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
          }}
        >
          {slides.map((s, i) => (
            <div key={i} style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
              <img
                src={s.img}
                alt={s.header}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.1) 60%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 18,
              }}>
                <span style={{
                  alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                  textTransform: 'uppercase', color: '#fff', background: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '3px 9px', marginBottom: 8,
                  backdropFilter: 'blur(4px)',
                }}>
                  {s.tag}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{s.header}</h2>
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', margin: '0 0 14px', lineHeight: 1.4, maxWidth: 320 }}>{s.text}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); ripple(e); s.onAction() }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    alignSelf: 'flex-start', background: 'var(--accent, #3ecf8e)', color: '#06251a',
                    fontWeight: 800, fontSize: 12.5, border: 'none', borderRadius: 12,
                    padding: '9px 18px', cursor: 'pointer',
                  }}
                >
                  {s.buttonLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => { setIndex(i); resumeAuto() }}
            style={{
              width: i === index ? 16 : 6, height: 6, borderRadius: 4, border: 'none',
              background: i === index ? 'var(--accent, #3ecf8e)' : 'var(--surface2)',
              cursor: 'pointer', transition: 'width 0.25s, background 0.25s', padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}
