#!/usr/bin/env node
// scripts/prerender.mjs
//
// WHY THIS EXISTS
// ---------------
// Chillverse is a client-rendered React SPA. Without this script, Vercel's
// SPA rewrite (see vercel.json) serves the EXACT SAME dist/index.html for
// every route. That means /privacy, /terms, /login, and /signup all show
// the homepage's title, description, and OG image to anything that doesn't
// execute JavaScript — Bing, Discord, WhatsApp, Slack, X/Twitter unfurlers,
// and most AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) never run
// the JS bundle, so they only ever saw one page's worth of metadata for the
// whole site.
//
// This script runs after `vite build` (see package.json) and writes a real
// dist/<route>/index.html for each public route with its own <title>,
// meta description, canonical URL, Open Graph / Twitter Card tags, and
// JSON-LD — plus real visible text inside #root so a non-JS crawler sees
// actual content, not an empty div.
//
// React still takes over once JS loads: main.tsx uses
// ReactDOM.createRoot(...).render(...) — NOT hydrateRoot — so it safely
// wipes and replaces whatever's already in #root. There is no hydration-
// mismatch risk from the static content below differing slightly from the
// live React output.
//
// MAINTENANCE
// -----------
// The text in ROUTES[].content is a snapshot for crawlers, mirrored from
// Privacy.tsx / Terms.tsx. If you edit the wording of the Privacy Policy or
// Terms in those React components, update the matching entry below too —
// otherwise the crawlable version will drift from what users actually see.
// (A future improvement: move legal copy into a single shared JSON/data file
// imported by both the React component and this script, so there's only one
// place to edit. Flagged as a follow-up, not done here to avoid changing
// your component structure without you reviewing it first.)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const SITE_URL = 'https://chillverse.com.ng'

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Chillverse',
  url: SITE_URL,
  logo: `${SITE_URL}/web-app-manifest-512x512.png`,
  description:
    'Chillverse is a Nigerian mobile-first social gaming platform for playing games, building XP and streaks, climbing leaderboards, and chatting with friends.',
  founder: {
    '@type': 'Person',
    name: 'Victor_vk',
    jobTitle: 'Founder & Developer',
    sameAs: ['https://github.com/Victor-labs'],
  },
  sameAs: [
    'https://x.com/joinchillverse',
    'https://www.instagram.com/chillverse001',
    'https://www.youtube.com/@chillverse_com',
  ],
}

function breadcrumb(label, path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chillverse', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}${path}` },
    ],
  }
}

// ── Route definitions ────────────────────────────────────────────────────
const FAQ_ITEMS = [
  ['What is Chillverse?', 'Chillverse is a Nigerian mobile-first social gaming platform where you play fast-paced games, build XP and daily streaks, climb live leaderboards, chat with friends, and customise your profile with unlockable avatar skins from the in-app Mall.'],
  ['Is Chillverse free to use?', 'Yes — Chillverse is completely free to join and play. Core features like games, streaks, leaderboards, chat, and profiles cost nothing. The Mall lets you optionally spend in-app diamonds on cosmetic avatar skins.'],
  ['What games can I play on Chillverse?', 'Chillverse has a growing library of quick-fire mini games, including Whot (the classic Nigerian card game) and Colour Block, with more titles being added regularly. Games support solo play and live multiplayer sessions.'],
  ['How does XP and the streak system work?', 'Every game you play earns XP, which levels up your account and moves you up the global leaderboard. Logging in and playing daily builds your streak — miss a day and your streak resets, so consistency matters.'],
  ['Can I chat with friends on Chillverse?', 'Yes. Chillverse has real-time chat and crew features so you can message friends, trash talk during matches, and stay connected with your community directly in the app.'],
  ['Does Chillverse have content for kids?', 'Yes — Chillverse includes a dedicated kids video section with curated, family-friendly content, separate from the main gaming and social features.'],
  ['How do I get started on Chillverse?', 'Sign up for free at chillverse.com.ng, set up your profile, and jump straight into a game. You start earning XP and building your streak from your very first session.'],
  ['What are Diamonds and what can I spend them on?', "Diamonds are Chillverse's in-app currency, purchasable with real money. You can spend them in the Mall on cosmetic avatar skins and profile items, or use them to unlock optional Version upgrades — none of it affects gameplay or your rank."],
  ['What is Chillverse Pro?', 'Chillverse Pro is an optional recurring subscription with two tiers, Orbit and Void, that unlock extra perks on top of the free experience. It auto-renews until cancelled, and any price change is notified in advance of your next renewal.'],
  ['Can I refer friends to Chillverse?', "Yes — Chillverse has a built-in referral program. You'll find your referral link from the Refer & Earn option on your profile."],
  ['How do I delete my Chillverse account?', 'You can request account deletion at any time. Some records may be retained briefly for legal or safety purposes, but they are no longer linked to your identity. See the Privacy Policy for full details.'],
  ['What is Halo AI?', "Halo AI is Chillverse's built-in assistant — ask it questions about the platform or your own account activity. It's automated, so treat its answers as general information rather than professional advice, and usage has a daily limit that can vary by Version tier."],
]

