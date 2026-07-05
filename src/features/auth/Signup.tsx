// src/pages/Signup.tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Check } from 'lucide-react'
import { signUpWithEmail, signInWithGoogle, upsertProfile, getCurrentSession } from './auth'
import { interestIcons } from '../../shared/lib/icons'

const INTERESTS = ['Strategy', 'Action', 'Puzzle', 'Compete', 'Social', 'Casual']
const COUNTRIES = [
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['OTHER', 'Other'],
]
const PLATFORMS = [
  { id: 'cvwt',    name: 'Chillverse Learning', desc: 'cvwtplatform.vercel.app · Knowledge branch', icon: '📚', iconBg: 'rgba(79,142,247,0.12)' },
  { id: 'discord', name: 'Discord',              desc: 'Sync your Discord profile & server roles',  icon: 'discord', iconBg: 'rgba(88,101,242,0.15)' },
  { id: 'google',  name: 'Google Account',       desc: 'Import your Google profile details',        icon: 'google',  iconBg: 'rgba(234,67,53,0.10)'  },
]

// ─── Sub-components ──────────────────────────────────────────
function StepDot({ n, state }: { n: number; state: 'active' | 'done' | 'idle' }) {
  const base: React.CSSProperties = {
    width: 28, height: 28, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 800, fontFamily: 'monospace', flexShrink: 0,
    border: '2px solid', transition: 'all 0.25s',
  }
  if (state === 'done') return (
    <div style={{ ...base, borderColor: 'var(--green)', background: 'rgba(62,207,142,0.10)', color: 'var(--green)' }}>
      <Check size={13} />
    </div>
  )
  if (state === 'active') return (
    <div style={{ ...base, borderColor: 'var(--purple)', background: 'rgba(155,109,255,0.12)', color: '#fff' }}>{n}</div>
  )
  return (
    <div style={{ ...base, borderColor: 'rgba(255,255,255,0.12)', background: 'var(--surface2)', color: 'var(--text-muted)' }}>{n}</div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>{error}</span>}
    </div>
  )
}

