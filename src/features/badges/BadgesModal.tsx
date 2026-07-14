// src/features/badges/BadgesModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { BadgeIcon } from './badgeIcons'
import { BADGE_RARITY_COLOR, BADGE_RARITY_RANK, badgeDisplayTitle, type BadgeDef, type PlayerBadge } from './badges'
import BadgeToast from './BadgeToast'

const PREVIEW_COUNT = 6

// Opened by tapping the "Badges" stat row on a profile — same pattern as
// achievements: a header showing "collected / total", then a grid of
// the player's top 6 (rarest first). Tapping one shows the slide-down
// name toast, same as the inline row.
export default function BadgesModal({
  badges, allDefs, originalUsername, onClose,
}: {
  badges: PlayerBadge[]
  allDefs: BadgeDef[]
  /** The player's frozen original_username — NOT their current username. */
  originalUsername: string
  onClose: () => void
}) {
  const [toast, setToast] = useState<BadgeDef | null>(null)

  const defById = new Map(allDefs.map(d => [d.id, d]))
  const owned = [...badges]
    .map(b => defById.get(b.badge_id))
    .filter((d): d is BadgeDef => !!d)
    .sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))

  const preview = owned.slice(0, PREVIEW_COUNT)
  const totalBadges = allDefs.length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '72vh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '22px 22px 0 0', padding: '18px 20px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.4)' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Badges</p>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color="var(--text-dim)" />
          </button>
        </div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 18 }}>{owned.length}/{totalBadges} collected</p>

        {owned.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No badges yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {preview.map(def => {
              const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setToast(def)}
                  className="ripple-wrap"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px', borderRadius: 16, background: 'var(--surface)', border: `1px solid ${color}33`, cursor: 'pointer' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '1c' }}>
                    <BadgeIcon iconKey={def.icon} size={19} color={color} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.25 }}>
                    {def.is_dynamic_username ? def.title : def.title}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <BadgeToast
          title={badgeDisplayTitle(toast, originalUsername)}
          icon={toast.icon}
          rarity={toast.rarity}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
