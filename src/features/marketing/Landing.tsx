// src/pages/Landing.tsx
import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import { useReveal } from './useReveal'
import { useAuth } from '../auth/useAuth'
import Seo from '../../shared/components/Seo'

// NOTE: no SearchAction here. Sitelinks-searchbox schema is only valid if the
// target URL works for a logged-out visitor — Chillverse's /search is behind
// auth, so pointing Google there would send anonymous searchers into a login
// wall. Add SearchAction back once there's a public search surface (e.g. a
// public player/leaderboard search, or blog search).
const HOME_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Chillverse',
    url: 'https://chillverse.com.ng',
  },
]

// Decorative / illustrative assets — hosted on Supabase storage.
const DRIFT = {
  willam: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Willam2.png',
  controller: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Controller.png',
  mascot: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Mascot.png',
}

// The static hero character — anchored beside the leaderboard mock on
// larger screens, and layered in behind it (low-opacity, blurred) on
// mobile so phones get a "player" presence too instead of nothing.
const HERO_CHARACTER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Baseballplayer.png'

const FEATURES = [
  { icon: DRIFT.controller, title: 'Play Games', accent: 'violet' },
  { icon: DRIFT.willam, title: 'Streak System', accent: 'amber' },
  { icon: DRIFT.controller, title: 'Leaderboards', accent: 'pink' },
  { icon: DRIFT.willam, title: 'Chat & Crew', accent: 'cyan' },
  { icon: DRIFT.controller, title: 'Your Profile', accent: 'green' },
]

// Real in-app profile pictures (pulled from the Mall's profile_pic catalog)
// so the leaderboard mock reads as an actual snapshot of the app instead of
// a placeholder. Only single-person, original-character pics were used —
// licensed/celebrity-likeness items in the catalog were deliberately
// skipped since this card is public-facing marketing, not gated in-app UI.
const LEADERBOARD_AVATARS = {
  zeroKnight: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Asher2.jpg',
  neonX: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Jax1.jpg',
  voidRacer: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Rhinna1.jpg',
  skyKid: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Nolan1.png',
}

// Tracks scroll position imperatively (no re-renders) and applies a
// translateY to the returned ref's element, scaled by `speed`. Positive
// speed = drifts further down as the page scrolls, matching the layered
// parallax feel of Discord's marketing page. Kept separate from the
// ambient drift-a/b/c keyframes below so both motions compose cleanly
// (scroll transform on the outer wrapper, idle drift on the inner one).
function useScrollParallax(speed: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let ticking = false
    const apply = () => {
      if (ref.current) ref.current.style.transform = `translateY(${window.scrollY * speed}px)`
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(apply)
      }
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])
  return ref
}

// Reusable drifting decorative image — floats bare with just a soft
// drop-shadow, no card/frame around it. `speed` controls how much it
// parallaxes against scroll (0 = static; ~0.2–0.35 reads as an obvious
// Discord-style layered drift as the page scrolls).
function DriftImg({
  src,
  alt,
  wrapperClassName,
  imgClassName = 'w-full h-auto',
  motion = 'drift-a',
  speed = 0.1,
}: {
  src: string
  alt: string
  wrapperClassName: string
  imgClassName?: string
  motion?: 'drift-a' | 'drift-b' | 'drift-c'
  speed?: number
}) {
  const parallaxRef = useScrollParallax(speed)
  return (
    <div ref={parallaxRef} className={`drift-outer ${wrapperClassName}`}>
      <div className={`drift-item ${motion}`}>
        <img src={src} alt={alt} className={imgClassName} loading="lazy" />
      </div>
    </div>
  )
}

// Fixed, viewport-pinned ambient layer — sits behind every section so the
// page never reads as flat black. A few softly blurred colour blooms plus
// a handful of near-invisible glyphs drifting on the existing keyframes
// give the whole scroll a frosted-glass depth instead of a plain #050506
// backdrop. Purely decorative: aria-hidden, no pointer events, and backs
// off entirely under reduced-motion.
function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full bg-chill-violet/[0.08] blur-[140px]" />
      <div className="absolute top-1/3 -right-20 w-[420px] h-[420px] rounded-full bg-chill-cyan/[0.06] blur-[130px]" />
      <div className="absolute bottom-0 left-1/4 w-[440px] h-[440px] rounded-full bg-chill-pink/[0.05] blur-[150px]" />
      <div className="hidden sm:block absolute top-[18%] left-[8%] text-4xl opacity-[0.05] drift-a">🎮</div>
      <div className="hidden sm:block absolute top-[55%] right-[10%] text-4xl opacity-[0.05] drift-b">🔥</div>
      <div className="hidden sm:block absolute top-[78%] left-[14%] text-4xl opacity-[0.05] drift-c">💬</div>
      <div className="hidden sm:block absolute top-[38%] left-[46%] text-4xl opacity-[0.04] drift-b">🏆</div>
    </div>
  )
}

