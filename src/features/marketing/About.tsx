// src/features/marketing/About.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Sparkles } from 'lucide-react'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import { useReveal } from './useReveal'
import AutoCarousel from './AutoCarousel'
import { fetchHistoryCards, fetchAboutEvents, type HistoryCard, type AboutEvent } from './aboutApi'

const BANNER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Untitled%20folder/Flyer.png'

// Drifting ambient art — 2 reused from Landing's own set, plus one new one.
const DRIFT = {
  bomb: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Bomb.png',
  game: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Game.png',
  orb: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Landing/Crystal.png',
}

const FOUNDERS = ['Victor_vk', 'Abdul Hadi']

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Chillverse',
    url: 'https://chillverse.com.ng/about',
    mainEntity: {
      '@type': 'Organization',
      name: 'Chillverse',
      url: 'https://chillverse.com.ng',
      founder: [
        { '@type': 'Person', name: 'Victor_vk' },
        { '@type': 'Person', name: 'Abdul Hadi' },
      ],
      description:
        'Chillverse is a next-generation entertainment ecosystem where movies, series, anime, games, community, events, and exclusive experiences come together in one place.',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chillverse', item: 'https://chillverse.com.ng/' },
      { '@type': 'ListItem', position: 2, name: 'About', item: 'https://chillverse.com.ng/about' },
    ],
  },
]

// Tracks the element's own position relative to the viewport and applies a
// clamped parallax translateY — same mechanic as Landing.tsx's BgArt, kept
// local here since it's small and Landing doesn't export it.
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
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply) } }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [speed, maxOffset])
  return ref
}

function DriftArt({ src, className, speed = 0.15 }: { src: string; className: string; speed?: number }) {
  const ref = useScrollParallax(speed)
  return (
    <div ref={ref} aria-hidden className={`absolute pointer-events-none z-0 ${className}`}>
      <img src={src} alt="" className="w-full h-auto opacity-95 drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]" loading="lazy" />
    </div>
  )
}

function HistorySlide({ card }: { card: HistoryCard }) {
  return (
    <div className="h-full flex items-center justify-center px-1">
      <div className="glass-panel-strong glow-violet-tint rounded-[24px] p-7 sm:p-9 text-center max-w-lg mx-auto h-full flex flex-col items-center justify-center">
        <span className="inline-block px-3.5 py-1 rounded-full bg-[rgba(108,80,255,0.14)] border border-[rgba(108,80,255,0.3)] text-[var(--violet-soft)] text-xs font-bold tracking-wide mb-4">
          {card.yearLabel}
        </span>
        <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2.5">{card.title}</h3>
        <p className="text-sm text-[var(--ltext-sec)] leading-relaxed">{card.body}</p>
      </div>
    </div>
  )
}

function EventSlide({ event, expanded }: { event: AboutEvent; expanded: boolean }) {
  return (
    <div className="relative w-full h-full rounded-[24px] overflow-hidden select-none">
      <img src={event.imageUrl} alt={event.name} draggable={false} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <span className="absolute top-3.5 right-3.5 text-[10px] font-bold uppercase tracking-wide text-white/80 bg-black/40 rounded-full px-2.5 py-1 backdrop-blur-sm">
        {expanded ? 'Tap to close' : 'Tap for details'}
      </span>
      <div
        className="absolute inset-x-0 bottom-0 p-5 sm:p-6 transition-transform duration-300 ease-out"
        style={{ transform: expanded ? 'translateY(0)' : 'translateY(calc(100% - 58px))' }}
      >
        <h3 className="text-lg font-bold text-white tracking-tight mb-1.5">{event.name}</h3>
        <p className="text-sm text-white/85 mb-1">{event.subtitle}</p>
        <p className="text-xs text-white/60 font-medium">{event.eventDate}</p>
      </div>
    </div>
  )
}

