// src/pages/Mall.tsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Image as ImageIcon, Shirt, Zap,
  Gem, Lock, Star, X, ShoppingBag, Heart,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMallItems } from '../hooks/useMallItems'
import { useWallet } from '../hooks/useWallet'
import type { MallItem, MallRarity } from '../types'


/* ══════════════════════════════════════════════════════
   WISHLIST TOAST
══════════════════════════════════════════════════════ */
function WishlistToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: 'rgba(20,20,24,0.95)', border: '1px solid rgba(255,77,139,0.35)',
      borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 9,
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
      animation: 'feedIn 0.25s ease-out both', whiteSpace: 'nowrap',
    }}>
      <Heart size={14} style={{ color: '#ff4d8b', fill: '#ff4d8b', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{message}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   RARITY
══════════════════════════════════════════════════════ */
const RARITY_META: Record<MallRarity, { color: string; bg: string }> = {
  Common: { color: '#888899', bg: 'rgba(136,136,153,0.14)' },
  Rare:   { color: '#4f8ef7', bg: 'rgba(79,142,247,0.14)' },
  Epic:   { color: '#9b6dff', bg: 'rgba(155,109,255,0.14)' },
  Mythic: { color: '#ff6b00', bg: 'linear-gradient(135deg,rgba(255,107,0,0.18),rgba(245,197,66,0.14))' },
}

function RarityBadge({ rarity }: { rarity: MallRarity }) {
  const meta = RARITY_META[rarity]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
      background: meta.bg, color: meta.color, whiteSpace: 'nowrap',
    }}>
      {rarity}
    </span>
  )
}

/* ══════════════════════════════════════════════════════
   UNLOCK / LOCK STATUS
   For now: items requiring an avatar link or group requirement are
   treated as locked until real ownership-checking is wired up (needs
   user_inventory join, not implemented in this pass). Pro-locked items
   are locked unless... we don't have a real "is this user Pro" check
   yet either — flagged clearly below, not silently assumed.
══════════════════════════════════════════════════════ */
interface LockInfo {
  locked: boolean
  reason: string | null
}

// TODO: replace with real ownership checks once user_inventory reads are
// wired into the Mall. For now this only reflects Pro-locking and items
// that are gated behind avatar/group requirements (shown locked until
// the real "does this user own the required avatar(s)" query exists).
function getLockInfo(item: MallItem, hasOwnedRequirement: boolean): LockInfo {
  if (item.is_pro_locked) {
    return { locked: true, reason: 'Requires Pro' }
  }
  if (item.category === 'profile_pic' && !item.price_gems && !item.unlock_xp && !hasOwnedRequirement) {
    // A profile_pic with no direct price/XP path and no confirmed
    // requirement ownership is gated behind an avatar/group link we
    // haven't verified yet.
    return { locked: true, reason: 'Requires specific avatar(s)' }
  }
  return { locked: false, reason: null }
}

/* ══════════════════════════════════════════════════════
   CARD COMPONENTS
══════════════════════════════════════════════════════ */
function SquareCard({ item, onSelect, onWishlist, wishlisted, likeCount = 0 }: { item: MallItem; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: boolean; likeCount?: number }) {
  const lock = getLockInfo(item, false)
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onSelect(item) }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)', border: isMythic ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16, padding: 10, cursor: 'pointer', position: 'relative',
        boxShadow: isMythic ? '0 0 0 1px rgba(255,107,0,0.18),4px 4px 10px var(--neu-dark)' : '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
        opacity: lock.locked ? 0.55 : 1,
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 12, marginBottom: 8, overflow: 'hidden',
        background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--surface2)',
        filter: lock.locked ? 'grayscale(0.6)' : 'none',
      }} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <RarityBadge rarity={item.rarity} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {lock.locked ? (
            <Lock size={13} color="var(--text-muted)" />
          ) : item.price_gems != null ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
              <Gem size={11} color="#4f8ef7" /> {item.price_gems.toLocaleString()}
            </span>
          ) : null}
          {!lock.locked && onWishlist && (
            <button type="button" onClick={e => { e.stopPropagation(); onWishlist(item) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Heart size={13} style={{ fill: wishlisted ? '#ff4d8b' : 'none' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', minWidth: 10 }}>{likeCount}</span>
            </button>
          )}
        </div>
      </div>
      {lock.locked && lock.reason && (
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4 }}>{lock.reason}</div>
      )}
    </div>
  )
}