const ROUTES = [
  {
    path: '/faq',
    title: 'Frequently Asked Questions',
    description:
      'Answers to common Chillverse questions — games, XP and streaks, Diamonds, Chillverse Pro, referrals, privacy, and Halo AI.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      breadcrumb('FAQ', '/faq'),
    ],
    content: `
      <main style="max-width:760px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
        <h1 style="font-size:36px;font-weight:800;margin-bottom:16px">Frequently asked questions</h1>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px;margin-bottom:32px">Everything you need to know about playing Chillverse.</p>
        ${FAQ_ITEMS.map(
          ([q, a]) => `
        <section style="margin-bottom:24px">
          <h2 style="font-size:17px;font-weight:700;margin-bottom:8px">${q}</h2>
          <p style="color:#a8a8b8;line-height:1.7;font-size:15px">${a}</p>
        </section>`
        ).join('')}
      </main>
    `,
  },
  {
    path: '/about',
    title: 'About Chillverse',
    description:
      'Chillverse is a free, mobile-first Nigerian social gaming platform. Learn about our mission, features, progression system, and community.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Chillverse',
        url: `${SITE_URL}/about`,
        mainEntity: {
          '@type': 'Organization',
          name: 'Chillverse',
          url: SITE_URL,
          foundingDate: '2026',
          founder: { '@type': 'Person', name: 'Victor_vk' },
          description:
            'Chillverse is a free, mobile-first Nigerian social gaming platform combining casual multiplayer games with a progression system (XP, streaks, ranks) and social features (chat, profiles, crews).',
        },
      },
      breadcrumb('About', '/about'),
    ],
    content: `
      <main style="max-width:860px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
        <h1 style="font-size:36px;font-weight:800;margin-bottom:16px">What is Chillverse?</h1>
        <p style="color:#a8a8b8;line-height:1.7;font-size:17px;max-width:640px;margin-bottom:40px">
          Chillverse is a free, mobile-first social gaming platform built in Nigeria. It combines
          fast-paced multiplayer games with a full progression system — XP, daily streaks, and
          competitive ranks — plus real-time chat so you can play and stay connected with your
          crew in one place.
        </p>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">Our Mission</h2>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px;margin-bottom:32px">
          Chillverse exists to make casual gaming social again. Every session feeds into your XP,
          your streak, your rank, and your standing with friends — free for anyone to join.
        </p>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">Features</h2>
        <ul style="color:#a8a8b8;line-height:1.8;font-size:15px;margin-bottom:32px;padding-left:20px">
          <li><strong>Games</strong> — Whot, Colour Block, Tac Zone, and more, solo or multiplayer.</li>
          <li><strong>XP & Ranks</strong> — a 6-tier ladder from Rookie to Diamond, earned entirely through play.</li>
          <li><strong>Daily Streaks</strong> — milestones from 1 to 365 days award bonus XP.</li>
          <li><strong>Leaderboards</strong> — real-time global rankings.</li>
          <li><strong>Profiles & Badges</strong> — followers, wishlist, achievements, avatars, badge collection.</li>
          <li><strong>Chat & Crew</strong> — real-time messaging with friends.</li>
          <li><strong>The Mall</strong> — optional cosmetic avatar skins bought with Diamonds.</li>
          <li><strong>Kids Video Section</strong> — curated, family-friendly content, kept separate.</li>
        </ul>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">The Rank Ladder</h2>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px;margin-bottom:32px">
          Rookie → Bronze I–III → Silver I–III → Gold I–III → Platinum I–III → Diamond I–III.
          Every player climbs the same public ladder — there's no way to buy rank progress.
        </p>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">History</h2>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px;margin-bottom:32px">
          Chillverse launched with its core experience — chat, social features, standard game
          sessions, and a profile and wallet system — and has since shipped further Version
          upgrades adding animation and visual polish. Chillverse was founded and built by
          <strong> Victor_vk</strong>.
        </p>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">Community</h2>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px">
          Follow Chillverse on
          <a href="https://x.com/joinchillverse" style="color:#9b6dff"> X/Twitter</a>,
          <a href="https://www.instagram.com/chillverse001" style="color:#9b6dff"> Instagram</a>, and
          <a href="https://www.youtube.com/@chillverse_com" style="color:#9b6dff"> YouTube</a>.
          Or <a href="/signup" style="color:#ff6b00;font-weight:700">sign up free</a> and jump in.
        </p>
      </main>
    `,
  },
  {
    path: '/login',
    title: 'Log In — Chillverse',
    description:
      'Log in to Chillverse to keep your streak alive, jump into a game, and check your rank on the leaderboard.',
    jsonLd: [breadcrumb('Log In', '/login')],
    content: `
      <main style="max-width:640px;margin:0 auto;padding:64px 24px;font-family:Inter,sans-serif;color:#e8e8f0">
        <h1 style="font-size:32px;font-weight:800;margin-bottom:12px">Log in to Chillverse</h1>
        <p style="color:#a8a8b8;line-height:1.6;margin-bottom:24px">
          Keep your streak alive, jump back into a game, and check your rank on the
          leaderboard. Chillverse is free to play — <a href="/signup" style="color:#9b6dff">create an account</a>
          if you don't have one yet.
        </p>
        <a href="/signup" style="color:#ff6b00;font-weight:700">Sign up free →</a>
      </main>
    `,
  },
  {
    path: '/signup',
    title: 'Sign Up Free — Chillverse',
    description:
      'Create your free Chillverse account in seconds. Start earning XP, building your streak, and climbing the leaderboard today.',
    jsonLd: [breadcrumb('Sign Up', '/signup')],
    content: `
      <main style="max-width:640px;margin:0 auto;padding:64px 24px;font-family:Inter,sans-serif;color:#e8e8f0">
        <h1 style="font-size:32px;font-weight:800;margin-bottom:12px">Join Chillverse free</h1>
        <p style="color:#a8a8b8;line-height:1.6;margin-bottom:24px">
          Play fast-paced games, earn XP, build a daily streak, and climb the global
          leaderboard — free to join, no subscription required. Already have an
          account? <a href="/login" style="color:#9b6dff">Log in</a>.
        </p>
        <a href="/login" style="color:#ff6b00;font-weight:700">Log in →</a>
      </main>
    `,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — Chillverse',
    description:
      'How Chillverse collects, uses, and protects your data — covering account info, gameplay data, Halo AI, cookies, and your privacy rights.',
    jsonLd: [breadcrumb('Privacy Policy', '/privacy')],
    content: legalShell('Privacy Policy', [
      ['1. Introduction and Scope', `Chillverse ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, share, and protect your personal information when you access or use the Chillverse platform, website, mobile applications, games, and related services (collectively, "the Platform"). By using the Platform you consent to the collection, use, and sharing of your information as described here.`],
      ['2. Information We Collect', `Information you provide directly: account details (username, email, password, date of birth, country), profile details, purchase and transaction history (processed via Paystack), chat/call/voice-note content, questions asked to Halo AI, feed posts and comments, support tickets, and referral activity. Information collected automatically: device and log information, gameplay data (scores, XP, streaks, achievements, ranks), social interaction data, general IP-based location, and cookies. We do not knowingly collect information from children under 13.`],
      ['3. How We Use Your Information', `To provide and maintain the Platform, personalize your experience, enable gameplay and social features, process purchases and subscriptions, power Halo AI, communicate service and security notices, send opt-out-able marketing, improve the Platform, ensure safety and fraud prevention, and comply with applicable law.`],
      ['4. Sharing Your Information', `We do not sell your personal information. We may share it with service providers (hosting, database, analytics), our payment processor Paystack, third-party AI infrastructure that powers Halo AI's responses, other users (where you make content visible to them), law enforcement where legally required, and, in the event of a merger or acquisition, a successor entity.`],
      ['5. Halo AI and Automated Processing', `Halo AI answers questions about Chillverse and, where relevant, your own account activity, by sending your question to third-party AI infrastructure to generate a response. Halo AI only ever accesses the data of the account asking the question. Conversations are logged for quality assurance and abuse prevention. Halo AI is automated and its answers are general information, not professional, financial, medical, or legal advice.`],
      ['6. Data Retention', `We retain personal information for as long as your account is active or as needed to provide the service. Some content has shorter retention by design (e.g. Highlights are removed 5 days after posting). You may request account deletion at any time; some records may be retained longer for legal or safety purposes, no longer linked to your identity.`],
      ['7. Your Rights and Choices', `Depending on your location, you may access, correct, or request deletion of your information; object to or restrict processing; request data portability; opt out of marketing; and withdraw consent. Contact privacy@chillverse.com to exercise these rights.`],
      ['8. Cookies and Tracking', `We use cookies, pixel tags, local storage, and similar technologies to operate the Platform, remember preferences, and analyze usage. You can control cookies through your browser, though some features may not work properly if disabled.`],
      ["9. Children's Privacy", `The Platform is not intended for children under 13. Parents or guardians who believe a child has provided us personal information should contact privacy@chillverse.com immediately. Users aged 13–18 may have limited access to certain features, including chat, without parental consent.`],
      ['10. GDPR / EEA, UK, and Swiss Rights', `Users in the EEA, UK, or Switzerland have additional rights under GDPR, including access, rectification, erasure, restriction, portability, and the right to lodge a complaint with a local data protection authority. Our Data Protection Officer can be reached at dpo@chillverse.com.`],
      ['11. Contact Information', `Chillverse Privacy Department — privacy@chillverse.com · Data Protection Officer — dpo@chillverse.com`],
    ], 'Last Updated: July 12, 2026 · Effective Date: July 12, 2026'),
  },
  {
    path: '/terms',
    title: 'Terms & Conditions — Chillverse',
    description:
      'The rules for using Chillverse — accounts, fair play, Diamonds and Chillverse Pro purchases, Halo AI, and your rights as a player.',
    jsonLd: [breadcrumb('Terms & Conditions', '/terms')],
    content: legalShell('Terms & Conditions', [
      ['1. Acceptance of Terms', `By accessing or using Chillverse (the "Platform"), you agree to be legally bound by these Terms and Conditions. Your use is also governed by our Privacy Policy, incorporated here by reference. We may modify these Terms at any time; continued use after changes constitutes acceptance.`],
      ['2. About Chillverse', `Chillverse is an independently operated project. [Legal entity name, jurisdiction, and registration details to be confirmed and published here once the business is formally registered.]`],
      ['3. Eligibility and Account Registration', `You must be at least 13 years old to use the Platform; users under 18 need parental or guardian consent. You're responsible for the accuracy of your account information and the confidentiality of your credentials. Multiple accounts to manipulate ranks or leaderboards are not permitted, and accounts may not be sold or transferred.`],
      ['4. Platform Services and Features', `Chillverse provides single- and multiplayer games, player profiles with levels/ranks/achievements, streaks and weekly missions, global chat and direct messaging, a social feed with Highlights, an in-app currency ("Diamonds") and Mall, Chillverse Pro subscriptions, Halo AI, Exploration, Watch, and a Referral program. Not every feature is available to every account at all times, and features may be modified, suspended, or discontinued.`],
      ['5. User Conduct and Community Guidelines', `You agree not to use the Platform illegally, harass or discriminate against other users, cheat or use unauthorized software, manipulate stats or ranks, impersonate others, spam or distribute malware, attempt unauthorized access, or share infringing content. Violations may result in warnings, suspension, permanent bans, forfeiture of Diamonds/Pro access, or legal action.`],
      ['6. Halo AI Companion', `Halo AI is an automated assistant; its responses may occasionally be incomplete or incorrect and are for general information only, not professional advice. Use of Halo AI is subject to a daily usage limit that may vary by Version tier.`],
      ['7. Intellectual Property', `Platform content (graphics, logos, game assets, sounds, software) is owned by or licensed to Chillverse. You retain ownership of content you submit (posts, comments, Highlights, chat), while granting Chillverse a non-exclusive, worldwide, royalty-free license to use it in connection with operating and promoting the Platform.`],
      ['8. Diamonds, Chillverse Pro, and Purchases', `Diamonds are an in-app currency purchasable with real money via Paystack, spendable on cosmetic Mall items or gifting; purchases are final and non-refundable except as required by law, and Diamonds have no real-world monetary value. Chillverse Pro (Orbit and Void tiers) is an optional recurring subscription that auto-renews until cancelled; price changes are notified in advance of your next renewal.`],
      ['9. Copyright Complaints (DMCA)', `Copyright complaints should be sent to dmca@chillverse.com with a description of the work, the location of the allegedly infringing material, your contact details, a good-faith statement, a statement under penalty of perjury, and your signature.`],
      ['10. Termination and Suspension', `We may suspend or terminate accounts at any time for violations of these Terms or suspected fraud. You may delete your account at any time; deletion is permanent. Provisions that by their nature survive termination (IP, payment obligations, dispute resolution, limitation of liability) continue to apply.`],
      ['11. Disclaimers and Limitation of Liability', `The Platform is provided "as is" without warranties of any kind, including as to Halo AI's accuracy. To the maximum extent permitted by law, Chillverse is not liable for indirect, incidental, or consequential damages arising from your use of the Platform.`],
      ['12. Force Majeure', `Chillverse is not liable for delay or failure to perform due to causes beyond its reasonable control, including outages, cyberattacks, natural disasters, or third-party service failures.`],
      ['13. Export Control and Sanctions', `You may not use the Platform if you are located in, or a resident of, a country subject to comprehensive sanctions, or if otherwise prohibited under applicable export control or sanctions law.`],
      ['14. Dispute Resolution and Governing Law', `These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes are first attempted to be resolved informally for 30 days, then by arbitration seated in Lagos, Nigeria, in English. [Governing law and arbitration details to be confirmed with legal counsel before publishing.]`],
      ['15. General Provisions', `These Terms and the Privacy Policy form the entire agreement between you and Chillverse. If any provision is found invalid, the rest remains in effect. Failure to enforce a right is not a waiver of it.`],
      ['16. Contact Information', `Chillverse Legal Department — legal@chillverse.com · DMCA notices — dmca@chillverse.com · Privacy inquiries — privacy@chillverse.com`],
    ], 'Last Updated: July 12, 2026 · Effective Date: July 12, 2026'),
  },
]

