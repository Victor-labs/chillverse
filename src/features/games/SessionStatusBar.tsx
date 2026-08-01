// src/features/games/SessionStatusBar.tsx
import { useEffect, useState } from 'react'
import { Gamepad2, Clock } from 'lucide-react'

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return '0:00:00'
  const totalSec = Math.floor(msLeft / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SessionStatusBar({
  count, limit, limitReached, resetAt,
}: {
  count: number
  limit: number
  limitReached: boolean
  resetAt: number   // epoch ms, 0 if not applicable
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!limitReached || !resetAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [limitReached, resetAt])

  const showTimer = limitReached && resetAt > now
  const msLeft = resetAt - now

  return (
    <div className="neu-card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      {showTimer ? (
        <>
          <Clock size={18} style={{ color: 'var(--purple, #9b6dff)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Sessions used up for today</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              More in {formatCountdown(msLeft)}
            </p>
          </div>
        </>
      ) : (
        <>
          <Gamepad2 size={18} style={{ color: 'var(--accent, #3ecf8e)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {count}/{limit} used today
            </p>
            <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (count / limit) * 100)}%`, background: 'var(--accent, #3ecf8e)', borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