const ACCENT_MAP: Record<string, { icon: string; pill: string }> = {
  violet: { icon: 'bg-chill-violet/15', pill: 'bg-chill-violet/15 text-chill-violetSoft border-chill-violet/25' },
  amber:  { icon: 'bg-chill-amber/12', pill: 'bg-chill-amber/10 text-chill-amber border-chill-amber/25' },
  pink:   { icon: 'bg-chill-pink/12', pill: 'bg-chill-pink/12 text-chill-pink border-chill-pink/25' },
  cyan:   { icon: 'bg-chill-cyan/12', pill: 'bg-chill-cyan/12 text-chill-cyan border-chill-cyan/25' },
  green:  { icon: 'bg-chill-green/10', pill: 'bg-chill-green/10 text-chill-green border-chill-green/25' },
}

export default function Landing() {
  useReveal()
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading && session) navigate('/dashboard', { replace: true })
  }, [loading, session, navigate])

  return (
    <div data-theme="midnight" className="contents">
      <Seo
        title="Chillverse — Play. Connect. Dominate."
        description="Play fast-paced games, build streaks, climb the leaderboard, and chat with your crew — all in one social gaming universe. Join Chillverse free."
        jsonLd={HOME_JSON_LD}
      />
      <Nav />
      <AmbientBackground />

      {/* ── HERO ──
          Big mascot display up top (Discord-style), then a tighter
          headline + one line of copy + a single CTA underneath. */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 sm:px-6 md:px-16 pt-32 sm:pt-36 pb-16 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <div className="w-[600px] h-[600px] rounded-full bg-chill-violet/[0.10] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-chill-cyan/[0.08] blur-[100px] -translate-x-24 translate-y-16" />
        </div>

        <div className="relative z-[6] flex flex-col items-center text-center max-w-2xl">
          {/* The big mascot — the whole point of the top of the page.
             Idle-floats gently; no card, no chrome, just the crew. */}
          <div className="drift-outer relative mb-4 sm:mb-6 w-[220px] sm:w-[300px] md:w-[360px]">
            <div className="drift-item drift-a">
              <img
                src={DRIFT.mascot}
                alt="The Chillverse crew"
                className="w-full h-auto drop-shadow-[0_30px_70px_rgba(108,80,255,0.4)]"
              />
            </div>
          </div>

          <h1 className="font-bold leading-[1.02] mb-4 text-[clamp(28px,7vw,52px)] tracking-tight">
            <span className="text-chill-text">Play. Win. </span>
            <span className="text-gradient">Dominate.</span>
          </h1>

          <p className="text-sm sm:text-base text-chill-textSecondary max-w-[300px] sm:max-w-sm mx-auto mb-8 leading-relaxed">
            Compete, build your profile, and keep your streak alive with your crew — all in one platform.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Link
              to="/signup"
              className="px-9 sm:px-10 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_8px_36px_rgba(108,80,255,0.5)] hover:-translate-y-1 hover:shadow-[0_14px_48px_rgba(108,80,255,0.7)] transition-all whitespace-nowrap"
            >
              Enter Chillverse →
            </Link>
            <a href="#features" className="text-xs sm:text-sm font-medium text-chill-textMuted hover:text-chill-violetSoft transition-colors">
              See what's inside
            </a>
          </div>
        </div>
      </section>

      {/* ── ARSENAL + HOW IT WORKS, merged ──
          One Discord-style glass card: short copy + a chip row of what
          the platform does, paired with one big illustration. Replaces
          the old 5-card feature grid + separate 3-step section. */}
      <section id="features" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="reveal glass-panel-strong glow-violet-tint rounded-[28px] p-7 sm:p-10 md:p-14 grid md:grid-cols-2 gap-10 md:gap-14 items-center overflow-hidden">
          <div className="order-2 md:order-1">
            <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// your arsenal</div>
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Built for players.</h2>
            <p className="text-sm sm:text-base text-chill-textSecondary leading-relaxed mb-3">
              Fast games, real streaks, a profile that's actually yours. Create it, jump into a match, and start climbing — your first win is seconds away.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-6">
              {FEATURES.map((f) => {
                const a = ACCENT_MAP[f.accent]
                return (
                  <span
                    key={f.title}
                    className={`inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full border text-xs font-semibold ${a.pill}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center ${a.icon}`}>
                      <img src={f.icon} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                    </span>
                    {f.title}
                  </span>
                )
              })}
            </div>

            <Link
              to="/signup"
              className="inline-block mt-8 text-sm font-semibold text-chill-violetSoft hover:underline"
            >
              Jump in — it takes 60 seconds →
            </Link>
          </div>

          <div className="order-1 md:order-2 flex items-center justify-center">
            <div className="drift-outer relative w-[220px] sm:w-[280px] md:w-full md:max-w-[320px]">
              <div className="drift-item drift-b">
                <img
                  src={DRIFT.controller}
                  alt="Chillverse game controller"
                  className="w-full h-auto drop-shadow-[0_24px_50px_rgba(108,80,255,0.3)]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD, merged into one glass card ──
          Now visible at every breakpoint (not desktop-only), with the
          player characters layered in behind the mock so phones get
          that "player" presence too. */}
      <section id="leaderboard" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center overflow-hidden">
          <div>
            <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// climb the ranks</div>
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">The top is within reach.</h2>
            <p className="text-sm sm:text-base text-chill-textSecondary leading-relaxed mb-7">
              Real-time leaderboards show exactly where you stand — and what it takes to rise. Every game counts.
            </p>
            <Link
              to="/login"
              className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_8px_36px_rgba(108,80,255,0.5)] hover:-translate-y-1 transition-all"
            >
              Check your rank →
            </Link>
          </div>

          <div className="relative flex items-center justify-center py-4" style={{ perspective: '700px' }}>
            {/* Player characters — layered behind the leaderboard card at
               every breakpoint, faded/scaled down on phones so they read
               as background presence rather than clutter. */}
            <img
              src={HERO_CHARACTER}
              alt=""
              aria-hidden
              className="absolute left-[2%] sm:left-[6%] bottom-0 w-[110px] sm:w-[150px] md:w-[190px] h-auto opacity-60 sm:opacity-80 blur-[1px] sm:blur-0 z-0 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              loading="lazy"
            />
            <img
              src={DRIFT.willam}
              alt=""
              aria-hidden
              className="absolute right-[0%] sm:right-[4%] top-[6%] w-[90px] sm:w-[120px] md:w-[150px] h-auto opacity-50 sm:opacity-70 blur-[1px] sm:blur-0 z-0 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              loading="lazy"
            />

            <div className="relative z-10 lb-float">
              <div className="glass-panel rounded-[22px] p-6 sm:p-7 w-[260px] sm:w-80 shadow-[0_40px_80px_rgba(0,0,0,0.7),0_0_80px_rgba(108,80,255,0.2)]">
                <div className="flex items-center justify-between mb-[18px] sm:mb-[22px]">
                  <span className="text-[12px] sm:text-[13px] font-bold tracking-wider text-chill-textMuted uppercase font-mono">Top Players</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-chill-green font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-chill-green live-dot" /> Live
                  </span>
                </div>

                {[
                  { rank: '🥇', avatar: LEADERBOARD_AVATARS.zeroKnight, name: 'ZeroKnight', score: '98,410', streak: 72, ring: 'rgba(255,184,0,0.5)' },
                  { rank: '🥈', avatar: LEADERBOARD_AVATARS.neonX, name: 'NeonX_', score: '91,870', streak: 58, ring: 'rgba(0,229,255,0.4)' },
                  { rank: '🥉', avatar: LEADERBOARD_AVATARS.voidRacer, name: 'VoidRacer', score: '88,220', streak: 41, ring: 'rgba(255,78,205,0.4)' },
                  { rank: '4', avatar: LEADERBOARD_AVATARS.skyKid, name: 'SkyKid', score: '84,100', streak: 35, ring: 'rgba(0,255,135,0.35)' },
                ].map((row) => (
                  <div key={row.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 hover:bg-chill-surface2 transition-colors">
                    <div className="w-[22px] text-center text-xs font-bold font-mono text-chill-textMuted">{row.rank}</div>
                    <div className="w-[34px] h-[34px] rounded-full flex-shrink-0 overflow-hidden" style={{ boxShadow: `0 0 0 2px ${row.ring}` }}>
                      <img src={row.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 text-[13px] font-semibold">{row.name}</div>
                    <div className="text-xs font-bold font-mono text-chill-violetSoft">{row.score}<span className="text-[10px] text-chill-amber ml-1">🔥{row.streak}</span></div>
                  </div>
                ))}

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-chill-violet/10">
                  <div className="w-[22px] text-center text-xs font-bold font-mono text-chill-violetSoft">—</div>
                  <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-chill-violet/20 text-chill-violetSoft">YOU</div>
                  <div className="flex-1 text-[13px] font-semibold text-chill-violetSoft">Your spot</div>
                  <div className="text-xs font-bold font-mono text-chill-violetSoft">???</div>
                </div>
              </div>

              <div className="badge-float absolute -top-4.5 -right-6 sm:-right-12 glass-chip border border-chill-pink/40 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-chill-pink shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2">
                ⚡ +2,400 XP gained!
              </div>
              <div className="badge-float-delay absolute bottom-2.5 -left-4 sm:-left-16 glass-chip border border-chill-cyan/35 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-chill-cyan shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2">
                👥 4 friends online
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LAST WORD — simple tagline, no buttons, no card ── */}
      <section className="relative px-6 py-20 sm:py-24 text-center">
        <p className="reveal text-gradient text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
          Your universe. Your rules.
        </p>
      </section>

      <Footer />
    </div>
  )
}
