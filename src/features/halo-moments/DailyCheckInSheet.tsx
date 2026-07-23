// src/features/halo-moments/DailyCheckInSheet.tsx
//
// Combines Daily Fortune (§4.3) + Daily Mystery Box (§4.1) + Halo's Daily
// Challenge intro (§4.2) into one sheet shown once per day, replacing the
// standalone DailyFortuneSheet. Driven by useDailyCheckIn(userId).
//
// The Mystery Box and Challenge still also live as dashboard cards
// (MysteryBoxCard / HaloChallengeCard) — this sheet is the first-encounter
// moment, not the only entry point. That's a deliberate deviation from a
// literal one-and-done popup: the box can be skipped here and opened later,
// and the challenge is completed gradually over the day (playing games,
// earning XP), so it needs a claim-able home on the dashboard regardless of
// whether the sheet was seen or dismissed.
//
// NOTE: the reveal step imports `halo-mystery-box-open.png`, referenced as
// still-to-be-added in chat — drop that file into src/assets/ (same
// dimensions/style as the existing halo-mystery-box.png) before building.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Star, Shirt, Frown, Target, Check } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { HALO_CHALLENGE_LABELS, type MysteryBoxResult } from './haloMoments'
import type { DailyCheckInData } from './useDailyCheckIn'
import haloMascot from '../../assets/halo-mascot.png'
import mysteryBoxImg from '../../assets/halo-mystery-box.png'
import mysteryBoxOpenImg from '../../assets/halo-mystery-box-open.png'

const REWARD_ICON = { xp: Star, avatar_item: Shirt, nothing: Frown } as const

type Step = 0 | 1 | 2

