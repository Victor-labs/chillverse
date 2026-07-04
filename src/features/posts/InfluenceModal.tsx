// src/features/posts/InfluenceModal.tsx
import { createPortal } from 'react-dom'
import { X, Sparkles } from 'lucide-react'

export default function InfluenceModal({
  open, onClose, authorName, influence,
}: {
  open: boolean
  onClose: () => void
  authorName: string
  influence: number
}) {
  if (!open) return null

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}
      onClick={onClose}
    >
      <div
        className="neu-card"
        style={{ width: '100%', maxWidth: 320, padding: 22, textAlign: 'center', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>

        <div style={{
          width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
          background: 'rgba(245,197,66,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={22} color="var(--gold)" />
        </div>

        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
          {authorName} has {influence} Influence
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
          Activities on posts increases Influence. Posts with more Influence has high filter priority.
        </p>
      </div>
    </div>,
    document.body,
  )
}
