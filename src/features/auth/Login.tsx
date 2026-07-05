// src/pages/Login.tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmail, signInWithGoogle, signInWithDiscord, resendConfirmationEmail } from './auth'

export default function Login() {
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'err' } | null>(null)

  function showToast(msg: string, type: 'success' | 'err' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const newErrors: typeof errors = {}
    if (!identifier.trim()) newErrors.identifier = 'Please enter your email'
    if (!password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setUnconfirmedEmail(null)
    setLoading(true)
    const { error } = await signInWithEmail(identifier.trim(), password)
    setLoading(false)

    if (error) {
      // Detect unconfirmed email
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setUnconfirmedEmail(identifier.trim())
        return
      }
      showToast(error.message, 'err')
      return
    }

    showToast('Logged in! Welcome back 🔥', 'success')
    setTimeout(() => navigate('/dashboard'), 1200)
  }

  async function handleResend() {
    if (!unconfirmedEmail) return
    setResendLoading(true)
    const { error } = await resendConfirmationEmail(unconfirmedEmail)
    setResendLoading(false)
    if (error) {
      showToast(error.message, 'err')
    } else {
      showToast('Confirmation email resent! Check your inbox AND spam folder 📩', 'success')
    }
  }

  async function handleGoogle() {
    const { error } = await signInWithGoogle()
    if (error) showToast(error.message, 'err')
  }

  async function handleDiscord() {
    const { error } = await signInWithDiscord()
    if (error) showToast(error.message, 'err')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="fixed w-[400px] h-[400px] rounded-full blur-[100px] -top-20 -left-24 pointer-events-none" style={{ background: 'rgba(155,109,255,0.10)' }} />
      <div className="fixed w-[350px] h-[350px] rounded-full blur-[100px] -bottom-24 -right-20 pointer-events-none" style={{ background: 'rgba(255,77,139,0.06)' }} />

      <div className="relative z-[2] w-full max-w-[460px] neu-card" style={{ padding: '32px 44px' }}>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, textDecoration: 'none' }}>
          <span style={{ fontSize: 24 }}>🎮</span>
          <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Chillverse</span>
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6, color: 'var(--text)' }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 28 }}>Log in and pick up where you left off.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: 'var(--surface2)', color: 'var(--text)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
              transition: 'all 0.2s',
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            or use email
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Unconfirmed email alert */}
          {unconfirmedEmail && (
            <div style={{
              background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.25)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                Your email <strong style={{ color: 'var(--text)' }}>{unconfirmedEmail}</strong> isn't confirmed yet.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="btn-primary"
                style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start' }}
              >
                {resendLoading
                  ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  : 'Resend confirmation email'}
              </button>
            </div>
          )}

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
              style={{
                background: 'var(--surface2)', border: `1px solid ${errors.identifier ? 'var(--red)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--text)', outline: 'none',
                boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
              onBlur={e => { e.target.style.borderColor = errors.identifier ? 'var(--red)' : 'rgba(255,255,255,0.07)' }}
            />
            {errors.identifier && <span style={{ fontSize: 12, color: 'var(--red)' }}>{errors.identifier}</span>}
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface2)', border: `1px solid ${errors.password ? 'var(--red)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12, padding: '12px 50px 12px 14px', fontSize: 14, color: 'var(--text)', outline: 'none',
                  boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
                onBlur={e => { e.target.style.borderColor = errors.password ? 'var(--red)' : 'rgba(255,255,255,0.07)' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <span style={{ fontSize: 12, color: 'var(--red)' }}>{errors.password}</span>}
          </div>

          <div style={{ textAlign: 'right', marginTop: -10 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '13px', borderRadius: 14, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : 'Log in →'}
          </button>

          {/* Platform logins */}
          <div style={{ background: 'rgba(79,142,247,0.04)', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 14, padding: 16, marginTop: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>// or log in via platform</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href="https://cvwtplatform.vercel.app/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,142,247,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79,142,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📚</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Chillverse Learning</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log in with your learning branch account</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 700 }}>→</span>
              </a>

              <button
                type="button"
                onClick={handleDiscord}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                  transition: 'border-color 0.2s', width: '100%',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(114,137,218,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(88,101,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#7289da"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.12 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Discord</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log in with your Discord account</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 700 }}>→</span>
              </button>
            </div>
          </div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>Sign up free</Link>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          borderRadius: 20, padding: '10px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)', zIndex: 999, whiteSpace: 'nowrap',
          background: 'var(--surface)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(62,207,142,0.4)' : 'rgba(255,79,79,0.4)'}`,
          color: toast.type === 'success' ? 'var(--green)' : 'var(--red)',
        }}>
          {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