export default function DailyCheckInSheet({
  data,
  onOpenBox,
  onClaimChallenge,
  onDismiss,
}: {
  data: DailyCheckInData
  onOpenBox: () => Promise<MysteryBoxResult | null>
  onClaimChallenge: () => Promise<{ xpReward: number } | null>
  onDismiss: () => void
}) {
  const [step, setStep] = useState<Step>(0)
  const [boxPhase, setBoxPhase] = useState<'idle' | 'opening' | 'result'>(
    data.mysteryBox?.opened ? 'result' : 'idle',
  )
  const [boxResult, setBoxResult] = useState<MysteryBoxResult | null>(
    data.mysteryBox?.opened
      ? {
          rewardType: (data.mysteryBox.rewardType ?? 'nothing') as MysteryBoxResult['rewardType'],
          rewardAmount: data.mysteryBox.rewardAmount ?? 0,
          rewardRef: data.mysteryBox.rewardRef,
          lineText: null, // only returned at open time — already-opened loads just show the amount
        }
      : null,
  )
  const [itemName, setItemName] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [challengeClaimed, setChallengeClaimed] = useState(!!data.challenge?.claimed)

  if (!data.fortune) return null

  async function handleOpenBox() {
    setBoxPhase('opening')
    const minDelay = new Promise(res => setTimeout(res, 900))
    const [result] = await Promise.all([onOpenBox(), minDelay])
    if (!result) {
      setBoxPhase('idle')
      return
    }
    if (result.rewardType === 'avatar_item' && result.rewardRef) {
      const { data: item } = await supabase.from('mall_items').select('name').eq('id', result.rewardRef).maybeSingle()
      setItemName(item?.name ?? 'a new item')
    }
    setBoxResult(result)
    setBoxPhase('result')
  }

  async function handleClaimChallenge() {
    if (claiming || challengeClaimed) return
    setClaiming(true)
    const reward = await onClaimChallenge()
    setClaiming(false)
    if (reward) setChallengeClaimed(true)
  }

  const RewardIcon = boxResult ? REWARD_ICON[boxResult.rewardType] : null
  const rewardLabel = boxResult
    ? boxResult.rewardType === 'xp' ? `+${boxResult.rewardAmount} XP`
    : boxResult.rewardType === 'avatar_item' ? `New item: ${itemName ?? '…'}`
    : 'Nothing this time'
    : ''

  const challenge = data.challenge
  const challengeLabel = challenge
    ? (HALO_CHALLENGE_LABELS[challenge.challengeKey] ?? 'Complete today\u2019s challenge').replace(
        '{target}', String(challenge.targetValue),
      )
    : ''
  const challengePct = challenge
    ? Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.targetValue)) * 100))
    : 0

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9997,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={step === 1 && boxPhase === 'opening' ? undefined : onDismiss}
    >
      <div
        className="neu-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 420, padding: '24px 22px 20px',
          borderRadius: '24px 24px 0 0', textAlign: 'center',
          animation: 'checkInSlideUp 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'linear-gradient(90deg,#9b6dff,#4f8ef7)' : 'var(--surface2)',
              transition: 'all 0.25s',
            }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div style={{ width: 72, height: 72, margin: '0 auto 12px', filter: 'drop-shadow(0 0 20px rgba(155,109,255,0.4))' }}>
              <img src={haloMascot} alt="Halo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
              Your Chillverse Fortune
            </div>
            <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 20, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
              {data.fortune.text}
            </p>
            <button type="button" onClick={() => setStep(1)} style={primaryBtnStyle}>Next</button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 14 }}>
              Daily Mystery Box
            </div>

            {boxPhase === 'idle' && (
              <>
                <button
                  type="button"
                  onClick={handleOpenBox}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block', margin: '0 auto 14px' }}
                >
                  <div style={{ width: 110, height: 110, margin: '0 auto', animation: 'checkInShake 1.6s ease-in-out infinite' }}>
                    <img src={mysteryBoxImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                </button>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Tap the box to open it</p>
              </>
            )}

            {boxPhase === 'opening' && (
              <>
                <div style={{ width: 110, height: 110, margin: '0 auto 18px', animation: 'checkInShake 0.5s ease-in-out infinite' }}>
                  <img src={mysteryBoxImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 20 }}>Opening…</p>
              </>
            )}

            {boxPhase === 'result' && boxResult && (
              <>
                <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 16px', animation: 'checkInPop 0.4s ease-out' }}>
                  <img src={mysteryBoxOpenImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  {RewardIcon && (
                    <div style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#f5c542,#ff9f4d)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                      border: '2px solid var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}>
                      <RewardIcon size={16} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{rewardLabel}</div>
                {boxResult.lineText && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>{boxResult.lineText}</p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={boxPhase === 'opening'}
              style={{ ...primaryBtnStyle, opacity: boxPhase === 'opening' ? 0.6 : 1, cursor: boxPhase === 'opening' ? 'default' : 'pointer' }}
            >
              {boxPhase === 'idle' ? 'Skip for now' : 'Next'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 13, margin: '0 auto 14px',
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <Target size={20} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
              Halo's Daily Challenge
            </div>

            {challenge ? (
              <>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', marginBottom: challenge.introText ? 10 : 16 }}>
                  {challengeLabel}
                </p>
                {challenge.introText && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16 }}>
                    "{challenge.introText}"
                  </p>
                )}
                <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%', width: `${challengePct}%`, borderRadius: 4,
                    background: challenge.completed ? '#3ecf8e' : 'linear-gradient(90deg,#9b6dff,#4f8ef7)',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 20 }}>
                  {challenge.progress}/{challenge.targetValue} · {challenge.xpReward} XP
                </p>

                {challengeClaimed ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#3ecf8e', marginBottom: 14 }}>
                    <Check size={15} /> Claimed
                  </div>
                ) : challenge.completed ? (
                  <button
                    type="button"
                    onClick={handleClaimChallenge}
                    disabled={claiming}
                    style={{ ...primaryBtnStyle, opacity: claiming ? 0.7 : 1, marginBottom: 12 }}
                  >
                    {claiming ? 'Claiming…' : 'Claim reward'}
                  </button>
                ) : null}
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>No challenge today.</p>
            )}

            <button type="button" onClick={onDismiss} style={secondaryBtnStyle}>Done</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes checkInSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes checkInShake { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes checkInPop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>,
    document.body,
  )
}

const primaryBtnStyle: CSSProperties = {
  width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
  background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
  fontSize: 14, fontWeight: 800, cursor: 'pointer',
}

const secondaryBtnStyle: CSSProperties = {
  width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
  background: 'var(--surface2)', color: 'var(--text)',
  fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 4,
}
