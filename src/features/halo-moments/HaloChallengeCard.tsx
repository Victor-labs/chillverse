// src/features/halo-moments/HaloChallengeCard.tsx
//
// Dashboard card for Halo's Daily Challenge (plan §4.2). Progress updates
// arrive via record_halo_challenge_progress() (called in parallel with
// weekly-mission progress — see weeklyMissions.ts), so this card just
// polls on mount/focus rather than needing its own realtime subscription;
// the "challenge complete" moment is also announced via the existing
// notification-toast pipeline from the SQL side.

import { useEffect, useState } from 'react'
import { Target, Check } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { getOrCreateHaloChallenge, claimHaloChallenge, HALO_CHALLENGE_LABELS, type HaloChallengeState } from './haloMoments'
import haloMascot from '../../assets/halo-mascot.png'

export default function HaloChallengeCard({ userId }: { userId: string | null }) {
  const [challenge, setChallenge] = useState<HaloChallengeState | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!userId) return
    getOrCreateHaloChallenge().then(setChallenge)
  }, [userId])

  async function handleClaim() {
    if (!challenge || claiming) return
    setClaiming(true)
    const reward = await claimHaloChallenge()
    setClaiming(false)
    if (reward) setChallenge(prev => prev ? { ...prev, claimed: true } : prev)
  }

  if (!challenge) return null

  const label = (HALO_CHALLENGE_LABELS[challenge.challengeKey] ?? 'Complete today\u2019s challenge')
    .replace('{target}', String(challenge.targetValue))
  const pct = Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.targetValue)) * 100))

  return (
    <div className="neu-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: challenge.introText ? 10 : 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <Target size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Halo's Daily Challenge</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        </div>
      </div>

      {challenge.introText && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 0 12px' }}>
          <img src={haloMascot} alt="Halo" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
            "{challenge.introText}"
          </p>
        </div>
      )}

      <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.4s',
          background: challenge.completed ? '#3ecf8e' : 'linear-gradient(90deg,#9b6dff,#4f8ef7)',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {challenge.progress}/{challenge.targetValue} · {challenge.xpReward} XP
        </span>

        {challenge.claimed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#3ecf8e' }}>
            <Check size={14} /> Claimed
          </span>
        ) : challenge.completed ? (
          <button
            type="button"
            onClick={(e) => { ripple(e); handleClaim() }}
            disabled={claiming}
            style={{
              padding: '7px 16px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: claiming ? 'default' : 'pointer',
              opacity: claiming ? 0.7 : 1,
            }}
          >
            {claiming ? 'Claiming…' : 'Claim'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
