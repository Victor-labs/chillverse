// src/pages/Signup.tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpWithEmail, signInWithGoogle, createProfile } from '../lib/auth'

const AVATARS = ['🧑‍🚀', '👾', '🎮', '🔥', '⚡', '💎', '🏆', '🌌']
const INTERESTS = ['🎯 Strategy', '⚡ Action', '🧩 Puzzle', '🏆 Compete', '💬 Social', '🎲 Casual']
const COUNTRIES = [
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['OTHER', 'Other'],
]

const PLATFORMS = [
  { id: 'cvwt', icon: '📚', name: 'Chillverse Learning', desc: 'cvwtplatform.vercel.app · Knowledge branch', bg: 'bg-chill-cyan/10' },
  { id: 'discord', icon: 'discord', name: 'Discord', desc: 'Sync your Discord profile & server roles', bg: 'bg-[#5865F2]/15' },
  { id: 'google', icon: 'google', name: 'Google Account', desc: 'Import your Google profile details', bg: 'bg-[#EA4335]/10' },
]

function StepDot({ n, state }: { n: number; state: 'active' | 'done' | 'idle' }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono border-2 flex-shrink-0 transition-all'
  if (state === 'done') return <div className={`${base} border-chill-green bg-chill-green/10 text-chill-green`}>✓</div>
  if (state === 'active') return <div className={`${base} border-chill-violet bg-chill-violet/[0.12] text-chill-violetSoft`}>{n}</div>
  return <div className={`${base} border-chill-borderBright bg-chill-surface2 text-chill-textMuted`}>{n}</div>
}

