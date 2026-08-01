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

// The baseball player — used ALONE peeking above the leaderboard card.
// Not paired with any other character.
const BASEBALL_PLAYER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Baseballplayer.png'

// Ree — the crew illustration that peeks above the footer.
const REE = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Ree.png'

// New cards: movies/entertainment hub, and the community/discussion hub.
const MOVIES_ART = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Movies.png'
const EARTH_ART = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Earth.png'

// Ambient background art. Exactly THREE images total on the whole page —
// one per section, not the same 3 pngs repeated over and over. Motion is
// bounded now too (see useScrollParallax): each drifts a little as its own
// section passes through the viewport, then holds at a capped offset — it
// no longer keeps drifting further the longer/lower the page gets.
const BG_ASSETS = {
  bomb: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Bomb.png',
  game: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Game.png',
  flyer: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Flyer.png',
}

// Tracks the element's OWN position relative to the viewport (not raw,
// ever-growing window.scrollY) and applies a translateY scaled by `speed`,
// clamped to +/-maxOffset. Because it's relative to the element's own
// position, the drift naturally settles near 0 once the element is well
// off-screen in either direction, and it never exceeds maxOffset no matter
// how long the page is — this is the "stop at a limit" behaviour, instead
// of the old version where translateY = scrollY * speed grew without
// bound the further down a long page you scrolled.
function useScrollParallax(speed: number, maxOffset = 50) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let ticking = false
    const apply = () => {
      const el = ref.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const viewportCenter = window.innerHeight / 2
        const elementCenter = rect.top + rect.height / 2
        const raw = (viewportCenter - elementCenter) * speed
        const clamped = Math.max(-maxOffset, Math.min(maxOffset, raw))
        el.style.transform = `translateY(${clamped}px)`
      }
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
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [speed, maxOffset])
  return ref
}

// A single background illustration, positioned absolutely inside whatever
// `relative` section wraps it. Bumped up from opacity-80 to opacity-95 and
// dropped the "hidden sm:block / hidden md:block" gating so it no longer
// disappears at in-between viewport widths.
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
      <img src={src} alt={alt} className="w-full h-auto opacity-95 drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]" loading="lazy" />
    </div>
  )
}

// One of the two static characters "standing behind" the leaderboard copy,
// like it's a wall — only head-to-stomach shows above. Achieved with a
// bottom mask-fade on the image itself so the cutoff is clean.
function PeekingCharacter({ src, className }: { src: string; className: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      className={`absolute h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)] ${className}`}
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
        maskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
      }}
    />
  )
}

// Pill accents for the small feature tags — colors pulled from the real
// marketing tokens in index.css (--amber / --cyan), not the old dead
// `chill-*` classes that don't exist in tailwind.config.js.
const ACCENT_MAP: Record<string, { pill: string }> = {
  amber: { pill: 'bg-[rgba(255,184,0,0.10)] text-[var(--amber)] border-[rgba(255,184,0,0.25)]' },
  cyan:  { pill: 'bg-[rgba(0,229,255,0.12)] text-[var(--cyan)] border-[rgba(0,229,255,0.25)]' },
}

