// src/components/Nav.tsx
import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'
import Logo from './Logo'

export default function Nav() {
  return (
    <nav
      data-theme="midnight"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-between h-[64px] px-5 md:px-10 bg-[rgba(9,9,12,0.55)] backdrop-blur-3xl backdrop-saturate-150 border-b border-white/[0.07] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
    >
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <Logo size={32} className="drop-shadow-[0_0_14px_color-mix(in srgb, var(--accent) 35%, transparent)]" />
        <Wordmark size={19} animated />
      </Link>

      <Link
        to="/login"
        className="px-6 py-[9px] rounded-full text-sm font-semibold text-white no-underline bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_4px_24px_rgba(108,80,255,0.45)] hover:-translate-y-px hover:shadow-[0_6px_30px_rgba(108,80,255,0.6)] transition-all"
      >
        Open Chillverse
      </Link>
    </nav>
  )
}
