// src/shared/lib/useLongPress.ts
//
// Generic tap-hold detector. Fires `onLongPress` with the press
// coordinates (for positioning a context menu near the finger) after
// `delayMs` of continuous contact, as long as the pointer hasn't moved
// past `moveTolerance`. A normal tap that releases before the delay is
// left alone — pass it through to whatever onClick the element already
// has; this hook only ever prevents the *long*-press case from also
// firing a click.
import { useRef } from 'react'

const DEFAULT_DELAY = 480
const MOVE_TOLERANCE = 10

export function useLongPress(onLongPress: (x: number, y: number) => void, delayMs = DEFAULT_DELAY) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  function clear() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }

  function begin(x: number, y: number) {
    fired.current = false
    start.current = { x, y }
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress(x, y)
    }, delayMs)
  }

  function move(x: number, y: number) {
    if (!start.current) return
    const dx = Math.abs(x - start.current.x)
    const dy = Math.abs(y - start.current.y)
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clear()
  }

  return {
    // Set on the element alongside its existing onClick — call
    // `wasLongPress()` at the top of that onClick and return early if true,
    // so the long-press doesn't also register as a tap.
    wasLongPress: () => fired.current,
    handlers: {
      onTouchStart: (e: React.TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY),
      onTouchMove: (e: React.TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY),
      onTouchEnd: clear,
      onMouseDown: (e: React.MouseEvent) => begin(e.clientX, e.clientY),
      onMouseMove: (e: React.MouseEvent) => move(e.clientX, e.clientY),
      onMouseUp: clear,
      onMouseLeave: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  }
}
