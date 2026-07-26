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

  // The button itself hides once the box is opened/unavailable, but the
  // modal must keep rendering independent of `box.opened` — onOpened()
  // flips box.opened the moment the reveal resolves, which used to nuke
  // this whole component (button AND modal) mid-reveal, so the modal
  // vanished right after "Opening…" and you never saw the result. The
  // modal's own isOpen/onClose lifecycle is what should control it now.
  const showButton = visible && !!box && !box.opened

  if (!showButton && !modalOpen) return null

  return (
    <>
      {showButton && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Open today's Halo Mystery Box"
          style={{
            position: 'fixed', right: 10, top: '48%', transform: 'translateY(-50%)',
            zIndex: 900, width: 64, height: 64, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            filter: 'drop-shadow(0 4px 14px rgba(155,109,255,0.55))',
            animation: 'mbxFloatShake 2.4s ease-in-out infinite',
          }}
        >
          <img src={mysteryBoxImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </button>
      )}

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
