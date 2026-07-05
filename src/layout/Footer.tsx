// src/components/Footer.tsx
import Wordmark from './Wordmark'

const FOOTER_LINKS: Array<[href: string, label: string]> = [
  ['https://cvwtplatform.vercel.app/', 'Platform'],
  ['#', 'About'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['#', 'Contact'],
]

export default function Footer() {
  return (
    <footer className="flex items-center justify-between flex-wrap gap-4 px-5 md:px-10 py-7 bg-[rgba(5,5,6,0.6)] border-t border-chill-border">
      <div className="flex items-center gap-2.5">
        <Wordmark size={18} animated={false} />
        <span className="text-[13px] text-chill-textMuted">© 2026 · All rights reserved</span>
      </div>
      <div className="flex gap-6 flex-wrap">
        {FOOTER_LINKS.map(([href, label]) => (
          <a
            key={label}
            href={href}
            className="text-[13px] text-chill-textMuted hover:text-chill-textSecondary transition-colors no-underline"
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  )
}
