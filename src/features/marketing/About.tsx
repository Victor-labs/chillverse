// src/features/marketing/About.tsx
import { Link } from 'react-router-dom'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'

const RANKS = [
  'Rookie', 'Bronze I–III', 'Silver I–III', 'Gold I–III',
  'Platinum I–III', 'Diamond I–III',
]

const STREAK_MILESTONES = [
  ['1 day', '+10 XP'], ['3 days', '+30 XP'], ['7 days', '+100 XP'],
  ['14 days', '+200 XP'], ['30 days', '+400 XP'], ['60 days', '+800 XP'],
  ['100 days', '+1,600 XP'], ['180 days', '+3,200 XP'], ['365 days', '+6,400 XP'],
]

const FEATURES = [
  { title: 'Games', desc: 'A growing library of quick-fire mini games — including Whot (the classic Nigerian card game), Colour Block, and Tac Zone — playable solo or in live multiplayer rooms.' },
  { title: 'XP & Ranks', desc: 'Every game earns XP that moves you through a 6-tier rank ladder — Rookie, Bronze, Silver, Gold, Platinum, and Diamond — each with sub-ranks and unlockable rewards like badges and profile pictures.' },
  { title: 'Daily Streaks', desc: 'Log in and play daily to build a streak. Milestones from 1 day up to 365 days award bonus XP — miss a day and the streak resets.' },
  { title: 'Leaderboards', desc: 'Global rankings updated in real time, so you can see exactly where you stand against every other player.' },
  { title: 'Profiles & Badges', desc: 'Customizable profiles with followers, a wishlist, an achievements count, an unlockable avatar system, and a badge collection earned through gameplay and ranks.' },
  { title: 'Chat & Crew', desc: 'Real-time chat, direct messages, and social features so you can stay connected with friends and your crew between matches.' },
  { title: 'The Mall', desc: 'An optional in-app store where players spend Diamonds — Chillverse\u2019s virtual currency — on cosmetic avatar skins and profile items. Entirely optional; nothing here affects gameplay.' },
  { title: 'Kids Video Section', desc: 'A dedicated, curated video area with family-friendly content, kept separate from the main gaming and social features.' },
]

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
      foundingDate: '2026',
      founder: { '@type': 'Person', name: 'Victor_vk' },
      description:
        'Chillverse is a free, mobile-first Nigerian social gaming platform combining casual multiplayer games with a progression system (XP, streaks, ranks) and social features (chat, profiles, crews).',
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

export default function About() {
  return (
    <div>
      <Seo
        title="About Chillverse"
        description="Chillverse is a free, mobile-first Nigerian social gaming platform. Learn about our mission, features, progression system, and community."
        path="/about"
        jsonLd={JSON_LD}
      />
      <Nav />

      <div className="max-w-[860px] mx-auto px-5 md:px-10 pt-28 pb-20">

        <div className="mb-14">
          <div className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-chill-violet mb-3">About Us</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">What is Chillverse?</h1>
          <p className="text-[17px] text-chill-textSecondary leading-relaxed max-w-[640px]">
            Chillverse is a free, mobile-first social gaming platform built in Nigeria. It combines
            fast-paced multiplayer games with a full progression system — XP, daily streaks, and
            competitive ranks — plus real-time chat so you can play and stay connected with your
            crew in one place.
          </p>
        </div>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-[15px] text-chill-textSecondary leading-relaxed">
            Chillverse exists to make casual gaming social again. Instead of playing alone against
            a screen, every session on Chillverse feeds into something bigger — your XP, your
            streak, your rank, and your standing with friends. The goal is a platform where quick
            games are fun in the moment and rewarding over time, free for anyone to join.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-5">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-chill-surface border border-chill-border rounded-2xl p-5">
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-chill-textSecondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-4">The Rank Ladder</h2>
          <p className="text-[15px] text-chill-textSecondary leading-relaxed mb-5">
            Every player climbs the same public rank ladder, earned entirely through XP from
            playing games — there's no way to buy rank progress.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {RANKS.map((r) => (
              <span key={r} className="px-3.5 py-1.5 rounded-full bg-chill-surface2 border border-chill-border text-sm text-chill-textSecondary">
                {r}
              </span>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Streak Milestones</h2>
          <p className="text-[15px] text-chill-textSecondary leading-relaxed mb-5">
            Play daily to build your streak. Each milestone banks bonus XP on top of whatever you
            earn from games that day.
          </p>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {STREAK_MILESTONES.map(([days, xp]) => (
              <div key={days} className="bg-chill-surface2 border border-chill-border rounded-xl px-3 py-3 text-center">
                <div className="text-sm font-bold">{days}</div>
                <div className="text-xs text-chill-amber">{xp}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-4">History</h2>
          <p className="text-[15px] text-chill-textSecondary leading-relaxed">
            Chillverse launched with its core experience — chat and social features, standard game
            sessions, and a profile and wallet system. Since then it has shipped further Version
            upgrades (an optional, Diamond-funded track distinct from the free core game) adding
            smoother animations and expanded visual polish, with more planned. Chillverse was
            founded and built by <strong>Victor_vk</strong>.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Community</h2>
          <p className="text-[15px] text-chill-textSecondary leading-relaxed">
            Chillverse is built around its players — real-time chat, follower/following profiles,
            a referral program to bring friends in, and a shared leaderboard everyone competes on.
            Follow along or get in touch:
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <a href="https://x.com/joinchillverse" className="text-chill-violetSoft hover:underline">X / Twitter</a>
            <a href="https://www.instagram.com/chillverse001" className="text-chill-violetSoft hover:underline">Instagram</a>
            <a href="https://www.youtube.com/@chillverse_com" className="text-chill-violetSoft hover:underline">YouTube</a>
          </div>
        </section>

        <div className="bg-chill-surface border border-chill-border rounded-2xl p-7 text-center">
          <h2 className="text-lg font-bold mb-2">Ready to jump in?</h2>
          <p className="text-sm text-chill-textSecondary mb-5">It's free — create an account and start earning XP from your first game.</p>
          <Link
            to="/signup"
            className="inline-block px-6 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] no-underline"
          >
            Sign up free →
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
