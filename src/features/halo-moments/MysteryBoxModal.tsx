// src/features/halo-moments/MysteryBoxModal.tsx
//
// Reveal flow for the Daily Mystery Box (plan §4.1). Calls openMysteryBox()
// as soon as it mounts (i.e. the moment the player taps the card) — a
// short "opening" state covers the round-trip, then the result renders
// with Halo's line (mystery_box_win / mystery_box_empty, picked
// server-side by open_mystery_box()).

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Gem, Star, Shirt, Frown } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { openMysteryBox, type MysteryBoxResult } from './haloMoments'
import mysteryBoxImg from '../../assets/halo-mystery-box.png'
import haloMascot from '../../assets/halo-mascot.png'

const REWARD_ICON = { diamonds: Gem, xp: Star, avatar_item: Shirt, nothing: Frown } as const

export default function MysteryBoxModal({
  isOpen,
  onClose,
  onOpened,
}: {
  isOpen: boolean
  onClose: () => void
  onOpened: (result: MysteryBoxResult) => void
}) {
  const [phase, setPhase] = useState<'opening' | 'result' | 'error'>('opening')
  const [result, setResult] = useState<MysteryBoxResult | null>(null)
  const [itemName, setItemName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setPhase('opening')
    setResult(null)
    setItemName(null)

    let cancelled = false
    // Brief pause so the "opening" animation actually shows, rather than
    // flashing straight to the result on a fast connection.
    const minDelay = new Promise(res => setTimeout(res, 900))

    Promise.all([openMysteryBox(), minDelay]).then(async ([{ result: r, error }]) => {
      if (cancelled) return
      if (error || !r) {
        setErrorMsg(error ?? 'Something went wrong opening the box.')
        setPhase('error')
        return
      }
      if (r.rewardType === 'avatar_item' && r.rewardRef) {
        const { data } = await supabase.from('mall_items').select('name').eq('id', r.rewardRef).maybeSingle()
        if (!cancelled) setItemName(data?.name ?? 'a new item')
      }
      if (cancelled) return
      setResult(r)
      onOpened(r)
      setPhase('result')
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const RewardIcon = result ? REWARD_ICON[result.rewardType] : null
  const rewardLabel = result
    ? result.rewardType === 'diamonds' ? `+${result.rewardAmount} diamonds`
    : result.rewardType === 'xp' ? `+${result.rewardAmount} XP`
    : result.rewardType === 'avatar_item' ? `New item: ${itemName ?? '…'}`
    : 'Nothing this time'
    : ''

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={phase !== 'opening' ? onClose : undefined}
    >
      <div
        className="neu-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 340, padding: '30px 24px', textAlign: 'center', borderRadius: 24 }}
      >
        {phase === 'opening' && (
          <div style={{
            width: 110, height: 110, margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'mbxShake 0.5s ease-in-out infinite',
          }}>
            <img src={mysteryBoxImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}

        {phase !== 'opening' && (
          <div style={{
            position: 'relative', width: 110, height: 110, margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'mbxPop 0.4s ease-out',
          }}>
            <img src={haloMascot} alt="Halo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
        )}

        {phase === 'opening' && (
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Opening…</p>
        )}

        {phase === 'error' && (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>{errorMsg}</p>
            <button type="button" onClick={onClose} style={closeBtnStyle}>Close</button>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{rewardLabel}</div>
            {result.lineText && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>{result.lineText}</p>
            )}
            <button type="button" onClick={onClose} style={closeBtnStyle}>Nice</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes mbxShake { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
        @keyframes mbxPop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>,
    document.body,
  )
}

const closeBtnStyle: CSSProperties = {
  width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
  background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
  fontSize: 14, fontWeight: 800, cursor: 'pointer',
}
