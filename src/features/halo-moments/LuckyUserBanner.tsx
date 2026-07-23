// src/features/halo-moments/LuckyUserBanner.tsx
//
// Lucky User of the Day (plan §4.5, item #10). Winner picked server-side on
// a schedule (pick_lucky_user(), migration 0075) — this component never
// picks or announces anything itself. get_daily_lucky_user() returns null
// for everyone except today's winner (private by default, per the plan),
// so this simply renders nothing for the other ~99.9% of users — no
// "someone else won" state to build.

import { useEffect, useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { getDailyLuckyUser, claimLuckyUserReward, type LuckyUserState } from './haloMoments'
import haloMascot from '../../assets/halo-mascot.png'

export default function LuckyUserBanner({ userId }: { userId: string | null }) {
  const [lucky, setLucky] = useState<LuckyUserState | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!userId) return
    getDailyLuckyUser().then(setLucky)
  }, [userId])

  async function handleClaim() {
    if (!lucky || claiming || lucky.claimed) return
    setClaiming(true)
    const reward = await claimLuckyUserReward()
    setClaiming(false)
    if (reward) setLucky(prev => prev ? { ...prev, claimed: true } : prev)
  }

  if (!lucky) return null

  return (
    <div
      className="neu-card"
      style={{
        padding: 18, display: 'flex', alignItems: 'center', gap: 14,
        background: 'linear-gradient(135deg,rgba(245,197,66,0.12),rgba(255,159,77,0.12))',
        border: '1px solid rgba(245,197,66,0.35)',
      }}
    >
      <div style={{ width: 44, height: 44, flexShrink: 0 }}>
        <img src={haloMascot} alt="Halo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
          <Sparkles size={15} color="#f5c542" /> You're today's Lucky User!
        </div>
        {lucky.lineText && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4 }}>
            "{lucky.lineText}"
          </p>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4 }}>
          +{lucky.xpReward} XP{lucky.diamondReward > 0 ? ` · +${lucky.diamondReward} diamonds` : ''}
        </p>
      </div>

      {lucky.claimed ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#3ecf8e', flexShrink: 0 }}>
          <Check size={14} /> Claimed
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => { ripple(e); handleClaim() }}
          disabled={claiming}
          style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#f5c542,#ff9f4d)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: claiming ? 'default' : 'pointer',
            opacity: claiming ? 0.7 : 1,
          }}
        >
          {claiming ? 'Claiming…' : 'Claim'}
        </button>
      )}
    </div>
  )
}
