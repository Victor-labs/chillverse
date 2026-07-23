// src/pages/Mall.tsx
import type React from 'react'
import { useState, useMemo, useCallback, useEffect, createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Image as ImageIcon, Shirt, Zap,
  Lock, Star, X, ShoppingBag, Heart, Users, Eye, Sparkles,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { updateMissionProgress } from '../missions/weeklyMissions'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { useMallItems } from './useMallItems'
import { useWallet } from './useWallet'
import type { MallItem, MallRarity } from '../../shared/types'
import PageOnboarding from '../onboarding/PageOnboarding'
import ProfileEffectPreview from './ProfileEffectPreview'
import { useFeatureFlags } from '../../shared/lib/featureFlags'
import { useModRole } from '../moderation/useModRole'
import FeatureGateScreen from '../../shared/components/FeatureGateScreen'

// Whether the viewing user has an active Pro (Orbit/Void) plan. Provided
// once at the top of Mall() and read by SquareCard/RectCard/ItemModal so
// is_pro_locked items don't need isPro threaded through every page wrapper.
const MallProContext = createContext(false)
// User's current total XP, read by SquareCard/RectCard/ItemModal so
// unlock_xp gated items can be checked without prop-drilling profile.xp
// through every page wrapper.
const MallXpContext = createContext(0)


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
      boxShadow: 'var(--elev-raise)', backdropFilter: 'blur(10px)',
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
  Mythic: { color: 'var(--accent)', bg: 'linear-gradient(135deg,color-mix(in srgb, var(--accent) 18%, transparent),rgba(245,197,66,0.14))' },
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
   Pro-locked items unlock for any active Pro plan (Orbit or Void).
   Avatar/group-requirement items are still locked until real
   ownership-checking is wired up (needs user_inventory join).
══════════════════════════════════════════════════════ */
interface LockInfo {
  locked: boolean
  reason: string | null
}

function getLockInfo(item: MallItem, hasOwnedRequirement: boolean, isPro: boolean, userXp: number): LockInfo {
  if (item.is_pro_locked) {
    return isPro ? { locked: false, reason: null } : { locked: true, reason: 'Requires Pro' }
  }
  if (item.unlock_xp != null) {
    // XP-gated item: locked until the user's XP meets the threshold.
    return userXp >= item.unlock_xp
      ? { locked: false, reason: null }
      : { locked: true, reason: `Requires ${item.unlock_xp.toLocaleString()} XP` }
  }
  if (item.category === 'profile_pic' && !item.price_gems && !hasOwnedRequirement) {
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
// Grid-card thumbnail: uses the static image_url when there is one. If an
// item has no poster but does have a video (animated_url), we render the
// video itself with no autoplay — the browser just displays frame 1, which
// looks identical to a static poster without needing a separate asset.
function CardThumb({ item, style }: { item: MallItem; style: React.CSSProperties }) {
  if (item.image_url) {
    return <div style={{ ...style, background: `url(${item.image_url}) center/cover` }} />
  }
  if (item.animated_url && /\.(mp4|webm)$/i.test(item.animated_url)) {
    return (
      <div style={{ ...style, background: 'var(--surface2)' }}>
        <video src={item.animated_url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return <div style={{ ...style, background: 'var(--surface2)' }} />
}

function SquareCard({ item, onSelect, onWishlist, wishlisted, likeCount = 0, compact = false }: { item: MallItem; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: boolean; likeCount?: number; compact?: boolean }) {
  const isPro = useContext(MallProContext)
  const userXp = useContext(MallXpContext)
  const lock = getLockInfo(item, false, isPro, userXp)
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onSelect(item) }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)', border: isMythic ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: compact ? 13 : 16, padding: compact ? 7 : 10, cursor: 'pointer', position: 'relative',
        boxShadow: isMythic ? '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),4px 4px 10px var(--neu-dark)' : '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
        opacity: lock.locked ? 0.55 : 1,
      }}
    >
      <CardThumb item={item} style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: compact ? 10 : 12, marginBottom: compact ? 6 : 8, overflow: 'hidden',
        filter: lock.locked ? 'grayscale(0.6)' : 'none',
      }} />
      <div style={{ fontSize: compact ? 10.5 : 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: compact ? 3 : 4, lineHeight: 1.25, whiteSpace: compact ? 'nowrap' : 'normal', overflow: compact ? 'hidden' : 'visible', textOverflow: compact ? 'ellipsis' : 'clip' }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!compact && <RarityBadge rarity={item.rarity} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {lock.locked ? (
            <Lock size={compact ? 11 : 13} color="var(--text-muted)" />
          ) : item.price_gems != null ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: compact ? 10 : 11.5, fontWeight: 700, color: 'var(--text)' }}>
              💎 {item.price_gems.toLocaleString()}
            </span>
          ) : null}
          {!lock.locked && onWishlist && (
            <button type="button" onClick={e => { e.stopPropagation(); onWishlist(item) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Heart size={compact ? 11 : 13} style={{ fill: wishlisted ? '#ff4d8b' : 'none' }} />
              {!compact && <span style={{ fontSize: 9, fontWeight: 700, color: wishlisted ? '#ff4d8b' : 'var(--text-muted)', minWidth: 10 }}>{likeCount}</span>}
            </button>
          )}
        </div>
      </div>
      {lock.locked && lock.reason && (
        <div style={{ fontSize: compact ? 8.5 : 9.5, color: 'var(--text-muted)', marginTop: 4 }}>{lock.reason}</div>
      )}
    </div>
  )
}

