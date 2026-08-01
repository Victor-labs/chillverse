// src/components/Footer.tsx
import { Instagram, Youtube, Mail, ArrowUpRight } from 'lucide-react'
import Wordmark from './Wordmark'
import Logo from './Logo'

// X/Twitter's bird-in-a-box mark isn't in lucide, so it's drawn inline to
// keep the social row visually consistent with the other icon glyphs.
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.2-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
    </svg>
  )
}

const SOCIALS = [
  { href: 'https://x.com/joinchillverse', label: 'X / Twitter', Icon: XIcon },
  { href: 'https://www.instagram.com/chillverse001', label: 'Instagram', Icon: Instagram },
  { href: 'https://www.youtube.com/@chillverse_com', label: 'YouTube', Icon: Youtube },
  { href: 'mailto:chillverserelationoffice@gmail.com', label: 'Email', Icon: Mail },
]

const FOOTER_COLUMNS: Array<{ heading: string; links: Array<[href: string, label: string, external?: boolean]> }> = [
  {
    heading: 'Product',
    links: [
      ['#features', 'Features'],
      ['#leaderboard', 'Leaderboard'],
      ['#community', 'Community'],
      ['https://cvwtplatform.vercel.app/', 'Learning Platform', true],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['/about', 'About'],
      ['/faq', 'FAQ'],
      ['mailto:chillverserelationoffice@gmail.com', 'Contact'],
    ],
  },
  {
    heading: 'Legal',
    links: [
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms'],
    ],
  },
]

export default function Footer() {
  return (
    <footer className="relative px-5 md:px-10 pt-16 pb-8 overflow-hidden">
      {/* soft ambient glow behind the glass panel, matching the rest of the page's tint language */}
      <div className="pointer-events-none absolute left-1/2 -top-24 -translate-x-1/2 w-[70%] max-w-[900px] h-64 rounded-full bg-chill-violet/[0.08] blur-[100px]" />
      <div className="pointer-events-none absolute right-[8%] bottom-0 w-64 h-64 rounded-full bg-chill-cyan/[0.06] blur-[90px]" />

      <div className="relative glass-panel-strong glow-violet-tint rounded-[28px] px-6 md:px-12 py-10 md:py-12 max-w-[1300px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 md:gap-8">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Logo size={26} />
              <Wordmark size={19} animated={false} />
            </div>
            <p className="text-[13px] text-chill-textSecondary leading-relaxed max-w-[280px] mb-6">
              Your universe. Your rules. Play, connect, and climb the leaderboard — all in one social gaming platform.
            </p>
            <div className="flex items-center gap-2.5">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  aria-label={label}
                  className="glass-chip w-9 h-9 rounded-full flex items-center justify-center text-chill-textSecondary hover:text-chill-violetSoft hover:border-chill-violet/40 hover:-translate-y-0.5 transition-all"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="font-mono text-[11px] tracking-[2px] uppercase text-chill-violetSoft mb-4">{col.heading}</div>
              <ul className="flex flex-col gap-3">
                {col.links.map(([href, label, external]) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      className="group inline-flex items-center gap-1 text-[13px] text-chill-textMuted hover:text-chill-text transition-colors no-underline"
                    >
                      {label}
                      {external && (
                        <ArrowUpRight size={12} className="opacity-0 -translate-y-0.5 translate-x-0 group-hover:opacity-60 group-hover:translate-y-0 transition-all" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* divider */}
        <div className="h-px w-full my-9 bg-gradient-to-r from-transparent via-chill-borderBright to-transparent" />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <span className="text-[12px] text-chill-textMuted">© 2026 Chillverse · All rights reserved</span>
          <span className="flex items-center gap-2 text-[12px] text-chill-textMuted">
            <span className="live-dot" />
            All systems online
          </span>
        </div>
      </div>
    </footer>
  )
}