function legalShell(heading, sections, dateLine) {
  const sectionsHtml = sections
    .map(
      ([title, text]) => `
      <section style="margin-bottom:28px">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#e8e8f0">${escapeHtml(title)}</h2>
        <p style="color:#a8a8b8;line-height:1.7;font-size:15px">${escapeHtml(text)}</p>
      </section>`
    )
    .join('')
  return `
    <main style="max-width:760px;margin:0 auto;padding:64px 24px;font-family:Inter,sans-serif;color:#e8e8f0">
      <h1 style="font-size:32px;font-weight:800;margin-bottom:8px">${escapeHtml(heading)}</h1>
      <p style="color:#666;font-size:13px;margin-bottom:32px">${escapeHtml(dateLine)}</p>
      ${sectionsHtml}
    </main>
  `
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Blog prerendering ────────────────────────────────────────────────────
// The blog lives in Supabase, not in the static route list above, so it
// needs its own step: fetch every published post at build time (via a
// plain REST call — no need for @supabase/supabase-js here) and turn each
// one into a real crawlable page, the same way legal pages are handled
// above. This is what actually lets AI crawlers (GPTBot, ClaudeBot,
// PerplexityBot, etc.) — which don't run JS — "pick up" the blog at all.
//
// Reuses VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, which Vercel already
// injects into the build environment for the Vite bundle, so no extra
// config is needed beyond what's already set for the app to work.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// Keep in sync with src/features/blog/constants.ts if categories/series change.
const CATEGORY_LABELS = {
  'game-updates': 'Game Updates',
  'community-spotlight': 'Community Spotlight',
  'chillverse-hq': 'Chillverse HQ',
  'how-to': 'How-To',
  safety: 'Safety',
}
const SERIES_LABELS = {
  'update-log': 'Update Log',
  'top-of-the-ladder': 'Top of the Ladder',
  'streak-spotlight': 'Streak Spotlight',
}
function seriesLabel(series) {
  return SERIES_LABELS[series] ?? series.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function fetchSupabase(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json()
}

// A minimal HTML version of src/shared/lib/markdownLite.ts's subset
// (## / ### headings, - / * / 1. lists, > quotes, **bold**, *italic*,
// [text](url) links). Keep this in sync if that parser's syntax changes.
function mdInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}
function liteMarkdownToHtml(content) {
  return content
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      if (block.startsWith('### ')) return `<h3>${mdInline(block.replace(/^### /, ''))}</h3>`
      if (block.startsWith('## ')) return `<h2>${mdInline(block.replace(/^## /, ''))}</h2>`
      if (block.startsWith('> ')) return `<blockquote>${mdInline(block.replace(/^>\s?/, ''))}</blockquote>`
      if (lines.length && lines.every((l) => /^[-*]\s/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${mdInline(l.replace(/^[-*]\s/, ''))}</li>`).join('')}</ul>`
      }
      if (lines.length && lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${mdInline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`
      }
      return `<p>${mdInline(block)}</p>`
    })
    .join('\n')
}
function stripMd(text) {
  return text.replace(/[#>*_[\]()`]/g, '').replace(/\s+/g, ' ').trim()
}
function dateLabel(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
}

function blogPostContent(post, authorName) {
  const meta = [CATEGORY_LABELS[post.category] || post.category, dateLabel(post.published_at), authorName].filter(Boolean).join(' · ')
  return `
    <main style="max-width:720px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
      ${post.hero_image_url ? `<img src="${post.hero_image_url}" alt="${escapeHtml(post.title)}" style="width:100%;border-radius:16px;margin-bottom:24px" />` : ''}
      <div style="font-size:13px;color:#888;margin-bottom:8px">${escapeHtml(meta)}</div>
      <h1 style="font-size:34px;font-weight:800;margin:0 0 20px;line-height:1.15">${escapeHtml(post.title)}</h1>
      ${post.excerpt ? `<p style="color:#a8a8b8;font-size:16px;line-height:1.6;margin-bottom:28px">${escapeHtml(post.excerpt)}</p>` : ''}
      <article>${liteMarkdownToHtml(post.content)}</article>
      ${post.tags?.length ? `<div style="margin-top:32px;font-size:13px;color:#888">${post.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</div>` : ''}
      <p style="margin-top:40px"><a href="/blog" style="color:#ff6b00;font-weight:700">← Back to Blog</a></p>
    </main>
  `
}

function blogListContent(heading, subtitle, posts) {
  return `
    <main style="max-width:860px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
      <h1 style="font-size:36px;font-weight:800;margin-bottom:8px">${escapeHtml(heading)}</h1>
      ${subtitle ? `<p style="color:#a8a8b8;margin-bottom:32px">${escapeHtml(subtitle)}</p>` : ''}
      ${posts
        .map(
          (p) => `
        <article style="margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="font-size:12px;color:#888;margin-bottom:6px">${escapeHtml([CATEGORY_LABELS[p.category] || p.category, dateLabel(p.published_at)].filter(Boolean).join(' · '))}</div>
          <h2 style="font-size:20px;font-weight:700;margin:0 0 8px"><a href="/blog/${p.slug}" style="color:#e8e8f0;text-decoration:none">${escapeHtml(p.title)}</a></h2>
          ${p.excerpt ? `<p style="color:#a8a8b8;font-size:14px;line-height:1.6;margin:0">${escapeHtml(p.excerpt)}</p>` : ''}
        </article>`
        )
        .join('')}
      ${posts.length === 0 ? `<p style="color:#a8a8b8">No posts here yet — check back soon.</p>` : ''}
    </main>
  `
}

let blogPosts = []
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    blogPosts = await fetchSupabase(
      'blog_posts?select=slug,title,excerpt,content,hero_image_url,category,series,tags,locale,author_id,published_at,updated_at' +
        '&is_published=eq.true&order=published_at.desc&limit=500'
    )
    console.log(`✓ fetched ${blogPosts.length} published blog post(s) for prerendering`)
  } catch (err) {
    console.warn(`⚠ could not fetch blog posts — skipping blog prerendering: ${err.message}`)
  }
} else {
  console.warn('⚠ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — skipping blog prerendering')
}

let authorsById = {}
const authorIds = [...new Set(blogPosts.map((p) => p.author_id).filter(Boolean))]
if (authorIds.length) {
  try {
    const authors = await fetchSupabase(`profiles?select=id,username,display_name&id=in.(${authorIds.join(',')})`)
    authorsById = Object.fromEntries(authors.map((a) => [a.id, a.display_name || a.username]))
  } catch (err) {
    console.warn(`⚠ could not fetch author names for blog prerendering: ${err.message}`)
  }
}

const enPosts = blogPosts.filter((p) => p.locale === 'en')
const updateLogPosts = enPosts.filter((p) => p.series === 'update-log')
const seriesSlugs = [...new Set(enPosts.map((p) => p.series).filter(Boolean))]

const BLOG_ROUTES = [
  {
    path: '/blog',
    title: 'Blog — Chillverse',
    description: 'Patch notes, community spotlights, and dev diaries — straight from the team building Chillverse.',
    jsonLd: [breadcrumb('Blog', '/blog')],
    content: blogListContent('Chillverse Blog', 'Patch notes, community spotlights, and dev diaries.', enPosts.slice(0, 30)),
  },
  ...(updateLogPosts.length
    ? [
        {
          path: '/blog/updates',
          title: 'Update Log — Chillverse',
          description: 'Every Chillverse patch and update, in order.',
          jsonLd: [breadcrumb('Update Log', '/blog/updates')],
          content: blogListContent('Update Log', `${updateLogPosts.length} update${updateLogPosts.length === 1 ? '' : 's'}`, updateLogPosts),
        },
      ]
    : []),
  ...seriesSlugs.map((series) => {
    const posts = enPosts.filter((p) => p.series === series)
    const label = seriesLabel(series)
    return {
      path: `/blog/series/${series}`,
      title: `${label} — Chillverse`,
      description: `${posts.length} post${posts.length === 1 ? '' : 's'} in this series on Chillverse.`,
      jsonLd: [breadcrumb(label, `/blog/series/${series}`)],
      content: blogListContent(label, `${posts.length} post${posts.length === 1 ? '' : 's'} in this series`, posts),
    }
  }),
  ...blogPosts.map((post) => {
    const authorName = post.author_id ? authorsById[post.author_id] : null
    const description = (post.excerpt || stripMd(post.content)).slice(0, 160)
    return {
      path: `/blog/${post.slug}`,
      title: `${post.title} — Chillverse`,
      description,
      ogType: 'article',
      ogImage: post.hero_image_url || undefined,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description,
          ...(post.hero_image_url ? { image: [post.hero_image_url] } : {}),
          datePublished: post.published_at || post.updated_at,
          dateModified: post.updated_at || post.published_at,
          author: authorName ? { '@type': 'Person', name: authorName } : { '@type': 'Organization', name: 'Chillverse' },
          publisher: { '@type': 'Organization', name: 'Chillverse', logo: { '@type': 'ImageObject', url: `${SITE_URL}/web-app-manifest-512x512.png` } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
          articleSection: CATEGORY_LABELS[post.category] || post.category,
          ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
        },
        breadcrumb(post.title, `/blog/${post.slug}`),
      ],
      content: blogPostContent(post, authorName),
    }
  }),
]

