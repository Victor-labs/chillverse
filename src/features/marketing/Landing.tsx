// src/pages/Landing.tsx
import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import CubeScene from '../exploration/CubeScene'
import { useReveal } from './useReveal'
import { useAuth } from '../auth/useAuth'

const FEATURES = [
  {
    icon: '🎮',
    title: 'Play Games',
    desc: 'Fast-paced challenges, multiplayer battles, and solo runs. Every win earns you XP and moves you up the board.',
    pill: 'Multiplayer',
    accent: 'violet',
  },
  {
    icon: '🔥',
    title: 'Streak System',
    desc: "Log in, play, stay hot. Your streak is your reputation. Miss a day and you'll feel it on the leaderboard.",
    pill: 'Daily XP',
    accent: 'amber',
  },
  {
    icon: '🏆',
    title: 'Leaderboards',
    desc: "Global and friend rankings updated in real time. See who's topping the charts — and decide if it'll be you.",
    pill: 'Live rankings',
    accent: 'pink',
  },
  {
    icon: '💬',
    title: 'Chat & Crew',
    desc: 'Trash talk, team up, or just vibe. Group chats, direct messages, and live reactions keep the energy going.',
    pill: 'Real-time',
    accent: 'cyan',
  },
  {
    icon: '🧑‍🚀',
    title: 'Your Profile',
    desc: 'Level, badges, game history, win rate — your profile is your flex. Customise it, build it, show it off.',
    pill: 'Achievements',
    accent: 'green',
  },
]

const ACCENT_MAP: Record<string, { icon: string; border: string; shadow: string; pill: string }> = {
  violet: { icon: 'bg-chill-violet/15', border: 'hover:border-chill-violet/50', shadow: 'hover:shadow-[0_20px_60px_rgba(108,80,255,0.2)]', pill: 'bg-chill-violet/15 text-chill-violetSoft' },
  amber:  { icon: 'bg-chill-amber/12', border: 'hover:border-chill-amber/35', shadow: 'hover:shadow-[0_20px_60px_rgba(255,184,0,0.12)]', pill: 'bg-chill-amber/10 text-chill-amber' },
  pink:   { icon: 'bg-chill-pink/12', border: 'hover:border-chill-pink/40', shadow: 'hover:shadow-[0_20px_60px_rgba(255,78,205,0.14)]', pill: 'bg-chill-pink/12 text-chill-pink' },
  cyan:   { icon: 'bg-chill-cyan/12', border: 'hover:border-chill-cyan/40', shadow: 'hover:shadow-[0_20px_60px_rgba(0,229,255,0.14)]', pill: 'bg-chill-cyan/12 text-chill-cyan' },
  green:  { icon: 'bg-chill-green/10', border: 'hover:border-chill-green/40', shadow: 'hover:shadow-[0_20px_60px_rgba(0,255,135,0.15)]', pill: 'bg-chill-green/10 text-chill-green' },
}

const TESTIMONIALS = [
  { initials: 'TK', name: 'TrapKing_99', role: 'Top 50 global', text: "My streak is at 87 days. I don't even open other apps anymore. Chillverse is just different.", color: 'rgba(108,80,255,0.2)', text2: '#a78bfa' },
  { initials: 'FX', name: 'FluxGamer', role: 'Ranked player', text: 'The leaderboard energy is insane. My whole crew is on here competing every day now.', color: 'rgba(0,229,255,0.15)', text2: '#00e5ff' },
  { initials: 'AY', name: 'Ayomide_', role: 'Badge collector', text: 'I love the profile customisation. My page actually feels like mine. The badge system goes hard.', color: 'rgba(255,78,205,0.15)', text2: '#ff4ecd' },
  { initials: 'OB', name: 'Obi_Plays', role: 'Community leader', text: 'Chat while you play, trash talk while you win. The vibe in here is unmatched.', color: 'rgba(0,255,135,0.12)', text2: '#00ff87' },
  { initials: 'ZR', name: 'ZeroRush', role: 'Top 10 player', text: 'Hit top 10 on the global board last week. The competition is real and addictive.', color: 'rgba(255,184,0,0.15)', text2: '#ffb800' },
]

