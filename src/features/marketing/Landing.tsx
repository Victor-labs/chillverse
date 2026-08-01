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

// The two static figures that now stand close together, centered, behind
// the leaderboard copy card (see PeekingCharacter below). No mock list, no
// floating badges — just the pair of characters as the section's visual.
const HERO_CHARACTER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Baseballplayer.png'

// TODO(Richard): swap this src for the exact png you want dropped into the
// empty slot between the closing tagline and the footer (marked in your
// screenshot). Using ART.mascot as a placeholder for now so the slot isn't
// empty — point it at the real asset URL once you've got it in Supabase.
const CLOSING_ART = ART.mascot

// Ambient background art — the ONLY things on this page that move, and
// only in direct response to scroll position (translateY tied to
// window.scrollY). Hold perfectly still the instant scrolling stops.
// These now run the full length of the page (both sides, every section)
// instead of stopping after the second card.
const BG_ASSETS = {
  bomb: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Bomb.png',
  game: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Game.png',
  flyer: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Flyer.png',
}

// Tracks scroll position imperatively (no re-renders) and applies a
// translateY to the returned ref's element, scaled by `speed`. This is
// the ONLY motion these background images get — no idle keyframes — so
// they sit perfectly still until the page actually scrolls. Positive
// speed drifts an image down as you scroll down (and back up as you
// scroll up); that's the whole "parallax" effect.
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
      className={`absolute z-0 h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)] ${className}`}
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
        maskImage: 'linear-gradient(to bottom, black 58%, transparent 82%)',
      }}
    />
  )
}

// Scroll-triggered "lazy load bounce up". useReveal() queries every
// `.reveal` element on mount and adds `.in` once it's in view (see
// useReveal.ts) — so this piggybacks on that same observer by ALSO
// carrying the `.reveal` class (required, or useReveal never finds it),
// then overrides the motion with a spring-eased translate instead of the
// standard fade used everywhere else. Scoped inline so it works without
// touching the global stylesheet.
const BOUNCE_STYLE = `
  .reveal-bounce { opacity: 0; transform: translateY(48px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .reveal-bounce.in { opacity: 1; transform: translateY(0); }
`

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
      <style>{BOUNCE_STYLE}</style>
      <Nav />

      {/* ── HERO ──
          No parallax art up top anymore — the bomb was sitting right under
          the nav, way too high. Parallax now only kicks in from the flyer's
          position (bottom of hero, where it was originally marked). */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 sm:px-6 md:px-16 pt-32 sm:pt-36 pb-16 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <div className="w-[600px] h-[600px] rounded-full bg-[rgba(108,80,255,0.10)] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-[rgba(0,229,255,0.08)] blur-[100px] -translate-x-24 translate-y-16" />
        </div>

        <BgArt src={BG_ASSETS.flyer} alt="" speed={0.24} className="block bottom-[4%] right-[4%] w-20 sm:w-28 md:w-36 rotate-3" />

        <div className="relative z-[6] flex flex-col items-center text-center max-w-2xl w-full">
          <img
            src={ART.mascot}
            alt="The Chillverse crew"
            className="block w-[280px] sm:w-[400px] md:w-[480px] h-auto mb-6 sm:mb-8 drop-shadow-[0_30px_70px_rgba(108,80,255,0.4)]"
          />

          <h1 className="font-bold leading-[1.02] mb-4 text-[clamp(28px,7vw,52px)] tracking-tight">
            <span>Play. Win. </span>
            <span className="text-gradient">Dominate.</span>
          </h1>

          <p className="text-sm sm:text-base text-[var(--ltext-sec)] max-w-[300px] sm:max-w-sm mx-auto mb-8 leading-relaxed">
            Compete, build your profile, and keep your streak alive with your crew, all in one platform.
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

      {/* ── ARSENAL + HOW IT WORKS, merged ── */}
      <section id="features" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.bomb} alt="" speed={0.14} className="block top-[2%] left-[2%] w-16 sm:w-24 lg:w-28 -rotate-6" />
        <BgArt src={BG_ASSETS.game} alt="" speed={0.16} className="block -top-6 right-[4%] w-20 sm:w-28 lg:w-36 rotate-6" />

        <div className="reveal glass-panel-strong glow-violet-tint rounded-[28px] p-7 sm:p-10 md:p-14 grid md:grid-cols-2 gap-10 md:gap-14 items-center overflow-hidden">
          <div className="order-2 md:order-1">
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

      {/* ── LEADERBOARD ──
          Mock "Top Players" card and the floating XP/friends badges are
          gone entirely, so this doesn't read as junked-up anymore. The two
          characters no longer flank a card at the edges, they now stand
          close together, centered, roughly mid-section. */}
      <section id="leaderboard" className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.flyer} alt="" speed={0.15} className="block top-[10%] left-[3%] w-16 sm:w-24 lg:w-28 -rotate-3" />
        <BgArt src={BG_ASSETS.game} alt="" speed={0.2} className="block bottom-[8%] right-[3%] w-16 sm:w-24 lg:w-28 rotate-6" />

        <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center overflow-visible">
          <div>
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

          <div className="relative flex items-center justify-center py-10 min-h-[220px]">
            {/* The two characters, close together and centered, standing
               in for the section's visual now that the mock list is gone. */}
            <PeekingCharacter
              src={HERO_CHARACTER}
              className="left-1/2 -translate-x-[92%] sm:-translate-x-[100%] top-0 w-[110px] sm:w-[140px] md:w-[170px]"
            />
            <PeekingCharacter
              src={ART.willam}
              className="left-1/2 -translate-x-[8%] sm:-translate-x-0 top-1 w-[100px] sm:w-[125px] md:w-[150px]"
            />
          </div>
        </div>
      </section>

      {/* ── STREAK & CHAT — third glass card ──
          Streak/Chat art is fixed at the card's corners, hanging off the
          edge like stickers, not inside the copy, not drifting. */}
      <section className="relative px-5 sm:px-6 md:px-16 py-20 sm:py-24 max-w-[1200px] mx-auto">
        <BgArt src={BG_ASSETS.bomb} alt="" speed={0.17} className="block top-[6%] right-[2%] w-16 sm:w-24 lg:w-28 rotate-6" />
        <BgArt src={BG_ASSETS.flyer} alt="" speed={0.13} className="block bottom-[4%] left-[2%] w-16 sm:w-24 lg:w-28 -rotate-6" />

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

      {/* ── CLOSING ART ──
          New slot for the piece you want dropped in between the tagline
          and the footer. Bounces up on scroll-in rather than fading like
          the rest of the "reveal" elements. Swap CLOSING_ART's src at the
          top of the file once you've got the real asset uploaded. */}
      <section className="relative flex items-center justify-center py-8 sm:py-10">
        <img
          src={CLOSING_ART}
          alt=""
          aria-hidden
          loading="lazy"
          className="reveal reveal-bounce w-[160px] sm:w-[200px] md:w-[240px] h-auto drop-shadow-[0_20px_45px_rgba(108,80,255,0.35)]"
        />
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
