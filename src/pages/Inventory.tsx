// src/pages/Inventory.tsx
import { useState, useEffect, useCallback } from 'react'
import {
  Package, Shirt, Zap, Image as ImageIcon,
  X, CheckCircle2, CircleDashed,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { MallItem, MallRarity } from '../types'

/* ══════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════ */
interface InventoryEntry {
  id: string
  item_id: string
  is_equipped: boolean
  quantity: number
  item: MallItem
}

/* ══════════════════════════════════════════════════
   REAL INVENTORY HOOK
══════════════════════════════════════════════════ */
function useInventory(userId: string | null) {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let active = true
    setLoading(true)

    supabase
      .from('user_inventory')
      .select('id, item_id, is_equipped, quantity, item:mall_items(*)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!active) return
        if (error) { console.error('inventory fetch:', error); setLoading(false); return }
        setInventory((data ?? []) as unknown as InventoryEntry[])
        setLoading(false)
      })

    return () => { active = false }
  }, [userId])

  return { inventory, setInventory, loading }
}


/* ══════════════════════════════════════════════════
   RARITY COLOURS
══════════════════════════════════════════════════ */
const RARITY_COLOR: Record<MallRarity, string> = {
  Common: '#888899',
  Rare:   '#4f8ef7',
  Epic:   '#9b6dff',
  Mythic: '#ff6b00',
}

/* ══════════════════════════════════════════════════
   EQUIP TOAST
══════════════════════════════════════════════════ */
interface ToastMsg { text: string; equipped: boolean }

