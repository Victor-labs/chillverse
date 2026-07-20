// src/features/settings/Settings.tsx — Settings root
// Discord-style categorized settings: this page is a navigable index of
// categories (each with its own sub-page) plus the two things the spec keeps
// at top level — the Profile viewing alert group and Log out.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Users, ShieldCheck, WalletMinimal, Crown, Palette,
  Mic, Bell, Layers, LogOut, Search, X, Volume2, LifeBuoy, BellRing,
  MonitorSmartphone, EyeOff,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useTheme } from '../../context/ThemeContext'
import { getTheme } from '../../shared/lib/themes'
import { isGameSoundEnabled, setGameSoundEnabled } from '../games/soundSettings'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { useAuth } from '../auth/useAuth'
import Avatar from '../../shared/components/Avatar'
import { signOut } from '../auth/auth'
import PageOnboarding from '../onboarding/PageOnboarding'
import {
  SectionTitle, InfoLine, ErrorLine, Row, ToggleRow, ChoiceGroup, useProfileField,
} from './settingsShared'

export default function Settings() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const isPro = isProActive(profile)
  const { theme } = useTheme()
  const { session } = useAuth()

  const [search, setSearch] = useState('')
  const [showLogout, setShowLogout] = useState(false)
  const [showMic, setShowMic] = useState(false)
  const [micState, setMicState] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [gameSound, setGameSound] = useState(() => isGameSoundEnabled())

  const viewAlert = useProfileField<'inside' | 'outside' | 'none'>(profile, 'profile_view_alert', 'inside')

  const userEmail = session?.user?.email ?? ''
  const displayName = profile?.display_name || profile?.username || 'You'
  const q = search.trim().toLowerCase()
  const matches = useMemo(() => (labels: string[]) => !q || labels.some(l => l.toLowerCase().includes(q)), [q])

  function toggleGameSound() {
    const next = !gameSound
    setGameSound(next)
    setGameSoundEnabled(next)
  }

  async function requestMic() {
    setMicState('asking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicState('granted')
    } catch {
      setMicState('denied')
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <PageOnboarding pageKey="settings" />
      <style>{`
        @keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
        .settings-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--elev-raise-sm);
          margin-bottom: 20px;
        }
        .settings-card > * {
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
          border: none !important;
          border-bottom: 1px solid var(--border) !important;
        }
        .settings-card > *:last-child { border-bottom: none !important; }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
        <div style={{ marginBottom: 20 }}>
          <button onClick={(e) => { ripple(e); navigate(-1) }} className="ripple-wrap" aria-label="Back" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}>
            <ArrowLeft size={15} />
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, boxShadow: 'var(--elev-raise-sm)' }}>
          <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search settings"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Profile summary — tapping it opens Account */}
        <div
          onClick={(e) => { ripple(e); navigate('/settings/account') }}
          className="ripple-wrap"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 18px', marginBottom: 8, boxShadow: 'var(--elev-raise)', animation: 'feedIn 0.3s var(--ease-out) both', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={profile?.avatar} name={displayName} size={58} radius={17} disabled style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }} />
            {isPro && (
              <span style={{
                position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
                color: 'var(--accent)', background: 'var(--nav)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                borderRadius: 6, padding: '1.5px 6px', whiteSpace: 'nowrap',
              }}>
                {profile?.pro_tier === 'void' ? 'Void' : 'Orbit'}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
        </div>

        {/* ── Account settings ── */}
        {matches(['Account', 'Social', 'Data', 'Privacy', 'Blocked', 'Age restriction', 'Username', 'Email', 'Password']) && (
          <>
            <SectionTitle>Account settings</SectionTitle>
            <div className="settings-card">
              <Row icon={<User size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
                label="Account" sub="Username, email, password, delete account"
                onClick={(e) => { ripple(e); navigate('/settings/account') }} />
              <Row icon={<Users size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
                label="Social" sub="Age restriction, status sharing, blocked accounts"
                onClick={(e) => { ripple(e); navigate('/settings/social') }} />
              <Row icon={<ShieldCheck size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
                label="Data & Privacy" sub="Profile visibility, policies & terms"
                onClick={(e) => { ripple(e); navigate('/settings/privacy') }} />
            </div>
          </>
        )}

        {/* ── Wallet settings ── */}
        {matches(['Wallet', 'Diamonds', 'Orbit', 'Void', 'Go Pro', 'Subscription']) && (
          <>
            <SectionTitle>Wallet settings</SectionTitle>
            <div className="settings-card">
              <Row icon={<WalletMinimal size={15} />} iconBg="rgba(245,197,66,0.12)" iconColor="var(--gold)"
                label="Wallet" sub="Diamonds balance and history"
                onClick={(e) => { ripple(e); navigate('/wallet') }} />
              <Row icon={<Crown size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
                label={isPro ? `Manage ${profile?.pro_tier === 'void' ? 'Void' : 'Orbit'}` : 'Go Pro'}
                sub={isPro ? 'Your subscription and billing' : 'Unlock premium themes, perks and more'}
                onClick={(e) => { ripple(e); navigate(isPro ? '/settings/subscription' : '/pro') }} />
            </div>
          </>
        )}

        {/* ── Chillverse ── */}
        {matches(['Chillverse', 'Appearance', 'Theme', 'Microphone', 'Notifications', 'Version', 'Game sound', 'Support']) && (
          <>
            <SectionTitle>Chillverse</SectionTitle>
            <div className="settings-card">
              <Row icon={<Palette size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
                label="Appearance" value={getTheme(theme).label}
                onClick={(e) => { ripple(e); navigate('/settings/theme') }} />
              <Row icon={<Mic size={15} />} iconBg="rgba(255,77,139,0.12)" iconColor="var(--pink)"
                label="Microphone" sub="Grant microphone access for calls and voice notes"
                onClick={(e) => { ripple(e); setShowMic(true); setMicState('idle') }} />
              <Row icon={<Bell size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
                label="Notifications" sub="In-app, system, and global chat"
                onClick={(e) => { ripple(e); navigate('/settings/notifications') }} />
              <Row icon={<Layers size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
                label="Version" value="v1.0"
                onClick={(e) => { ripple(e); navigate('/version') }} />
            </div>
            <div className="settings-card">
              <ToggleRow icon={<Volume2 size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
                label="Game sound" sub="Play sound effects during games like Pattern King"
                on={gameSound} onToggle={toggleGameSound} />
              <Row icon={<LifeBuoy size={15} />} iconBg="color-mix(in srgb, var(--accent) 12%, transparent)" iconColor="var(--accent)"
                label="Support"
                onClick={(e) => { ripple(e); navigate('/support') }} />
            </div>
          </>
        )}

        {/* ── Profile viewing (top-level per spec) ── */}
        {matches(['Profile viewing', 'Inside Chillverse', 'Outside Chillverse', 'None']) && (
          <>
            <SectionTitle>Profile viewing</SectionTitle>
            <ChoiceGroup
              value={viewAlert.value}
              onPick={(v) => viewAlert.save(v)}
              options={[
                { id: 'inside', label: 'Inside Chillverse', sub: 'In-app alert when someone views your profile', icon: <Bell size={14} />, color: 'var(--accent)' },
                { id: 'outside', label: 'Outside Chillverse', sub: 'System notification, even when the app is closed', icon: <MonitorSmartphone size={14} />, color: 'var(--blue)' },
                { id: 'none', label: 'None', sub: 'No profile view alerts', icon: <EyeOff size={14} />, color: 'var(--text-muted)' },
              ]}
            />
            <InfoLine>When someone views your profile, you'll be alerted according to this setting — "None" turns the alert off entirely.</InfoLine>
            <ErrorLine>{viewAlert.error}</ErrorLine>
          </>
        )}

        {/* ── Other notifications ── */}
        {matches(['Other notifications', 'Highlights', 'Activities', 'Status', 'Exploration', 'Gifts', 'Profile likes', 'Session reset', 'Live readers']) && (
          <>
            <SectionTitle>Other notifications</SectionTitle>
            <Row icon={<BellRing size={15} />} iconBg="rgba(255,77,139,0.12)" iconColor="var(--pink)"
              label="Other notifications" sub="Chillverse events, highlights, activities & status"
              onClick={(e) => { ripple(e); navigate('/settings/other-notifications') }} />
          </>
        )}

        {/* ── Log out ── */}
        <div style={{ marginTop: 26 }}>
          <Row icon={<LogOut size={15} />} iconBg="rgba(255,79,79,0.12)" danger
            label="Log out"
            onClick={(e) => { ripple(e); setShowLogout(true) }} />
        </div>
      </div>

      {/* Log out modal */}
      {showLogout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', animation: 'popIn 0.22s var(--ease-spring) both' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Log out?</div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>You'll need to sign back in to access your account.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowLogout(false)} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
              <button onClick={handleLogout} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Log out</button>
            </div>
          </div>
        </div>
      )}

      {/* Microphone permission modal */}
      {showMic && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', animation: 'popIn 0.22s var(--ease-spring) both', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', background: 'rgba(255,77,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pink)' }}>
              <Mic size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Microphone access</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 18 }}>
              {micState === 'granted'
                ? 'Microphone access is enabled — calls and voice notes are ready to go.'
                : micState === 'denied'
                  ? 'Access was denied. Enable the microphone for this site in your browser settings, then try again.'
                  : 'Chillverse uses your microphone for voice calls and voice notes. Your browser will ask for permission.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowMic(false)} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>
                {micState === 'granted' ? 'Done' : 'Close'}
              </button>
              {micState !== 'granted' && (
                <button onClick={requestMic} disabled={micState === 'asking'} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 13, opacity: micState === 'asking' ? 0.6 : 1 }}>
                  {micState === 'asking' ? 'Requesting…' : micState === 'denied' ? 'Try again' : 'Allow'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
