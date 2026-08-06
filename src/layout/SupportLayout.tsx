// src/layout/SupportLayout.tsx
// Standalone chrome for the public help center served at
// support.chillverse.com.ng — deliberately NOT AppLayout and NOT behind
// ProtectedRoute, exactly like BlogLayout. Anyone can read articles and
// browse feedback signed out; only "Submit a request" and voting need auth.
//
// Like the blog, appearance is NOT tied to the visitor's in-app theme (which
// can be any premium colour a signed-in user picked) — a help center is a
// public brand surface, so it gets its own fixed two-mode palette under its
// own localStorage key. It defaults to LIGHT because that's what people
// expect from a support site, and because most visitors arrive cold from a
// search engine rather than from inside the dark app.
//
// Layout is modelled on support.discord.com (centred breadcrumb, oversized
// display heading, prominent search, two-column card grid) but painted in
// Chillverse orange rather than blurple.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LifeBuoy, Sun, Moon } from 'lucide-react'
import Logo from './Logo'
import Wordmark from './Wordmark'
import { useAuth } from '../features/auth/useAuth'
import { ripple } from '../shared/lib/ripple'

type SupportAppearance = 'dark' | 'light'
const APPEARANCE_STORAGE_KEY = 'cv_support_appearance'

const DARK_PALETTE: Record<string, string> = {
  '--bg': '#0b0b0c',
  '--nav': '#0a0a0a',
  '--surface': '#141416',
  '--surface2': '#1c1c1e',
  '--surface3': '#242426',
  '--active': '#2a2a2c',
  '--popover': '#161616',
  '--text': '#ffffff',
  '--text-secondary': '#b3b3b3',
  '--text-dim': '#b3b3b3',
  '--text-muted': '#7a7a7a',
  '--border': 'rgba(255,255,255,0.09)',
  '--border-strong': 'rgba(255,255,255,0.16)',
  '--sh': 'rgba(0,0,0,0.6)',
  '--sh-strong': 'rgba(0,0,0,0.8)',
  '--hl': 'rgba(255,255,255,0.045)',
  '--hl-faint': 'rgba(255,255,255,0.02)',
  '--glow': 'transparent',
  '--accent': '#ff6b00',
  '--accent2': '#ff9a3c',
  '--accent-soft': 'rgba(255,107,0,0.16)',
  '--overlay-scrim': 'rgba(0,0,0,0.7)',
}

// Discord tints its help center a pale brand colour rather than pure white.
// Same idea here, with Chillverse orange at very low saturation.
const LIGHT_PALETTE: Record<string, string> = {
  '--bg': '#fdf6f0',
  '--nav': '#fffaf6',
  '--surface': '#ffffff',
  '--surface2': '#f6ede5',
  '--surface3': '#efe2d6',
  '--active': '#e7d6c6',
  '--popover': '#ffffff',
  '--text': '#14100d',
  '--text-secondary': '#5c534c',
  '--text-dim': '#5c534c',
  '--text-muted': '#8d8177',
  '--border': 'rgba(20,16,13,0.10)',
  '--border-strong': 'rgba(20,16,13,0.18)',
  '--sh': 'rgba(60,40,20,0.08)',
  '--sh-strong': 'rgba(60,40,20,0.14)',
  '--hl': 'rgba(255,255,255,0.9)',
  '--hl-faint': 'rgba(255,255,255,0.5)',
  '--glow': 'transparent',
  '--accent': '#ff6b00',
  '--accent2': '#ff9a3c',
  '--accent-soft': 'rgba(255,107,0,0.12)',
  '--overlay-scrim': 'rgba(20,16,13,0.4)',
}

function readStoredAppearance(): SupportAppearance {
  if (typeof window === 'undefined') return 'light'
  return localStorage.getItem(APPEARANCE_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export default function SupportLayout() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [appearance, setAppearance] = useState<SupportAppearance>(readStoredAppearance)

  useEffect(() => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
  }, [appearance])

  const palette = appearance === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
  const scopeStyle = {
    ...palette,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    color: 'var(--text)',
  } as CSSProperties

  const isFeedback = location.pathname.startsWith('/support/feedback')

  return (
    <div style={scopeStyle}>
      <style>{`
        @media (max-width: 640px) {
          .support-header-link { display: none !important; }
          .support-header-badge-text { display: none !important; }
          .support-header-wordmark { display: none !important; }
        }
      `}</style>

      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, height: 64, padding: '0 clamp(1rem, 4vw, 2.5rem)',
          background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
          backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)',
        }}
      >
        <Link to="/support" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
          <Logo size={30} />
          <span className="support-header-wordmark">
            <Wordmark size={17} animated={false} />
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 800, color: 'var(--text-dim)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '4px 10px', marginLeft: 2, flexShrink: 0,
          }}>
            <LifeBuoy size={12} /> <span className="support-header-badge-text">Help</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span className="support-header-link"><HeaderLink to="/support/feedback" active={isFeedback}>Feedback</HeaderLink></span>
          <span className="support-header-link"><HeaderLink to="/support/tickets/new">Submit a request</HeaderLink></span>

          <button
            type="button"
            onClick={(e) => { ripple(e); setAppearance(a => (a === 'dark' ? 'light' : 'dark')) }}
            className="ripple-wrap"
            title={appearance === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              marginLeft: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 999,
              background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)',
            }}
          >
            {appearance === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            type="button"
            onClick={(e) => { ripple(e); navigate(session ? '/dashboard' : '/login') }}
            className="ripple-wrap"
            style={{
              marginLeft: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              border: 'none', borderRadius: 999, padding: '9px 18px',
            }}
          >
            {session ? 'Open App' : 'Sign in'}
          </button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '28px clamp(1rem, 4vw, 2.5rem) 64px' }}>
        <Outlet />
      </main>

      <footer style={{
        borderTop: '1px solid var(--border)', padding: '24px clamp(1rem, 4vw, 2.5rem)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={18} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Chillverse</span>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/support" style={footerLinkStyle}>Help Center</Link>
          <Link to="/support/feedback" style={footerLinkStyle}>Feedback</Link>
          <Link to="/blog" style={footerLinkStyle}>Blog</Link>
          <Link to="/privacy" style={footerLinkStyle}>Privacy</Link>
          <Link to="/terms" style={footerLinkStyle}>Terms</Link>
          <Link to="/" style={footerLinkStyle}>Chillverse Home</Link>
        </div>
      </footer>
    </div>
  )
}

function HeaderLink({ to, children, active }: { to: string; children: ReactNode; active?: boolean }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 12.5, fontWeight: 700,
        color: active ? 'var(--text)' : 'var(--text-dim)',
        textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
        background: active ? 'var(--surface2)' : 'transparent',
      }}
    >
      {children}
    </Link>
  )
}

const footerLinkStyle: CSSProperties = {
  fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
}

/**
 * Oversized centred page heading, the one visual signature the Discord help
 * center leans on hardest. Exported so every support page renders it
 * identically instead of each re-deriving the clamp() sizing.
 */
export function SupportDisplayHeading({ children }: { children: ReactNode }) {
  return (
    <h1 style={{
      margin: '8px 0 24px', textAlign: 'center',
      fontSize: 'clamp(2.4rem, 9vw, 5rem)', lineHeight: 1.02,
      fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase',
      color: 'var(--accent)',
    }}>
      {children}
    </h1>
  )
}
