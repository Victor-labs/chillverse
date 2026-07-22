// src/shared/components/FeatureGateScreen.tsx
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FeatureGateScreenProps {
  /** Short headline, e.g. "Chat is temporarily unavailable". */
  title: string
  /** One or two sentences explaining the pause to a non-staff user. */
  message: string
  /** Optional emoji shown above the title. Defaults to a pause icon. */
  emoji?: string
}

/** Full-screen block rendered in place of an entire feature (Chat, Mall,
 *  Halo AI, Multiplayer rooms) when its "system:*" feature flag is
 *  disabled. Mirrors the look of AppLayout's maintenance-mode screen so
 *  a paused feature reads the same way a paused whole-app window does.
 *  Callers are responsible for bypassing this for staff. */
export default function FeatureGateScreen({ title, message, emoji = '⏸️' }: FeatureGateScreenProps) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--bg)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40 }}>{emoji}</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>{message}</p>
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 24px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
          color: 'var(--text)',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>
    </div>
  )
}