export default function Landing() {
  useReveal()
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading && session) navigate('/dashboard', { replace: true })
  }, [loading, session, navigate])

  return (
    // `landing-root` is what actually applies the marketing background
    // (--lbg, a soft #050506) and text color (--ltext) from index.css.
    // The old `className="contents"` set display:contents, which strips
    // the element from the box model entirely — so this background rule
    // was never able to paint, and the page fell back to the app shell's
    // pure #000000 midnight background instead. That's the real reason
    // it read as flatter/less transparent than intended.
    <div data-theme="midnight" className="landing-root">
      <Seo
        title="Chillverse — Play. Connect. Dominate."
        description="Play fast-paced games, build streaks, climb the leaderboard, and chat with your crew — all in one social gaming universe. Join Chillverse free."
        jsonLd={HOME_JSON_LD}
      />
      <Nav />

      {/* ── HERO ──
          No parallax art up top anymore — the bomb was sitting right under
          the nav, way too high. Parallax now only kicks in from the flyer's
          position (bottom of hero, where it was originally marked). */}
      <section className="relative flex flex-col items-center justify-start overflow-hidden px-5 sm:px-6 md:px-16 pt-14 sm:pt-16 md:pt-20 pb-16 sm:pb-20 min-h-[auto]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <div className="w-[600px] h-[600px] rounded-full bg-[rgba(108,80,255,0.10)] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-[rgba(0,229,255,0.08)] blur-[100px] -translate-x-24 translate-y-16" />
        </div>

        <BgArt src={BG_ASSETS.flyer} alt="" speed={0.24} className="block bottom-[4%] right-[4%] w-20 sm:w-28 md:w-36 rotate-3" />

        <div className="relative z-[6] flex flex-col items-center text-center max-w-2xl w-full">
          <img
            src={ART.mascot}
            alt="The Chillverse crew"
            className="block w-[340px] sm:w-[460px] md:w-[560px] lg:w-[640px] h-auto mb-5 sm:mb-7 drop-shadow-[0_30px_70px_rgba(108,80,255,0.4)]"
          />

          <h1
            className="leading-[1.02] mb-4 text-[clamp(30px,7vw,54px)] tracking-wide uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800 }}
          >
            <span>Play. Win. </span>
            <span className="text-gradient">Dominate.</span>
          </h1>

          <p className="text-sm sm:text-base text-[var(--ltext-sec)] max-w-[320px] sm:max-w-md mx-auto mb-8 leading-relaxed">
            Chillverse brings movies, anime, games, community, and exclusive experiences together in one seamless platform.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Link
              to="/signup"
              className="px-9 sm:px-10 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-bold text-white bg-gradient-to-br from-[var(--violet)] to-[#3d1fb5] shadow-[0_4px_16px_rgba(108,80,255,0.25)] hover:-translate-y-1 hover:shadow-[0_6px_22px_rgba(108,80,255,0.35)] transition-all whitespace-nowrap"
            >
              Enter Chillverse →
            </Link>
            <a href="#features" className="text-xs sm:text-sm font-medium text-[var(--ltext-muted)] hover:text-[var(--violet-soft)] transition-colors">
              See what's inside
            </a>
          </div>
        </div>
      </section>

      {/* ── ARSENAL + HOW IT WORKS, merged ──
          Controller now peeks above the card the same way the baseball
          player peeks above the leaderboard card — consistent treatment
          across the page instead of being a plain inline image. */}
      <section id="features" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.bomb} alt="" speed={0.14} className="block top-[2%] left-[2%] w-16 sm:w-24 lg:w-28 -rotate-6" />

        <div className="relative pt-14 sm:pt-16 md:pt-20">
          <PeekingCharacter
            src={ART.controller}
            className="left-1/2 -translate-x-1/2 top-0 z-[2] w-[130px] sm:w-[160px] md:w-[190px]"
          />

          <div className="reveal glass-panel-strong glow-violet-tint rounded-[28px] p-7 sm:p-10 md:p-14 text-center max-w-xl mx-auto overflow-visible">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Built for players.</h2>
            <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed mb-3">
              Fast games, real streaks, a profile that's actually yours. Create it, jump into a match, and start climbing, your first win is seconds away.
            </p>

            <Link
              to="/signup"
              className="inline-block mt-8 text-sm font-semibold text-[var(--violet-soft)] hover:underline"
            >
              Jump in, it takes 60 seconds →
            </Link>
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD ──
          Ree peeks in from ABOVE the card — outside its bounds, like the
          Discord reference (crew half-visible over the top edge of the
          card, rest tucked behind it) — not sitting inside the card's
          own grid like before. The wrapping div here (not the card) is
          what needs the top padding + overflow-visible, so the art has
          room to poke up past the card's edge without getting clipped. */}
      <section id="leaderboard" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.game} alt="" speed={0.2} className="block bottom-[8%] right-[3%] w-16 sm:w-24 lg:w-28 rotate-6" />

        <div className="relative pt-14 sm:pt-16 md:pt-20">
          <PeekingCharacter
            src={BASEBALL_PLAYER}
            className="left-1/2 -translate-x-1/2 top-0 z-[2] w-[190px] sm:w-[250px] md:w-[300px] lg:w-[340px]"
          />

          <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 text-center max-w-xl mx-auto overflow-visible">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">The top is within reach.</h2>
            <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed mb-7">
              Real-time leaderboards show exactly where you stand, and what it takes to rise. Every game counts.
            </p>
            <Link
              to="/login"
              className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-[var(--violet)] to-[#3d1fb5] shadow-[0_4px_16px_rgba(108,80,255,0.25)] hover:-translate-y-1 transition-all"
            >
              Check your rank →
            </Link>
          </div>
        </div>
      </section>

      {/* ── STREAK & CHAT — third glass card ──
          Streak/Chat art is fixed at the card's corners, hanging off the
          edge like stickers, not inside the copy, not drifting. */}
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
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Never miss a beat.</h2>
            <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed mb-6">
              Log in, play, stay hot, your streak is your reputation. Then trash talk, team up, or just vibe with your crew in real time.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${ACCENT_MAP.amber.pill}`}>Daily XP</span>
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${ACCENT_MAP.cyan.pill}`}>Real-time chat</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── MOVIES / ENTERTAINMENT ──
          Camera art peeks in from ABOVE the card, same treatment as the
          controller/baseball player — not boxed inside a grid column. */}
      <section className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="relative pt-14 sm:pt-16 md:pt-20">
          <PeekingCharacter
            src={MOVIES_ART}
            className="left-1/2 -translate-x-1/2 top-0 z-[2] w-[140px] sm:w-[175px] md:w-[205px]"
          />

          <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 text-center max-w-xl mx-auto overflow-visible">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Lights. Camera. Chillverse.</h2>
            <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed">
              Discover trending blockbusters, timeless classics, anime, TV series, and hidden gems, all carefully organized in one place. Whether you're in the mood for action, romance, comedy, horror, or sci-fi, your next binge-worthy watch is just a click away.
            </p>
          </div>
        </div>
      </section>

      {/* ── COMMUNITY ──
          Earth art peeks in from ABOVE the card, same treatment as the
          movies section above — not boxed inside a grid column. */}
      <section className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <div className="relative pt-14 sm:pt-16 md:pt-20">
          <PeekingCharacter
            src={EARTH_ART}
            className="left-1/2 -translate-x-1/2 top-0 z-[2] w-[140px] sm:w-[175px] md:w-[205px]"
          />

          <div className="reveal glass-panel-strong glow-green-tint rounded-[28px] p-7 sm:p-10 md:p-14 text-center max-w-xl mx-auto overflow-visible">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight mb-4">Stay Connected Beyond Entertainment</h2>
            <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed">
              Discover trending discussions, community highlights, announcements, creator updates, and everything happening across Chillverse. Join conversations, share your thoughts, and never miss what's new.
            </p>
          </div>
        </div>
      </section>

      {/* ── LAST WORD — simple tagline, no buttons, no card ──
          Extra bottom padding here is deliberate: it's the clearance the
          footer-peek image below needs so it doesn't climb up over this
          text (it was overlapping "universe" before). */}
      <section className="relative px-6 pt-20 sm:pt-24 pb-40 sm:pb-48 md:pb-56 text-center">
        <p className="reveal text-gradient text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
          Your universe. Your rules.
        </p>
      </section>

      {/* ── FOOTER PEEK ──
          Ree peeks up from behind the footer — head-to-stomach visible,
          legs tucked out of sight below the footer's top edge. The image
          renders BEFORE the footer in the DOM so the footer's own
          translucent background paints over its lower half, which is
          what actually sells "peeking from behind" rather than the art
          just floating above the footer as a separate element. Offset is
          intentionally smaller than before, paired with the extra
          padding above, so it clears the tagline text. */}
      <div className="relative">
        <PeekingCharacter
          src={REE}
          className="left-1/2 -translate-x-1/2 -top-[90px] sm:-top-[110px] md:-top-[130px] w-[180px] sm:w-[220px] md:w-[250px]"
        />
        <Footer />
      </div>
    </div>
  )
}
