// src/pages/ForgotPassword.tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordReset } from './auth'
import Wordmark from '../../layout/Wordmark'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setError('')
    setLoading(true)
    const { error: err } = await sendPasswordReset(email.trim())
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed w-[400px] h-[400px] rounded-full bg-chill-violet/[0.13] blur-[100px] -top-20 -left-24 pointer-events-none" />

      <div className="relative z-[2] w-full max-w-[460px] glass-panel glow-violet-tint rounded-[22px] p-8 md:p-11 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
        <Link to="/" className="flex items-center gap-2.5 mb-7">
          <span className="text-2xl">🎮</span>
          <Wordmark size={20} animated={false} />
        </Link>

        {sent ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Check your inbox</h1>
            <p className="text-sm text-chill-textSecondary mb-7">
              If an account exists for <strong className="text-chill-text">{email}</strong>, we've sent a link to reset your password.
            </p>
            <Link
              to="/login"
              className="w-full inline-block text-center py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#8a2d0a] shadow-[0_6px_28px_rgba(255,106,44,0.45)] hover:-translate-y-0.5 transition-all"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Reset your password</h1>
            <p className="text-sm text-chill-textSecondary mb-7">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-chill-textSecondary tracking-wide">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={`bg-chill-surface2 border-[1.5px] rounded-[10px] px-4 py-3.5 text-[15px] outline-none transition-all focus:border-chill-violet focus:shadow-[0_0_0_3px_rgba(255,106,44,0.15)] ${error ? 'border-chill-red' : 'border-chill-border'}`}
                />
                {error && <div className="text-xs text-chill-red mt-1">{error}</div>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#8a2d0a] shadow-[0_6px_28px_rgba(255,106,44,0.45)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading ? <span className="w-[18px] h-[18px] border-2 border-white/25 border-t-white rounded-full animate-spin" /> : 'Send reset link →'}
              </button>
            </form>
          </>
        )}

        <div className="text-center text-[13px] text-chill-textMuted mt-5">
          <Link to="/login" className="text-chill-violetSoft font-semibold hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  )
}
