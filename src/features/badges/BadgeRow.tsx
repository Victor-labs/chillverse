// src/features/badges/BadgeRow.tsx
import { useState } from 'react'
import { BadgeIcon } from './badgeIcons'
import { BADGE_RARITY_COLOR, BADGE_RARITY_RANK, badgeDisplayTitle, type BadgeDef, type PlayerBadge } from './badges'
import BadgeToast from './BadgeToast'
import BadgeContextMenu from './BadgeContextMenu'
import BadgeQuickSheet, { type ProInfo } from './BadgeQuickSheet'
import BadgeNudge, { hasSeenBadgeNudge, markBadgeNudgeSeen } from './BadgeNudge'
import { useLongPress } from '../../shared/lib/useLongPress'

const MAX_VISIBLE = 5

// Row of small badge icons shown right next to the display name — the
// Discord-style badge row. Shows up to 5, rarest first; a 6th+ badge
// collapses into a "+N" chip instead of an icon. Tapping an icon shows
// the slide-down BadgeToast with just its name. Tapping "+N" opens the
// full collection modal (via onOpenAll).
//
// Tap-and-HOLD anywhere on the row instead opens a small "View badges"
// context menu, which opens the compact BadgeQuickSheet — a quicker,
// Discord-badges-popover-style preview separate from the full modal.
export default function BadgeRow({
  badges, defs, originalUsername, onOpenAll,
  avatarUrl, displayName, isOwnProfile = true, pro, onViewYourBadges,
}: {
  badges: PlayerBadge[]
  defs: BadgeDef[]
  /** The player's frozen original_username — NOT their current username. */
  originalUsername: string
  onOpenAll: () => void
  /** These enable the tap-hold quick-sheet; omit to keep the row tap-only. */
  avatarUrl?: string | null
  displayName?: string
  isOwnProfile?: boolean
  pro?: ProInfo | null
  /** Only used (and only shown) when isOwnProfile is false. */
  onViewYourBadges?: () => void
}) {
  const [toast, setToast] = useState<BadgeDef | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [showNudge, setShowNudge] = useState(!isOwnProfile && !hasSeenBadgeNudge())

  const quickSheetEnabled = !!displayName
  const longPress = useLongPress((x, y) => {
    if (!quickSheetEnabled) return
    markBadgeNudgeSeen()
    setShowNudge(false)
    setMenuPos({ x, y })
  })

  // Normally a badge-less player shows nothing here. But if the quick
  // sheet is wired up, keep a (near-invisible) long-press target so a
  // new player can still discover "available to unlock" from their own
  // profile even before they've earned anything.
  if (!badges.length && !quickSheetEnabled) return null

  const defById = new Map(defs.map(d => [d.id, d]))
  const sorted = [...badges]
    .map(b => defById.get(b.badge_id))
    .filter((d): d is BadgeDef => !!d)
    .sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))

  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - visible.length

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5 }} {...longPress.handlers}>
        {visible.map(def => {
          const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => { if (!longPress.wasLongPress()) setToast(def) }}
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
        {sorted.length === 0 && quickSheetEnabled && (
          <div
            style={{
              width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', border: '1px dashed var(--border-strong)',
            }}
          >
            <BadgeIcon iconKey="sparkles" size={11} color="var(--text-muted)" />
          </div>
        )}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => { if (!longPress.wasLongPress()) onOpenAll() }}
            style={{
              height: 22, minWidth: 22, padding: '0 6px', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', border: '1px solid var(--border-strong)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-dim)' }}>+{overflow}</span>
          </button>
        )}

        {showNudge && quickSheetEnabled && <BadgeNudge onDismiss={() => setShowNudge(false)} />}
      </div>

      {toast && (
        <BadgeToast
          title={badgeDisplayTitle(toast, originalUsername)}
          icon={toast.icon}
          rarity={toast.rarity}
          onDone={() => setToast(null)}
        />
      )}

      {menuPos && (
        <BadgeContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          onViewBadges={() => setShowSheet(true)}
        />
      )}

      {showSheet && quickSheetEnabled && (
        <BadgeQuickSheet
          badges={badges}
          allDefs={defs}
          originalUsername={originalUsername}
          avatarUrl={avatarUrl}
          displayName={displayName as string}
          isOwnProfile={isOwnProfile}
          pro={pro}
          onOpenAll={() => { setShowSheet(false); onOpenAll() }}
          onViewYourBadges={onViewYourBadges}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  )
}
