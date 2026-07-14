// src/layout/Logo.tsx
interface LogoProps {
  /** Rendered height in px. Width scales automatically to preserve the mark's aspect ratio. */
  size?: number
  className?: string
}

/**
 * The Chillverse "CV" brand mark — the official logo asset (public/logo.png),
 * rendered as a transparent PNG so it drops cleanly onto the app's dark surfaces.
 */
export default function Logo({ size = 34, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Chillverse"
      className={`inline-block shrink-0 object-contain select-none ${className}`}
      style={{ height: size, width: 'auto' }}
      draggable={false}
    />
  )
}
