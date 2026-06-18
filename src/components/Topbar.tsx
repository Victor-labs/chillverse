// src/components/Topbar.tsx
import { Link } from 'react-router-dom'
import { Menu, Bell, MessageCircle } from 'lucide-react'

interface TopbarProps {
  title: string
  onMenuClick: () => void
}

/**
 * Fixed top bar for authenticated pages. Title is supplied by AppLayout
 * (derived from the route), not hardcoded here, so it stays correct on
 * both /dashboard and every /coming-soon?feature=X destination.
 */
export default function Topbar({ title, onMenuClick }: TopbarProps) {
  return (
    <header className="glass-panel fixed top-0 right-0 left-0 md:left-[260px] z-[300] flex items-center justify-between gap-4 px-5 md:px-8 py-4">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden text-chill-text hover:text-chill-violetSoft transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <Link
          to="/coming-soon?feature=Notifications"
          className="w-10 h-10 rounded-full flex items-center justify-center text-chill-textSecondary hover:text-chill-text hover:bg-white/5 transition-all"
          aria-label="Notifications"
        >
          <Bell size={19} />
        </Link>
        <Link
          to="/coming-soon?feature=Chat"
          className="w-10 h-10 rounded-full flex items-center justify-center text-chill-textSecondary hover:text-chill-text hover:bg-white/5 transition-all"
          aria-label="Chat"
        >
          <MessageCircle size={19} />
        </Link>
      </div>
    </header>
  )
}
