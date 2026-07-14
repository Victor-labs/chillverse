// src/components/ProtectedRoute.tsx
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { signOut } from './auth'
import { getMyModerationStatus } from '../moderation/moderation'

interface ProtectedRouteProps {
  children: ReactNode
}

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
    <div className="neu-card" style={{ padding: 40 }}>
      <span style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth()
  const [banCheck, setBanCheck] = useState<{ checked: boolean; banned: boolean; until: string | null; reason: string | null }>({
    checked: false, banned: false, until: null, reason: null,
  })

  useEffect(() => {
    if (!user) {
      setBanCheck({ checked: true, banned: false, until: null, reason: null })
      return
    }
    let active = true
    getMyModerationStatus(user.id).then(status => {
      if (!active) return
      setBanCheck({ checked: true, banned: status.isBanned, until: status.bannedUntil, reason: status.banReason })
      if (status.isBanned) signOut()
    })
    return () => { active = false }
  }, [user])

  if (loading || (session && !banCheck.checked)) {
    return <Spinner />
  }

  if (banCheck.banned) {
    const untilText = banCheck.until ? `until ${new Date(banCheck.until).toLocaleString()}` : 'permanently'
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <div className="neu-card" style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Account suspended</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
            Your account has been suspended {untilText}.
          </p>
          {banCheck.reason && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Reason: {banCheck.reason}</p>
          )}
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
