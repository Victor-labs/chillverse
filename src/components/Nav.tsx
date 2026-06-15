import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-between px-6 md:px-16 py-4 bg-chill-bg/75 backdrop-blur-2xl border-b border-chill-border">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-9 h-9" style={{ perspective: '130px' }}>
          <div
            className="w-[34px] h-[34px] relative animate-[nav-spin_16s_linear_infinite]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="absolute w-[34px] h-[34px] border-[1.5px] border-chill-violet/70 bg-chill-violet/10 flex items-center justify-center text-[10px] font-bold font-mono text-chill-violetSoft rounded"
              style={{ transform: 'translateZ(17px)' }}>CV</div>
          </div>
        </div>
        <span className="text-xl font-bold text-gradient-2">Chillverse</span>
      </Link>

      <ul className="hidden md:flex items-center gap-8 list-none">
        <li><a href="/#features" className="text-sm font-medium text-chill-textSecondary hover:text-chill-text transition-colors">Features</a></li>
        <li><a href="/#leaderboard" className="text-sm font-medium text-chill-textSecondary hover:text-chill-text transition-colors">Leaderboard</a></li>
        <li><a href="/#community" className="text-sm font-medium text-chill-textSecondary hover:text-chill-text transition-colors">Community</a></li>
      </ul>

      <Link
        to="/login"
        className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_4px_24px_rgba(108,80,255,0.45)] hover:opacity-90 hover:-translate-y-px transition-all"
      >
        Play Now →
      </Link>
    </nav>
  )
}