export default function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [legalChecked, setLegalChecked] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 2
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  // Step 3
  const [avatar, setAvatar] = useState('🧑‍🚀')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [country, setCountry] = useState('')
  const [interests, setInterests] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'err' } | null>(null)

  function showToast(msg: string, type: 'success' | 'err' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function pwStrength(v: string) {
    let score = 0
    if (v.length >= 8) score++
    if (/[A-Z]/.test(v)) score++
    if (/[0-9]/.test(v)) score++
    if (/[^A-Za-z0-9]/.test(v)) score++
    return score
  }

  function validateStep1() {
    const e: Record<string, string> = {}
    if (username.trim().length < 3 || username.trim().length > 20) e.username = 'Username must be 3–20 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address'

    let dobOk = false
    if (dob) {
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      dobOk = age >= 13
    }
    if (!dobOk) e.dob = 'You must be at least 13 to join'

    if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirm || confirm.length === 0) e.confirm = 'Passwords do not match'
    if (!legalChecked) e.legal = 'You must accept the terms to continue'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function goToStep2(e: FormEvent) {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

  function goToStep3() {
    setStep(3)
  }

  function toggleInterest(tag: string) {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function handleFinish() {
    setLoading(true)

    const { data, error } = await signUpWithEmail(email.trim(), password)

    if (error) {
      setLoading(false)
      showToast(error.message, 'err')
      return
    }

    const userId = data.user?.id

    if (userId) {
      const { error: profileError } = await createProfile(userId, {
        username: username.trim(),
        displayName: displayName.trim(),
        avatar,
        country,
        interests,
        dob,
        connectedPlatform: selectedPlatform,
      })

      if (profileError) {
        setLoading(false)
        showToast('Account created, but profile setup failed: ' + profileError.message, 'err')
        return
      }
    }

    setLoading(false)

    if (!data.session) {
      // Email confirmation required
      showToast('Check your email to confirm your account 📩', 'success')
      setTimeout(() => navigate('/login'), 2200)
    } else {
      showToast('Account created! Welcome to the verse 🚀', 'success')
      setTimeout(() => navigate('/dashboard'), 1500)
    }
  }

  async function handleGoogleSignup() {
    const { error } = await signInWithGoogle()
    if (error) showToast(error.message, 'err')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed w-[400px] h-[400px] rounded-full bg-chill-violet/[0.14] blur-[100px] -top-24 -right-24 pointer-events-none" />
      <div className="fixed w-[300px] h-[300px] rounded-full bg-chill-cyan/[0.08] blur-[100px] -bottom-20 -left-20 pointer-events-none" />

      <div className="relative z-[2] w-full max-w-[460px] glass-panel glow-violet-tint rounded-[22px] p-8 md:p-11 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">

        <Link to="/" className="flex items-center gap-2.5 mb-7">
          <span className="text-2xl">🎮</span>
          <span className="text-xl font-bold text-gradient-2">Chillverse</span>
        </Link>

        {/* Step indicator */}
        <div className="flex items-center mb-7">
          <StepDot n={1} state={step === 1 ? 'active' : 'done'} />
          <div className={`flex-1 h-px mx-1.5 ${step > 1 ? 'bg-chill-violet' : 'bg-chill-border'}`} />
          <StepDot n={2} state={step === 2 ? 'active' : step > 2 ? 'done' : 'idle'} />
          <div className={`flex-1 h-px mx-1.5 ${step > 2 ? 'bg-chill-violet' : 'bg-chill-border'}`} />
          <StepDot n={3} state={step === 3 ? 'active' : 'idle'} />
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <form onSubmit={goToStep2} className="flex flex-col gap-[18px]">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Create your account</h1>
              <p className="text-sm text-chill-textSecondary">Join the verse. It's free forever.</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
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
              or sign up with email
              <div className="flex-1 h-px bg-chill-border" />
            </div>

            <Field label="Username" error={errors.username}>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. NeonX_99" autoComplete="username" className={inputClass(!!errors.username)} />
            </Field>

            <Field label="Email address" error={errors.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" className={inputClass(!!errors.email)} />
            </Field>

            <Field label="Date of birth" error={errors.dob}>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().split('T')[0]} className={inputClass(!!errors.dob)} />
            </Field>

            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  className={`w-full ${inputClass(!!errors.password)}`}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-chill-textMuted hover:text-chill-textSecondary">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <PwStrength score={pwStrength(password)} />
            </Field>

            <Field label="Confirm password" error={errors.confirm}>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full ${inputClass(!!errors.confirm)}`}
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-chill-textMuted hover:text-chill-textSecondary">
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            <label className="flex items-start gap-2.5 text-[13px] text-chill-textSecondary cursor-pointer">
              <input type="checkbox" checked={legalChecked} onChange={(e) => setLegalChecked(e.target.checked)} className="w-4 h-4 mt-0.5 accent-chill-violet flex-shrink-0" />
              <span>
                I agree to the <Link to="/terms" target="_blank" className="text-chill-violetSoft">Terms & Conditions</Link> and{' '}
                <Link to="/privacy" target="_blank" className="text-chill-violetSoft">Privacy Policy</Link>
              </span>
            </label>
            {errors.legal && <div className="text-xs text-chill-red -mt-2.5">{errors.legal}</div>}

            <button type="submit" className="w-full py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_6px_28px_rgba(108,80,255,0.45)] hover:shadow-[0_10px_38px_rgba(108,80,255,0.65)] hover:-translate-y-0.5 transition-all">
              Create account →
            </button>
          </form>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="flex flex-col gap-[18px]">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Connect a platform</h1>
              <p className="text-sm text-chill-textSecondary">
                Do you already have an account on one of our platforms? Link it to sync your progress instantly.
              </p>
            </div>

            <div className="bg-chill-cyan/[0.06] border border-chill-cyan/20 rounded-[10px] px-3.5 py-3 text-[13px] text-chill-textSecondary leading-relaxed">
              <strong className="text-chill-cyan">Optional step.</strong> If you use the Chillverse learning branch or any partner platform, connecting it lets you carry over your XP, streaks, and profile data.
            </div>

            <div className="flex flex-col gap-3">
              {PLATFORMS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`bg-chill-surface2 border-[1.5px] rounded-[14px] px-5 py-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                    selectedPlatform === p.id ? 'border-chill-violet shadow-[0_0_20px_rgba(108,80,255,0.2)]' : 'border-chill-border hover:border-chill-cyan/40'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0 ${p.bg}`}>
                    {p.icon === 'discord' ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="#7289da"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.12 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                    ) : p.icon === 'google' ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    ) : p.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold mb-0.5">{p.name}</div>
                    <div className="text-xs text-chill-textMuted">{p.desc}</div>
                  </div>
                  <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedPlatform === p.id ? 'bg-chill-violet border-chill-violet' : 'border-chill-borderBright'}`}>
                    {selectedPlatform === p.id && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={goToStep3} className="w-full py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_6px_28px_rgba(108,80,255,0.45)] hover:shadow-[0_10px_38px_rgba(108,80,255,0.65)] hover:-translate-y-0.5 transition-all">
              Continue →
            </button>
            <div onClick={() => { setSelectedPlatform(null); goToStep3() }} className="text-center text-[13px] text-chill-textMuted cursor-pointer hover:text-chill-textSecondary hover:underline">
              Skip for now
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="flex flex-col gap-[18px]">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1.5">Set up your profile</h1>
              <p className="text-sm text-chill-textSecondary">How do you want to show up in the verse?</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => setShowAvatarPicker((v) => !v)}
                className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-chill-violet to-chill-cyan flex items-center justify-center text-[28px] cursor-pointer border-2 border-chill-borderBright"
              >
                {avatar}
              </div>
              <div className="text-xs text-chill-textMuted">Tap to choose avatar</div>
            </div>

            {showAvatarPicker && (
              <div className="flex flex-wrap gap-2.5 justify-center">
                {AVATARS.map((a) => (
                  <span
                    key={a}
                    onClick={() => { setAvatar(a); setShowAvatarPicker(false) }}
                    className="text-2xl cursor-pointer p-2 rounded-lg border border-chill-border hover:border-chill-violetSoft transition-colors"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}

            <Field label="Display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How others see you" className={inputClass(false)} />
            </Field>

            <Field label="Country / Region">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputClass(false)} cursor-pointer`}>
                <option value="">Select your country</option>
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </Field>

            <Field label="What are you into?">
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    className={`px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] font-medium cursor-pointer transition-all ${
                      interests.includes(tag) ? 'border-chill-violet bg-chill-violet/[0.12] text-chill-violetSoft' : 'border-chill-border bg-chill-surface2 text-chill-textSecondary'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Field>

            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full py-3.5 rounded-full text-[15px] font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_6px_28px_rgba(108,80,255,0.45)] hover:shadow-[0_10px_38px_rgba(108,80,255,0.65)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-[18px] h-[18px] border-2 border-white/25 border-t-white rounded-full animate-spin" /> : 'Enter Chillverse 🚀'}
            </button>
          </div>
        )}

        <div className="text-center text-[13px] text-chill-textMuted mt-5">
          Already have an account? <Link to="/login" className="text-chill-violetSoft font-semibold hover:underline">Log in</Link>
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

function inputClass(hasError: boolean) {
  return `bg-chill-surface2 border-[1.5px] rounded-[10px] px-4 py-3.5 text-[15px] outline-none transition-all focus:border-chill-violet focus:shadow-[0_0_0_3px_rgba(108,80,255,0.15)] ${
    hasError ? 'border-chill-red' : 'border-chill-border'
  }`
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-chill-textSecondary tracking-wide">{label}</label>
      {children}
      {error && <div className="text-xs text-chill-red mt-0.5">{error}</div>}
    </div>
  )
}

function PwStrength({ score }: { score: number }) {
  const cls = score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong'
  return (
    <div className="flex gap-1 mt-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`pw-bar ${i < score ? cls : ''}`} />
      ))}
    </div>
  )
}