export default function About() {
  useReveal()
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([])
  const [events, setEvents] = useState<AboutEvent[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistoryCards().then(setHistoryCards).catch(() => {})
    fetchAboutEvents().then(setEvents).catch(() => {})
  }, [])

  return (
    <div data-theme="midnight" className="landing-root">
      <Seo
        title="About Chillverse"
        description="Chillverse is a next-generation entertainment ecosystem where movies, series, anime, games, community, events, and exclusive experiences come together in one place."
        path="/about"
        jsonLd={JSON_LD}
      />
      <Nav />

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-start overflow-hidden px-5 sm:px-6 md:px-16 pt-14 sm:pt-16 md:pt-20 pb-10 sm:pb-14">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <div className="w-[600px] h-[600px] rounded-full bg-[rgba(108,80,255,0.10)] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-[rgba(0,229,255,0.08)] blur-[100px] -translate-x-24 translate-y-16" />
        </div>

        <DriftArt src={DRIFT.bomb} speed={0.14} className="hidden sm:block top-[6%] left-[3%] w-16 md:w-24 -rotate-6" />

        <div className="relative z-[6] flex flex-col items-center text-center max-w-2xl w-full">
          <h1
            className="leading-[1.02] mb-4 text-[clamp(30px,7vw,54px)] tracking-wide uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800 }}
          >
            About <span className="text-gradient">Chillverse</span>
          </h1>
          <p className="text-sm sm:text-base text-[var(--ltext-sec)] max-w-[320px] sm:max-w-md mx-auto leading-relaxed">
            Chillverse brings movies, anime, games, community, and exclusive experiences together in one seamless platform.
          </p>
        </div>
      </section>

      {/* ── BANNER — rounded-square flyer, iOS-style corners ── */}
      <section className="relative px-5 sm:px-6 md:px-16 max-w-[1200px] mx-auto mb-16 sm:mb-20">
        <div className="reveal rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/[0.08]">
          <img src={BANNER} alt="Chillverse" className="w-full h-auto block" loading="lazy" />
        </div>
      </section>

      {/* ── CHILLVERSE HISTORY ── */}
      <section className="relative px-5 sm:px-6 md:px-16 py-4 sm:py-6 max-w-[900px] mx-auto mb-16 sm:mb-20">
        <DriftArt src={DRIFT.game} speed={0.18} className="hidden sm:block -top-[4%] right-[0%] w-16 md:w-24 rotate-6" />
        <h2 className="reveal text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8 sm:mb-10">Chillverse History</h2>
        {historyCards.length > 0 && (
          <AutoCarousel
            items={historyCards}
            heightClassName="h-[260px] sm:h-[220px]"
            renderSlide={(card) => <HistorySlide card={card} />}
          />
        )}
      </section>

      {/* ── WHAT IS CHILLVERSE? ── */}
      <section className="relative px-5 sm:px-6 md:px-16 py-4 sm:py-6 max-w-[1200px] mx-auto mb-16 sm:mb-20">
        <div className="reveal glass-panel-strong glow-cyan-tint rounded-[28px] p-7 sm:p-10 md:p-14 text-center max-w-xl mx-auto">
          <h2 className="text-[clamp(24px,3.5vw,36px)] font-bold leading-tight tracking-tight mb-4">What is Chillverse?</h2>
          <p className="text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed">
            Chillverse is a next-generation entertainment ecosystem where movies, series, anime, games,
            community, events, and exclusive experiences come together in one place.
          </p>
        </div>
      </section>

      {/* ── FOUNDERS ── */}
      <section className="relative px-5 sm:px-6 md:px-16 py-4 sm:py-6 max-w-[1200px] mx-auto mb-16 sm:mb-20">
        <h2 className="reveal text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8 sm:mb-10">Founders</h2>
        <div className="reveal grid grid-cols-2 gap-4 sm:gap-6 max-w-md mx-auto">
          {FOUNDERS.map((name) => (
            <div key={name} className="glass-panel-strong glow-pink-tint rounded-[24px] p-6 sm:p-8 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[var(--violet)] to-[#3d1fb5] flex items-center justify-center mx-auto mb-4">
                <Crown size={26} className="text-white" />
              </div>
              <p className="text-sm sm:text-base font-bold tracking-wide uppercase">{name}</p>
              <p className="text-xs text-[var(--ltext-muted)] mt-1">Co-Founder</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── EVENTS ── */}
      <section className="relative px-5 sm:px-6 md:px-16 py-4 sm:py-6 max-w-[900px] mx-auto mb-16 sm:mb-20">
        <DriftArt src={DRIFT.orb} speed={0.16} className="hidden sm:block -top-[6%] left-[0%] w-20 md:w-28" />
        <h2 className="reveal text-2xl sm:text-3xl font-bold tracking-tight text-center mb-2.5">Our Events Held Across Platforms</h2>
        <p className="reveal text-sm text-[var(--ltext-muted)] text-center mb-8 sm:mb-10">Tap a slide for more details</p>
        {events.length > 0 && (
          <AutoCarousel
            items={events}
            heightClassName="h-[340px] sm:h-[380px]"
            onSlideTap={(_, event) => setExpandedEventId((cur) => (cur === event.id ? null : event.id))}
            renderSlide={(event, _i, active) => (
              <EventSlide event={event} expanded={active && expandedEventId === event.id} />
            )}
          />
        )}
      </section>

      {/* ── LAST WORD ── */}
      <section className="relative px-5 sm:px-6 md:px-16 py-10 sm:py-14 max-w-[700px] mx-auto text-center mb-4">
        <Sparkles size={24} className="text-[var(--violet-soft)] mx-auto mb-5" />
        <h2 className="reveal text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Help Shape the Next Generation of Entertainment.
        </h2>
        <p className="reveal text-sm sm:text-base text-[var(--ltext-sec)] leading-relaxed mb-8 max-w-lg mx-auto">
          Join a passionate team creating the next generation of entertainment. Whether you're a developer, designer,
          writer, moderator, or creative thinker, there's a place for you at Chillverse. Together, we're building
          experiences that bring people together.
        </p>
        <Link
          to="/work"
          className="inline-block px-8 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-[var(--violet)] to-[#3d1fb5] shadow-[0_4px_16px_rgba(108,80,255,0.25)] hover:-translate-y-1 hover:shadow-[0_6px_22px_rgba(108,80,255,0.35)] transition-all"
        >
          Work at Chillverse
        </Link>
      </section>

      <Footer />
    </div>
  )
}
