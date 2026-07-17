// src/features/marketing/FAQ.tsx
import { Link } from 'react-router-dom'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import { FAQ_ITEMS } from '../../shared/content/faq'

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chillverse', item: 'https://chillverse.com.ng/' },
      { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://chillverse.com.ng/faq' },
    ],
  },
]

export default function FAQ() {
  return (
    <div>
      <Seo
        title="Frequently Asked Questions"
        description="Answers to common Chillverse questions — games, XP and streaks, Diamonds, Chillverse Pro, referrals, privacy, and Halo AI."
        path="/faq"
        jsonLd={JSON_LD}
      />
      <Nav />

      <div className="max-w-3xl mx-auto px-5 md:px-10 pt-28 pb-20">
        <div className="mb-12">
          <div className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-chill-violet mb-3">FAQ</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Frequently asked questions</h1>
          <p className="text-[17px] text-chill-textSecondary leading-relaxed max-w-[560px]">
            Everything you need to know about playing Chillverse. Can't find your answer here?{' '}
            <a href="mailto:chillverserelationoffice@gmail.com" className="text-chill-violetSoft hover:underline">
              Get in touch
            </a>.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group glass-panel rounded-2xl px-6 py-5 open:pb-5 transition-all">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[16px] text-chill-text">
                {item.q}
                <span className="shrink-0 text-chill-textMuted transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-chill-textSecondary">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="bg-chill-surface border border-chill-border rounded-2xl p-7 text-center mt-12">
          <h2 className="text-lg font-bold mb-2">Still have questions?</h2>
          <p className="text-sm text-chill-textSecondary mb-5">Learn more about the platform or jump straight in.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/about" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-chill-border text-chill-text no-underline">
              About Chillverse
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-chill-violet to-[#3d1fb5] no-underline"
            >
              Sign up free →
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