function neuInput(hasError: boolean): React.CSSProperties {
  return {
    background: 'var(--surface2)',
    border: `1px solid ${hasError ? 'var(--red)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: 12, padding: '12px 14px',
    fontSize: 14, color: 'var(--text)', outline: 'none',
    boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
    transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }
}

function PwStrength({ score }: { score: number }) {
  const cls = score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong'
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      {[0,1,2,3].map(i => <div key={i} className={`pw-bar ${i < score ? cls : ''}`} />)}
    </div>
  )
}

function GoogleSVG() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
function DiscordSVG() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#7289da">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.12 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────
export default function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const [username,    setUsername]    = useState('')
  const [email,       setEmail]       = useState('')
  const [dob,         setDob]         = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [legalChecked,setLegalChecked]= useState(false)
  const [errors,      setErrors]      = useState<Record<string, string>>({})

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [country,     setCountry]     = useState('')
  const [interests,   setInterests]   = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'err' } | null>(null)

  function showToast(msg: string, type: 'success' | 'err' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function pwStrength(v: string) {
    let s = 0
    if (v.length >= 8) s++
    if (/[A-Z]/.test(v)) s++
    if (/[0-9]/.test(v)) s++
    if (/[^A-Za-z0-9]/.test(v)) s++
    return s
  }

  function validateStep1() {
    const e: Record<string, string> = {}
    if (username.trim().length < 3 || username.trim().length > 20) e.username = 'Username must be 3–20 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address'
    if (dob) {
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      if (age < 13) e.dob = 'You must be at least 13 to join'
    } else {
      e.dob = 'You must be at least 13 to join'
    }
    if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirm || confirm.length === 0) e.confirm = 'Passwords do not match'
    if (!legalChecked) e.legal = 'You must accept the terms to continue'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function goToStep2(e: FormEvent) {
    e.preventDefault()
    if (!legalChecked) {
      showToast('Please accept the Terms & Conditions and Privacy Policy to continue.', 'err')
      setErrors(prev => ({ ...prev, legal: 'You must accept the terms to continue' }))
      return
    }
    if (validateStep1()) setStep(2)
  }
  function goToStep3() { setStep(3) }
  function toggleInterest(tag: string) {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleFinish() {
    setLoading(true)
    const { data: signUpData, error } = await signUpWithEmail(email.trim(), password)

    if (error) {
      setLoading(false)
      showToast(error.message, 'err')
      return
    }

    // Detect already-registered-but-unconfirmed
    if (signUpData?.user && signUpData.user.identities?.length === 0) {
      setLoading(false)
      showToast('This email is already registered. Check your inbox for a confirmation link.', 'err')
      return
    }

    const { data: { session } } = await getCurrentSession()

    if (!session) {
      setLoading(false)
      showToast('Confirmation email sent! Check your inbox AND spam folder 📩', 'success')
      setTimeout(() => navigate('/login'), 2200)
      return
    }

    const { error: profileError } = await upsertProfile(session.user.id, {
      username: username.trim(),
      displayName: displayName.trim(),
      country, interests, dob,
      connectedPlatform: selectedPlatform,
    })

    setLoading(false)

    if (profileError) {
      showToast(
        profileError.code === '42501'
          ? "We couldn't save your profile — please confirm your email and try again."
          : 'Something went wrong saving your profile. Please try again.',
        'err'
      )
      return
    }

    showToast('Account created! Welcome to the verse 🚀', 'success')
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  async function handleGoogleSignup() {
    const { error } = await signInWithGoogle()
    if (error) showToast(error.message, 'err')
  }

  const divider = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      or sign up with email
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'rgba(155,109,255,0.09)', filter: 'blur(100px)', top: '-6rem', right: '-6rem', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'rgba(79,142,247,0.06)', filter: 'blur(100px)', bottom: '-5rem', left: '-5rem', pointerEvents: 'none' }} />

      <div className="neu-card" style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 460, padding: '32px 40px' }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, textDecoration: 'none' }}>
          <span style={{ fontSize: 22 }}>🎮</span>
          <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Chillverse</span>
        </Link>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          <StepDot n={1} state={step === 1 ? 'active' : 'done'} />
          <div style={{ flex: 1, height: 1, margin: '0 6px', background: step > 1 ? 'var(--purple)' : 'rgba(255,255,255,0.07)', transition: 'background 0.3s' }} />
          <StepDot n={2} state={step === 2 ? 'active' : step > 2 ? 'done' : 'idle'} />
          <div style={{ flex: 1, height: 1, margin: '0 6px', background: step > 2 ? 'var(--purple)' : 'rgba(255,255,255,0.07)', transition: 'background 0.3s' }} />
          <StepDot n={3} state={step === 3 ? 'active' : 'idle'} />
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <form onSubmit={goToStep2} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, color: 'var(--text)' }}>Create your account</h1>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Join the verse. It's free forever.</p>
            </div>

            {/* Google */}
            <button type="button" onClick={handleGoogleSignup}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)' }}>
              <GoogleSVG /> Continue with Google
            </button>
            {divider}

            <Field label="Username" error={errors.username}>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. NeonX_99" autoComplete="username" style={neuInput(!!errors.username)}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = errors.username ? 'var(--red)' : 'rgba(255,255,255,0.07)' }} />
            </Field>

            <Field label="Email address" error={errors.email}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" style={neuInput(!!errors.email)}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = errors.email ? 'var(--red)' : 'rgba(255,255,255,0.07)' }} />
            </Field>

            <Field label="Date of birth" error={errors.dob}>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().split('T')[0]} style={neuInput(!!errors.dob)}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = errors.dob ? 'var(--red)' : 'rgba(255,255,255,0.07)' }} />
            </Field>

            <Field label="Password" error={errors.password}>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" style={neuInput(!!errors.password)}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = errors.password ? 'var(--red)' : 'rgba(255,255,255,0.07)' }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
              <PwStrength score={pwStrength(password)} />
            </Field>

            <Field label="Confirm password" error={errors.confirm}>
              <div style={{ position: 'relative' }}>
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password" style={neuInput(!!errors.confirm)}
                  onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = errors.confirm ? 'var(--red)' : 'rgba(255,255,255,0.07)' }} />
                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>{showConfirm ? 'Hide' : 'Show'}</button>
              </div>
            </Field>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={legalChecked} onChange={e => setLegalChecked(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Terms & Conditions</Link>{' '}and{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>
              </span>
            </label>
            {errors.legal && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: -10 }}>{errors.legal}</span>}

            <button type="submit" className="btn-primary" style={{ padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800 }}>
              Create account →
            </button>
          </form>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, color: 'var(--text)' }}>Connect a platform</h1>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Link an existing account to sync your progress instantly.</p>
            </div>

            <div style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--blue)' }}>Optional.</strong> Carry over XP, streaks, and profile data from a connected platform.
            </div>

            {PLATFORMS.map(p => (
              <button key={p.id} type="button" onClick={() => setSelectedPlatform(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%', cursor: 'pointer',
                  background: 'var(--surface2)',
                  border: `1.5px solid ${selectedPlatform === p.id ? 'rgba(155,109,255,0.5)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 14, padding: '14px 16px',
                  boxShadow: selectedPlatform === p.id ? '0 0 20px rgba(155,109,255,0.15)' : '2px 2px 6px var(--neu-dark)',
                  transition: 'all 0.2s',
                }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: p.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                  {p.icon === 'discord' ? <DiscordSVG /> : p.icon === 'google' ? <GoogleSVG /> : p.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.desc}</p>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selectedPlatform === p.id ? 'var(--purple)' : 'rgba(255,255,255,0.2)'}`,
                  background: selectedPlatform === p.id ? 'var(--purple)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {selectedPlatform === p.id && <Check size={11} color="#fff" />}
                </div>
              </button>
            ))}

            <button type="button" className="btn-primary" onClick={goToStep3} style={{ padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800 }}>
              Continue →
            </button>
            <button type="button" onClick={() => { setSelectedPlatform(null); goToStep3() }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'center', padding: 4 }}>
              Skip for now
            </button>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, color: 'var(--text)' }}>Set up your profile</h1>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>How do you want to show up in the verse?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(155,109,255,0.35)',
              }}>
                <Rocket size={32} color="#fff" />
              </div>
            </div>

            <Field label="Display name">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How others see you" style={neuInput(false)}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }} />
            </Field>

            <Field label="Country / Region">
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...neuInput(false), cursor: 'pointer' }}>
                <option value="">Select your country</option>
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </Field>

            <Field label="What are you into?">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {INTERESTS.map(tag => {
                  const Icon = interestIcons[tag]
                  const selected = interests.includes(tag)
                  return (
                    <button key={tag} type="button" onClick={() => toggleInterest(tag)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: selected ? 'rgba(155,109,255,0.12)' : 'var(--surface2)',
                        border: `1.5px solid ${selected ? 'rgba(155,109,255,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        color: selected ? '#d4b8ff' : 'var(--text-dim)',
                        transition: 'all 0.18s',
                        boxShadow: selected ? '0 0 12px rgba(155,109,255,0.15)' : '2px 2px 5px var(--neu-dark)',
                      }}>
                      <Icon className="w-3.5 h-3.5" />
                      {tag}
                    </button>
                  )
                })}
              </div>
            </Field>

            <button type="button" onClick={handleFinish} disabled={loading} className="btn-primary"
              style={{ padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : 'Enter Chillverse 🚀'}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
        </p>
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
