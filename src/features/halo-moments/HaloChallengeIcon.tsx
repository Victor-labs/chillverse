// src/features/halo-moments/HaloChallengeIcon.tsx
//
// Replaces the old full-width HaloChallengeCard. The challenge now lives
// behind a compact icon button (plan sketch: a small badge-style tap
// target rather than a permanent card taking up feed space) — a red dot
// appears once the challenge is complete and waiting to be claimed, and
// the icon greys out once it's been claimed for the day. Tapping the icon
// always opens HaloChallengeModal ("Today's Challenge"), whether the
// challenge is still in progress, ready to claim, or already claimed.

import { useState } from 'react'
import { Target } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { claimHaloChallenge, type HaloChallengeState } from './haloMoments'
import HaloChallengeModal from './HaloChallengeModal'

export default function HaloChallengeIcon({
  challenge,
  onClaimed,
}: {
  challenge: HaloChallengeState | null
  onClaimed: () => void
}) {
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)

  if (!challenge) return null

  const unclaimedReady = challenge.completed && !challenge.claimed
  const done = challenge.claimed

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    const reward = await claimHaloChallenge()
    setClaiming(false)
    if (reward) onClaimed()
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { ripple(e); setOpen(true) }}
        aria-label="Today's Challenge"
        title={done ? "Today's Challenge — come back tomorrow" : "Today's Challenge"}
        style={{
          position: 'relative', width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          border: 'none', cursor: 'pointer', padding: 0,
          background: done ? 'var(--surface2)' : 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: done ? 'grayscale(0.6)' : 'none',
          opacity: done ? 0.55 : 1,
          transition: 'opacity 0.3s, filter 0.3s',
        }}
      >
        <Target size={20} color={done ? 'var(--text-dim)' : '#fff'} />
        {unclaimedReady && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%',
              background: '#ff4d4f', border: '2px solid var(--bg)',
            }}
          />
        )}
      </button>

      {open && challenge && (
        <HaloChallengeModal
          challenge={challenge}
          claiming={claiming}
          onClaim={handleClaim}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