// ── Help center prerendering ─────────────────────────────────────────────
// Same problem as the blog, worse consequences: a help center that only
// exists after JS runs is invisible to search engines, which is where
// essentially all help-center traffic comes from. Someone Googling
// "chillverse streak reset" should land on the article, not on nothing.
//
// support.chillverse.com.ng is a 308 redirect to this path (see vercel.json),
// not a separate origin, so there is only ever one canonical URL per article
// and no duplicate-content split between two hostnames.
const SUPPORT_URL = `${SITE_URL}/support`

function supportBreadcrumb(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chillverse Support', item: SUPPORT_URL },
      ...trail.map(([name, path], i) => ({
        '@type': 'ListItem', position: i + 2, name, item: `${SUPPORT_URL}${path}`,
      })),
    ],
  }
}

let supportCategories = []
let supportArticles = []
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    ;[supportCategories, supportArticles] = await Promise.all([
      fetchSupabase('support_categories?select=id,slug,name,description,sort_order&order=sort_order.asc'),
      fetchSupabase(
        'support_articles?select=slug,title,summary,content,tags,category_id,author_id,persona_author_id,view_count,created_at,updated_at' +
          '&is_published=eq.true&order=sort_order.asc&limit=1000'
      ),
    ])
    console.log(`✓ fetched ${supportArticles.length} published support article(s) in ${supportCategories.length} categories`)
  } catch (err) {
    console.warn(`⚠ could not fetch support content — skipping help center prerendering: ${err.message}`)
    supportCategories = []
    supportArticles = []
  }
}

