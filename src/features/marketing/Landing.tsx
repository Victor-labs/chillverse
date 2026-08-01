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

// Character / feature illustrations — hosted on Supabase storage. These
// are STATIC — no drift, no idle animation. They only ever move if
// explicitly wired to scroll (see BG_ASSETS below).
const ART = {
  willam: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Willam2.png',
  controller: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Controller.png',
  mascot: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Mascot.png',
  streak: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Streak.png',
  chat: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Chat.png',
}

// The static hero character — one of the two figures anchored behind the
// leaderboard card (see PeekingCharacter below).
const HERO_CHARACTER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Baseballplayer.png'

// Ambient background art — the ONLY things on this page that move, and
// only in direct response to scroll position (translateY tied to
// window.scrollY). Hold perfectly still the instant scrolling stops.
const BG_ASSETS = {
  bomb: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Bomb.png',
  game: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Game.png',
  flyer: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Flyer.png',
}

const FEATURES = [
  { icon: ART.controller, title: 'Play Games', accent: 'violet' },
  { icon: ART.willam, title: 'Leaderboards', accent: 'pink' },
  { icon: ART.controller, title: 'Your Profile', accent: 'green' },
]

// Real in-app profile pictures (pulled from the Mall's profile_pic catalog)
// so the leaderboard preview reads as an actual snapshot of the app instead
// of a placeholder. Only single-person, original-character pics were used —
// licensed/celebrity-likeness items in the catalog were deliberately
// skipped since this card is public-facing marketing, not gated in-app UI.
const LEADERBOARD_AVATARS = {
  zeroKnight: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Asher2.jpg',
  neonX: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Jax1.jpg',
  voidRacer: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Rhinna1.jpg',
  skyKid: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Nolan1.png',
}

// Rank colour matches the real Leaderboards page's convention (top 3 get
// the game's accent colour, everyone else stays neutral) — plain numbers,
// not medal emoji, so this reads as the actual product instead of a
// invented mock.
const LEADERBOARD_ROWS = [
  { rank: 1, avatar: LEADERBOARD_AVATARS.zeroKnight, name: 'ZeroKnight', score: '98,410', streak: 72, accent: '#ffb800' },
  { rank: 2, avatar: LEADERBOARD_AVATARS.neonX, name: 'NeonX_', score: '91,870', streak: 58, accent: '#00e5ff' },
  { rank: 3, avatar: LEADERBOARD_AVATARS.voidRacer, name: 'VoidRacer', score: '88,220', streak: 41, accent: '#ff4ecd' },
  { rank: 4, avatar: LEADERBOARD_AVATARS.skyKid, name: 'SkyKid', score: '84,100', streak: 35, accent: 'var(--chill-textMuted, #8a8a94)' },
]

// Tracks scroll position imperatively (no re-renders) and applies a
// translateY to the returned ref's element, scaled by `speed`. This is
// the ONLY motion these background images get — no idle keyframes — so
// they sit perfectly still until the page actually scrolls.
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

// A single background illustration, positioned absolutely inside whatever
// `relative` section wraps it. Visible enough to actually break up the
// black (no blur, no near-zero opacity) but never in front of copy.
function BgArt({
  src,
  alt,
  className,
  speed = 0.15,
}: {
  src: string
  alt: string
  className: string
  speed?: number
}) {
  const ref = useScrollParallax(speed)
  return (
    <div ref={ref} aria-hidden className={`absolute pointer-events-none z-0 ${className}`}>
      <img src={src} alt={alt} className="w-full h-auto opacity-80 drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]" loading="lazy" />
    </div>
  )
}

