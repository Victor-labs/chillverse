// src/components/ProtectedRoute.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { useAuth } from './useAuth'
import { signOut } from './auth'
import { getMyModerationStatus } from '../moderation/moderation'
import { supabase } from '../../shared/lib/supabase'
import Avatar from '../../shared/components/Avatar'

const APPEAL_EMAIL = 'Chillverserelationoffice@gmail.com'

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
  const [banProfile, setBanProfile] = useState<{ avatar: string | null; username: string } | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  // Once we've confirmed a ban for this session, that verdict sticks — it is
  // never re-derived from a later `user` change. This is what stops the
  // ~3s flash: previously, signing the user out the moment a ban was found
  // cleared `session`/`user`, which re-ran this effect and reset banCheck to
  // "not banned" right before the render that would have shown the notice,
  // bouncing the person straight to /login. Now sign-out only happens when
  // the person actively clicks "Quit" below.
  const verdictRef = useRef(false)

  useEffect(() => {
    if (verdictRef.current) return
    if (!user) {
      setBanCheck({ checked: true, banned: false, until: null, reason: null })
      return
    }
    let active = true
    getMyModerationStatus(user.id).then(status => {
      if (!active) return
      if (status.isBanned) verdictRef.current = true
      setBanCheck({ checked: true, banned: status.isBanned, until: status.bannedUntil, reason: status.banReason })
      if (status.isBanned) {
        supabase.from('profiles').select('avatar, username').eq('id', user.id).maybeSingle()
          .then(({ data }) => { if (active && data) setBanProfile({ avatar: data.avatar ?? null, username: data.username }) })
      }
    })
    return () => { active = false }
  }, [user])

  if (loading || (session && !banCheck.checked)) {
    return <Spinner />
  }

  if (banCheck.banned) {
    const untilText = banCheck.until ? `until ${new Date(banCheck.until).toLocaleString()}` : 'permanently'
    const subject = encodeURIComponent('Ban Appeal' + (banProfile ? ` - ${banProfile.username}` : ''))
    const body = encodeURIComponent(`Hi Chillverse team,\n\nI'd like to appeal my account suspension${banProfile ? ` (username: ${banProfile.username})` : ''}.\n\n`)
    const appealHref = `mailto:${APPEAL_EMAIL}?subject=${subject}&body=${body}`

    async function handleQuit() {
      setSigningOut(true)
      await signOut()
      window.location.href = '/login'
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <div className="neu-card" style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 74, height: 74, margin: '0 auto 18px' }}>
            <Avatar src={banProfile?.avatar} name={banProfile?.username ?? '?'} size={74} radius={18} disabled style={{ filter: 'grayscale(1)', opacity: 0.7 }} />
            <div style={{
              position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: '50%',
              background: '#ff4d4d', border: '3px solid var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ban size={14} color="#fff" strokeWidth={2.5} />
            </div>
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Account suspended</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
            Your account has been suspended {untilText}.
          </p>
          {banCheck.reason && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>Reason: {banCheck.reason}</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
            If you believe this was a mistake, you can request an appeal below.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" onClick={handleQuit} disabled={signingOut}
              style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--text-dim)', cursor: signingOut ? 'default' : 'pointer' }}>
              {signingOut ? 'Signing out…' : 'Quit'}
            </button>
            <a href={appealHref}
              style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Request Appeal
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
