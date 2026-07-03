// src/components/NotificationToastRenderer.tsx
import { useRef, useState } from 'react'
import { Bell, Trophy, Flame, UserPlus, Zap, Heart, Eye, Crown, Fan, MessageCircle, Spade, Image, Brain, Wifi, CirclePlay } from 'lucide-react'
import type React from 'react'
import { useNotificationToast } from './useNotificationToast'
import type { ToastNotif } from './useNotificationToast'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

const ICON_MAP: Record<string, LucideIcon> = {
  'user-plus':      UserPlus,
  'eye':            Eye,
  'heart':          Heart,
  'zap':            Zap,
  'crown':          Crown,
  'flame':          Flame,
  'trophy':         Trophy,
  'bell':           Bell,
  'fan':            Fan,
  'message-circle': MessageCircle,
  'spade':          Spade,
  'image':          Image,
  'brain':          Brain,
  'wifi':           Wifi,
  'circle-play':    CirclePlay,
}

const SWIPE_DISMISS_PX = 70

function ToastItem({ toast, onDismiss }: { toast: ToastNotif; onDismiss: () => void }) {
  const Icon = ICON_MAP[toast.icon] ?? Bell
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    setDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setDragX(e.clientX - startX.current)
  }
  function onPointerUp() {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > SWIPE_DISMISS_PX) {
      onDismiss()
    } else {
      setDragX(0)
    }
  }

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={() => { if (Math.abs(dragX) < 4) onDismiss() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '12px 16px',
        background: 'rgba(14,14,18,0.96)',
        border: `1px solid ${toast.color}40`,
        borderRadius: 16,
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${toast.color}18`,
        backdropFilter: 'blur(14px)',
        cursor: 'grab',
        touchAction: 'pan-y',
        animation: dragging ? 'none' : 'toastDropIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        transform: `translateX(${dragX}px)`,
        opacity: dragging ? Math.max(0.25, 1 - Math.abs(dragX) / 220) : 1,
        transition: dragging ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
        maxWidth: 380,
        width: '100%',
        position: 'relative',
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
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        width: 'min(380px, calc(100vw - 24px))',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto', position: 'relative', width: '100%' }}>
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastDropIn {
          from { opacity: 0; transform: translateY(-40px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </>
  )
}
