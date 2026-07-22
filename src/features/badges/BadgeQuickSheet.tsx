// src/features/badges/BadgeQuickSheet.tsx
//
// Opened via tap-hold → "View badges" (see BadgeContextMenu). A compact
// sheet — deliberately smaller than the full BadgesDex/BadgesModal grid —
// built to mirror the "Your badges" popover pattern (avatar + name header,
// top few badges, tap one for details, a way to browse the rest).
//
// Two sections:
//  1. This player's best 3 badges (rarest first) + a [+N] tile that opens
//     the existing full BadgesModal if they have more than 3.
//  2. "Available to unlock" — only shown on the viewer's OWN sheet — 4
//     badges they haven't earned yet, picked at random each time the
//     sheet opens. If they aren't Pro, one slot always shows the Orbit
//     Member tile so it's never buried.
//
// Tapping any badge (owned, locked, or the Orbit tile) opens a detail
// card with the icon, name, rarity, how to get it, and — for locked
// badges — whether it's still obtainable at all.
import { useEffect, useMemo, useState } from 'react'
import { X, Lock } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'
import { BadgeIcon } from './badgeIcons'
import {
  BADGE_RARITY_COLOR, BADGE_RARITY_RANK, badgeDisplayTitle,
  type BadgeDef, type PlayerBadge,
} from './badges'
import { proBadgeSrc, type ProBadgeColor } from './ProBadge'

const PRO_TIERS: Array<{ key: ProBadgeColor; label: string; months: number; color: string }> = [
  { key: 'blue', label: 'Blue', months: 0, color: '#4f8ef7' },
  { key: 'indigo', label: 'Indigo', months: 3, color: '#6d5bff' },
  { key: 'holo', label: 'Holo', months: 6, color: '#c9a7ff' },
  { key: 'green', label: 'Green', months: 12, color: '#3ecf8e' },
  { key: 'gold', label: 'Gold', months: 24, color: '#f5c542' },
  { key: 'red', label: 'Red', months: 36, color: '#ff5c5c' },
]

export interface ProInfo {
  isPro: boolean
  tier: 'orbit' | 'void' | null
  color: ProBadgeColor | string | null
  memberSince: string | null
}

// Marker object used for the Orbit tile so it can flow through the same
// "selected" detail state as a real BadgeDef, without needing a matching
// row in the `badges` table.
const ORBIT_MARKER = '__orbit__'

