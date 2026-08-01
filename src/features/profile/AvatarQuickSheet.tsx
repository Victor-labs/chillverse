// src/features/profile/AvatarQuickSheet.tsx
//
// Opened by tapping the "Avatar" tile in the profile preview's Stats tab —
// mirrors BadgeQuickSheet's header pattern ("Presido's badges") but for
// the single equipped avatar skin: "Presido equipped avatar". Unlike
// artifacts, avatars have no showcase concept — a player can only ever
// have one equipped avatar skin at a time (see Inventory.tsx's equip
// flow), so this sheet is deliberately just the one big tile, no grid,
// no browsing.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'

// Matches ProfilePreviewModal's sheet exactly, same as BadgeQuickSheet —
// keep in sync if that ever changes.
const SHEET_HEIGHT_VH = 85
const WIDE_BREAKPOINT = 640

export default function AvatarQuickSheet({
  displayName, profileAvatarUrl, equippedAvatarUrl, rankColor, onClose,
}: {
  displayName: string
  /** The player's regular profile picture, shown small in the header. */
  profileAvatarUrl?: string | null
  /** The equipped avatar SKIN — the big image this sheet exists to show. */
  equippedAvatarUrl: string | null
  rankColor?: string | null
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= WIDE_BREAKPOINT)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  useEffect(() => {
    function onResize() { setIsWide(window.innerWidth >= WIDE_BREAKPOINT) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  function close() { setVisible(false); setTimeout(onClose, 260) }

  const color = rankColor ?? '#888899'

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 20100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: isWide ? 'min(92vw, 460px)' : '100%',
          height: `${SHEET_HEIGHT_VH}vh`,
          borderRadius: '20px 20px 0 0',
          marginTop: 'auto',
          overflowY: 'auto',
          background: 'var(--surface2)',
          padding: '20px 20px 30px',
          boxShadow: '0 -12px 40px -12px var(--sh)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          zIndex: 20105,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={profileAvatarUrl ?? undefined} name={displayName} size={38} radius={12} disabled />
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {displayName} equipped avatar
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
                {equippedAvatarUrl ? 'The avatar skin currently shown on their profile' : 'No avatar skin equipped yet'}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            width: '100%', aspectRatio: '1 / 1', maxHeight: 320, margin: '0 auto',
            borderRadius: 24, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: equippedAvatarUrl ? `${color}18` : 'var(--surface)',
            border: `1px solid ${equippedAvatarUrl ? color + '44' : 'var(--border-strong)'}`,
          }}
        >
          {equippedAvatarUrl
            ? <img src={equippedAvatarUrl} alt="Equipped avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24 }}>
                <Sparkles size={30} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No avatar equipped</p>
              </div>
            )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