// Bylines come from two tables — real profiles and house personas — because
// support_articles mirrors blog_posts here (migration 0104).
const supportAuthorsById = {}
if (supportArticles.length) {
  const profileIds = [...new Set(supportArticles.map((a) => a.author_id).filter(Boolean))]
  const personaIds = [...new Set(supportArticles.map((a) => a.persona_author_id).filter(Boolean))]
  try {
    if (profileIds.length) {
      const rows = await fetchSupabase(`profiles?select=id,username,display_name&id=in.(${profileIds.join(',')})`)
      for (const r of rows) supportAuthorsById[r.id] = r.display_name || r.username
    }
    if (personaIds.length) {
      const rows = await fetchSupabase(`blog_personas?select=id,username,display_name&id=in.(${personaIds.join(',')})`)
      for (const r of rows) supportAuthorsById[r.id] = r.display_name || r.username
    }
  } catch (err) {
    console.warn(`⚠ could not fetch help center author names: ${err.message}`)
  }
}

const categoryById = Object.fromEntries(supportCategories.map((c) => [c.id, c]))
const articlesByCategory = {}
for (const article of supportArticles) {
  const category = categoryById[article.category_id]
  if (!category) continue // orphaned article — no route to render it at
  ;(articlesByCategory[category.slug] ??= []).push(article)
}