function RectCard({ item, onSelect, onWishlist, wishlisted, likeCount = 0 }: { item: MallItem; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: boolean; likeCount?: number }) {
  const lock = getLockInfo(item, false)
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onSelect(item) }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)', border: isMythic ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 18, padding: 12, cursor: 'pointer', position: 'relative',
        boxShadow: isMythic ? '0 0 0 1px rgba(255,107,0,0.18),4px 4px 10px var(--neu-dark)' : '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
        opacity: lock.locked ? 0.55 : 1,
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '3 / 4', borderRadius: 14, marginBottom: 10, overflow: 'hidden',
        background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--surface2)',
        filter: lock.locked ? 'grayscale(0.6)' : 'none',
      }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5, lineHeight: 1.3 }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <RarityBadge rarity={item.rarity} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {lock.locked ? (
            <Lock size={13} color="var(--text-muted)" />
          ) : item.price_gems != null ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
              <Gem size={11} color="#4f8ef7" /> {item.price_gems.toLocaleString()}
            </span>
          ) : item.unlock_xp != null ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
              <Zap size={11} color="#f5c542" /> {item.unlock_xp.toLocaleString()} XP
            </span>
          ) : null}
          {!lock.locked && onWishlist && (
            <button type="button" onClick={e => { e.stopPropagation(); onWishlist(item) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Heart size={13} style={{ fill: wishlisted ? '#ff4d8b' : 'none' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', minWidth: 10 }}>{likeCount}</span>
            </button>
          )}
        </div>
      </div>
      {lock.locked && lock.reason && (
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4 }}>{lock.reason}</div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   DETAIL / CONFIRM MODAL
══════════════════════════════════════════════════════ */
function ItemModal({ item, walletBalance, onClose }: { item: MallItem; walletBalance: number; onClose: () => void }) {
  const lock = getLockInfo(item, false)
  const canAfford = item.price_gems != null && walletBalance >= item.price_gems

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 360, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.55)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <X size={13} />
        </button>

        <div style={{ width: '100%', height: 200, borderRadius: 16, marginBottom: 16, overflow: 'hidden', background: 'var(--surface2)' }}>
          {item.image_url && (
            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
          )}
        </div>

        {item.sub_category && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 6 }}>
            {item.sub_category}
          </div>
        )}
        <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: 'var(--text)' }}>{item.name}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <RarityBadge rarity={item.rarity} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6, marginBottom: 18 }}>
          {item.description}
        </div>

        {lock.locked ? (
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={14} style={{ marginBottom: 4 }} /> {lock.reason}
          </div>
        ) : (
          <>
            {item.price_gems != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                <Gem size={18} color="#4f8ef7" /> {item.price_gems.toLocaleString()} Diamonds
              </div>
            )}
            {item.price_gems != null && !canAfford && (
              <div style={{ fontSize: 11, color: '#ff6b6b', textAlign: 'center', marginBottom: 10 }}>
                Not enough Diamonds to buy this item.
              </div>
            )}
            <button
              disabled={item.price_gems != null && !canAfford}
              onClick={(e) => { ripple(e as any) /* TODO: wire real purchase via secure server-side function */ }}
              className="ripple-wrap"
              style={{
                width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: item.price_gems != null && !canAfford ? 'not-allowed' : 'pointer',
                background: item.price_gems != null && !canAfford ? 'var(--surface3)' : 'linear-gradient(135deg,var(--accent),#ff9a3c)',
                color: item.price_gems != null && !canAfford ? 'var(--text-muted)' : '#fff',
                fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: item.price_gems != null && !canAfford ? 'none' : '0 4px 16px rgba(255,107,0,0.35)',
              }}
            >
              <ShoppingBag size={14} /> {item.price_gems != null ? 'Buy' : 'Unlock'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   SUB-PAGE WRAPPER — matches Settings.tsx SubPage pattern
══════════════════════════════════════════════════════ */
function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 700, background: 'var(--bg)', overflowY: 'auto', animation: 'slideInRight 0.28s cubic-bezier(0.4,0,0.2,1) both' }}>
      {/* SubPage header — covers sidebar and topbar completely */}
      <div style={{ position: 'sticky', top: 0, height: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', background: 'rgba(17,17,19,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 710 }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 20px 48px', maxWidth: 700, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PROFILE PICS SUB-PAGE
══════════════════════════════════════════════════════ */
function ProfilePicsPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const profilePics = items.filter(i => i.category === 'profile_pic')
  return (
    <SubPage title="Profile Pics" onBack={onBack}>
      {profilePics.length === 0 ? (
        <EmptyState label="No profile pics available yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11 }}>
          {profilePics.map(item => <SquareCard key={item.id} item={item} onSelect={onSelect} onWishlist={onWishlist} wishlisted={wishlisted?.has(item.id)} likeCount={likeCounts?.[item.id] ?? 0} />)}
        </div>
      )}
    </SubPage>
  )
}

/* ══════════════════════════════════════════════════════
   AVATARS SUB-PAGE — with sub-category tabs
══════════════════════════════════════════════════════ */
const AVATAR_SUB_CATEGORIES = ['Models and brand', 'Others', 'Power up characters']

function AvatarsPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const [activeTab, setActiveTab] = useState(AVATAR_SUB_CATEGORIES[0])
  const avatars = items.filter(i => i.category === 'avatar_skin' && i.sub_category === activeTab)

  return (
    <SubPage title="Avatars" onBack={onBack}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto' }}>
        {AVATAR_SUB_CATEGORIES.map(tab => (
          <button
            key={tab}
            onClick={(e) => { ripple(e as any); setActiveTab(tab) }}
            className="ripple-wrap"
            style={{
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-dim)',
              border: activeTab === tab ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {avatars.length === 0 ? (
        <EmptyState label={`No avatars in "${activeTab}" yet.`} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {avatars.map(item => <RectCard key={item.id} item={item} onSelect={onSelect} onWishlist={onWishlist} wishlisted={wishlisted?.has(item.id)} likeCount={likeCounts?.[item.id] ?? 0} />)}
        </div>
      )}
    </SubPage>
  )
}

/* ══════════════════════════════════════════════════════
   CONSUMABLES SUB-PAGE
══════════════════════════════════════════════════════ */
function ConsumablesPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const consumables = items.filter(i => i.category === 'xp_booster' || i.is_consumable)
  return (
    <SubPage title="Consumables" onBack={onBack}>
      {consumables.length === 0 ? (
        <EmptyState label="No consumables available yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {consumables.map(item => <RectCard key={item.id} item={item} onSelect={onSelect} onWishlist={onWishlist} wishlisted={wishlisted?.has(item.id)} likeCount={likeCounts?.[item.id] ?? 0} />)}
        </div>
      )}
    </SubPage>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <ShoppingBag size={28} style={{ opacity: 0.35 }} />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   TOP-LEVEL SECTION MENU CONFIG
══════════════════════════════════════════════════════ */
const SECTIONS = [
  { id: 'profile_pics', label: 'Profile Pics', sub: 'Square cards, no sub-categories', Icon: ImageIcon, iconBg: 'rgba(79,142,247,0.15)', iconColor: '#4f8ef7' },
  { id: 'avatars',      label: 'Avatars',      sub: 'Models, Others, Power up',        Icon: Shirt,     iconBg: 'rgba(255,77,139,0.15)', iconColor: '#ff4d8b' },
  { id: 'consumables',  label: 'Consumables',  sub: 'XP boosters and more',             Icon: Zap,       iconBg: 'rgba(245,197,66,0.15)', iconColor: '#f5c542' },
] as const

/* ══════════════════════════════════════════════════════
   MAIN MALL PAGE
══════════════════════════════════════════════════════ */
export default function Mall() {
  const navigate = useNavigate()
  const { items, loading: itemsLoading } = useMallItems()
  const { wallet } = useWallet()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MallItem | null>(null)
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const diamondBalance = wallet?.gem_balance ?? 0

  // Load like counts for all visible items + subscribe to realtime changes
  useEffect(() => {
    if (!items.length) return
    // Initial load
    // Load counts from public view + poll every 30s for cross-user live updates
    async function loadCounts() {
      const { data } = await supabase.from('wishlist_counts').select('item_id, count')
      if (!data) return
      const counts: Record<string, number> = {}
      for (const row of data) {
        counts[row.item_id as string] = row.count as number
      }
      setLikeCounts(counts)
    }
    loadCounts()
    const poll = setInterval(loadCounts, 30_000)
    return () => clearInterval(poll)
  }, [items.length])

  // Load existing wishlist ids
  useEffect(() => {
    if (!userId) return
    supabase.from('wishlist').select('item_id').eq('user_id', userId)
      .then(({ data }) => {
        setWishlisted(new Set((data ?? []).map((r: { item_id: string }) => r.item_id)))
      })
  }, [userId])

  const handleWishlist = useCallback(async (item: MallItem) => {
    if (!userId) return
    if (wishlisted.has(item.id)) return // already wishlisted, tap does nothing (remove from profile)
    await supabase.from('wishlist').upsert({
      user_id: userId,
      item_id: item.id,
      item_name: item.name,
      item_type: item.category,
      item_image: item.image_url ?? null,
    }, { onConflict: 'user_id,item_id' })
    setWishlisted(prev => new Set([...prev, item.id]))
    setToast('This item has been added to your wishlist.')
  }, [userId, wishlisted])

  const featured = useMemo(
    () => items.filter(i => i.rarity === 'Mythic').slice(0, 6),
    [items]
  )


  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Topbar row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
            <ArrowLeft size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.05)', padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            <Gem size={13} color="#4f8ef7" /> {diamondBalance.toLocaleString()} Diamonds
          </div>
        </div>

        {/* Featured carousel */}
        {featured.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>Featured</div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
              {featured.map(item => (
                <div
                  key={item.id}
                  onClick={(e) => { ripple(e); setSelectedItem(item) }}
                  className="ripple-wrap"
                  style={{
                    flex: '0 0 auto', width: 200, background: 'var(--surface)', border: '1px solid rgba(255,107,0,0.2)',
                    borderRadius: 18, padding: 14, cursor: 'pointer',
                    boxShadow: '5px 5px 14px var(--neu-dark),-3px -3px 10px var(--neu-light)',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,var(--accent),#f5c542)', color: '#1a1108', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                    <Star size={10} /> Featured
                  </div>
                  <div style={{
                    width: '100%', height: 90, borderRadius: 13, marginBottom: 10,
                    background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--surface2)',
                  }} />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{item.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <RarityBadge rarity={item.rarity} />
                    {item.price_gems != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                        <Gem size={12} color="#4f8ef7" /> {item.price_gems.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buy Diamonds row */}
        <div
          onClick={(e) => { ripple(e); navigate('/buy-diamonds') }}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)',
            border: '1px solid rgba(79,142,247,0.25)', borderRadius: 18, padding: 16, marginBottom: 20,
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
            boxShadow: '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
            animation: 'feedIn 0.35s ease-out both',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(79,142,247,0.06),rgba(155,109,255,0.04))', pointerEvents: 'none' }} />
          <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(79,142,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f8ef7', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
            <Gem size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Buy Diamonds</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Top up your diamond balance</div>
          </div>
          <ChevronRight size={16} color="var(--text-muted)" />
        </div>

        {/* Section menu */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Browse</div>
        {SECTIONS.map((section, i) => (
          <div
            key={section.id}
            onClick={(e) => { ripple(e); setOpenSection(section.id) }}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 18, padding: 16, marginBottom: 11, cursor: 'pointer',
              boxShadow: '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
              animation: 'feedIn 0.35s ease-out both', animationDelay: `${i * 0.05}s`,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: section.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.iconColor, boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
              <section.Icon size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{section.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{section.sub}</div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        ))}

        {itemsLoading && (
          <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>Loading catalog…</div>
        )}
      </div>

      {/* Sub-pages */}
      {openSection === 'profile_pics' && <ProfilePicsPage items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}
      {openSection === 'avatars'      && <AvatarsPage      items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}
      {openSection === 'consumables'  && <ConsumablesPage  items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}

      {/* Detail / confirm modal */}
      {selectedItem && (
        <ItemModal item={selectedItem} walletBalance={diamondBalance} onClose={() => setSelectedItem(null)} />
      )}

      {/* Wishlist toast */}
      {toast && <WishlistToast message={toast} onDone={() => setToast(null)} />}
    </>
  )
}
