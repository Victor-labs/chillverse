// src/features/halo-moments/MysteryBoxFloatingButton.tsx
//
// Redesign: the Daily Mystery Box is no longer a dashboard card or a sheet
// step — it's a small sticky button pinned to the right edge of the screen
// (support-bubble style, like the reference screenshots), shaking to draw
// the eye, that only appears after the Daily Challenge modal has been
// responded to. Tapping it opens the existing MysteryBoxModal reveal flow
// unchanged. Once opened, it disappears until the next day.

import { useState } from 'react'
import type { MysteryBoxState, MysteryBoxResult } from './haloMoments'
import MysteryBoxModal from './MysteryBoxModal'
import mysteryBoxImg from '../../assets/halo-mystery-box.png'

export default function MysteryBoxFloatingButton({
  visible,
  box,
  onOpened,
}: {
  /** Only render once the challenge modal has been dismissed. */
  visible: boolean
  box: MysteryBoxState | null
  onOpened: (result: MysteryBoxResult) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  // Nothing to show: box hasn't loaded, already opened today, or we're
  // still waiting on the challenge modal to be dismissed first.
  if (!visible || !box || box.opened) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label="Open today's Halo Mystery Box"
        style={{
          position: 'fixed', right: 10, top: '48%', transform: 'translateY(-50%)',
          zIndex: 900, width: 64, height: 64, borderRadius: '50%', border: 'none',
          background: 'radial-gradient(circle at 35% 30%, #3a2a55, #1c1430)',
          boxShadow: '0 4px 18px rgba(155,109,255,0.45), 0 0 0 3px rgba(155,109,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 8,
          animation: 'mbxFloatShake 2.4s ease-in-out infinite',
        }}
      >
        <img src={mysteryBoxImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </button>

      <MysteryBoxModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpened={onOpened}
      />

      <style>{`
        @keyframes mbxFloatShake {
          0%, 78%, 100% { transform: translateY(-50%) rotate(0deg); }
          80% { transform: translateY(-50%) rotate(-8deg); }
          84% { transform: translateY(-50%) rotate(8deg); }
          88% { transform: translateY(-50%) rotate(-6deg); }
          92% { transform: translateY(-50%) rotate(6deg); }
          96% { transform: translateY(-50%) rotate(0deg); }
        }
      `}</style>
    </>
  )
}
