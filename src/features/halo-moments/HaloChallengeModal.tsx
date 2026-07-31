// src/features/halo-moments/HaloChallengeModal.tsx
//
// Redesign: this is no longer an auto-popping "Accept or Decline" prompt —
// the challenge is active the moment it's picked (see useHaloDailyFlow), so
// this modal only ever opens because the player tapped the challenge icon.
// Renamed "Today's Challenge" and stripped of the mascot art + intro quote
// (HaloChallengeIcon already carries Halo's branding, so repeating the
// mascot here every time the player checks their progress just got
// repetitive). Three states: in progress (label + bar), completed and
// unclaimed (a Claim button), or claimed (a quiet "come back tomorrow").

import { Target, Check, X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { HALO_CHALLENGE_LABELS, type HaloChallengeState } from './haloMoments'

export default function HaloChallengeModal({
  challenge,
  claiming,
  onClaim,
  onClose,
}: {
  challenge: HaloChallengeState
  claiming: boolean
  onClaim: () => void
  onClose: () => void
}) {
  const label = (HALO_CHALLENGE_LABELS[challenge.challengeKey] ?? 'Complete today\u2019s challenge')
    .replace('{target}', String(challenge.targetValue))
  const pct = Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.targetValue)) * 100))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="neu-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, padding: '22px 22px 24px', borderRadius: 22,
          textAlign: 'center', position: 'relative',
          animation: 'haloChallengePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%',
            border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>

        <div
          style={{
            width: 52, height: 52, margin: '4px auto 14px', borderRadius: 16,
            background: challenge.claimed
              ? 'var(--surface2)'
              : 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: challenge.claimed ? 'var(--text-dim)' : '#fff',
          }}
        >
          {challenge.claimed ? <Check size={24} /> : <Target size={24} />}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
          Today's Challenge
        </div>

        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>
          {label}
        </p>

        {challenge.claimed ? (
          <>
            <p style={{ fontSize: 13, color: '#3ecf8e', fontWeight: 700, marginBottom: 4 }}>
              Completed &amp; claimed
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 4 }}>
              Come back tomorrow for a new challenge.
            </p>
          </>
        ) : (
          <>
            <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', margin: '0 0 10px' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.4s',
                background: challenge.completed ? '#3ecf8e' : 'linear-gradient(90deg,#9b6dff,#4f8ef7)',
              }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
              {challenge.progress}/{challenge.targetValue} · {challenge.xpReward} XP
            </p>
          </>
        )}

        {challenge.completed && !challenge.claimed && (
          <button
            type="button"
            onClick={(e) => { ripple(e); onClaim() }}
            disabled={claiming}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
              fontSize: 14, fontWeight: 800, cursor: claiming ? 'default' : 'pointer',
              opacity: claiming ? 0.7 : 1,
            }}
          >
            {claiming ? 'Claiming…' : `Claim ${challenge.xpReward} XP`}
          </button>
        )}
      </div>

      <style>{`
        @keyframes haloChallengePop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
