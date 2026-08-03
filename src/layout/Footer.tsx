// src/layout/Footer.tsx
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import Logo from './Logo'
import Wordmark from './Wordmark'

// Items with an href go to a real place. Items with href: null are
// placeholders — rendered as plain, unclickable text for now (Brand /
// Reviews don't have pages yet).
type FooterLink = { label: string; href: string | null; external?: boolean }

const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Leaderboard', href: '/#leaderboard' },
      { label: 'Learning Platform', href: 'https://cvwtplatform.vercel.app/', external: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: 'mailto:chillverserelationoffice@gmail.com' },
      { label: 'Editorial room', href: '/editorial-room' },
      { label: 'Work at Chillverse', href: '/work' },
      { label: 'Brand', href: null },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'FAQ', href: '/faq' },
      { label: 'Reviews', href: null },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

function FooterLinkItem({ link }: { link: FooterLink }) {
  const cls = 'text-[13px] text-[var(--ltext-muted)] hover:text-[var(--ltext-sec)] transition-colors no-underline'

  if (!link.href) {
    // Placeholder — not linked anywhere yet, so it shouldn't look
    // clickable. Slightly dimmer + default cursor communicates that.
    return <span className={`${cls} opacity-60 cursor-default hover:text-[var(--ltext-muted)]`}>{link.label}</span>
  }
  if (link.external || link.href.startsWith('mailto:')) {
    return (
      <a href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} className={cls}>
        {link.label}
      </a>
    )
  }
  return (
    <Link to={link.href} className={cls}>
      {link.label}
    </Link>
  )
}

export default function Footer() {
  return (
    <footer className="relative border-t border-[rgba(124,102,255,0.14)] bg-[rgba(5,5,6,0.6)] px-5 md:px-10 pt-14 pb-10">
      <div className="max-w-[1200px] mx-auto">
        <Link to="/" className="flex items-center gap-2 no-underline mb-10">
          <Logo size={26} />
          <Wordmark size={16} animated={false} />
        </Link>

        {/* Phone: collapsible accordion (native <details>, no JS state
           needed — each column starts closed and expands independently). */}
        <div className="sm:hidden divide-y divide-white/[0.08] border-t border-white/[0.08]">
          {COLUMNS.map((col) => (
            <details key={col.heading} className="group py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none text-[11px] font-bold tracking-[1.5px] uppercase text-[var(--ltext-muted)] [&::-webkit-details-marker]:hidden">
                {col.heading}
                <ChevronDown className="w-4 h-4 text-[var(--ltext-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-2.5 mt-3.5">
                {col.links.map((link) => (
                  <FooterLinkItem key={link.label} link={link} />
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* sm and up: normal static grid, nothing collapsible. */}
        <div className="hidden sm:grid sm:grid-cols-4 gap-x-6 gap-y-10">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="text-[11px] font-bold tracking-[1.5px] uppercase text-[var(--ltext-muted)] mb-3.5">{col.heading}</div>
              <div className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <FooterLinkItem key={link.label} link={link} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
