// src/features/badges/BadgeRow.tsx
import { useState } from 'react'
import { BadgeIcon } from './badgeIcons'
import { BADGE_RARITY_COLOR, BADGE_RARITY_RANK, badgeDisplayTitle, type BadgeDef, type PlayerBadge } from './badges'
import BadgeToast from './BadgeToast'

const MAX_VISIBLE = 5

// Row of small badge icons shown right next to the display name — the
// Discord-style badge row. Shows up to 5, rarest first; a 6th+ badge
// collapses into a "+N" chip instead of an icon. Tapping an icon shows
// the slide-down BadgeToast with just its name. Tapping "+N" opens the
// full collection modal (via onOpenAll).
export default function BadgeRow({
  badges, defs, originalUsername, onOpenAll,
}: {
  badges: PlayerBadge[]
  defs: BadgeDef[]
  /** The player's frozen original_username — NOT their current username. */
  originalUsername: string
  onOpenAll: () => void
}) {
  const [toast, setToast] = useState<BadgeDef | null>(null)

  if (!badges.length) return null

  const defById = new Map(defs.map(d => [d.id, d]))
  const sorted = [...badges]
    .map(b => defById.get(b.badge_id))
    .filter((d): d is BadgeDef => !!d)
    .sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))

  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - visible.length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {visible.map(def => {
          const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setToast(def)}
              style={{
                width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: color + '1c', border: `1px solid ${color}44`, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
              aria-label={def.title}
            >
              <BadgeIcon iconKey={def.icon} size={12} color={color} />
            </button>
          )
        })}
        {overflow > 0 && (
          <button
            type="button"
            onClick={onOpenAll}
            style={{
              height: 22, minWidth: 22, padding: '0 6px', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', border: '1px solid var(--border-strong)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-dim)' }}>+{overflow}</span>
          </button>
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
    </>
  )
}
