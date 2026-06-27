// src/components/NotificationToastRenderer.tsx
import { Bell, Trophy, Flame, UserPlus, Zap, Heart, Eye, Crown } from 'lucide-react'
import type React from 'react'
import { useNotificationToast } from '../hooks/useNotificationToast'
import type { ToastNotif } from '../hooks/useNotificationToast'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

const ICON_MAP: Record<string, LucideIcon> = {
  'user-plus':  UserPlus,
  'eye':        Eye,
  'heart':      Heart,
  'zap':        Zap,
  'crown':      Crown,
  'flame':      Flame,
  'trophy':     Trophy,
  'bell':       Bell,
}

function ToastItem({ toast, onDismiss }: { toast: ToastNotif; onDismiss: () => void }) {
  const Icon = ICON_MAP[toast.icon] ?? Bell
  return (
    <div
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '12px 16px',
        background: 'rgba(14,14,18,0.96)',
        border: `1px solid ${toast.color}40`,
        borderRadius: 16,
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${toast.color}18`,
        backdropFilter: 'blur(14px)',
        cursor: 'pointer',
        animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        maxWidth: 340,
        width: '100%',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${toast.color}18`,
        border: `1px solid ${toast.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: toast.color,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2, lineHeight: 1.3 }}>
          {toast.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toast.body}
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: '0 0 16px 16px', background: `${toast.color}30`, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: toast.color, animation: 'toastProgress 4s linear forwards' }} />
      </div>
    </div>
  )
}

export default function NotificationToastRenderer() {
  const { toasts, dismiss } = useNotificationToast()

  if (toasts.length === 0) return null

  return (
    <>
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto', position: 'relative' }}>
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(60px) scale(0.9); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </>
  )
}