function supportShell(heading, subtitle, inner) {
  return `
    <main style="max-width:860px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
      <h1 style="font-size:36px;font-weight:800;margin-bottom:8px">${escapeHtml(heading)}</h1>
      ${subtitle ? `<p style="color:#a8a8b8;line-height:1.7;margin-bottom:32px">${escapeHtml(subtitle)}</p>` : ''}
      ${inner}
    </main>
  `
}

function articleLinkList(categorySlug, articles) {
  if (!articles.length) return `<p style="color:#a8a8b8">No articles here yet.</p>`
  return `<ul style="line-height:2;padding-left:20px">${articles
    .map(
      (a) =>
        `<li><a href="/support/${categorySlug}/${a.slug}" style="color:#e8e8f0">${escapeHtml(a.title)}</a>${
          a.summary ? ` — <span style="color:#a8a8b8">${escapeHtml(a.summary)}</span>` : ''
        }</li>`
    )
    .join('')}</ul>`
}

const SUPPORT_ROUTES = supportCategories.length
  ? [
      {
        path: '/support',
        canonicalPath: '',
        siteUrl: SUPPORT_URL,
        title: 'Chillverse Help Center',
        description:
          'Guides, answers, and troubleshooting for Chillverse — accounts, games, XP and streaks, Diamonds, Chillverse Pro, and safety.',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Chillverse Help Center',
            url: SUPPORT_URL,
            publisher: { '@type': 'Organization', name: 'Chillverse', url: SITE_URL },
          },
          supportBreadcrumb([]),
        ],
        content: supportShell(
          'Chillverse Help Center',
          'Find answers about your account, games, streaks, Diamonds, and everything else.',
          `<ul style="line-height:2;padding-left:20px">${supportCategories
            .map(
              (c) =>
                `<li><a href="/support/${c.slug}" style="color:#e8e8f0;font-weight:700">${escapeHtml(c.name)}</a>${
                  c.description ? ` — <span style="color:#a8a8b8">${escapeHtml(c.description)}</span>` : ''
                } <span style="color:#666">(${(articlesByCategory[c.slug] ?? []).length})</span></li>`
            )
            .join('')}</ul>
           <p style="margin-top:32px"><a href="/support/feedback" style="color:#ff6b00;font-weight:700">Share feedback →</a></p>`
        ),
      },
      ...supportCategories.map((category) => {
        const articles = articlesByCategory[category.slug] ?? []
        return {
          path: `/support/${category.slug}`,
          canonicalPath: `/${category.slug}`,
          siteUrl: SUPPORT_URL,
          title: `${category.name} — Chillverse Help Center`,
          description:
            category.description ||
            `${articles.length} help article${articles.length === 1 ? '' : 's'} about ${category.name} on Chillverse.`,
          jsonLd: [supportBreadcrumb([[category.name, `/${category.slug}`]])],
          content: supportShell(category.name, category.description, articleLinkList(category.slug, articles)),
        }
      }),
      ...supportArticles
        .filter((article) => categoryById[article.category_id])
        .map((article) => {
          const category = categoryById[article.category_id]
          const description = (article.summary || stripMd(article.content)).slice(0, 160)
          const canonicalPath = `/${category.slug}/${article.slug}`
          const authorName = supportAuthorsById[article.persona_author_id || article.author_id] || null
          return {
            path: `/support/${category.slug}/${article.slug}`,
            canonicalPath,
            siteUrl: SUPPORT_URL,
            title: `${article.title} — Chillverse Help Center`,
            description,
            ogType: 'article',
            jsonLd: [
              {
                '@context': 'https://schema.org',
                // TechArticle is the schema type Google expects for
                // support/how-to documentation, not BlogPosting.
                '@type': 'TechArticle',
                headline: article.title,
                description,
                datePublished: article.created_at,
                dateModified: article.updated_at || article.created_at,
                author: authorName
                  ? { '@type': 'Person', name: authorName }
                  : { '@type': 'Organization', name: 'Chillverse' },
                publisher: {
                  '@type': 'Organization',
                  name: 'Chillverse',
                  logo: { '@type': 'ImageObject', url: `${SITE_URL}/web-app-manifest-512x512.png` },
                },
                mainEntityOfPage: { '@type': 'WebPage', '@id': `${SUPPORT_URL}${canonicalPath}` },
                articleSection: category.name,
                ...(article.tags?.length ? { keywords: article.tags.join(', ') } : {}),
              },
              supportBreadcrumb([
                [category.name, `/${category.slug}`],
                [article.title, canonicalPath],
              ]),
            ],
            content: `
              <main style="max-width:720px;margin:0 auto;padding:96px 24px 64px;font-family:Inter,sans-serif;color:#e8e8f0">
                <div style="font-size:13px;color:#888;margin-bottom:8px"><a href="/support" style="color:#888">Help Center</a> › <a href="/support/${category.slug}" style="color:#888">${escapeHtml(category.name)}</a></div>
                <h1 style="font-size:34px;font-weight:800;margin:0 0 20px;line-height:1.15">${escapeHtml(article.title)}</h1>
                ${authorName ? `<div style="font-size:13px;color:#888;margin-bottom:12px">By ${escapeHtml(authorName)}</div>` : ''}
                ${article.summary ? `<p style="color:#a8a8b8;font-size:16px;line-height:1.6;margin-bottom:28px">${escapeHtml(article.summary)}</p>` : ''}
                <article>${liteMarkdownToHtml(article.content)}</article>
                ${article.tags?.length ? `<div style="margin-top:32px;font-size:13px;color:#888">${article.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</div>` : ''}
                <p style="margin-top:40px"><a href="/support/${category.slug}" style="color:#ff6b00;font-weight:700">← Back to ${escapeHtml(category.name)}</a></p>
              </main>
            `,
          }
        }),
    ]
  : []

