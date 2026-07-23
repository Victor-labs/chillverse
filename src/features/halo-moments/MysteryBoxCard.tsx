// src/features/halo-moments/MysteryBoxCard.tsx
//
// Dashboard card for the Daily Mystery Box (plan §4.1). Mirrors the visual
// language of Dashboard.tsx's other neu-card tiles. Fetches (but doesn't
// open) today's box on mount via getOrCreateDailyMysteryBox — the actual
// reward roll only happens when the player taps and MysteryBoxModal calls
// openMysteryBox().

import { useEffect, useState } from 'react'
import { ripple } from '../../shared/lib/ripple'
import { getOrCreateDailyMysteryBox, type MysteryBoxState, type MysteryBoxResult } from './haloMoments'
import MysteryBoxModal from './MysteryBoxModal'
import mysteryBoxImg from '../../assets/halo-mystery-box.png'

export default function MysteryBoxCard({ userId }: { userId: string | null }) {
  const [box, setBox] = useState<MysteryBoxState | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    getOrCreateDailyMysteryBox().then(setBox)
  }, [userId])

  function handleOpened(result: MysteryBoxResult) {
    setBox(prev => prev ? {
      ...prev, opened: true, rewardType: result.rewardType,
      rewardAmount: result.rewardAmount, rewardRef: result.rewardRef,
    } : prev)
  }

  if (!box) return null

  const opened = box.opened

  return (
    <>
      <button
        type="button"
        onClick={(e) => { ripple(e); if (!opened) setModalOpen(true) }}
        disabled={opened}
        className="neu-card ripple-wrap"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 18, width: '100%',
          textAlign: 'left', border: 'none', cursor: opened ? 'default' : 'pointer',
          opacity: opened ? 0.6 : 1,
        }}
      >
        <div style={{
          width: 52, height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src={mysteryBoxImg}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: opened ? 'grayscale(0.6)' : 'none' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Daily Mystery Box</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {opened ? "Opened — see you tomorrow" : 'Tap to open today\u2019s box'}
          </div>
        </div>
      </button>

      <MysteryBoxModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpened={handleOpened}
      />
    </>
  )
}
