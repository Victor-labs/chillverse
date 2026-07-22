// src/layout/BlogLayout.tsx
// Standalone chrome for the public blog — deliberately NOT AppLayout.
// Mirrors how discord.com/blog is a separate surface from discord.com/app:
// its own header/footer, reachable and readable by anyone, signed in or not.
//
// Appearance is intentionally NOT tied to the visitor's Chillverse app theme
// (which can be any premium color a signed-in user picked). The blog is a
// public-facing brand surface, so it gets its own fixed two-mode palette —
// true AMOLED black + charcoal for dark, true white for light — toggled
// independently and stored under its own localStorage key. Every child
// component under this layout already styles itself with var(--bg),
// var(--surface), etc., so overriding those custom properties here is
// enough to re-skin the whole blog without touching any of those files.
import { useEffect, useState, type CSSProperties } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Newspaper, Sun, Moon } from 'lucide-react'
import Logo from './Logo'
import Wordmark from './Wordmark'
import { useAuth } from '../features/auth/useAuth'
import { ripple } from '../shared/lib/ripple'

type BlogAppearance = 'dark' | 'light'
const APPEARANCE_STORAGE_KEY = 'cv_blog_appearance'

const DARK_PALETTE: Record<string, string> = {
  '--bg': '#000000',
  '--nav': '#0a0a0a',
  '--surface': '#121212',
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

const LIGHT_PALETTE: Record<string, string> = {
  '--bg': '#ffffff',
  '--nav': '#f7f7f8',
  '--surface': '#ffffff',
  '--surface2': '#f2f2f4',
  '--surface3': '#eaeaec',
  '--active': '#e2e2e6',
  '--popover': '#ffffff',
  '--text': '#0a0a0b',
  '--text-secondary': '#55555c',
  '--text-dim': '#55555c',
  '--text-muted': '#8c8c93',
  '--border': 'rgba(10,10,11,0.09)',
  '--border-strong': 'rgba(10,10,11,0.16)',
  '--sh': 'rgba(20,20,30,0.08)',
  '--sh-strong': 'rgba(20,20,30,0.14)',
  '--hl': 'rgba(255,255,255,0.9)',
  '--hl-faint': 'rgba(255,255,255,0.5)',
  '--glow': 'transparent',
  '--accent': '#ff6b00',
  '--accent2': '#ff9a3c',
  '--accent-soft': 'rgba(255,107,0,0.10)',
  '--overlay-scrim': 'rgba(10,10,11,0.4)',
}

function readStoredAppearance(): BlogAppearance {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem(APPEARANCE_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

export default function BlogLayout() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [appearance, setAppearance] = useState<BlogAppearance>(readStoredAppearance)

  useEffect(() => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
  }, [appearance])

  const palette = appearance === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
  const scopeStyle = { ...palette, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' } as CSSProperties

  return (
    <div style={scopeStyle}>
      <style>{`
        @media (max-width: 640px) {
          .blog-header-link { display: none !important; }
          .blog-header-badge-text { display: none !important; }
          .blog-header-wordmark { display: none !important; }
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
          <Logo size={30} />
          <span className="blog-header-wordmark">
            <Wordmark size={17} animated={false} />
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 800, color: 'var(--text-dim)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '4px 10px', marginLeft: 2, flexShrink: 0,
          }}>
            <Newspaper size={12} /> <span className="blog-header-badge-text">Blog</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span className="blog-header-link"><HeaderLink to="/blog">Latest</HeaderLink></span>
          <span className="blog-header-link"><HeaderLink to="/blog/updates">Update Log</HeaderLink></span>

          <button
            type="button"
            onClick={(e) => { ripple(e); setAppearance(a => a === 'dark' ? 'light' : 'dark') }}
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
            {session ? 'Open App' : 'Log In'}
          </button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '32px clamp(1rem, 4vw, 2.5rem) 64px' }}>
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
        <div style={{ display: 'flex', gap: 18 }}>
          <Link to="/about" style={footerLinkStyle}>About</Link>
          <Link to="/privacy" style={footerLinkStyle}>Privacy</Link>
          <Link to="/terms" style={footerLinkStyle}>Terms</Link>
          <Link to="/" style={footerLinkStyle}>Chillverse Home</Link>
        </div>
      </footer>
    </div>
  )
}

function HeaderLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', textDecoration: 'none',
        padding: '8px 12px', borderRadius: 8,
      }}
    >
      {children}
    </Link>
  )
}

const footerLinkStyle: CSSProperties = {
  fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
}
