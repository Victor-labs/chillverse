import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmail, signInWithGoogle, signInWithDiscord } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
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

    setLoading(true)
    const { error } = await signInWithEmail(identifier.trim(), password)
    setLoading(false)

    if (error) {
      showToast(error.message, 'err')
      return
    }

    showToast('Logged in! Welcome back 🔥', 'success')
    setTimeout(() => navigate('/'), 1200)
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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed w-[400px] h-[400px] rounded-full bg-chill-violet/[0.13] blur-[100px] -top-20 -left-24 pointer-events-none" />
      <div className="fixed w-[350px] h-[350px] rounded-full bg-chill-pink/[0.07] blur-[100px] -bottom-24 -right-20 pointer-events-none" />

      <div className="relative z-[2] w-full max-w-[460px] bg-chill-surface border border-chill-border rounded-[22px] p-8 md:p-11 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">

        <Link to="/" className="flex items-center gap-2.5 mb-7">
          <span className="text-2xl">🎮</span>
          <span className="text-xl font-bold text-gradient-2">Chillverse</span>
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Welcome back</h1>
        <p className="text-sm text-chill-textSecondary mb-7">Log in and pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">

          <button
            type="button"
            onClick={handleGoogle}
            className="flex items-center justify-center gap-2.5 py-3 rounded-[10px] bg-chill-surface2 border-[1.5px] border-chill-border text-sm font-semibold hover:border-chill-borderBright hover:bg-chill-violet/[0.06] transition-all"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-[13px] text-chill-textMuted">
            <div className="flex-1 h-px bg-chill-border" />
            or use email
            <div className="flex-1 h-px bg-chill-border" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-chill-textSecondary tracking-wide">Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
              className={`bg-chill-surface2 border-[1.5px] rounded-[10px] px-4 py-3.5 text-[15px] outline-none transition-all focus:border-chill-violet focus:shadow-[0_0_0_3px_rgba(108,80,255,0.15)] ${errors.identifier ? 'border-chill-red' : 'border-chill-border'}`}
            />
            {errors.identifier && <div className="text-xs text-chill-red mt-1">{errors.identifier}</div>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-chill-textSecondary tracking-wide">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className={`w-full bg-chill-surface2 border-[1.5px] rounded-[10px] px-4 py-3.5 text-[15px] outline-none transition-all focus:border-chill-violet focus:shadow-[0_0_0_3px_rgba(108,80,255,0.15)] ${errors.password ? 'border-chill-red' : 'border-chill-border'}`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-chill-textMuted hover:text-chill-textSecondary"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <div className="text-xs text-chill-red mt-1">{errors.password}</div>}
          </div>

          <div className="text-right text-[13px] -mt-2.5">
            <Link to="/forgot-password" className="text-chill-violetSoft font-medium hover:underline">Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_6px_28px_rgba(108,80,255,0.45)] hover:shadow-[0_10px_38px_rgba(108,80,255,0.65)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-[18px] h-[18px] border-2 border-white/25 border-t-white rounded-full animate-spin" />
            ) : (
              'Log in →'
            )}
          </button>

          {/* Platform connect */}
          <div className="mt-1.5 bg-chill-cyan/[0.04] border border-chill-cyan/[0.18] rounded-xl p-4">
            <div className="text-[12px] font-bold tracking-wider uppercase text-chill-textMuted mb-3 font-mono">
              // or log in via platform
            </div>
            <div className="flex flex-col gap-2.5">
              <a
                href="https://cvwtplatform.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="bg-chill-surface2 border-[1.5px] border-chill-border rounded-[14px] px-5 py-4 flex items-center gap-3.5 cursor-pointer hover:border-chill-cyan/40 hover:shadow-[0_0_20px_rgba(0,229,255,0.08)] transition-all"
              >
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0 bg-chill-cyan/10">📚</div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold mb-0.5">Chillverse Learning</div>
                  <div className="text-xs text-chill-textMuted">Log in with your learning branch account</div>
                </div>
                <span className="text-xs text-chill-cyan font-semibold">→</span>
              </a>

              <button
                type="button"
                onClick={handleDiscord}
                className="bg-chill-surface2 border-[1.5px] border-chill-border rounded-[14px] px-5 py-4 flex items-center gap-3.5 cursor-pointer hover:border-chill-violetSoft/40 hover:shadow-[0_0_20px_rgba(108,80,255,0.08)] transition-all text-left"
              >
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#5865F2]/15">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#7289da"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.12 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold mb-0.5">Discord</div>
                  <div className="text-xs text-chill-textMuted">Log in with your Discord account</div>
                </div>
                <span className="text-xs text-chill-violetSoft font-semibold">→</span>
              </button>
            </div>
          </div>
        </form>

        <div className="text-center text-[13px] text-chill-textMuted mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="text-chill-violetSoft font-semibold hover:underline">Sign up free</Link>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.4)] border z-[999] whitespace-nowrap ${
            toast.type === 'success' ? 'border-chill-green/40 text-chill-green' : 'border-chill-red/40 text-chill-red'
          } bg-chill-surface`}
        >
          {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
        </div>
      )}
    </div>
  )
}