function RectCard({ item, onSelect, onWishlist, wishlisted, likeCount = 0 }: { item: MallItem; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: boolean; likeCount?: number }) {
  const isPro = useContext(MallProContext)
  const userXp = useContext(MallXpContext)
  const lock = getLockInfo(item, false, isPro, userXp)
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onSelect(item) }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)', border: isMythic ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 18, padding: 12, cursor: 'pointer', position: 'relative',
        boxShadow: isMythic ? '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),4px 4px 10px var(--neu-dark)' : '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
        opacity: lock.locked ? 0.55 : 1,
      }}
    >
      <CardThumb item={item} style={{
        width: '100%', aspectRatio: '3 / 4', borderRadius: 14, marginBottom: 10, overflow: 'hidden',
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
              💎 {item.price_gems.toLocaleString()}
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

function BannerCard({ item, onSelect, onWishlist, wishlisted, likeCount = 0 }: { item: MallItem; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: boolean; likeCount?: number }) {
  const isPro = useContext(MallProContext)
  const userXp = useContext(MallXpContext)
  const lock = getLockInfo(item, false, isPro, userXp)
  const isMythic = item.rarity === 'Mythic'

  return (
    <div
      onClick={(e) => { ripple(e); onSelect(item) }}
      className="ripple-wrap"
      style={{
        background: 'var(--surface)', border: isMythic ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 14, padding: 9, cursor: 'pointer', position: 'relative',
        boxShadow: isMythic ? '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),4px 4px 10px var(--neu-dark)' : '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)',
        opacity: lock.locked ? 0.55 : 1,
      }}
    >
      {/* Wide/landscape image slot — the shape itself is the cue that this
          is a banner, even at small card size. */}
      <div style={{
        width: '100%', aspectRatio: '2.2 / 1', borderRadius: 10, marginBottom: 7, overflow: 'hidden', position: 'relative',
        background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--surface2)',
        filter: lock.locked ? 'grayscale(0.6)' : 'none',
      }}>
        {!lock.locked && onWishlist && (
          <button type="button" onClick={e => { e.stopPropagation(); onWishlist(item) }}
            style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: 20, cursor: 'pointer', padding: '3px 6px', color: wishlisted ? '#ff4d8b' : '#fff', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Heart size={10.5} style={{ fill: wishlisted ? '#ff4d8b' : 'none' }} />
            <span style={{ fontSize: 8.5, fontWeight: 700 }}>{likeCount}</span>
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <RarityBadge rarity={item.rarity} />
        {lock.locked ? (
          <Lock size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        ) : item.price_gems != null ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
            💎 {item.price_gems.toLocaleString()}
          </span>
        ) : null}
      </div>
      {lock.locked && lock.reason && (
        <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 4 }}>{lock.reason}</div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PURCHASE TOAST
══════════════════════════════════════════════════════ */
function PurchaseToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: 'rgba(17,17,19,0.97)',
      border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      borderRadius: 14, padding: '11px 18px',
      display: 'flex', alignItems: 'center', gap: 9,
      boxShadow: 'var(--elev-raise)', backdropFilter: 'blur(12px)',
      animation: 'feedIn 0.25s ease-out both', whiteSpace: 'nowrap',
    }}>
      <ShoppingBag size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{message}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   DETAIL / CONFIRM MODAL
══════════════════════════════════════════════════════ */
const BUY_LABEL: Partial<Record<MallItem['category'], string>> = {
  profile_pic: 'Buy Profile Pic',
  banner: 'Buy Banner',
  avatar_skin: 'Buy Avatar',
}

// Shared sizing for the "profile header mockup" preview (banner + the
// overlapping avatar + name/username), used automatically for banners and
// on-demand (behind the eye-toggle) for profile pics.
const MOCK_BANNER_H = 110
const MOCK_AVATAR_SIZE = 56
const MOCK_TOTAL_H = 194 // banner (110) + overlapping avatar's visible half (28) + name/username block + padding

// The buy sheet is always exactly this tall — same fixed height as the
// profile preview sheet (see SHEET_HEIGHT_VH in ProfilePreviewModal.tsx) —
// regardless of how much or how little info a given item has. Short
// content just leaves breathing room at the bottom; long content scrolls
// inside the sheet. No more "sheet height depends on content" behavior.
const BUY_SHEET_HEIGHT_VH = 85

// Small square thumbnail size for the profile-pic item view (the "just the
// small pic" per-item image, distinct from the full profile-header mockup
// which now only appears on demand for profile pics).
const PIC_THUMB_SIZE = 108

function ItemModal({
  item, walletBalance, userId, onClose, onPurchased, onWishlist, wishlisted, previewProfile, ownerCount = 0,
}: {
  item: MallItem
  walletBalance: number
  userId: string | null
  onClose: () => void
  onPurchased: (item: MallItem) => void
  onWishlist?: (item: MallItem) => void
  wishlisted?: boolean
  previewProfile?: { avatar: string; displayName: string; username: string; banner?: string | null } | null
  ownerCount?: number
}) {
  const isPro = useContext(MallProContext)
  const userXp = useContext(MallXpContext)
  const lock = getLockInfo(item, false, isPro, userXp)
  const canAfford = item.price_gems != null && walletBalance >= item.price_gems
  const [buying, setBuying] = useState(false)
  const [alreadyOwned, setAlreadyOwned] = useState(false)
  const [checkingOwn, setCheckingOwn] = useState(true)
  // Only banners show the full profile-header mockup automatically — it's
  // the one thing that fills the whole header, so it's worth previewing up
  // front. Profile pics show just their own small thumbnail by default;
  // the full "how it'll look on your profile" mockup is revealed on demand
  // via the eye-toggle below (see showPicPreview). Avatars get their own
  // full-but-shrunk image treatment further down.
  const isBanner = item.category === 'banner'
  const isProfilePic = item.category === 'profile_pic'
  // Profile card effects share the profile_pic category (they live in the
  // "Profile card effect" sub-tab under Profile Pics) but behave nothing
  // like a normal profile pic: the sheet shows only the static poster
  // (image_url), never an inline mockup, and "Preview" opens a full-screen
  // look at the real profile with the effect playing over it instead of
  // toggling a small mockup in place.
  const isCardEffect = item.sub_category === 'Profile card effect'
  const mockBannerSrc = isBanner ? (item.animated_url || item.image_url) : previewProfile?.banner
  const mockAvatarSrc = isProfilePic && !isCardEffect ? (item.animated_url || item.image_url) : previewProfile?.avatar
  // Card-effect thumb: static poster only. If an item has no poster (no
  // image_url), fall back to the video itself with no autoplay so the
  // browser just shows frame 1 — never the animated version here.
  const cardEffectPosterSrc = item.image_url || null
  const cardEffectPosterIsVideo = !item.image_url && !!item.animated_url && /\.(mp4|webm)$/i.test(item.animated_url)

  // ── Profile-pic-only: on-demand "preview on profile" toggle ──────────
  const [showPicPreview, setShowPicPreview] = useState(false)
  // ── Card-effect-only: full-screen "how it'll actually look" preview,
  // which draws up the real profile (via ProfileEffectPreview) instead of
  // the small in-sheet mockup other categories use. ──
  const [showEffectPreview, setShowEffectPreview] = useState(false)
  // ── Profile-pic-only: occasional nudge bubble pointing at the eye
  // toggle, reminding people it's there. Only fires some of the time (not
  // on every single view of a profile pic) and only until the person
  // actually taps preview or dismisses it. ──
  const [showPreviewNudge, setShowPreviewNudge] = useState(false)
  useEffect(() => {
    if (!isProfilePic || isCardEffect) return
    if (Math.random() > 0.35) return // fires roughly 1 in ~3 opens, not every time
    const showT = setTimeout(() => setShowPreviewNudge(true), 1100)
    const hideT = setTimeout(() => setShowPreviewNudge(false), 6500)
    return () => { clearTimeout(showT); clearTimeout(hideT) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, isProfilePic])

  // Check if user already owns this item
  useEffect(() => {
    if (!userId || !item.id) { setCheckingOwn(false); return }
    supabase.from('user_inventory').select('id').eq('user_id', userId).eq('item_id', item.id).maybeSingle()
      .then(({ data }) => { setAlreadyOwned(!!data); setCheckingOwn(false) })
  }, [userId, item.id])

  const isXpUnlock = item.price_gems == null && item.unlock_xp != null

  async function handleBuy() {
    if (!userId || buying || alreadyOwned) return
    if (!isXpUnlock && !canAfford) return
    setBuying(true)
    try {
      if (!isXpUnlock) {
        // Atomic, server-priced purchase: balance check, deduction, inventory
        // insert, and transaction log all happen in one DB transaction.
        const { error } = await supabase.rpc('purchase_mall_item', {
          p_user_id: userId,
          p_item_id: item.id,
        })
        if (error) {
          if (error.message === 'insufficient_funds') {
            alert('Purchase failed — not enough diamonds.')
          } else {
            console.error('purchase error:', error)
            alert('Purchase failed. Please try again.')
          }
          return
        }
      } else {
        // XP-unlock items have no cost to pay (the XP threshold check already
        // happened in getLockInfo), so just add to inventory directly.
        if (item.is_consumable) {
          const { data: existing } = await supabase
            .from('user_inventory').select('id, quantity').eq('user_id', userId).eq('item_id', item.id).maybeSingle()
          if (existing) {
            await supabase.from('user_inventory').update({ quantity: (existing.quantity ?? 1) + 1 }).eq('id', existing.id)
          } else {
            await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id, is_equipped: false, quantity: 1 })
          }
        } else {
          await supabase.from('user_inventory').insert({ user_id: userId, item_id: item.id, is_equipped: false, quantity: 1 })
        }
      }

      // Weekly missions: generic purchase counter + per-category tiers
      updateMissionProgress(userId, 'items_purchased', 1).catch(console.error)
      const categoryMetric: Partial<Record<MallItem['category'], string>> = {
        avatar_skin: 'avatar_skins_bought',
        chat_theme: 'chat_themes_bought',
        profile_pic: 'profile_pics_bought',
        xp_booster: 'xp_boosters_bought',
      }
      const catMetric = categoryMetric[item.category]
      if (catMetric) updateMissionProgress(userId, catMetric, 1).catch(console.error)

      onPurchased(item)
      onClose()
    } catch (err) {
      console.error('purchase error:', err)
      alert('Purchase failed. Please try again.')
    } finally {
      setBuying(false)
    }
  }

  const buyLabelBase = BUY_LABEL[item.category] ?? 'Buy'

  return (
    <>
    {/* Backdrop + sheet. When the effect preview opens, this whole thing
        slides down out of the way and stops accepting input — rather than
        staying mounted underneath the preview and fighting it for stacking
        order, it's just gone. It swings back up once the preview closes,
        since it was never unmounted, just parked below the viewport. */}
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        transform: showEffectPreview ? 'translateY(100%)' : 'translateY(0)',
        opacity: showEffectPreview ? 0 : 1,
        pointerEvents: showEffectPreview ? 'none' : 'auto',
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1), opacity 0.28s ease',
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '0 20px 24px', width: '100%', maxWidth: 460,
        border: '1px solid var(--border)', borderBottom: 'none', boxShadow: '0 -12px 40px -12px var(--sh)',
        position: 'relative', height: `${BUY_SHEET_HEIGHT_VH}vh`, overflowY: 'auto', overscrollBehavior: 'contain',
        display: 'flex', flexDirection: 'column', animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)', margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header: preview eye (profile pics only) + wishlist heart + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, margin: '14px 0', flexShrink: 0, position: 'relative' }}>
          {isProfilePic && !lock.locked && (
            <div style={{ position: 'relative', marginRight: 'auto' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isCardEffect) { setShowEffectPreview(true) } else { setShowPicPreview(v => !v) }
                  setShowPreviewNudge(false)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20,
                  background: (showPicPreview || showEffectPreview) ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'rgba(255,255,255,0.06)',
                  border: (showPicPreview || showEffectPreview) ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid transparent',
                  cursor: 'pointer', color: (showPicPreview || showEffectPreview) ? 'var(--accent)' : 'var(--text-dim)',
                  fontSize: 11.5, fontWeight: 700,
                }}
              >
                <Eye size={14} /> {isCardEffect ? 'Preview' : (showPicPreview ? 'Hide preview' : 'Preview')}
              </button>
              {/* Occasional nudge bubble — points at the preview button,
                  only shows some of the time, and disappears on its own or
                  the moment the person taps preview. */}
              {showPreviewNudge && (
                <div
                  onClick={(e) => { e.stopPropagation(); setShowPicPreview(true); setShowPreviewNudge(false) }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 5,
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12,
                    background: 'rgba(20,20,24,0.97)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                    boxShadow: 'var(--elev-raise)', cursor: 'pointer', whiteSpace: 'nowrap',
                    animation: 'feedIn 0.25s ease-out both',
                  }}
                >
                  <div style={{ position: 'absolute', top: -5, left: 16, width: 9, height: 9, background: 'rgba(20,20,24,0.97)', borderLeft: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderTop: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', transform: 'rotate(45deg)' }} />
                  <Sparkles size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Tap preview to see how it'll look</span>
                </div>
              )}
            </div>
          )}
          {onWishlist && !lock.locked && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onWishlist(item) }}
              style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: wishlisted ? '#ff4d8b' : 'var(--text-dim)' }}>
              <Heart size={14} style={{ fill: wishlisted ? '#ff4d8b' : 'none' }} />
            </button>
          )}
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <X size={14} />
          </button>
        </div>

        {isProfilePic ? (
          /* ── Profile pic: small standalone thumbnail by default. The
             full "how it'll look on your profile" mockup only appears
             once the person taps the eye/Preview toggle above — banners
             are the only category that auto-shows the full mockup. ── */
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: PIC_THUMB_SIZE, height: PIC_THUMB_SIZE, margin: '0 auto 14px', borderRadius: 22,
              overflow: 'hidden', background: 'var(--surface2)', border: '1px solid var(--border)',
              boxShadow: 'var(--elev-raise)',
            }}>
              {isCardEffect ? (
                cardEffectPosterSrc ? (
                  <img src={cardEffectPosterSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : cardEffectPosterIsVideo ? (
                  <video src={item.animated_url!} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null
              ) : mockAvatarSrc ? (
                /\.(mp4|webm)$/i.test(mockAvatarSrc) ? (
                  <video src={mockAvatarSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={mockAvatarSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : null}
            </div>

            {showPicPreview && !isCardEffect && (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)', minHeight: MOCK_TOTAL_H, animation: 'feedIn 0.25s ease-out both' }}>
                <div style={{ position: 'relative', width: '100%', height: MOCK_BANNER_H, background: 'var(--surface2)' }}>
                  {previewProfile?.banner ? (
                    /\.(mp4|webm)$/i.test(previewProfile.banner) ? (
                      <video src={previewProfile.banner} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={previewProfile.banner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,rgba(79,142,247,0.18),rgba(155,109,255,0.14))' }} />
                  )}
                </div>
                <div style={{ background: 'var(--surface)', padding: `${MOCK_AVATAR_SIZE / 2 + 8}px 14px 14px` }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewProfile?.displayName || 'You'}</div>
                  {previewProfile?.username && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>@{previewProfile.username}</div>
                  )}
                </div>
                <div style={{
                  position: 'absolute', left: 14, top: MOCK_BANNER_H - MOCK_AVATAR_SIZE / 2,
                  width: MOCK_AVATAR_SIZE, height: MOCK_AVATAR_SIZE, borderRadius: 16, padding: 2,
                  background: 'linear-gradient(135deg,var(--accent),#4f8ef7)', border: '3px solid var(--surface)',
                }}>
                  {mockAvatarSrc ? (
                    /\.(mp4|webm)$/i.test(mockAvatarSrc) ? (
                      <video src={mockAvatarSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img src={mockAvatarSrc} alt="" style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                    )
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: 12, background: 'var(--surface2)' }} />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : isBanner ? (
          /* ── Banner: previews automatically inside the profile-header
             mockup (this is the only category that does, since a banner
             IS the whole header). The avatar chip is positioned with
             `position: absolute`, not a negative margin — a negative
             margin on a child with no padding/border above it collapses
             with the parent's own margin and escapes upward, which is
             what was clipping the avatar against the banner before.
             Absolute positioning can't collapse, so it can't get clipped. ── */
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)', minHeight: MOCK_TOTAL_H }}>
            <div style={{ position: 'relative', width: '100%', height: MOCK_BANNER_H, background: 'var(--surface2)' }}>
              {mockBannerSrc ? (
                /\.(mp4|webm)$/i.test(mockBannerSrc) ? (
                  <video src={mockBannerSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={mockBannerSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,rgba(79,142,247,0.18),rgba(155,109,255,0.14))' }} />
              )}
            </div>
            <div style={{ background: 'var(--surface)', padding: `${MOCK_AVATAR_SIZE / 2 + 8}px 14px 14px` }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewProfile?.displayName || 'You'}</div>
              {previewProfile?.username && (
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>@{previewProfile.username}</div>
              )}
            </div>
            {/* Avatar overlapping the banner by half its own height —
                absolutely positioned relative to the mockup container so it
                always renders on top and can never be clipped by a
                collapsed margin. */}
            <div style={{
              position: 'absolute', left: 14, top: MOCK_BANNER_H - MOCK_AVATAR_SIZE / 2,
              width: MOCK_AVATAR_SIZE, height: MOCK_AVATAR_SIZE, borderRadius: 16, padding: 2,
              background: 'linear-gradient(135deg,var(--accent),#4f8ef7)', border: '3px solid var(--surface)',
            }}>
              {mockAvatarSrc ? (
                /\.(mp4|webm)$/i.test(mockAvatarSrc) ? (
                  <video src={mockAvatarSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <img src={mockAvatarSrc} alt="" style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                )
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: 12, background: 'var(--surface2)' }} />
              )}
            </div>
          </div>
        ) : (
          /* ── Avatar (and any other) items: no profile-header mockup —
             instead the WHOLE image is shown, shrunk down to fit inside
             the frame (objectFit: contain, not cover), so nothing gets
             cropped off the top/bottom/sides. Framed at MOCK_TOTAL_H so
             the sheet still lines up with the banner/profile-pic sheets. ── */
          <div style={{
            width: '100%', height: MOCK_TOTAL_H,
            borderRadius: 16, marginBottom: 16, overflow: 'hidden', background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
          }}>
            {item.animated_url ? (
              /\.(mp4|webm)$/i.test(item.animated_url) ? (
                <video
                  src={item.animated_url}
                  autoPlay loop muted playsInline
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                // gif (or any still-image fallback) — browsers animate gifs natively
                <img src={item.animated_url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              )
            ) : item.image_url ? (
              <img src={item.image_url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : null}
          </div>
        )}

        {item.sub_category && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 6 }}>
            {item.sub_category}
          </div>
        )}
        <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 6, color: 'var(--text)' }}>{item.name}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <RarityBadge rarity={item.rarity} />
        </div>
        {item.description && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6, marginBottom: 18 }}>
            {item.description}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 10 }}>
          Give your profile a distinct look
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 18 }}>
          <Users size={14} color="var(--text-dim)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            {ownerCount.toLocaleString()} {ownerCount === 1 ? 'person' : 'people'} already {item.is_consumable ? 'used' : 'have'} this
          </span>
        </div>

        {lock.locked ? (
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface2)', borderRadius: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={14} style={{ marginBottom: 4 }} /> {lock.reason}
          </div>
        ) : alreadyOwned && !item.is_consumable ? (
          <div style={{ textAlign: 'center', padding: 12, background: 'rgba(62,207,142,0.08)', borderRadius: 12, fontSize: 12, color: '#3ecf8e', fontWeight: 700, border: '1px solid rgba(62,207,142,0.2)' }}>
            ✓ Already in your inventory
          </div>
        ) : (
          <>
            {item.price_gems != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                💎 {item.price_gems.toLocaleString()} Diamonds
              </div>
            )}
            {isXpUnlock && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                <Zap size={15} color="#f5c542" /> {item.unlock_xp!.toLocaleString()} XP reached — free unlock
              </div>
            )}
            {item.price_gems != null && !canAfford && (
              <div style={{ fontSize: 11, color: '#ff6b6b', textAlign: 'center', marginBottom: 10 }}>
                Not enough Diamonds to buy this item.
              </div>
            )}
            <button
              disabled={checkingOwn || buying || (!isXpUnlock && !canAfford)}
              onClick={(e) => { ripple(e); handleBuy() }}
              className="ripple-wrap"
              style={{
                width: '100%', padding: 13, borderRadius: 14, border: 'none',
                cursor: buying || (!isXpUnlock && !canAfford) ? 'not-allowed' : 'pointer',
                background: buying || (!isXpUnlock && !canAfford) ? 'var(--surface3)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
                color: buying || (!isXpUnlock && !canAfford) ? 'var(--text-muted)' : '#fff',
                fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: buying || (!isXpUnlock && !canAfford) ? 'none' : '0 4px 16px color-mix(in srgb, var(--accent) 35%, transparent)',
                transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
              }}
            >
              <ShoppingBag size={14} /> {buying ? 'Buying…' : item.price_gems != null ? buyLabelBase : 'Unlock'}
            </button>
          </>
        )}
      </div>
    </div>

    {showEffectPreview && isCardEffect && userId && (
      <ProfileEffectPreview
        userId={userId}
        videoUrl={item.animated_url}
        onClose={() => setShowEffectPreview(false)}
      />
    )}
    </>
  )
}

