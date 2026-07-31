// src/features/halo-moments/MysteryBoxIcon.tsx
//
// Redesign: the Daily Mystery Box is now a compact icon button sitting
// next to HaloChallengeIcon (rather than a sticky floating button pinned
// to the screen edge). Red dot = unopened today. Tapping it opens
// MysteryBoxModal, which handles the shake → reveal flow itself. Once
// opened, the icon greys out and stops responding to taps until the next
// UTC day, same "come back tomorrow" language as the challenge icon.

import { useState } from 'react'
import { Gift } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import type { MysteryBoxState, MysteryBoxResult } from './haloMoments'
import MysteryBoxModal from './MysteryBoxModal'

export default function MysteryBoxIcon({
  box,
  onOpened,
}: {
  box: MysteryBoxState | null
  onOpened: (result: MysteryBoxResult) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  if (!box) return null

  const done = box.opened

  return (
    <>
      <button
        type="button"
        onClick={done ? undefined : (e) => { ripple(e); setModalOpen(true) }}
        aria-label="Daily Mystery Box"
        title={done ? 'Daily Mystery Box — come back tomorrow' : 'Daily Mystery Box'}
        style={{
          position: 'relative', width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          border: 'none', padding: 0,
          cursor: done ? 'default' : 'pointer',
          background: done ? 'var(--surface2)' : 'linear-gradient(135deg,#f5c542,#ff9f4d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: done ? 'grayscale(0.6)' : 'none',
          opacity: done ? 0.55 : 1,
          transition: 'opacity 0.3s, filter 0.3s',
        }}
      >
        <Gift size={20} color={done ? 'var(--text-dim)' : '#fff'} />
        {!done && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%',
              background: '#ff4d4f', border: '2px solid var(--bg)',
            }}
          />
        )}
      </button>

      <MysteryBoxModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpened={onOpened}
      />
    </>
  )
}
