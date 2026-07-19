// src/features/badges/BadgesDex.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Lock } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import { getAllBadges, getPlayerBadges, badgeDisplayTitle, BADGE_RARITY_COLOR, BADGE_RARITY_RANK, type BadgeDef, type PlayerBadge } from './badges'
import { BadgeIcon } from './badgeIcons'

// Settings > Badges — the full catalog ("badge dex"): every badge that
// exists, locked ones greyed out, with the requirement shown under each.
// Tapping any badge opens a detail modal with the requirement text, plus
// (only for ones the player hasn't unlocked) a plain hint line — no
// button, no auto-opened ticket.
export default function BadgesDex() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [defs, setDefs] = useState<BadgeDef[]>([])
  const [mine, setMine] = useState<PlayerBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BadgeDef | null>(null)
  const [originalUsername, setOriginalUsername] = useState('')

  useEffect(() => {
    getAllBadges().then(setDefs)
    if (userId) {
      getPlayerBadges(userId).then(setMine).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Only needed to render the dynamic "Originally known as {originalUsername}"
    // tile correctly — this must stay original_username, never username,
    // or the badge text will drift every time the player renames themselves.
    if (!userId) return
    supabase.from('profiles').select('original_username').eq('id', userId).single()
      .then(({ data }) => { if (data?.original_username) setOriginalUsername(data.original_username) })
  }, [userId])

  const ownedIds = new Set(mine.map(b => b.badge_id))
  const sorted = [...defs].sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button type="button" onClick={(e) => { ripple(e); navigate(-1) }} className="ripple-wrap"
          style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={15} color="var(--text-dim)" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Badges</span>
      </div>

      <div style={{ padding: '0 20px 6px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
          {loading ? 'Loading…' : `${mine.length}/${defs.length} collected`}
        </p>
      </div>

      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(def => {
          const owned = ownedIds.has(def.id)
          const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setSelected(def)}
              className="ripple-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 16, background: 'var(--surface)', border: `1px solid ${owned ? color + '33' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', textAlign: 'left', boxShadow: 'var(--elev-raise-sm)', opacity: owned ? 1 : 0.55 }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: owned ? color + '1c' : 'var(--surface2)' }}>
                {owned ? <BadgeIcon iconKey={def.icon} size={19} color={color} /> : <Lock size={15} color="var(--text-muted)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: owned ? 'var(--text)' : 'var(--text-dim)' }}>
                  {owned ? badgeDisplayTitle(def, originalUsername) : def.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{def.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <BadgeDetailModal
          def={selected}
          owned={ownedIds.has(selected.id)}
          originalUsername={originalUsername}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function BadgeDetailModal({ def, owned, originalUsername, onClose }: { def: BadgeDef; owned: boolean; originalUsername: string; onClose: () => void }) {
  const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: 'var(--bg)', borderRadius: 22, padding: '22px 20px', boxShadow: 'var(--elev-popover)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="var(--text-dim)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: -6 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: owned ? color + '1c' : 'var(--surface2)' }}>
            {owned ? <BadgeIcon iconKey={def.icon} size={26} color={color} /> : <Lock size={20} color="var(--text-muted)" />}
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>
            {owned ? badgeDisplayTitle(def, originalUsername) : def.title}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>{def.description}</p>

          {!owned && def.grant_type === 'auto' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
              Think you already meet this? Reach out to Support.
            </p>
          )}
          {!owned && def.grant_type === 'manual' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
              This badge is assigned by the Chillverse team.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
