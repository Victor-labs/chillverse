// src/layout/Footer.tsx
import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'
import Logo from './Logo'

// Items with an href go to a real place. Items with href: null are
// placeholders — rendered as plain, unclickable text for now (Editorial
// room / Work at Chillverse / Brand / Reviews don't have pages yet).
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
      { label: 'Editorial room', href: null },
      { label: 'Work at Chillverse', href: null },
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
  const cls = 'text-[13px] text-chill-textMuted hover:text-chill-textSecondary transition-colors no-underline'

  if (!link.href) {
    // Placeholder — not linked anywhere yet, so it shouldn't look
    // clickable. Slightly dimmer + default cursor communicates that.
    return <span className={`${cls} opacity-60 cursor-default hover:text-chill-textMuted`}>{link.label}</span>
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
    <footer className="relative border-t border-chill-border bg-[rgba(5,5,6,0.6)] px-5 md:px-10 pt-14 pb-7">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 mb-12">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Logo size={24} />
            <Wordmark size={19} animated={false} />
          </div>
          <p className="text-[13px] text-chill-textMuted leading-relaxed max-w-[220px]">
            Your universe. Your rules. Play, connect, and climb the leaderboard — all in one social gaming platform.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <div className="text-[11px] font-bold tracking-[1.5px] uppercase text-chill-textMuted mb-3.5">{col.heading}</div>
            <div className="flex flex-col gap-2.5">
              {col.links.map((link) => (
                <FooterLinkItem key={link.label} link={link} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-3 pt-6 border-t border-chill-border">
        <span className="text-[13px] text-chill-textMuted">© 2026 Chillverse · All rights reserved</span>
        <span className="flex items-center gap-1.5 text-[11px] text-chill-green font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-chill-green live-dot" /> All systems online
        </span>
      </div>
    </footer>
  )
}
