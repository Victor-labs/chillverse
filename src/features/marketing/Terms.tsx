import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

const SECTIONS = [
  { id: 't1', title: '1. Acceptance of Terms' },
  { id: 't2', title: '2. Eligibility and Account Registration' },
  { id: 't3', title: '3. Platform Services and Features' },
  { id: 't4', title: '4. User Conduct and Community Guidelines' },
  { id: 't5', title: '5. Intellectual Property' },
  { id: 't6', title: '6. Virtual Items and Purchases' },
  { id: 't7', title: '7. Termination and Suspension' },
  { id: 't8', title: '8. Disclaimers and Limitation of Liability' },
  { id: 't9', title: '9. Dispute Resolution' },
  { id: 't10', title: '10. Contact Information' },
]

export default function Terms() {
  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3.5 px-6 md:px-10 py-4 bg-chill-bg/85 backdrop-blur-xl border-b border-chill-border">
        <Link to="/" className="text-sm text-chill-textSecondary hover:text-chill-text">Chillverse</Link>
        <span className="text-chill-textMuted">/</span>
        <span className="text-sm text-chill-violetSoft font-semibold">Terms & Conditions</span>
        <Link to="/privacy" className="ml-auto text-sm text-chill-textSecondary hover:text-chill-text">Privacy Policy</Link>
      </div>

      <div className="max-w-[800px] mx-auto px-5 md:px-10 pt-24 pb-20">

        <div className="mb-12 pb-8 border-b border-chill-border">
          <div className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-chill-violet mb-3">Legal Document</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Terms & Conditions</h1>
          <div className="text-[13px] text-chill-textMuted">Last Updated: June 12, 2026 · Effective Date: June 12, 2026</div>
        </div>

        <div className="bg-chill-amber/[0.06] border border-chill-amber/25 rounded-xl px-4.5 py-3.5 mb-5 text-sm text-chill-textSecondary leading-relaxed">
          ⚠️ Please read these Terms carefully before using Chillverse. By accessing or using the Platform, you agree to be legally bound by these Terms.
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

        <Section id="t1" title="1. Acceptance of Terms">
          <p>By accessing, downloading, installing, or using the Chillverse platform, website, mobile applications, games, and any related services (collectively, "the Platform" or "Chillverse"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions ("Terms"), our Privacy Policy, and all applicable laws and regulations.</p>
          <p>These Terms constitute a legally binding agreement between you ("User", "Player", "you", or "your") and Chillverse ("we", "us", "our", or "the Company").</p>
          <p>We reserve the right to modify these Terms at any time. All changes will be effective immediately upon posting. Your continued use of the Platform constitutes your acceptance of revised Terms.</p>
        </Section>

        <Section id="t2" title="2. Eligibility and Account Registration">
          <p>To use the Platform, you must be at least 13 years of age. Users under 18 must have obtained parental or guardian consent.</p>
          <p>You agree to provide accurate, current, and complete information during registration, and to maintain and update your account information. You are solely responsible for maintaining the confidentiality of your account credentials.</p>
          <p>You may not create multiple accounts to manipulate leaderboards, game outcomes, streaks, or rankings. You may not sell, transfer, or assign your account to any other person or entity.</p>
          <p>Usernames must not contain offensive, defamatory, sexually explicit, violent, hateful, or discriminatory content, and may not impersonate other individuals or Chillverse staff.</p>
        </Section>

        <Section id="t3" title="3. Platform Services and Features">
          <p>Chillverse provides an online social gaming platform that includes:</p>
          <ul>
            <li>Multiplayer and single-player games</li>
            <li>Player profiles including levels, badges, game history, win rates, and statistics</li>
            <li>Streak systems and daily engagement tracking</li>
            <li>Global and friend-based leaderboards and rankings</li>
            <li>Real-time chat, direct messaging, group chats, and community forums</li>
            <li>In-game virtual currency, items, cosmetics, and other digital goods</li>
            <li>Achievement and badge systems</li>
            <li>Social networking features including friend lists and crew/clan systems</li>
            <li>Knowledge and learning platform branch (Branch Feature)</li>
          </ul>
          <p>We reserve the right to modify, suspend, or discontinue any part of the Platform at any time, with or without notice.</p>
        </Section>

        <Section id="t4" title="4. User Conduct and Community Guidelines">
          <p>You agree not to:</p>
          <ul>
            <li>Use the Platform for any illegal purpose</li>
            <li>Harass, abuse, threaten, defame, or discriminate against any user</li>
            <li>Engage in cheating, hacking, exploiting, or using unauthorized software, bots, or scripts</li>
            <li>Manipulate or artificially inflate game statistics, scores, streaks, rankings, or XP</li>
            <li>Impersonate any person or entity, including Chillverse staff</li>
            <li>Engage in spamming, phishing, or distributing malware</li>
            <li>Attempt unauthorized access to the Platform or other users' accounts</li>
            <li>Reverse engineer or attempt to derive the source code of the Platform</li>
            <li>Upload content that infringes intellectual property or privacy rights</li>
          </ul>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">4.2 Chat Standards</h3>
          <p>When using Chat Services, you must not share personal information of others, engage in cyberbullying or hate speech, share sexually explicit content, organize illegal activities, or share links to malicious websites.</p>
          <p>Violations may result in warnings, temporary suspension, permanent ban, or legal action depending on severity.</p>
        </Section>

        <Section id="t5" title="5. Intellectual Property">
          <p>All content on the Platform, including but not limited to graphics, logos, game assets, sounds, music, text, and software, is owned by or licensed to Chillverse and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from Platform content without our prior written consent.</p>
          <p>By submitting User-Generated Content to the Platform, you grant Chillverse a non-exclusive, worldwide, royalty-free license to use, reproduce, modify, and display such content in connection with the Platform.</p>
        </Section>

        <Section id="t6" title="6. Virtual Items and Purchases">
          <p>The Platform may offer in-game virtual currency, items, cosmetics, and other digital goods. All purchases of Virtual Items are final and non-refundable, except as required by applicable law. Virtual Items have no real-world monetary value and cannot be exchanged for cash.</p>
          <p>We reserve the right to modify, discontinue, or remove Virtual Items at any time. We are not liable for any loss of Virtual Items resulting from account termination due to violations of these Terms.</p>
        </Section>

        <Section id="t7" title="7. Termination and Suspension">
          <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for violations of these Terms, suspected fraudulent or illegal activity, or for any other reason at our sole discretion. Upon termination, your right to use the Platform immediately ceases.</p>
          <p>You may close your account at any time by contacting us. Certain information may be retained as required by law or for legitimate business purposes.</p>
        </Section>

        <Section id="t8" title="8. Disclaimers and Limitation of Liability">
          <p>The Platform is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          <p>To the maximum extent permitted by applicable law, Chillverse shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the Platform.</p>
        </Section>

        <Section id="t9" title="9. Dispute Resolution">
          <p>Any dispute arising out of or relating to these Terms shall first be attempted to be resolved through informal negotiation. If informal resolution fails, disputes shall be resolved by binding arbitration in accordance with applicable arbitration rules.</p>
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States. Any judicial proceedings shall be brought exclusively in the federal or state courts located in Delaware.</p>
        </Section>

        <Section id="t10" title="10. Contact Information">
          <div className="bg-chill-surface border border-chill-border rounded-xl px-6 py-5">
            <p className="m-0 text-sm">
              <strong>Chillverse Legal Department</strong><br />
              Email: <a href="mailto:legal@chillverse.com" className="text-chill-violetSoft">legal@chillverse.com</a><br />
              DMCA notices: <a href="mailto:dmca@chillverse.com" className="text-chill-violetSoft">dmca@chillverse.com</a><br />
              Privacy inquiries: <a href="mailto:privacy@chillverse.com" className="text-chill-violetSoft">privacy@chillverse.com</a>
            </p>
          </div>
        </Section>

        <div className="bg-chill-violet/[0.05] border border-chill-violet/30 rounded-xl px-4.5 py-3.5 mt-8 text-sm text-chill-textSecondary leading-relaxed">
          BY ACCESSING OR USING THE PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS AND CONDITIONS.
        </div>

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
