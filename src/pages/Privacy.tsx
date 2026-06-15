import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

const SECTIONS = [
  { id: 's1', title: '1. Introduction and Scope' },
  { id: 's2', title: '2. Information We Collect' },
  { id: 's3', title: '3. How We Use Your Information' },
  { id: 's4', title: '4. Sharing Your Information' },
  { id: 's5', title: '5. Data Retention' },
  { id: 's6', title: '6. Your Rights and Choices' },
  { id: 's7', title: '7. Cookies and Tracking' },
  { id: 's8', title: "8. Children's Privacy" },
  { id: 's9', title: '9. GDPR / EEA Rights' },
  { id: 's10', title: '10. Contact Information' },
]

export default function Privacy() {
  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3.5 px-6 md:px-10 py-4 bg-chill-bg/85 backdrop-blur-xl border-b border-chill-border">
        <Link to="/" className="text-sm text-chill-textSecondary hover:text-chill-text">Chillverse</Link>
        <span className="text-chill-textMuted">/</span>
        <span className="text-sm text-chill-violetSoft font-semibold">Privacy Policy</span>
        <Link to="/terms" className="ml-auto text-sm text-chill-textSecondary hover:text-chill-text">Terms & Conditions</Link>
      </div>

      <div className="max-w-[800px] mx-auto px-5 md:px-10 pt-24 pb-20">

        <div className="mb-12 pb-8 border-b border-chill-border">
          <div className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-chill-violet mb-3">Legal Document</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Privacy Policy</h1>
          <div className="text-[13px] text-chill-textMuted">Last Updated: June 12, 2026 · Effective Date: June 12, 2026</div>
        </div>

        <div className="bg-chill-surface border border-chill-border rounded-2xl p-6 md:p-7 mb-12">
          <h3 className="text-[13px] font-bold text-chill-textMuted tracking-wide uppercase mb-3.5 font-mono">Table of Contents</h3>
          <ol className="pl-4.5 flex flex-col gap-2 list-decimal">
            {SECTIONS.map((s) => (
              <li key={s.id} className="text-sm">
                <a href={`#${s.id}`} className="text-chill-violetSoft hover:underline">{s.title.replace(/^\d+\.\s/, '')}</a>
              </li>
            ))}
          </ol>
        </div>

        <Section id="s1" title="1. Introduction and Scope">
          <p>Chillverse ("we", "us", "our", or "the Company") is committed to protecting your privacy and personal information. This Privacy Policy describes how we collect, use, store, share, and protect your personal information when you access, download, install, or use the Chillverse platform, website, mobile applications, games, and any related services (collectively, "the Platform").</p>
          <p>This Privacy Policy applies to all users of the Platform, including registered players, guest users, visitors to our website, and anyone who interacts with our services. By accessing or using the Platform, you consent to the collection, use, and sharing of your information as described in this Privacy Policy.</p>
          <p>This Privacy Policy is incorporated into and forms part of our Terms and Conditions of Service. We reserve the right to modify this Privacy Policy at any time. Your continued use of the Platform following any changes constitutes your acceptance of such changes.</p>
          <p>If you do not agree with any aspect of this Privacy Policy, you must immediately cease using the Platform and delete your account.</p>
        </Section>

        <Section id="s2" title="2. Information We Collect">
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">2.1 Information You Provide Directly</h3>
          <p>We collect information that you voluntarily provide when you:</p>
          <ul>
            <li>Register for an account: username, email address, password, date of birth, and country/region</li>
            <li>Complete your player profile: display name, avatar, bio, game preferences</li>
            <li>Make purchases: billing address, payment method details (via third-party processors), transaction history</li>
            <li>Use Chat Services: messages, direct messages, group chat content, forum posts</li>
            <li>Contact support or submit feedback</li>
            <li>Participate in surveys, contests, or promotions</li>
            <li>Connect your account with third-party services</li>
            <li>Submit User-Generated Content: screenshots, gameplay recordings, custom content</li>
          </ul>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">2.2 Information Collected Automatically</h3>
          <ul>
            <li>Device information: device type, OS, hardware model, unique device identifiers, screen resolution</li>
            <li>Log information: IP address, browser type, access times, pages viewed</li>
            <li>Gameplay data: scores, win/loss records, XP earned, streaks, achievements, leaderboard positions</li>
            <li>Social interaction data: friend lists, crew memberships, followed players</li>
            <li>Location information: general geographic location from IP address</li>
            <li>Cookies and similar tracking technologies (see Section 7)</li>
          </ul>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">2.3 Information from Third Parties</h3>
          <p>We may receive information from social media platforms (if you connect your account), payment processors, analytics providers, advertising partners, and other users who tag or invite you.</p>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">2.4 Children's Information</h3>
          <p>We do not knowingly collect personal information from children under 13. See Section 8 for full details.</p>
        </Section>

        <Section id="s3" title="3. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide and maintain the Platform, including account management and authentication</li>
            <li>Personalize your experience: game recommendations, friend suggestions, content tailoring</li>
            <li>Enable gameplay and social features: leaderboards, XP tracking, streaks, chat, multiplayer</li>
            <li>Process transactions: payments, virtual items, subscriptions, refunds</li>
            <li>Communicate with you: service notifications, security alerts, support responses</li>
            <li>Send marketing and promotional communications (you may opt out at any time)</li>
            <li>Improve the Platform through usage analysis and feature testing</li>
            <li>Ensure safety and security: fraud detection, cheating prevention, content moderation</li>
            <li>Comply with applicable laws and legal processes</li>
            <li>Provide access to the Chillverse learning branch and track educational progress</li>
          </ul>
        </Section>

        <Section id="s4" title="4. Sharing Your Information">
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul>
            <li>Service providers who assist us in operating the Platform (hosting, analytics, payment processing)</li>
            <li>Other users, where you choose to make your profile, scores, or content public</li>
            <li>Law enforcement or regulatory authorities when required by law</li>
            <li>Business partners in connection with Platform features you opt into</li>
            <li>Successors in the event of a merger, acquisition, or sale of assets</li>
          </ul>
        </Section>

        <Section id="s5" title="5. Data Retention">
          <p>We retain your personal information for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us. Some information may be retained for legal or compliance purposes after account deletion.</p>
        </Section>

        <Section id="s6" title="6. Your Rights and Choices">
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate or incomplete information</li>
            <li>Request deletion of your personal information</li>
            <li>Object to or restrict certain processing activities</li>
            <li>Data portability — receive your data in a structured, machine-readable format</li>
            <li>Opt out of marketing communications at any time</li>
            <li>Withdraw consent where processing is based on consent</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:privacy@chillverse.com" className="text-chill-violetSoft">privacy@chillverse.com</a>.</p>
        </Section>

        <Section id="s7" title="7. Cookies and Tracking Technologies">
          <p>We use cookies, web beacons, pixel tags, local storage, and similar technologies to collect information about your use of the Platform, remember your preferences, analyze usage patterns, and deliver targeted advertising. You can control cookie settings through your browser, though some features may not function properly if cookies are disabled.</p>
        </Section>

        <Section id="s8" title="8. Children's Privacy">
          <p>The Platform is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at <a href="mailto:privacy@chillverse.com" className="text-chill-violetSoft">privacy@chillverse.com</a> and we will delete that information promptly.</p>
          <p>For users between 13 and 18, we collect limited information and may restrict access to certain features, including chat functionalities, without parental consent.</p>
        </Section>

        <Section id="s9" title="9. GDPR / EEA, UK, and Swiss Privacy Rights">
          <p>If you are located in the EEA, UK, or Switzerland, you have additional rights under GDPR including the right to access, rectification, erasure, restriction of processing, data portability, and to lodge a complaint with your local data protection authority.</p>
          <p>Our Data Protection Officer can be reached at <a href="mailto:dpo@chillverse.com" className="text-chill-violetSoft">dpo@chillverse.com</a>.</p>
        </Section>

        <Section id="s10" title="10. Contact Information">
          <div className="bg-chill-surface border border-chill-border rounded-xl px-6 py-5">
            <p className="m-0 text-sm">
              <strong>Chillverse Privacy Department</strong><br />
              Email: <a href="mailto:privacy@chillverse.com" className="text-chill-violetSoft">privacy@chillverse.com</a><br />
              Data Protection Officer: <a href="mailto:dpo@chillverse.com" className="text-chill-violetSoft">dpo@chillverse.com</a>
            </p>
          </div>
        </Section>

        <p className="text-[13px] text-chill-textMuted text-center mt-12 pt-6 border-t border-chill-border">© 2026 Chillverse. All rights reserved.</p>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="mb-12 scroll-mt-20">
      <h2 className="text-xl md:text-2xl font-bold mb-4 pt-2">{title}</h2>
      <div className="flex flex-col gap-3.5 text-[15px] text-chill-textSecondary leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:leading-relaxed">
        {children}
      </div>
    </div>
  )
}
