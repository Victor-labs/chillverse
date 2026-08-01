// src/shared/components/Toast.tsx
// Minimal toast — no global provider needed. Each caller owns its own
// visible/message state and renders <Toast /> once; useToast() just gives
// a tiny helper to trigger + auto-dismiss it.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export interface ToastState {
  message: string
  icon: LucideIcon
  iconColor?: string
}

export function useToast(durationMs = 2600) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(state: ToastState) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(state)
    timerRef.current = setTimeout(() => setToast(null), durationMs)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { toast, showToast }
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  const Icon = toast.icon

  return createPortal(
    <div
      style={{
        position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        zIndex: 10000, display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)', boxShadow: 'var(--elev-raise)',
        border: '1px solid var(--border)', borderRadius: 14,
        padding: '11px 16px', maxWidth: '90vw',
        animation: 'toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      <Icon size={16} style={{ color: toast.iconColor ?? 'var(--text-dim)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{toast.message}</span>
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>,
    document.body,
  )
}