// ── Build ─────────────────────────────────────────────────────────────────
const template = readFileSync(join(DIST, 'index.html'), 'utf-8')

function renderAndWrite(route) {
  let html = template
  // Support pages are canonical on their own subdomain (see SUPPORT_URL);
  // everything else is canonical on the apex domain.
  const base = route.siteUrl ?? SITE_URL

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(route.description)}" />`
  )
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${base}${route.canonicalPath ?? route.path}" />`
  )
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${base}${route.canonicalPath ?? route.path}" />`)
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
  html = html.replace(/<meta name="twitter:url" content="[^"]*"\s*\/?>/, `<meta name="twitter:url" content="${base}${route.canonicalPath ?? route.path}" />`)
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
  if (route.ogType) {
    html = html.replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${route.ogType}" />`)
  }

  // Strip the homepage's JSON-LD blocks (Organization + FAQPage) and
  // replace with this route's own Organization + BreadcrumbList so every
  // page still carries site identity plus its own position in the site.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
  let extraHead = [ORG_JSON_LD, ...route.jsonLd]
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n    ')

  // Blog posts get their own hero image as the share image, replacing the
  // default homepage OG images (collapses both og:image variants to one).
  if (route.ogImage) {
    html = html.replace(/<meta property="og:image[^"]*" content="[^"]*"\s*\/?>\s*/g, '')
    html = html.replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>\s*/g, '')
    extraHead = `<meta property="og:image" content="${route.ogImage}" />\n    <meta name="twitter:image" content="${route.ogImage}" />\n    ${extraHead}`
  }

  html = html.replace('</head>', `${extraHead}\n  </head>`)

  // Give non-JS crawlers real visible content instead of an empty shell.
  html = html.replace('<div id="root"></div>', `<div id="root">${route.content}</div>`)

  const outDir = join(DIST, route.path.replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8')
  console.log(`✓ prerendered ${route.path}`)
}

