// src/components/Nav.tsx
import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'

const NAV_LINKS: Array<[href: string, label: string]> = [
  ['/#features', 'Features'],
  ['/#leaderboard', 'Leaderboard'],
  ['/#community', 'Community'],
]

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-between h-[60px] px-5 md:px-10 bg-[rgba(5,5,6,0.75)] backdrop-blur-2xl border-b border-chill-border">
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        {/* Spinning, glowing mini cube logo */}
        <div className="w-[34px] h-[34px]" style={{ perspective: '130px' }}>
          <div
            className="w-[34px] h-[34px] relative"
            style={{ transformStyle: 'preserve-3d', animation: 'nav-spin 16s linear infinite' }}
          >
            <div
              className="nav-logo-face absolute w-[34px] h-[34px] flex items-center justify-center rounded-md text-[10px] font-extrabold font-mono text-chill-violetSoft bg-chill-violet/12 border-[1.5px] border-chill-violet/70"
              style={{ transform: 'translateZ(17px)' }}
            >
              CV
            </div>
          </div>
        </div>
        <Wordmark size={20} animated />
      </Link>

      <ul className="hidden md:flex items-center gap-8 list-none m-0 p-0">
        {NAV_LINKS.map(([href, label]) => (
          <li key={label}>
            <a
              href={href}
              className="text-sm font-medium text-chill-textSecondary hover:text-chill-text transition-colors no-underline"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>

      <Link
        to="/login"
        className="px-[22px] py-[9px] rounded-full text-sm font-bold text-white no-underline bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_4px_24px_rgba(108,80,255,0.45)] hover:-translate-y-px transition-all"
      >
        Play Now →
      </Link>
    </nav>
  )
}
