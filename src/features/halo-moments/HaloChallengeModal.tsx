// src/features/halo-moments/HaloChallengeModal.tsx
//
// Redesign: the challenge is now issued through its own modal — Halo shows
// up, presents the challenge, the user Accepts or Declines, and that's the
// end of it (no combined sheet, no auto-tracking before a response).
// Declining calls respond_halo_challenge(false) and the modal never shows
// again today; HaloChallengeCard on the dashboard only renders once
// status === 'accepted'.

import { HALO_CHALLENGE_LABELS, type HaloChallengeState } from './haloMoments'
import haloMascot from '../../assets/halo-mascot.png'

export default function HaloChallengeModal({
  challenge,
  onAccept,
  onDecline,
}: {
  challenge: HaloChallengeState
  onAccept: () => void
  onDecline: () => void
}) {
  const label = (HALO_CHALLENGE_LABELS[challenge.challengeKey] ?? 'Complete today\u2019s challenge')
    .replace('{target}', String(challenge.targetValue))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="neu-card"
        style={{
          width: '100%', maxWidth: 360, padding: '28px 24px 22px', borderRadius: 22,
          textAlign: 'center', animation: 'haloChallengePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{ width: 76, height: 76, margin: '0 auto 14px', filter: 'drop-shadow(0 0 20px rgba(155,109,255,0.4))' }}>
          <img src={haloMascot} alt="Halo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
          Halo's Daily Challenge
        </div>

        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: challenge.introText ? 8 : 6 }}>
          {label}
        </p>

        {challenge.introText && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10 }}>
            "{challenge.introText}"
          </p>
        )}

        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 22 }}>
          Reward: {challenge.xpReward} XP
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onDecline}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
              background: 'var(--surface2)', color: 'var(--text)',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Accept
          </button>
        </div>
      </div>

      <style>{`
        @keyframes haloChallengePop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