for (const route of [...ROUTES, ...BLOG_ROUTES, ...SUPPORT_ROUTES]) renderAndWrite(route)

// ── sitemap.xml — add blog URLs so crawlers can discover posts without search ──
// image: optional { loc, title } — adds an <image:image> entry so Google Images
// has a signal to crawl the post's hero image, same as the homepage already does.
function sitemapEntry(loc, { lastmod, changefreq = 'weekly', priority = '0.6', image, base = SITE_URL } = {}) {
  const imageXml = image
    ? `    <image:image>\n      <image:loc>${image.loc}</image:loc>\n      <image:title>${escapeHtml(image.title)}</image:title>\n    </image:image>\n`
    : ''
  return `  <url>\n    <loc>${base}${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${imageXml}  </url>\n`
}
try {
  let additions = sitemapEntry('/blog', { changefreq: 'daily', priority: '0.9' })
  if (updateLogPosts.length) additions += sitemapEntry('/blog/updates', { changefreq: 'daily', priority: '0.7' })
  for (const series of seriesSlugs) additions += sitemapEntry(`/blog/series/${series}`, { priority: '0.5' })
  for (const post of blogPosts) {
    // hero_image_url may be a relative path (e.g. from Supabase storage) or
    // already-absolute — normalize to a full URL so it's valid in the sitemap.
    const heroUrl = post.hero_image_url
      ? (post.hero_image_url.startsWith('http') ? post.hero_image_url : `${SITE_URL}${post.hero_image_url.startsWith('/') ? '' : '/'}${post.hero_image_url}`)
      : null
    additions += sitemapEntry(`/blog/${post.slug}`, {
      lastmod: (post.updated_at || post.published_at || '').slice(0, 10) || undefined,
      changefreq: 'monthly',
      priority: '0.7',
      image: heroUrl ? { loc: heroUrl, title: post.title } : undefined,
    })
  }
  const sitemapPath = join(DIST, 'sitemap.xml')
  const sitemapXml = readFileSync(sitemapPath, 'utf-8').replace('</urlset>', `${additions}</urlset>`)
  writeFileSync(sitemapPath, sitemapXml, 'utf-8')
  console.log(`✓ sitemap.xml updated with ${blogPosts.length} blog URL(s)`)
} catch (err) {
  console.warn(`⚠ could not update sitemap.xml: ${err.message}`)
}

// ── sitemap.xml — help center URLs.
// These live on the apex domain under /support, the same host that serves
// sitemap.xml, so they belong in the main sitemap rather than a separate one.
// (A sitemap may only list URLs on the host serving it.) This runs after the
// blog block above, so it re-reads the file and appends a second time.
try {
  if (supportCategories.length) {
    let urls = sitemapEntry('', { base: SUPPORT_URL, changefreq: 'weekly', priority: '0.9' })
    for (const category of supportCategories) {
      urls += sitemapEntry(`/${category.slug}`, { base: SUPPORT_URL, changefreq: 'weekly', priority: '0.7' })
    }
    let articleUrlCount = 0
    for (const article of supportArticles) {
      const category = categoryById[article.category_id]
      if (!category) continue // orphaned article — not reachable at any URL
      articleUrlCount += 1
      urls += sitemapEntry(`/${category.slug}/${article.slug}`, {
        base: SUPPORT_URL,
        lastmod: (article.updated_at || article.created_at || '').slice(0, 10) || undefined,
        changefreq: 'monthly',
        priority: '0.8',
      })
    }
    const sitemapPath = join(DIST, 'sitemap.xml')
    const withSupport = readFileSync(sitemapPath, 'utf-8').replace('</urlset>', `${urls}</urlset>`)
    writeFileSync(sitemapPath, withSupport, 'utf-8')
    console.log(`✓ sitemap.xml updated with ${articleUrlCount} help center article URL(s)`)
  }
} catch (err) {
  console.warn(`⚠ could not write sitemap-support.xml: ${err.message}`)
}

// ── llms.txt — point AI assistants/crawlers straight at the blog ──────────
try {
  if (enPosts.length) {
    const section = `\n## Blog\n- [Chillverse Blog](${SITE_URL}/blog): patch notes, community spotlights, and dev diaries from the team building Chillverse.\n${enPosts
      .slice(0, 8)
      .map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug})${p.excerpt ? `: ${p.excerpt}` : ''}`)
      .join('\n')}\n`
    const llmsPath = join(DIST, 'llms.txt')
    writeFileSync(llmsPath, readFileSync(llmsPath, 'utf-8') + section, 'utf-8')
    console.log('✓ llms.txt updated with latest blog posts')
  }
  if (supportCategories.length) {
    // Help articles are the single most useful thing an AI assistant can
    // quote when someone asks it a question about Chillverse, so point at
    // the categories explicitly rather than hoping crawlers find them.
    const supportSection = `\n## Help Center\n- [Chillverse Help Center](${SUPPORT_URL}): guides and troubleshooting for accounts, games, streaks, Diamonds, and Chillverse Pro.\n${supportCategories
      .map((c) => `- [${c.name}](${SUPPORT_URL}/${c.slug})${c.description ? `: ${c.description}` : ''}`)
      .join('\n')}\n`
    const llmsPath = join(DIST, 'llms.txt')
    writeFileSync(llmsPath, readFileSync(llmsPath, 'utf-8') + supportSection, 'utf-8')
    console.log('✓ llms.txt updated with help center categories')
  }
} catch (err) {
  console.warn(`⚠ could not update llms.txt: ${err.message}`)
}