export default function Landing() {
  useReveal()
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const heroContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && session) navigate('/dashboard', { replace: true })
  }, [loading, session, navigate])

  return (
    <>
      <Nav />

      {/* ── HERO ──
          Outer div is the tall "pinned" scroll container CubeScene measures
          progress against; the inner section stays sticky at the top of the
          viewport while the user scrolls through the extra height, driving
          the cube's rotate/recede/fade animation. */}
      <div ref={heroContainerRef} className="relative" style={{ height: '220vh' }}>
        <section className="sticky top-0 min-h-screen h-screen relative flex items-center justify-center overflow-hidden px-6 md:px-16 pt-32 pb-24">
          <CubeScene containerRef={heroContainerRef} />

          <div className="relative z-[2] max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-chill-violet/35 bg-chill-violet/10 text-sm font-semibold text-chill-violetSoft tracking-wide mb-7">
              <span className="live-dot" />
              Games · Profiles · Streaks · Chat
            </div>

            <h1 className="font-bold leading-[0.95] mb-7 text-[clamp(58px,9vw,100px)] tracking-tight">
              <span className="block text-chill-text">Play. Win.</span>
              <span className="block text-gradient">Dominate.</span>
              <span className="block text-[rgba(238,234,255,0.55)] text-[0.55em] font-normal mt-2.5 tracking-normal">
                Your universe. Your rules.
              </span>
            </h1>

            <p className="text-lg text-chill-textSecondary max-w-md mx-auto mb-12 leading-relaxed">
              Compete, build your profile, keep your streak alive, and chat with your crew — all inside one electrifying platform.
            </p>

            <div className="flex items-center justify-center gap-3.5 flex-wrap">
              <Link
                to="/signup"
                className="px-10 py-4 rounded-full text-base font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_8px_36px_rgba(108,80,255,0.5)] hover:-translate-y-1 hover:shadow-[0_14px_48px_rgba(108,80,255,0.7)] transition-all"
              >
                Enter Chillverse →
              </Link>
              <a
                href="#features"
                className="px-10 py-4 rounded-full text-base font-medium text-chill-text border-[1.5px] border-chill-borderBright hover:bg-chill-violet/10 hover:border-chill-violetSoft transition-all"
              >
                See what's inside
              </a>
            </div>

            <div className="mt-12 flex items-center justify-center gap-2 text-xs tracking-[3px] uppercase text-chill-textMuted font-mono">
              <div className="w-10 h-px bg-gradient-to-r from-transparent to-chill-borderBright" />
              scroll to explore
              <div className="w-10 h-px bg-gradient-to-l from-transparent to-chill-borderBright" />
            </div>
          </div>
        </section>
      </div>

      {/* ── STATS ── */}
      <div className="bg-chill-surface border-y border-chill-border px-6 md:px-16 py-9 flex items-center justify-center gap-12 md:gap-20 flex-wrap">
        {[
          ['120K+', 'Players Online'],
          ['5M+', 'Games Played'],
          ['850K', 'Streaks Active'],
          ['#1', 'Social Gaming'],
        ].map(([num, label], i) => (
          <div key={i} className="reveal text-center" style={{ transitionDelay: `${i * 0.1}s` }}>
            <div className="text-4xl font-bold font-mono text-gradient-2 leading-none">{num}</div>
            <div className="text-xs text-chill-textMuted mt-1.5 tracking-[1.2px] uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className="px-6 md:px-16 py-24 max-w-[1300px] mx-auto">
        <div className="reveal">
          <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// your arsenal</div>
          <h2 className="text-[clamp(36px,4.5vw,54px)] font-bold leading-tight tracking-tight mb-3.5">Built for players.</h2>
          <p className="text-lg text-chill-textSecondary max-w-md leading-relaxed">Everything you need to compete, connect, and climb — in one place.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] mt-14">
          {FEATURES.map((f, i) => {
            const a = ACCENT_MAP[f.accent]
            return (
              <div
                key={f.title}
                className={`reveal glass-panel glow-violet-tint rounded-2xl p-7 transition-all duration-300 hover:-translate-y-[6px] ${a.border} ${a.shadow}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className={`w-[50px] h-[50px] rounded-xl flex items-center justify-center text-2xl mb-[18px] ${a.icon}`}>
                  {f.icon}
                </div>
                <div className="text-lg font-semibold mb-2.5">{f.title}</div>
                <p className="text-sm text-chill-textSecondary leading-relaxed">{f.desc}</p>
                <span className={`inline-block mt-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${a.pill}`}>
                  {f.pill}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── LEADERBOARD SCENE ── */}
      <section id="leaderboard" className="px-6 md:px-16 py-20 bg-gradient-to-b from-chill-bg via-chill-bg2 to-chill-bg">
        <div className="max-w-[1300px] mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="reveal">
            <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// climb the ranks</div>
            <h2 className="text-[clamp(36px,4.5vw,54px)] font-bold leading-tight tracking-tight mb-3.5">The top is within reach.</h2>
            <p className="text-lg text-chill-textSecondary max-w-md leading-relaxed mb-8">
              Real-time leaderboards show you exactly where you stand — and what it takes to rise. Every game counts.
            </p>
            <Link
              to="/login"
              className="inline-block px-7 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_8px_36px_rgba(108,80,255,0.5)] hover:-translate-y-1 transition-all"
            >
              Check your rank →
            </Link>
          </div>

          <div className="reveal hidden lg:flex items-center justify-center" style={{ perspective: '700px', transitionDelay: '0.2s' }}>
            <div className="relative">
              <div className="lb-float">
                <div className="glass-panel-strong glow-violet-tint rounded-[22px] p-7 w-80 shadow-[0_40px_80px_rgba(0,0,0,0.7),0_0_80px_rgba(108,80,255,0.2)]">
                  <div className="flex items-center justify-between mb-[22px]">
                    <span className="text-[13px] font-bold tracking-wider text-chill-textMuted uppercase font-mono">Top Players</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-chill-green font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-chill-green live-dot" /> Live
                    </span>
                  </div>

                  {[
                    { rank: '🥇', initials: 'ZK', name: 'ZeroKnight', score: '98,410', streak: 72, bg: 'rgba(255,184,0,0.15)', color: '#ffb800' },
                    { rank: '🥈', initials: 'NX', name: 'NeonX_', score: '91,870', streak: 58, bg: 'rgba(0,229,255,0.12)', color: '#00e5ff' },
                    { rank: '🥉', initials: 'VR', name: 'VoidRacer', score: '88,220', streak: 41, bg: 'rgba(255,78,205,0.12)', color: '#ff4ecd' },
                    { rank: '4', initials: 'SK', name: 'SkyKid', score: '84,100', streak: 35, bg: 'rgba(0,255,135,0.1)', color: '#00ff87' },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 hover:bg-chill-surface2 transition-colors">
                      <div className="w-[22px] text-center text-xs font-bold font-mono text-chill-textMuted">{row.rank}</div>
                      <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: row.bg, color: row.color }}>{row.initials}</div>
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
              </div>

              <div className="badge-float absolute -top-4.5 -right-12 glass-chip border border-chill-pink/40 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-chill-pink shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2">
                ⚡ +2,400 XP gained!
              </div>
              <div className="badge-float-delay absolute bottom-2.5 -left-16 glass-chip border border-chill-cyan/35 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-chill-cyan shadow-[0_10px_30px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-2">
                👥 4 friends online
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 md:px-16 py-24 max-w-[1300px] mx-auto">
        <div className="reveal text-center">
          <div className="font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// jump in</div>
          <h2 className="text-[clamp(36px,4.5vw,54px)] font-bold leading-tight tracking-tight">Start in 60 seconds.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 mt-14 relative">
          {[
            { n: '01', title: 'Create your profile', desc: 'Pick your username, avatar, and set your game preferences. Your identity in the verse starts here.' },
            { n: '02', title: 'Jump into a game', desc: 'Browse active lobbies, challenge friends, or drop into a quick match. Your first win is seconds away.' },
            { n: '03', title: 'Climb & dominate', desc: 'Earn XP, protect your streak, and climb the leaderboard. Every session pushes you higher.' },
          ].map((step, i) => (
            <div key={step.n} className="reveal text-center" style={{ transitionDelay: `${i * 0.12}s` }}>
              <div className="w-[68px] h-[68px] rounded-full border-[1.5px] border-chill-borderBright bg-chill-surface flex items-center justify-center text-xl font-bold font-mono mx-auto mb-[18px] text-chill-violetSoft hover:bg-chill-violet/15 hover:border-chill-violet transition-all">
                {step.n}
              </div>
              <div className="text-base font-semibold mb-2">{step.title}</div>
              <p className="text-[13px] text-chill-textSecondary leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMMUNITY ── */}
      <section id="community" className="py-20 bg-chill-bg2 border-y border-chill-border overflow-hidden">
        <div className="max-w-[1300px] mx-auto px-6 md:px-16 pb-10">
          <div className="reveal font-mono text-[11px] tracking-[2.5px] uppercase text-chill-violet mb-3.5">// the verse speaks</div>
          <h2 className="reveal text-[clamp(36px,4.5vw,54px)] font-bold leading-tight tracking-tight">Players love it here.</h2>
        </div>

        <div className="t-scroll px-6 md:px-16">
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
            <div key={i} className="glass-panel glow-violet-tint rounded-2xl p-6 w-[290px] flex-shrink-0">
              <div className="text-chill-amber text-[11px] mb-2.5">★★★★★</div>
              <p className="text-[13px] leading-relaxed text-chill-textSecondary mb-3.5">"{t.text}"</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: t.color, color: t.text2 }}>{t.initials}</div>
                <div>
                  <div className="text-[13px] font-semibold">{t.name}</div>
                  <div className="text-[11px] text-chill-textMuted">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BRANCH CALLOUT ── */}
      <section className="px-6 md:px-16 py-20 max-w-[1300px] mx-auto">
        <div className="reveal glass-panel-strong glow-cyan-tint rounded-2xl p-8 md:p-12 flex items-center justify-between gap-12 flex-wrap relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-chill-cyan/[0.06] blur-3xl" />
          <div className="relative z-10">
            <span className="inline-block mb-3.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-chill-cyan/10 text-chill-cyan border border-chill-cyan/25">
              Branch Feature
            </span>
            <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">There's a learning side too.</h3>
            <p className="text-base text-chill-textSecondary max-w-md leading-relaxed">
              Chillverse isn't just games. There's a dedicated knowledge platform branch — for players who want to level up their mind alongside their rank. Explore it when you're ready.
            </p>
          </div>
          <a
            href="https://cvwtplatform.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="relative z-10 px-8 py-3.5 rounded-full text-[15px] font-semibold text-chill-cyan border-[1.5px] border-chill-cyan/45 hover:bg-chill-cyan/10 hover:-translate-y-0.5 transition-all whitespace-nowrap"
          >
            Explore the branch →
          </a>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 md:px-16 py-28 text-center max-w-3xl mx-auto">
        <div className="reveal">
          <h2 className="text-[clamp(42px,6vw,68px)] font-bold leading-none tracking-tight mb-[18px]">Your verse is waiting.</h2>
          <p className="text-lg text-chill-textSecondary mb-11">Drop in, build your profile, and start your streak today. The leaderboard won't climb itself.</p>
          <div className="flex items-center justify-center gap-3.5 flex-wrap">
            <Link
              to="/signup"
              className="px-11 py-[18px] rounded-full text-[17px] font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] shadow-[0_10px_40px_rgba(108,80,255,0.55)] hover:-translate-y-1 hover:shadow-[0_18px_56px_rgba(108,80,255,0.7)] transition-all"
            >
              Enter Chillverse →
            </Link>
            <a href="#features" className="px-11 py-[18px] rounded-full text-[17px] font-medium text-chill-text border-[1.5px] border-chill-borderBright hover:bg-chill-violet/10 transition-all">
              See features
            </a>
          </div>
          <p className="mt-[18px] text-[13px] text-chill-textMuted">Free to join · No credit card</p>
        </div>
      </section>

      <Footer />
    </>
  )
}
