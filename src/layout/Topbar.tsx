// src/components/Topbar.tsx
import { Link } from 'react-router-dom'
import { MessageCircle, ArrowLeft } from 'lucide-react'
import NotificationBell from '../features/notifications/NotificationBell'

interface TopbarProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  onMenuClick: () => void
}

export default function Topbar({ title, showBack, onBack, onMenuClick }: TopbarProps) {
  return (
    <header className="topbar-shell">
      <div className="flex items-center gap-3">
        {/* Back button — shown on sub-pages (all devices) */}
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--surface)',
              boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
              border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          /* Hamburger — only on mobile/tablet, hidden on desktop since sidebar is always visible */
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden flex flex-col gap-[5px] p-2"
            aria-label="Open menu"
            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <span style={{ display: 'block', height: 2, width: 18, background: 'var(--text-dim)', borderRadius: 2 }} />
            <span style={{ display: 'block', height: 2, width: 13, background: 'var(--text-dim)', borderRadius: 2 }} />
            <span style={{ display: 'block', height: 2, width: 16, background: 'var(--text-dim)', borderRadius: 2 }} />
          </button>
        )}

        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          to="/chat"
          aria-label="Chat"
          style={{
            width: 38, height: 38,
            borderRadius: 10,
            background: 'var(--surface)',
            boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <MessageCircle size={17} />
        </Link>
      </div>
    </header>
  )
}
