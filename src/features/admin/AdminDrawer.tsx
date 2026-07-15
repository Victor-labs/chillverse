// src/features/admin/AdminDrawer.tsx
// Generic "shell" used for every admin drill-down. Drawers stack — opening
// a second AdminDrawer while one is already open renders on top of it with
// a slightly higher z-index, which is what lets "Total Users" open a list
// and a row in that list open a detail view without either replacing the
// other. Kept intentionally dumb (title + back + content) so every future
// drill-down (economy, games, event schedule, etc.) can reuse it as-is.
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'

interface AdminDrawerProps {
  open: boolean
  title: string
  subtitle?: string
  /** Stack depth — 0 for the first drawer opened, 1 for one opened on top
   *  of it, etc. Only affects z-index and horizontal inset so nested
   *  drawers read as "further in" rather than fully covering the parent. */
  depth?: number
  onClose: () => void
  /** Present only on nested drawers — goes back to the parent shell
   *  instead of closing everything. */
  onBack?: () => void
  children: ReactNode
}

export default function AdminDrawer({ open, title, subtitle, depth = 0, onClose, onBack, children }: AdminDrawerProps) {
  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: depth === 0 ? 'rgba(0,0,0,0.55)' : 'transparent',
        zIndex: 200 + depth * 10, display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={depth === 0 ? onClose : undefined}
    >
      <div
        className="neu-card"
        style={{
          width: '100%', maxWidth: 520, height: '100%', borderRadius: 0,
          marginLeft: depth * 28, boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4 }}
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
            {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4 }}
          >
            <X size={17} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
