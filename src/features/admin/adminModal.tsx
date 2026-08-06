// src/features/admin/adminModal.tsx
//
// Shared modal shell + form field styles used across the admin ops
// console (AdminOpsPanel.tsx, StatusOpsSection.tsx, and any future
// sections). Pulled out of AdminOpsPanel.tsx so sub-sections can import
// this without creating a circular dependency back on AdminOpsPanel.tsx
// itself.
import { X } from 'lucide-react'

export function Modal({ title, onClose, children, width = 380 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }`}</style>
      <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 22, width: '100%', maxWidth: width, maxHeight: '82vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', animation: 'popIn 0.22s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 6px' }
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none',
}