export default function BadgeQuickSheet({
  badges, allDefs, originalUsername, avatarUrl, displayName, isOwnProfile,
  pro, onClose, onOpenAll, onViewYourBadges,
}: {
  badges: PlayerBadge[]
  allDefs: BadgeDef[]
  originalUsername: string
  avatarUrl?: string | null
  displayName: string
  isOwnProfile: boolean
  pro?: ProInfo | null
  onClose: () => void
  /** Opens the existing full BadgesModal — used by the "+N" overflow tile. */
  onOpenAll: () => void
  /** Only called (and only shown) when isOwnProfile is false. */
  onViewYourBadges?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState<BadgeDef | typeof ORBIT_MARKER | null>(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 260) }

  const defById = useMemo(() => new Map(allDefs.map(d => [d.id, d])), [allDefs])
  const owned = useMemo(() => [...badges]
    .map(b => defById.get(b.badge_id))
    .filter((d): d is BadgeDef => !!d)
    .sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9)), [badges, defById])

  const top3 = owned.slice(0, 3)
  const overflow = owned.length - top3.length

  // Random "available to unlock" picks — chosen once per sheet-open, not
  // reshuffled on every re-render.
  const [unlockPool] = useState(() => {
    const ownedIds = new Set(badges.map(b => b.badge_id))
    const candidates = allDefs.filter(d => !ownedIds.has(d.id) && d.is_available !== false && d.id !== 'orbit_subscriber')
    const shuffled = [...candidates].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 4)
  })

  const showUnlockSection = isOwnProfile
  const notPro = !pro?.isPro
  const orbitDef = defById.get('orbit_subscriber')
  // Bump the Orbit tile into the unlock grid (replacing the last slot) so
  // a non-Pro viewer always sees it, without ever showing 5 tiles.
  const unlockTiles: Array<BadgeDef | typeof ORBIT_MARKER> = showUnlockSection
    ? (notPro ? [ORBIT_MARKER, ...unlockPool.slice(0, 3)] : unlockPool)
    : []

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 20100 }} />
      <div className="sheet-or-modal" style={{ zIndex: 20105 }}>
        <div
          className="sheet-or-modal-inner"
          onClick={e => e.stopPropagation()}
          style={{ maxHeight: '78vh', overflowY: 'auto', background: 'var(--surface2)', padding: '20px 20px 30px', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar src={avatarUrl ?? undefined} name={displayName} size={38} radius={12} disabled />
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                  {isOwnProfile ? 'Your badges' : `${displayName}'s badges`}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Find out what badges you can unlock</p>
              </div>
            </div>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {owned.length === 0 ? (
            <div style={{ padding: '18px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No badges yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: showUnlockSection ? 22 : 4 }}>
              {top3.map(def => (
                <BadgeTile key={def.id} def={def} owned onClick={() => setSelected(def)} />
              ))}
              {overflow > 0 && (
                <button
                  type="button"
                  onClick={onOpenAll}
                  className="ripple-wrap"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '14px 6px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>+{overflow}</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>See all</span>
                </button>
              )}
            </div>
          )}

          {!isOwnProfile && onViewYourBadges && (
            <button
              type="button"
              onClick={() => { close(); onViewYourBadges() }}
              className="ripple-wrap"
              style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
            >
              View your badges
            </button>
          )}

          {showUnlockSection && (
            <>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                Available to unlock
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {unlockTiles.map(item => (
                  item === ORBIT_MARKER ? (
                    <OrbitTile key="orbit" def={orbitDef} onClick={() => setSelected(ORBIT_MARKER)} />
                  ) : (
                    <BadgeTile key={item.id} def={item} owned={false} onClick={() => setSelected(item)} />
                  )
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selected === ORBIT_MARKER && (
        <OrbitDetail pro={pro ?? null} def={orbitDef ?? null} onClose={() => setSelected(null)} />
      )}
      {selected && selected !== ORBIT_MARKER && (
        <BadgeDetail
          def={selected}
          owned={badges.some(b => b.badge_id === selected.id)}
          originalUsername={originalUsername}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

function BadgeTile({ def, owned, onClick }: { def: BadgeDef; owned: boolean; onClick: () => void }) {
  const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
  return (
    <button
      type="button"
      onClick={onClick}
      className="ripple-wrap"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 6px', borderRadius: 16, background: 'var(--surface)', border: `1px solid ${owned ? color + '33' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', opacity: owned ? 1 : 0.55 }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: owned ? color + '1c' : 'var(--surface2)' }}>
        {owned ? <BadgeIcon iconKey={def.icon} size={19} color={color} /> : <Lock size={15} color="var(--text-muted)" />}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.2 }}>
        {def.title}
      </span>
    </button>
  )
}

function OrbitTile({ def, onClick }: { def?: BadgeDef; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ripple-wrap"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 6px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(79,142,247,0.35)', cursor: 'pointer' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79,142,247,0.14)' }}>
        <img src={proBadgeSrc('blue')} alt="Orbit" width={20} height={20} style={{ display: 'block', filter: 'grayscale(1)', opacity: 0.7 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.2 }}>
        {def?.title ?? 'Orbit Member'}
      </span>
    </button>
  )
}

function AvailabilityCard({ available }: { available: boolean }) {
  return (
    <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: 999, background: available ? '#3ecf8e' : 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
        {available ? 'Still available to unlock' : 'No longer available to unlock'}
      </span>
    </div>
  )
}

function BadgeDetail({ def, owned, originalUsername, onClose }: { def: BadgeDef; owned: boolean; originalUsername: string; onClose: () => void }) {
  const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--bg)', borderRadius: 22, padding: '22px 20px', boxShadow: 'var(--elev-popover)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="var(--text-dim)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: -6 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: owned ? color + '1c' : 'var(--surface2)' }}>
            {owned ? <BadgeIcon iconKey={def.icon} size={26} color={color} /> : <Lock size={20} color="var(--text-muted)" />}
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>
            {owned ? badgeDisplayTitle(def, originalUsername) : def.title}
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color, background: color + '18', border: `1px solid ${color}44`, borderRadius: 999, padding: '3px 10px' }}>
            {def.rarity}
          </span>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5, marginTop: 2 }}>{def.description}</p>

          {!owned && def.grant_type === 'auto' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Think you already meet this? Reach out to Support.</p>
          )}
          {!owned && def.grant_type === 'manual' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>This badge is assigned by the Chillverse team.</p>
          )}

          {!owned && <AvailabilityCard available={def.is_available !== false} />}
        </div>
      </div>
    </div>
  )
}

function OrbitDetail({ pro, def, onClose }: { pro: ProInfo | null; def?: BadgeDef | null; onClose: () => void }) {
  const currentRank = pro?.isPro ? PRO_TIERS.findIndex(t => t.key === (pro.color as ProBadgeColor)) : -1
  const rarityColor = def ? (BADGE_RARITY_COLOR[def.rarity] ?? '#4f8ef7') : '#4f8ef7'
  const title = def?.title ?? 'Orbit Member'
  const description = def?.description
    ?? (pro?.isPro
      ? 'Awarded for being a Chillverse Pro member. The colour deepens the longer you stay subscribed.'
      : 'Subscribe to Chillverse Pro to unlock this badge — its colour evolves the longer you stay a member.')
  const available = def?.is_available ?? true

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--bg)', borderRadius: 22, padding: '22px 20px', boxShadow: 'var(--elev-popover)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="var(--text-dim)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: -6 }}>
          <img src={proBadgeSrc(pro?.isPro ? (pro.color as ProBadgeColor) : 'blue')} alt={title} width={56} height={56} style={{ display: 'block', filter: pro?.isPro ? 'none' : 'grayscale(1)', opacity: pro?.isPro ? 1 : 0.6 }} />
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>{title}</p>
          {def && (
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: rarityColor, background: rarityColor + '18', border: `1px solid ${rarityColor}44`, borderRadius: 999, padding: '3px 10px' }}>
              {def.rarity}
            </span>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>{description}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', marginTop: 8 }}>
            {PRO_TIERS.map((t, i) => {
              const unlocked = currentRank >= 0 && i <= currentRank
              return (
                <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 12, background: 'var(--surface)', border: `1px solid ${unlocked ? t.color + '55' : 'var(--border-strong)'}` }}>
                  <img src={proBadgeSrc(t.key)} alt={t.label} width={22} height={22} style={{ filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : 0.4 }} />
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: unlocked ? t.color : 'var(--text-muted)' }}>{t.label}</span>
                  {!unlocked && <Lock size={9} color="var(--text-muted)" />}
                </div>
              )
            })}
          </div>

          {!pro?.isPro && <AvailabilityCard available={available} />}
        </div>
      </div>
    </div>
  )
}
