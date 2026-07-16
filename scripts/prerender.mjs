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
const ROUTES = [
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

// ── Build ─────────────────────────────────────────────────────────────────
const template = readFileSync(join(DIST, 'index.html'), 'utf-8')

for (const route of ROUTES) {
  let html = template

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(route.description)}" />`
  )
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${SITE_URL}${route.path}" />`
  )
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${SITE_URL}${route.path}" />`)
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
  html = html.replace(/<meta name="twitter:url" content="[^"]*"\s*\/?>/, `<meta name="twitter:url" content="${SITE_URL}${route.path}" />`)
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)

  // Strip the homepage's JSON-LD blocks (Organization + FAQPage) and
  // replace with this route's own Organization + BreadcrumbList so every
  // page still carries site identity plus its own position in the site.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
  const jsonLdBlocks = [ORG_JSON_LD, ...route.jsonLd]
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n    ')
  html = html.replace('</head>', `${jsonLdBlocks}\n  </head>`)

  // Give non-JS crawlers real visible content instead of an empty shell.
  html = html.replace('<div id="root"></div>', `<div id="root">${route.content}</div>`)

  const outDir = join(DIST, route.path.replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8')
  console.log(`✓ prerendered ${route.path}`)
}