// One of the two static characters "standing behind" the leaderboard
// card, like it's a wall — only head-to-stomach shows above the card's
// top edge. Achieved with a bottom mask-fade on the image itself so the
// cutoff is clean regardless of the glass card's own transparency.
function PeekingCharacter({ src, className }: { src: string; className: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      className={`absolute z-0 h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)] ${className}`}
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
        maskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
      }}
    />
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

      {/* ── HERO ──
          Everything below is normal document flow now — the mascot is a
          plain block-level image, not absolutely positioned, so it can
          never overlap the headline or paragraph under it again. */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 sm:px-6 md:px-16 pt-32 sm:pt-36 pb-16 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <div className="w-[600px] h-[600px] rounded-full bg-chill-violet/[0.10] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-chill-cyan/[0.08] blur-[100px] -translate-x-24 translate-y-16" />
        </div>

        <BgArt src={BG_ASSETS.bomb} alt="" speed={0.18} className="hidden sm:block top-[8%] left-[4%] w-24 md:w-32 -rotate-6" />
        <BgArt src={BG_ASSETS.flyer} alt="" speed={0.24} className="hidden sm:block bottom-[6%] right-[5%] w-28 md:w-36 rotate-3" />

        <div className="relative z-[6] flex flex-col items-center text-center max-w-2xl w-full">
          {/* The big mascot — genuinely big now, sits in normal flow with
             its own margin so nothing after it can ride up underneath. */}
          <img
            src={ART.mascot}
            alt="The Chillverse crew"
            className="block w-[280px] sm:w-[400px] md:w-[480px] h-auto mb-6 sm:mb-8 drop-shadow-[0_30px_70px_rgba(108,80,255,0.4)]"
          />

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

      {/* ── ARSENAL + HOW IT WORKS, merged ── */}
      <section id="features" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.game} alt="" speed={0.16} className="hidden md:block -top-6 right-[6%] w-28 lg:w-36 rotate-6" />

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
            <img
              src={ART.controller}
              alt="Chillverse game controller"
              className="w-[220px] sm:w-[280px] md:w-full md:max-w-[320px] h-auto drop-shadow-[0_24px_50px_rgba(108,80,255,0.3)]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD, merged into one glass card ──
          Static characters peek up from behind the card like it's a
          wall — head-to-stomach only, no drift. Row list uses plain
          numbered ranks (no medal emoji) to match the real product. */}
      <section id="leaderboard" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center overflow-visible">
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

          <div className="relative flex items-center justify-center py-6">
            {/* Characters behind the card — like it's a wall they're
               standing behind. Positioned so only the top ~40% (head to
               stomach) clears the card's top edge; mask-fades the rest. */}
            <PeekingCharacter
              src={HERO_CHARACTER}
              className="left-[6%] sm:left-[10%] -top-2 sm:top-0 w-[100px] sm:w-[130px] md:w-[160px]"
            />
            <PeekingCharacter
              src={ART.willam}
              className="right-[6%] sm:right-[10%] -top-4 sm:-top-2 w-[90px] sm:w-[115px] md:w-[140px]"
            />

            <div className="relative z-10 w-[260px] sm:w-80">
              <div className="glass-panel rounded-[22px] p-6 sm:p-7 shadow-[0_40px_80px_rgba(0,0,0,0.7),0_0_80px_rgba(108,80,255,0.2)]">
                <div className="flex items-center justify-between mb-[18px] sm:mb-[22px]">
                  <span className="text-[12px] sm:text-[13px] font-bold tracking-wider text-chill-textMuted uppercase font-mono">Top Players</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-chill-green font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-chill-green live-dot" /> Live
                  </span>
                </div>

                {LEADERBOARD_ROWS.map((row) => (
                  <div key={row.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 hover:bg-chill-surface2 transition-colors">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold font-mono"
                      style={{ background: row.rank <= 3 ? `${row.accent}22` : 'transparent', color: row.accent }}
                    >
                      {row.rank}
                    </div>
                    <div className="w-[30px] h-[30px] rounded-full flex-shrink-0 overflow-hidden">
                      <img src={row.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 text-[13px] font-semibold">{row.name}</div>
                    <div className="text-xs font-bold font-mono text-chill-violetSoft">{row.score}<span className="text-[10px] text-chill-amber ml-1">🔥{row.streak}</span></div>
                  </div>
                ))}

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-chill-violet/10">
                  <div className="w-6 h-6 text-center text-xs font-bold font-mono text-chill-violetSoft flex items-center justify-center">—</div>
                  <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 bg-chill-violet/20 text-chill-violetSoft">YOU</div>
                  <div className="flex-1 text-[13px] font-semibold text-chill-violetSoft">Your spot</div>
                  <div className="text-xs font-bold font-mono text-chill-violetSoft">???</div>
                </div>
              </div>

              <div className="badge-float absolute -top-4.5 -right-4 sm:-right-10 glass-chip border border-chill-pink/40 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-chill-pink shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2 z-20">
                ⚡ +2,400 XP gained!
              </div>
              <div className="badge-float-delay absolute bottom-2.5 -left-2 sm:-left-12 glass-chip border border-chill-cyan/35 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-chill-cyan shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2 z-20">
                👥 4 friends online
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STREAK & CHAT — third glass card ──
          Streak/Chat art is fixed at the card's corners, hanging off the
          edge like stickers — not inside the copy, not drifting. */}
      <section className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="reveal glass-panel-strong glow-pink-tint rounded-[28px] p-7 sm:p-10 md:p-14 relative overflow-visible">
          <img
            src={ART.streak}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -top-6 -left-4 sm:-top-8 sm:-left-8 w-16 sm:w-24 md:w-28 h-auto z-20 drop-shadow-[0_16px_30px_rgba(0,0,0,0.5)]"
          />
          <img
            src={ART.chat}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -bottom-6 -right-4 sm:-bottom-8 sm:-right-8 w-16 sm:w-24 md:w-28 h-auto z-20 drop-shadow-[0_16px_30px_rgba(0,0,0,0.5)]"
          />

          <div className="max-w-lg mx-auto text-center">
            <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// stay in it</div>
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Never miss a beat.</h2>
            <p className="text-sm sm:text-base text-chill-textSecondary leading-relaxed mb-6">
              Log in, play, stay hot — your streak is your reputation. Then trash talk, team up, or just vibe with your crew in real time.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${ACCENT_MAP.amber.pill}`}>Daily XP</span>
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${ACCENT_MAP.cyan.pill}`}>Real-time chat</span>
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
