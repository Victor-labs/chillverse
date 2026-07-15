// src/features/admin/AdminDrawer.tsx
// Generic "shell" used for every admin drill-down. Drawers stack — opening
// a second AdminDrawer while one is already open renders on top of it with
// a slightly higher z-index, which is what lets "Total Users" open a list
// and a row in that list open a detail view without either replacing the
// other. Styled with the app's neumorphic shell so every drill-down reads
// as one connected dashboard surface rather than a glass-blue sheet. Kept intentionally dumb
// (title
// + back + content) so every future drill-down (economy, games, event
// schedule, etc.) can reuse it as-is.
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
        position: 'fixed', inset: 0,
        background: depth === 0 ? 'rgba(10,10,12,0.72)' : 'transparent',
        zIndex: 200 + depth * 10, display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={depth === 0 ? onClose : undefined}
    >
      <div
        className="neu-card"
        style={{
          width: '100%', maxWidth: 540, height: '100%', borderRadius: 0,
          marginLeft: depth * 30, boxShadow: '-10px 0 28px var(--neu-dark), inset 1px 0 0 rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--surface)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
            background: 'var(--surface)',
          }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9,
                color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 7, flexShrink: 0,
              }}
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em',
            }}>
              {title}
            </p>
            {subtitle && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9,
              color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 7, flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
