import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import Seo from '../../shared/components/Seo'

const SECTIONS = [
  { id: 't1', title: '1. Acceptance of Terms' },
  { id: 't2', title: '2. About Chillverse' },
  { id: 't3', title: '3. Eligibility and Account Registration' },
  { id: 't4', title: '4. Platform Services and Features' },
  { id: 't5', title: '5. User Conduct and Community Guidelines' },
  { id: 't6', title: '6. Halo AI Companion' },
  { id: 't7', title: '7. Intellectual Property' },
  { id: 't8', title: '8. Diamonds, Chillverse Pro, and Purchases' },
  { id: 't9', title: '9. Copyright Complaints (DMCA)' },
  { id: 't10', title: '10. Termination and Suspension' },
  { id: 't11', title: '11. Disclaimers and Limitation of Liability' },
  { id: 't12', title: '12. Force Majeure' },
  { id: 't13', title: '13. Export Control and Sanctions' },
  { id: 't14', title: '14. Dispute Resolution and Governing Law' },
  { id: 't15', title: '15. General Provisions' },
  { id: 't16', title: '16. Contact Information' },
]

export default function Terms() {
  return (
    <div>
      <Seo
        title="Terms & Conditions"
        description="The rules for using Chillverse — accounts, fair play, Diamonds and Chillverse Pro purchases, Halo AI, and your rights as a player."
        path="/terms"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Chillverse', item: 'https://chillverse.com.ng/' },
              { '@type': 'ListItem', position: 2, name: 'Terms & Conditions', item: 'https://chillverse.com.ng/terms' },
            ],
          },
        ]}
      />
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
          <div className="text-[13px] text-chill-textMuted">Last Updated: July 12, 2026 · Effective Date: July 12, 2026</div>
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
          <p>By accessing, downloading, installing, or using the Chillverse platform, website, mobile applications, games, and any related services (collectively, "the Platform" or "Chillverse"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions ("Terms").</p>
          <p>These Terms constitute a legally binding agreement between you ("User", "Player", "you", or "your") and Chillverse ("we", "us", "our", or "the Company"), as further identified in Section 2.</p>
          <p>Your use of the Platform is also governed by our <Link to="/privacy" className="text-chill-violetSoft">Privacy Policy</Link>, which explains how we collect, use, and protect your personal information, and which is incorporated into these Terms by reference.</p>
          <p>We reserve the right to modify these Terms at any time. All changes will be effective immediately upon posting. Your continued use of the Platform constitutes your acceptance of revised Terms.</p>
        </Section>

        <Section id="t2" title="2. About Chillverse">
          <p>Chillverse is operated by <strong>[LEGAL ENTITY NAME TO BE CONFIRMED]</strong>, a company [incorporated/registered] under the laws of <strong>[COUNTRY OF INCORPORATION]</strong>, registration number <strong>[REGISTRATION NUMBER]</strong>, with its registered address at <strong>[REGISTERED BUSINESS ADDRESS]</strong>.</p>
          <p><em>(Placeholder — replace the bracketed details above with Chillverse's actual registered company name, jurisdiction, registration number, and address before publishing. This information is required so users and courts can clearly identify the party they're contracting with.)</em></p>
        </Section>

        <Section id="t3" title="3. Eligibility and Account Registration">
          <p>To use the Platform, you must be at least 13 years of age. Users under 18 must have obtained parental or guardian consent, and a parent or guardian remains responsible for a minor's use of the Platform, including any purchases made on the account.</p>
          <p>You agree to provide accurate, current, and complete information during registration, and to maintain and update your account information. You are solely responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately at <a href="mailto:legal@chillverse.com" className="text-chill-violetSoft">legal@chillverse.com</a> if you suspect any unauthorized access to or use of your account.</p>
          <p>You may not create multiple accounts to manipulate ranks, game outcomes, streaks, or leaderboards. You may not sell, transfer, or assign your account to any other person or entity.</p>
          <p>Usernames and display names must not contain offensive, defamatory, sexually explicit, violent, hateful, or discriminatory content, and may not impersonate other individuals or Chillverse staff or use reserved terms associated with Chillverse's own team.</p>
        </Section>

        <Section id="t4" title="4. Platform Services and Features">
          <p>Chillverse provides an online social gaming platform that includes, among other things:</p>
          <ul>
            <li>Single-player games and live head-to-head multiplayer games played in rooms</li>
            <li>Player profiles including levels, ranks, achievements, game history, and statistics</li>
            <li>Streak systems, weekly missions, and daily engagement tracking</li>
            <li>Global and per-game skill ranks</li>
            <li>Real-time Global Chat, direct messaging, voice calling, and voice notes</li>
            <li>A social feed for posts, comments, following other players, and temporary Highlights</li>
            <li>In-game virtual currency ("Diamonds"), cosmetic items, and a Mall to purchase and gift them</li>
            <li>Chillverse Pro, an optional recurring subscription (Orbit and Void tiers), and the separate Version upgrade track</li>
            <li>Halo AI, an in-app AI assistant (see Section 6)</li>
            <li>Exploration, a feature allowing you to send expeditions into in-app maps for rewards</li>
            <li>Watch, a built-in video/movie player featuring licensed or third-party-hosted video content</li>
            <li>A Referral program allowing you to invite others in exchange for in-app rewards</li>
            <li>An optional connection to the separate Chillverse Learning platform branch, for users who choose to link that account</li>
          </ul>
          <p>Not every feature is available to every account at all times — some features require reaching a certain rank, level, or subscription tier, as described elsewhere on the Platform. We reserve the right to modify, suspend, or discontinue any part of the Platform at any time, with or without notice.</p>
        </Section>

        <Section id="t5" title="5. User Conduct and Community Guidelines">
          <p>You agree not to:</p>
          <ul>
            <li>Use the Platform for any illegal purpose</li>
            <li>Harass, abuse, threaten, defame, or discriminate against any user</li>
            <li>Engage in cheating, hacking, exploiting, or using unauthorized software, bots, or scripts</li>
            <li>Manipulate or artificially inflate game statistics, scores, streaks, ranks, or XP</li>
            <li>Impersonate any person or entity, including Chillverse staff</li>
            <li>Engage in spamming, phishing, or distributing malware</li>
            <li>Attempt unauthorized access to the Platform or other users' accounts</li>
            <li>Reverse engineer or attempt to derive the source code of the Platform</li>
            <li>Upload or share content, including in posts, chat, or voice notes, that infringes intellectual property or privacy rights</li>
          </ul>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">5.1 Chat, Calling, and Content Standards</h3>
          <p>When using Global Chat, direct messages, voice calls, voice notes, posts, or Highlights, you must not share other users' personal information without consent, engage in cyberbullying or hate speech, share sexually explicit content, organize illegal activities, or share links to malicious websites. If you believe another player is violating these standards, you can block them directly from their profile and should also report the behavior to Support, as described in our Help Center.</p>
          <p>Violations may result in warnings, temporary suspension, permanent ban, forfeiture of Diamonds or Chillverse Pro access, or legal action, depending on severity, at our sole discretion.</p>
        </Section>

        <Section id="t6" title="6. Halo AI Companion">
          <p>Halo AI is an automated, AI-powered assistant built into the Platform to help you understand Chillverse's features and your own account activity. Halo AI's responses are generated automatically and may occasionally be incomplete, out of date, or incorrect. Halo AI's answers are provided for general informational purposes about the Platform only and do not constitute professional, financial, medical, or legal advice, and should not be relied upon as such. You remain solely responsible for any decisions you make based on Halo AI's responses.</p>
          <p>Your use of Halo AI is also subject to a daily usage limit, which may vary depending on your Version tier and may change from time to time without notice. Attempting to circumvent Halo AI's usage limits, or using it for purposes unrelated to Chillverse, is a violation of these Terms.</p>
        </Section>

        <Section id="t7" title="7. Intellectual Property">
          <p>All content on the Platform, including but not limited to graphics, logos, game assets, sounds, music, text, and software, is owned by or licensed to Chillverse and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from Platform content without our prior written consent.</p>
          <p>As between you and Chillverse, you retain ownership of any User-Generated Content you submit — including posts, comments, Highlights, chat messages, and voice notes. By submitting such content to the Platform, you grant Chillverse a non-exclusive, worldwide, royalty-free license to use, reproduce, modify, and display it solely in connection with operating and promoting the Platform. This license does not transfer ownership of your content to us.</p>
          <p>The Watch feature may display video content sourced from or hosted by third-party providers. That content remains the property of its respective owners, and your use of it is also subject to those providers' own terms.</p>
        </Section>

        <Section id="t8" title="8. Diamonds, Chillverse Pro, and Purchases">
          <p>The Platform offers an in-app virtual currency called Diamonds, which can be purchased with real money and spent on cosmetic items in the Mall, or sent to other players as gifts. Diamond purchases are processed through our third-party payment processor, Paystack. All purchases of Diamonds are final and non-refundable, except as required by applicable law. Diamonds have no real-world monetary value, cannot be exchanged for cash, transferred outside the Platform, or redeemed for anything other than in-app cosmetic content.</p>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">8.1 Failed, Duplicate, or Undelivered Payments</h3>
          <p>If a payment fails, you are charged more than once for the same purchase, or your Diamonds are not credited to your account despite a successful charge, please contact Support with your payment reference as soon as possible. We will investigate the payment with Paystack and, where the issue is confirmed to be a processing error on our end or Paystack's, we will credit the missing Diamonds to your account or refund the duplicate or failed charge, as appropriate. This section does not limit any refund rights you may separately have under applicable consumer protection law.</p>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">8.2 Chillverse Pro Subscriptions</h3>
          <p>The Platform also offers Chillverse Pro, an optional, recurring subscription available in Orbit and Void tiers, billed monthly or yearly through Paystack. Chillverse Pro automatically renews at the end of each billing period using your existing payment method until you cancel. To cancel your subscription, contact Support through a support ticket; your existing Pro benefits will continue for the remainder of any period you've already paid for.</p>
          <p>Subscription prices, tiers, and included benefits may change from time to time. Where we increase the price of your active subscription, we will provide you with advance notice by email and/or in-app notification before the new price takes effect on your next renewal, giving you the opportunity to cancel before being charged the new price.</p>
          <p>We reserve the right to modify, discontinue, or remove Diamonds, cosmetic items, or subscription tiers at any time. We are not liable for any loss of Diamonds, cosmetic items, or subscription access resulting from account termination due to violations of these Terms.</p>
        </Section>

        <Section id="t9" title="9. Copyright Complaints (DMCA)">
          <p>If you believe content on the Platform infringes your copyright, please send a written notice to <a href="mailto:dmca@chillverse.com" className="text-chill-violetSoft">dmca@chillverse.com</a> including:</p>
          <ul>
            <li>A description of the copyrighted work you believe has been infringed</li>
            <li>The specific location on the Platform of the material you believe is infringing (a link, username, or post/message identifier)</li>
            <li>Your contact information, including name, address, telephone number, and email address</li>
            <li>A statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law</li>
            <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf</li>
            <li>Your physical or electronic signature</li>
          </ul>
          <p>Upon receiving a complete and valid notice, we will review it and may remove or disable access to the reported content, notify the user who posted it, and, in the case of repeat infringement, suspend or terminate the relevant account.</p>
        </Section>

        <Section id="t10" title="10. Termination and Suspension">
          <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for violations of these Terms, suspected fraudulent or illegal activity, or for any other reason at our sole discretion. Upon termination, your right to use the Platform immediately ceases.</p>
          <p>You may delete your account at any time from within the app, or by contacting us. Account deletion is permanent and cannot be undone. Certain information, including transaction records, may be retained as required by law or for legitimate business purposes even after your account is deleted. Sections of these Terms that by their nature should survive termination — including Intellectual Property, payment obligations already incurred, Dispute Resolution and Governing Law, and Limitation of Liability — will continue to apply after your account is terminated or deleted.</p>
        </Section>

        <Section id="t11" title="11. Disclaimers and Limitation of Liability">
          <p>The Platform is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components. This includes Halo AI, whose responses are automatically generated and provided without warranty as to their accuracy or completeness.</p>
          <p>To the maximum extent permitted by applicable law, Chillverse shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the Platform. Nothing in these Terms excludes or limits any liability that cannot be excluded or limited under applicable law.</p>
        </Section>

        <Section id="t12" title="12. Force Majeure">
          <p>Chillverse shall not be liable for any delay or failure to perform resulting from causes beyond our reasonable control, including but not limited to internet or telecommunications outages, cyberattacks, power failures, natural disasters, acts of government, labor disputes, or the failure or unavailability of third-party services we rely on (including our hosting, payment, or AI infrastructure providers).</p>
        </Section>

        <Section id="t13" title="13. Export Control and Sanctions">
          <p>You may not access or use the Platform if you are located in, or a resident or national of, a country or region subject to comprehensive sanctions under applicable law, or if you are otherwise prohibited from receiving services under applicable export control or sanctions laws. You represent that you are not on any government list of prohibited or restricted parties.</p>
        </Section>

        <Section id="t14" title="14. Dispute Resolution and Governing Law">
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to its conflict of law principles. <em>(Placeholder assumption — this reflects Chillverse's Paystack/Nigeria-based operations as currently understood; confirm this against Chillverse's actual place of incorporation and where it does business before publishing, and update Section 2 to match.)</em></p>
          <p>Any dispute arising out of or relating to these Terms shall first be attempted to be resolved through informal negotiation for a period of 30 days. If informal resolution fails, the dispute shall be referred to and finally resolved by arbitration administered under the Arbitration and Mediation Act 2023 (Nigeria) [or the Rules of the Lagos Court of Arbitration, as applicable], by a sole arbitrator, seated in Lagos, Nigeria, conducted in the English language. Judgment on the arbitration award may be entered in any court having jurisdiction. Nothing in this section prevents either party from seeking urgent injunctive relief from a competent court where necessary. <em>(Placeholder — confirm the preferred arbitral institution, number of arbitrators for higher-value claims, and seat with Chillverse's legal counsel before publishing.)</em></p>
        </Section>

        <Section id="t15" title="15. General Provisions">
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">15.1 Entire Agreement</h3>
          <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Chillverse regarding your use of the Platform, and supersede any prior agreements or understandings, whether written or oral.</p>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">15.2 Severability</h3>
          <p>If any provision of these Terms is found by a court or arbitrator of competent jurisdiction to be invalid or unenforceable, that provision shall be enforced to the maximum extent permissible, and the remaining provisions shall remain in full force and effect.</p>
          <h3 className="text-base font-semibold text-chill-textSecondary mt-5 mb-2.5">15.3 Waiver</h3>
          <p>Our failure to enforce any right or provision of these Terms shall not be considered a waiver of that right or provision. Any waiver must be in writing and signed by an authorized representative of Chillverse to be effective.</p>
        </Section>

        <Section id="t16" title="16. Contact Information">
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