/* ══════════════════════════════════════════════════════
   SUB-PAGE WRAPPER — inline back-button row, same pattern as Gift.tsx.
   (Previously this was a `position: fixed` full-viewport overlay with its
   own fixed header. That fought the app's own Topbar — which is ALSO
   `position: fixed; top: 0` — for the same strip of screen, so depending on
   stacking order the back arrow ended up hidden behind the "Mall" topbar
   instead of showing "Avatars"/"Profile Pics" above it. Gift.tsx never had
   this bug because its back button is just normal inline content that sits
   below the Topbar and scrolls with the page — so that's what we do here too.)
══════════════════════════════════════════════════════ */
function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', animation: 'feedIn 0.25s ease-out both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', boxShadow: 'var(--elev-raise-sm)', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PROFILE PICS SUB-PAGE
══════════════════════════════════════════════════════ */
// "Classic" covers every existing profile pic (sub_category is null on all
// of them). "Profile card effect" is the new tab holding the Discord-style
// animated effects — same pattern as the Avatar sub-tabs below.
const PROFILE_PIC_SUB_CATEGORIES = ['Classic', 'Profile card effect']

function ProfilePicsPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const [activeTab, setActiveTab] = useState(PROFILE_PIC_SUB_CATEGORIES[0])
  const profilePics = items.filter(i => i.category === 'profile_pic' && (activeTab === 'Classic' ? !i.sub_category : i.sub_category === activeTab))

  return (
    <SubPage title="Profile Pics" onBack={onBack}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto' }}>
        {PROFILE_PIC_SUB_CATEGORIES.map(tab => (
          <button
            key={tab}
            onClick={(e) => { ripple(e); setActiveTab(tab) }}
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

      {profilePics.length === 0 ? (
        <EmptyState label={`No items in "${activeTab}" yet.`} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {profilePics.map(item => <SquareCard key={item.id} item={item} onSelect={onSelect} onWishlist={onWishlist} wishlisted={wishlisted?.has(item.id)} likeCount={likeCounts?.[item.id] ?? 0} compact />)}
        </div>
      )}
    </SubPage>
  )
}

/* ══════════════════════════════════════════════════════
   AVATARS SUB-PAGE — with sub-category tabs
══════════════════════════════════════════════════════ */
const AVATAR_SUB_CATEGORIES = ['Models and brand', 'Others', 'Power up characters', 'Animated Characters']

function AvatarsPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const [activeTab, setActiveTab] = useState(AVATAR_SUB_CATEGORIES[0])
  const avatars = items.filter(i => i.category === 'avatar_skin' && i.sub_category === activeTab)

  return (
    <SubPage title="Avatars" onBack={onBack}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto' }}>
        {AVATAR_SUB_CATEGORIES.map(tab => (
          <button
            key={tab}
            onClick={(e) => { ripple(e); setActiveTab(tab) }}
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

function BannersPage({ items, onBack, onSelect, onWishlist, wishlisted, likeCounts }: { items: MallItem[]; onBack: () => void; onSelect: (item: MallItem) => void; onWishlist?: (item: MallItem) => void; wishlisted?: Set<string>; likeCounts?: Record<string, number> }) {
  const banners = items.filter(i => i.sub_category === 'album' || i.category === 'banner')
  return (
    <SubPage title="Banners" onBack={onBack}>
      {banners.length === 0 ? (
        <EmptyState label="No banners available yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {banners.map(item => <BannerCard key={item.id} item={item} onSelect={onSelect} onWishlist={onWishlist} wishlisted={wishlisted?.has(item.id)} likeCount={likeCounts?.[item.id] ?? 0} />)}
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
  { id: 'profile_pics', label: 'Profile Pics', sub: 'Square cards, no sub-categories', Icon: ImageIcon, iconBg: 'rgba(79,142,247,0.15)',  iconColor: '#4f8ef7' },
  { id: 'avatars',      label: 'Avatars',      sub: 'Models, Others, Power up',        Icon: Shirt,     iconBg: 'rgba(255,77,139,0.15)', iconColor: '#ff4d8b' },
  { id: 'consumables',  label: 'Consumables',  sub: 'XP boosters and more',             Icon: Zap,       iconBg: 'rgba(245,197,66,0.15)', iconColor: '#f5c542' },
  { id: 'banners',      label: 'Banners',       sub: 'Profile banner images',            Icon: ImageIcon, iconBg: 'rgba(155,109,255,0.15)', iconColor: '#9b6dff' },
] as const

/* ══════════════════════════════════════════════════════
   MAIN MALL PAGE
══════════════════════════════════════════════════════ */
export default function Mall() {
  const navigate = useNavigate()
  const { items, loading: itemsLoading } = useMallItems()
  const { wallet, refetch: refetchWallet } = useWallet()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { profile } = useProfile()
  const isPro = isProActive(profile)
  const userXp = profile?.xp ?? 0
  const { isEnabled: isMallFlagEnabled, loading: mallFlagLoading } = useFeatureFlags()
  const { isStaff: mallIsStaff } = useModRole()
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MallItem | null>(null)
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [ownerCounts, setOwnerCounts] = useState<Record<string, number>>({})
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

  // Load "how many people own this" counts, same polling pattern as likes
  useEffect(() => {
    if (!items.length) return
    async function loadOwnerCounts() {
      const { data } = await supabase.from('item_owner_counts').select('item_id, count')
      if (!data) return
      const counts: Record<string, number> = {}
      for (const row of data) {
        counts[row.item_id as string] = row.count as number
      }
      setOwnerCounts(counts)
    }
    loadOwnerCounts()
    const poll = setInterval(loadOwnerCounts, 30_000)
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
    // Weekly mission: wishlist_adds
    if (userId) updateMissionProgress(userId, 'wishlist_adds', 1).catch(console.error)
  }, [userId, wishlisted])

  // Featured: 3 items picked pseudo-randomly, rotating every 2 days
  // Seed changes every 2 days so the same 3 show for all users that day
  const featured = useMemo(() => {
    if (!items.length) return []
    const twoDayEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 2))
    // Simple seeded shuffle — deterministic for the same epoch
    const seeded = [...items].sort((a, b) => {
      const ha = (a.id + twoDayEpoch).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      const hb = (b.id + twoDayEpoch).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      return ha - hb
    })
    return seeded.slice(0, 3)
  }, [items])

  if (!mallFlagLoading && !isMallFlagEnabled('system:mall') && !mallIsStaff) {
    return (
      <FeatureGateScreen
        title="Mall is temporarily unavailable"
        message="An admin has paused the Mall for maintenance. The rest of Chillverse is still open — check back soon."
      />
    )
  }

  return (
    <MallProContext.Provider value={isPro}>
    <MallXpContext.Provider value={userXp}>
    <PageOnboarding pageKey="mall" />
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>

      {!openSection && (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Topbar row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}>
            <ArrowLeft size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)', padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            💎 {diamondBalance.toLocaleString()} Diamonds
          </div>
        </div>

        {/* Buy Diamonds row */}
        <div
          onClick={(e) => { ripple(e); navigate('/buy-diamonds') }}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)',
            border: '1px solid rgba(79,142,247,0.25)', borderRadius: 18, padding: 16, marginBottom: 20,
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
            boxShadow: 'var(--elev-raise)',
            animation: 'feedIn 0.35s ease-out both',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(79,142,247,0.06),rgba(155,109,255,0.04))', pointerEvents: 'none' }} />
          <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(79,142,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f8ef7', boxShadow: 'var(--elev-raise-sm)' }}>
            💎
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
              display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, padding: 16, marginBottom: 11, cursor: 'pointer',
              boxShadow: 'var(--elev-raise)',
              animation: 'feedIn 0.35s ease-out both', animationDelay: `${i * 0.05}s`,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: section.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.iconColor, boxShadow: 'var(--elev-raise-sm)' }}>
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

        {/* Featured — 3 items, rotates every 2 days */}
        {featured.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>Featured</div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
              {featured.map(item => (
                <div
                  key={item.id}
                  onClick={(e) => { ripple(e); setSelectedItem(item) }}
                  className="ripple-wrap"
                  style={{
                    flex: '0 0 auto', width: 200, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                    borderRadius: 18, padding: 14, cursor: 'pointer',
                    boxShadow: 'var(--elev-raise)',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,var(--accent),#f5c542)', color: '#1a1108', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                    <Star size={10} /> Featured
                  </div>
                  <CardThumb item={item} style={{ width: '100%', height: 90, borderRadius: 13, marginBottom: 10, overflow: 'hidden' }} />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{item.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <RarityBadge rarity={item.rarity} />
                    {item.price_gems != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                        💎 {item.price_gems.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Sub-pages */}
      {openSection === 'profile_pics' && <ProfilePicsPage items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}
      {openSection === 'avatars'      && <AvatarsPage      items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}
      {openSection === 'consumables'  && <ConsumablesPage  items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}
      {openSection === 'banners'      && <BannersPage       items={items} onBack={() => setOpenSection(null)} onSelect={setSelectedItem} onWishlist={handleWishlist} wishlisted={wishlisted} likeCounts={likeCounts} />}

      {/* Detail / confirm modal */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          walletBalance={diamondBalance}
          userId={userId}
          onClose={() => setSelectedItem(null)}
          onWishlist={handleWishlist}
          wishlisted={wishlisted.has(selectedItem.id)}
          previewProfile={profile ? { avatar: profile.avatar, displayName: profile.display_name ?? profile.username, username: profile.username, banner: profile.banner_url } : null}
          ownerCount={ownerCounts[selectedItem.id] ?? 0}
          onPurchased={(item) => {
            setPurchaseToast(`${item.name} added to your inventory!`)
            setWishlisted(prev => {
              if (!prev.has(item.id)) return prev
              const next = new Set(prev)
              next.delete(item.id)
              return next
            })
            refetchWallet?.()
          }}
        />
      )}
      {purchaseToast && <PurchaseToast message={purchaseToast} onDone={() => setPurchaseToast(null)} />}

      {/* Wishlist toast */}
      {toast && <WishlistToast message={toast} onDone={() => setToast(null)} />}
    </MallXpContext.Provider>
    </MallProContext.Provider>
  )
}
