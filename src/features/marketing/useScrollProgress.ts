import { useEffect, type RefObject } from 'react'

/**
 * Tracks scroll progress (0 → 1) through a tall "pinned" container.
 *
 * Progress is 0 while the container's top is at (or below) the viewport
 * top, and eases to 1 as the container's bottom approaches the viewport
 * bottom — i.e. it measures how far the user has scrolled through the
 * container's own extra height, not the whole page.
 *
 * `onProgress` fires on scroll and resize (passive listeners), and once
 * on mount to set the initial value.
 */
export function useScrollProgress(
  containerRef: RefObject<HTMLDivElement | null>,
  onProgress: (progress: number) => void
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const compute = () => {
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      if (total <= 0) {
        onProgress(0)
        return
      }
      const scrolled = -rect.top
      const progress = Math.min(1, Math.max(0, scrolled / total))
      onProgress(progress)
    }

    compute()
    window.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [containerRef, onProgress])
}