function EquipToast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: 'rgba(17,17,19,0.97)',
      border: `1px solid ${msg.equipped ? 'rgba(255,107,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 14, padding: '11px 18px',
      display: 'flex', alignItems: 'center', gap: 9,
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)',
      animation: 'invFeedIn 0.25s ease-out both', whiteSpace: 'nowrap',
    }}>
      {msg.equipped
        ? <CheckCircle2 size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        : <CircleDashed  size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
      }
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{msg.text}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   EQUIP MODAL
══════════════════════════════════════════════════ */
function EquipModal({
  entry,
  onEquip,
  onUnequip,
  onClose,
}: {
  entry: InventoryEntry
  onEquip: () => void
  onUnequip: () => void
  onClose: () => void
}) {
  const { item } = entry
  const color = RARITY_COLOR[item.rarity]
  const isEquipped = entry.is_equipped

  const categoryLabel =
    item.category === 'avatar_skin'  ? 'Avatar' :
    item.category === 'xp_booster'   ? 'Consumable' :
    item.sub_category === 'album'    ? 'Album' : 'Profile Pic'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 24, padding: 24,
        width: '100%', maxWidth: 340,
        border: `1px solid ${isEquipped ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', position: 'relative',
        animation: 'invModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, width: 30, height: 30,
            borderRadius: 9, background: 'rgba(255,255,255,0.06)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)',
          }}
        >
          <X size={13} />
        </button>

        {/* Image placeholder */}
        <div style={{
          width: '100%', height: 160, borderRadius: 16, marginBottom: 16,
          background: item.image_url
            ? `url(${item.image_url}) center/cover`
            : `linear-gradient(135deg, rgba(255,107,0,0.08), rgba(155,109,255,0.08))`,
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!item.image_url && (
            <Package size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
          )}
        </div>

        {/* Category chip */}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
          color: color, textAlign: 'center', marginBottom: 6,
        }}>
          {categoryLabel}
        </div>

        {/* Name */}
        <div style={{ fontSize: 19, fontWeight: 800, textAlign: 'center', color: 'var(--text)', marginBottom: 4 }}>
          {item.name}
        </div>

        {/* Rarity */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${color}20`, color }}>
            {item.rarity}
          </span>
        </div>

        {/* Description */}
        {item.description && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6, marginBottom: 18 }}>
            {item.description}
          </div>
        )}

        {/* Quantity badge for consumables */}
        {item.is_consumable && (
          <div style={{
            textAlign: 'center', marginBottom: 14,
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            Owned: <span style={{ color: 'var(--text)', fontWeight: 700 }}>×{entry.quantity}</span>
          </div>
        )}

        {/* Equip / Unequip button */}
        {isEquipped ? (
          <button
            onClick={(e) => { ripple(e as any); onUnequip() }}
            className="ripple-wrap"
            style={{
              width: '100%', padding: 13, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', background: 'var(--surface2)',
              color: 'var(--text-dim)', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <CircleDashed size={15} /> Unequip
          </button>
        ) : (
          <button
            onClick={(e) => { ripple(e as any); onEquip() }}
            className="ripple-wrap"
            style={{
              width: '100%', padding: 13, borderRadius: 14, border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent), #ff9a3c)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: '0 4px 18px rgba(255,107,0,0.35)',
            }}
          >
            <CheckCircle2 size={15} /> Equip
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ITEM CARD
══════════════════════════════════════════════════ */
function InventoryCard({ entry, onTap }: { entry: InventoryEntry; onTap: () => void }) {
  const { item } = entry
  const color = RARITY_COLOR[item.rarity]
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onTap() }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)',
        border: entry.is_equipped
          ? '1.5px solid rgba(255,107,0,0.45)'
          : isMythic
          ? '1px solid rgba(255,107,0,0.2)'
          : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16, padding: 10, cursor: 'pointer', position: 'relative',
        boxShadow: entry.is_equipped
          ? '0 0 0 1px rgba(255,107,0,0.15), 4px 4px 12px var(--neu-dark)'
          : '4px 4px 10px var(--neu-dark), -2px -2px 8px var(--neu-light)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Equipped dot */}
      {entry.is_equipped && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 6px rgba(255,107,0,0.7)',
        }} />
      )}

      {/* Image */}
      <div style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 12, marginBottom: 8,
        background: item.image_url
          ? `url(${item.image_url}) center/cover`
          : `linear-gradient(135deg, ${color}18, ${color}08)`,
        border: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!item.image_url && <Package size={22} style={{ color: `${color}55` }} />}
      </div>

      {/* Name */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </div>

      {/* Rarity + quantity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, padding: '2px 6px', borderRadius: 6, background: `${color}18` }}>
          {item.rarity}
        </span>
        {item.is_consumable && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>×{entry.quantity}</span>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   SECTION HEADER
══════════════════════════════════════════════════ */
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '2px 2px 6px var(--neu-dark), -1px -1px 4px var(--neu-light)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
          {count} item{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN INVENTORY PAGE
══════════════════════════════════════════════════ */
export default function Inventory() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const { inventory, setInventory, loading } = useInventory(userId)
  const [selected, setSelected] = useState<InventoryEntry | null>(null)
  const [toast, setToast]       = useState<ToastMsg | null>(null)

  const equip = useCallback(async (entry: InventoryEntry) => {
    const { item } = entry

    // Optimistic: unequip all in same category, equip this one
    setInventory(prev => prev.map(e => ({
      ...e,
      is_equipped: e.item.category === item.category ? e.id === entry.id : e.is_equipped,
    })))
    setToast({ text: `Equipped ${item.name}`, equipped: true })
    setSelected(null)

    // Persist inventory state
    const sameCategory = inventory
      .filter(e => e.item.category === item.category && e.is_equipped && e.id !== entry.id)
      .map(e => e.id)
    if (sameCategory.length) {
      await supabase.from('user_inventory').update({ is_equipped: false }).in('id', sameCategory)
    }
    await supabase.from('user_inventory').update({ is_equipped: true }).eq('id', entry.id)

    // Apply to profile
    if (!userId) return
    if (item.category === 'profile_pic' && item.sub_category !== 'album') {
      // Sets actual profile picture (avatar field stores emoji OR image URL)
      await supabase.from('profiles').update({ avatar: item.image_url ?? item.name }).eq('id', userId)
    } else if (item.category === 'avatar_skin') {
      // Stores the equipped avatar skin name/url on profiles
      await supabase.from('profiles').update({ equipped_avatar: item.image_url ?? item.name }).eq('id', userId)
    } else if (item.sub_category === 'album') {
      // Albums set as banner
      await supabase.from('profiles').update({ banner_url: item.image_url }).eq('id', userId)
    }
    // consumables: no profile change — timer handled separately
  }, [inventory, setInventory, userId])

  const unequip = useCallback(async (entry: InventoryEntry) => {
    const { item } = entry
    setInventory(prev => prev.map(e => e.id === entry.id ? { ...e, is_equipped: false } : e))
    setToast({ text: `Unequipped ${item.name}`, equipped: false })
    setSelected(null)

    await supabase.from('user_inventory').update({ is_equipped: false }).eq('id', entry.id)

    // Revert profile fields
    if (!userId) return
    if (item.category === 'profile_pic' && item.sub_category !== 'album') {
      await supabase.from('profiles').update({ avatar: '🧑‍🚀' }).eq('id', userId)
    } else if (item.category === 'avatar_skin') {
      await supabase.from('profiles').update({ equipped_avatar: null }).eq('id', userId)
    } else if (item.sub_category === 'album') {
      await supabase.from('profiles').update({ banner_url: null }).eq('id', userId)
    }
  }, [setInventory, userId])

  const avatars     = inventory.filter(e => e.item.category === 'avatar_skin')
  const consumables = inventory.filter(e => e.item.category === 'xp_booster' || e.item.is_consumable)
  const profilePics = inventory.filter(e => e.item.category === 'profile_pic' && e.item.sub_category !== 'album')
  const albums      = inventory.filter(e => e.item.sub_category === 'album')

  const isEmpty = !loading && inventory.length === 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading inventory…
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes invFeedIn {
          from { opacity:0; transform: translateX(-50%) translateY(12px) }
          to   { opacity:1; transform: translateX(-50%) translateY(0) }
        }
        @keyframes invModalIn {
          from { opacity:0; transform: scale(0.88) }
          to   { opacity:1; transform: scale(1) }
        }
        @keyframes invSectionIn {
          from { opacity:0; transform: translateY(10px) }
          to   { opacity:1; transform: translateY(0) }
        }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Package size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Inventory</h1>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Tap any item to equip or unequip it
          </div>
        </div>

        {isEmpty && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '60px 20px', textAlign: 'center',
          }}>
            <Package size={40} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)' }}>Your inventory is empty</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Head to the Mall to pick up some items!</div>
          </div>
        )}

        {/* ─── Avatars ─────────────────────────────── */}
        {avatars.length > 0 && (
          <div style={{ marginBottom: 28, animation: 'invSectionIn 0.3s ease-out both', animationDelay: '0s' }}>
            <SectionHeader icon={<Shirt size={16} style={{ color: '#ff4d8b' }} />} label="Avatars" count={avatars.length} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {avatars.map(e => <InventoryCard key={e.id} entry={e} onTap={() => setSelected(e)} />)}
            </div>
          </div>
        )}

        {/* Divider */}
        {avatars.length > 0 && (consumables.length > 0 || profilePics.length > 0 || albums.length > 0) && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 28 }} />
        )}

        {/* ─── Consumables ─────────────────────────── */}
        {consumables.length > 0 && (
          <div style={{ marginBottom: 28, animation: 'invSectionIn 0.3s ease-out both', animationDelay: '0.07s' }}>
            <SectionHeader icon={<Zap size={16} style={{ color: '#f5c542' }} />} label="Consumables" count={consumables.length} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {consumables.map(e => <InventoryCard key={e.id} entry={e} onTap={() => setSelected(e)} />)}
            </div>
          </div>
        )}

        {/* Divider */}
        {consumables.length > 0 && (profilePics.length > 0 || albums.length > 0) && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 28 }} />
        )}

        {/* ─── Profile Pics & Albums ───────────────── */}
        {(profilePics.length > 0 || albums.length > 0) && (
          <div style={{ animation: 'invSectionIn 0.3s ease-out both', animationDelay: '0.14s' }}>
            <SectionHeader icon={<ImageIcon size={16} style={{ color: '#4f8ef7' }} />} label="Profile Pics & Albums" count={profilePics.length + albums.length} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {profilePics.map(e => <InventoryCard key={e.id} entry={e} onTap={() => setSelected(e)} />)}
              {albums.map(e => <InventoryCard key={e.id} entry={e} onTap={() => setSelected(e)} />)}
            </div>
          </div>
        )}

      </div>

      {/* Equip modal */}
      {selected && (
        <EquipModal
          entry={selected}
          onEquip={() => equip(selected)}
          onUnequip={() => unequip(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Toast */}
      {toast && <EquipToast msg={toast} onDone={() => setToast(null)} />}
    </>
  )
}
