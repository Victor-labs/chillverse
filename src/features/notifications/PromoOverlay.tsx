// src/components/PromoOverlay.tsx
//
// Lightweight promo/announcement modal — same shape as IncomingChallengeOverlay
// (fixed dim overlay -> centered card -> media banner -> content -> button),
// with the gradient "badge" highlight style borrowed from the notification demo.
//
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export interface PromoNotification {
  id: string
  videoUrl?: string
  imageUrl?: string // static image alternative to videoUrl — used by image-only promos
  title: string
  // Body text with one word/phrase to bold — split into before/highlight/after
  bodyBefore: string
  bodyHighlight: string
  bodyAfter: string
  badgeText: string // 'NEW' | 'TAP'
  ctaLabel?: string
  dismissLabel?: string // defaults to 'Later'
  onCta?: () => void
}

interface Props {
  notification: PromoNotification
  onDismiss: () => void
}

export default function PromoOverlay({ notification, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  function handleCta() {
    notification.onCta?.()
    handleDismiss()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={handleDismiss}
    >
      {/* Small box: the card itself */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340,
          background: 'var(--surface2)',
          borderRadius: 24,
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--elev-popover)',
          overflow: 'hidden',
          position: 'relative',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(20px)',
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Big box: video banner */}
        <div style={{
          width: '100%', height: 180, position: 'relative', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          <video
            src={notification.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: notification.imageUrl ? 'none' : 'block' }}
          />
          {notification.imageUrl && (
            <img
              src={notification.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.55))',
          }} />

          {/* Gradient badge — highlight style borrowed from notification demo */}
          <span
            style={{
              position: 'absolute',
              top: 12, left: 12,
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '5px 11px',
              borderRadius: 999,
              textTransform: 'uppercase',
            }}
          >
            {notification.badgeText}
          </span>

          {/* Dismiss */}
          <button onClick={handleDismiss} style={{
            position: 'absolute', top: 12, right: 12,
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,0,0,0.5)', border: 'none',
            cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} />
          </button>
        </div>

        {/* Text + buttons */}
        <div style={{ padding: '18px 20px 20px' }}>
          <h2 style={{
            margin: '0 0 8px',
            color: 'var(--text)',
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.3,
          }}>
            {notification.title}
          </h2>

          <p style={{
            margin: '0 0 18px',
            color: 'var(--text-dim)',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            {notification.bodyBefore}
            <span style={{ color: 'var(--text)', fontWeight: 800 }}>
              {notification.bodyHighlight}
            </span>
            {notification.bodyAfter}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleDismiss} style={{
              flex: 1, padding: '12px 0', borderRadius: 13,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)', color: 'var(--text-dim)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {notification.dismissLabel ?? 'Later'}
            </button>
            <button onClick={handleCta} style={{
              flex: 2, padding: '12px 0', borderRadius: 13,
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>
              {notification.ctaLabel ?? 'Tap to view'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
