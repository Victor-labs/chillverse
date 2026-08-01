// src/features/profile/ArtifactQuickSheet.tsx
//
// Opened by tapping the "Artifact" tile in the profile preview's Stats
// tab — mirrors BadgeQuickSheet's pattern ("Presido's badges") for
// artifacts: "Presido equipped artifacts" up top, the one equipped
// artifact as the primary tile, then up to three additional "showcased"
// artifacts below it. Equip (one) + showcase (up to three others) are
// both set from EditProfileModal's Artifacts section — this sheet is
// read-only, with a "Manage artifacts" shortcut into that section when
// it's the viewer's own profile.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Package, Pencil } from 'lucide-react'

export interface ArtifactTileData {
  id: string
  name: string
  mediaUrl: string | null
  tier: string
}

// Mirrors Artifacts.tsx's TIER_META colours so an artifact reads the same
// way here as it does in the Exploration collection screen.
const TIER_COLOR: Record<string, string> = {
  common: '#888899',
  rare: '#4f8ef7',
  epic: '#9b6dff',
  mythic: '#f5c542',
}

// Matches ProfilePreviewModal's sheet exactly, same as BadgeQuickSheet —
// keep in sync if that ever changes.
const SHEET_HEIGHT_VH = 85
const WIDE_BREAKPOINT = 640

export default function ArtifactQuickSheet({
  displayName, isOwnProfile, equipped, showcased, onClose, onManage,
}: {
  displayName: string
  isOwnProfile: boolean
  equipped: ArtifactTileData | null
  showcased: ArtifactTileData[]
  onClose: () => void
  /** Only called (and only shown) when isOwnProfile is true — opens Edit Profile's Artifacts section. */
  onManage?: () => void
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

  const equippedColor = equipped ? (TIER_COLOR[equipped.tier] ?? '#888899') : '#888899'

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={17} style={{ color: 'var(--text-dim)' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {displayName} equipped artifacts
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
                {equipped ? 'Their primary artifact, plus what they\'re showcasing' : 'No artifact equipped yet'}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Equipped — the one primary artifact */}
        <div
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18,
            background: equipped ? `${equippedColor}14` : 'var(--surface)',
            border: `1px solid ${equipped ? equippedColor + '44' : 'var(--border-strong)'}`,
            marginBottom: 22,
          }}
        >
          <div style={{ width: 62, height: 62, borderRadius: 16, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {equipped?.mediaUrl
              ? <img src={equipped.mediaUrl} alt={equipped.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Package size={22} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {equipped?.name ?? 'No artifact equipped'}
            </p>
            {equipped && (
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: equippedColor }}>
                {equipped.tier}
              </span>
            )}
          </div>
        </div>

        {/* Showcased — up to three OTHER artifacts */}
        <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
          Showcased
        </p>
        {showcased.length === 0 ? (
          <div style={{ padding: '18px 0', textAlign: 'center', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border-strong)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No showcased artifacts yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {showcased.map(a => {
              const color = TIER_COLOR[a.tier] ?? '#888899'
              return (
                <div key={a.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 6px', borderRadius: 16, background: 'var(--surface)', border: `1px solid ${color}33` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18` }}>
                    {a.mediaUrl
                      ? <img src={a.mediaUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Package size={17} color={color} />}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {a.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {isOwnProfile && onManage && (
          <button
            type="button"
            onClick={() => { close(); onManage() }}
            className="ripple-wrap"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginTop: 22 }}
          >
            <Pencil size={13} /> Manage artifacts
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
