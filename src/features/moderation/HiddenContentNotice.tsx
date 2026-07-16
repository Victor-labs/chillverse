// src/features/moderation/HiddenContentNotice.tsx
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * Two audiences, two different messages:
 *
 * - The author of a confirmed hard-violation removal (profanity, PII,
 *   threats, hate speech, etc — see migration 0033) sees the DB-provided
 *   `reason` text ("Your message was taken down because it goes against
 *   our Terms and Conditions"), with "Terms and Conditions" as a tappable
 *   link to /terms.
 * - Everyone else who can now see the row (RLS opens `violation = true`
 *   rows to all readers once content/body has been redacted server-side)
 *   sees a generic "Message deleted by moderator" — no reason detail,
 *   since it's none of their business why, and the content itself is
 *   already gone from the row either way.
 *
 * Report-pending content (0030 — hidden, not yet a confirmed violation)
 * never reaches non-author/non-staff viewers at all (RLS keeps that row
 * fully invisible to them), so this component only ever renders for them
 * in the confirmed-violation case.
 */
export default function HiddenContentNotice({
  reason,
  isOwner,
  inline = false,
}: {
  reason: string | null
  isOwner: boolean
  inline?: boolean
}) {
  const wrapperStyle = {
    display: inline ? 'inline-flex' : 'flex',
    alignItems: 'flex-start' as const, gap: 6, fontStyle: 'italic' as const, color: '#ff9a3c', fontSize: 'inherit', lineHeight: 1.4,
  }

  if (!isOwner) {
    return (
      <span style={wrapperStyle}>
        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        Message deleted by moderator
      </span>
    )
  }

  const text = reason ?? 'This content is hidden pending moderator review.'
  const tcIdx = text.indexOf('Terms and Conditions')

  return (
    <span style={wrapperStyle}>
      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
      {tcIdx === -1 ? (
        text
      ) : (
        <span>
          {text.slice(0, tcIdx)}
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Terms and Conditions
          </Link>
          {text.slice(tcIdx + 'Terms and Conditions'.length)}
        </span>
      )}
    </span>
  )
}
