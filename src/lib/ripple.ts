// src/lib/ripple.ts
import type { MouseEvent } from 'react'

export function ripple(e: MouseEvent<HTMLElement>): void {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2

  const span = document.createElement('span')
  span.className = 'ripple-dot'
  span.style.width = `${size}px`
  span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`

  const computedStyle = window.getComputedStyle(target)
  if (computedStyle.position === 'static') target.style.position = 'relative'
  if (computedStyle.overflow === 'visible') target.style.overflow = 'hidden'

  target.appendChild(span)
  setTimeout(() => span.remove(), 600)
}
