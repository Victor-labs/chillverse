// src/layout/Footer.tsx
import { Link } from 'react-router-dom'

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
  // The logo/wordmark/tagline block and the bottom copyright + status bar
  // were both marked for removal (ref screenshot) — gone. What's left is
  // just the four link columns.
  return (
    <footer className="relative border-t border-[rgba(124,102,255,0.14)] bg-[rgba(5,5,6,0.6)] px-5 md:px-10 pt-14 pb-10">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
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
    </footer>
  )
}
