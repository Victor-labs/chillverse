// src/features/economy/SendGiftModal.tsx
//
// Full-screen "Send a gift" page, opened when a viewer taps an item on
// another player's wishlist (from PlayerProfile.tsx or ProfilePreviewModal.tsx).
// This REPLACES the old standalone /gift page — there is no more Gift Shop
// route, no recipient search, and no "add message" field. The recipient is
// always the wishlist owner and the item is always the tapped wishlist item.
//
// Flow: tap wishlist item -> this drops in full screen -> tap "Buy Gift" ->
// diamonds deducted, page closes, caller shows a "Gift sent" toast.

import { useEffect, useState } from 'react'
import { X, Gift as GiftIcon, AlertCircle, Sparkles } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useWallet } from './useWallet'
import { triggerAchievementCheck } from '../achievements/triggerAchievements'
import { updateMissionProgress } from '../missions/weeklyMissions'
import Logo from '../../layout/Logo'
import SharedAvatar from '../../shared/components/Avatar'
import type { MallRarity } from '../../shared/types'

// Same promo art used across the app's gift-related surfaces.
const CARD_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Pics/erasebg-transformed%20(2).png'

const RARITY_META: Record<MallRarity, { color: string; bg: string }> = {
  Common: { color: '#888899', bg: 'rgba(136,136,153,0.14)' },
  Rare:   { color: '#4f8ef7', bg: 'rgba(79,142,247,0.14)'  },
  Epic:   { color: '#9b6dff', bg: 'rgba(155,109,255,0.14)' },
  Mythic: { color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 14%, transparent)'   },
}

const BLESSED_HANDS_GOAL = 5

export type GiftSendResult = 'success' | 'already_owned' | 'insufficient' | 'network_error' | 'unavailable'

/** Shared toast copy for a finished gift attempt — used by every screen that renders SendGiftModal. */
export function giftResultMessage(result: GiftSendResult, recipientName: string): string {
  switch (result) {
    case 'success':        return `Gift sent to ${recipientName}! 🎁`
    case 'already_owned':  return `${recipientName} already owns this item.`
    case 'insufficient':   return 'Not enough diamonds for this gift.'
    case 'unavailable':    return 'This item is no longer available.'
    default:                return 'Network error. Please try again.'
  }
}

interface WishlistGiftTarget {
  /** wishlist row's item_id — the row in mall_items this points to, if known */
  itemId: string | null
  /** fallback display name, used while the mall item loads and if lookup fails */
  itemName: string
  /** fallback image, used while the mall item loads */
  itemImage: string | null
}

interface ResolvedItem {
  id: string
  name: string
  image_url: string | null
  price_gems: number
  rarity: MallRarity
}

export default function SendGiftModal({
  recipientId,
  recipientName,
  recipientAvatar,
  target,
  onClose,
  onSent,
}: {
  recipientId: string
  recipientName: string
  recipientAvatar: string | null
  target: WishlistGiftTarget
  onClose: () => void
  onSent: (result: GiftSendResult, recipientName: string) => void
}) {
  const { user } = useAuth()
  const { wallet, refetch: refetchWallet } = useWallet()
  const [senderName, setSenderName] = useState('Someone')
  const [item, setItem] = useState<ResolvedItem | null>(null)
  const [itemLoading, setItemLoading] = useState(true)
  const [itemUnavailable, setItemUnavailable] = useState(false)
  const [giftsSent, setGiftsSent] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  // Lock page scroll while this full-screen page is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  // Load the sender's display name (for the achievement notification / RPC).
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) setSenderName(data.display_name || data.username || 'Someone')
    })
  }, [user])

  // Resolve the live mall_items row (price, rarity, current image) for the
  // tapped wishlist item — the wishlist table only stores a name/image
  // snapshot, so we always look up the authoritative item before charging.
  useEffect(() => {
    let active = true
    setItemLoading(true)
    setItemUnavailable(false)

    const query = target.itemId
      ? supabase.from('mall_items').select('id, name, image_url, price_gems, rarity, is_active').eq('id', target.itemId).maybeSingle()
      : supabase.from('mall_items').select('id, name, image_url, price_gems, rarity, is_active').ilike('name', target.itemName).limit(1).maybeSingle()

    query.then(({ data }) => {
      if (!active) return
      if (!data || data.is_active === false || data.price_gems == null) {
        setItemUnavailable(true)
        setItemLoading(false)
        return
      }
      setItem({
        id: data.id,
        name: data.name,
        image_url: data.image_url,
        price_gems: data.price_gems,
        rarity: data.rarity as MallRarity,
      })
      setItemLoading(false)
    })

    return () => { active = false }
  }, [target.itemId, target.itemName])

  // Gift progress toward the "Blessed Hands" achievement (gift 5 users).
  useEffect(() => {
    if (!user) return
    let active = true
    supabase.from('gifts').select('*', { count: 'exact', head: true }).eq('sender_id', user.id).then(({ count }) => {
      if (active) setGiftsSent(count ?? 0)
    })
    return () => { active = false }
  }, [user])

  const price = item?.price_gems ?? 0
  const canAfford = (wallet?.gem_balance ?? 0) >= price
  const progressCount = Math.min(giftsSent ?? 0, BLESSED_HANDS_GOAL)
  const rarityMeta = item ? RARITY_META[item.rarity] : RARITY_META.Common

  async function handleBuyGift() {
    if (!item || !user || sending || !canAfford) return
    setSending(true)

    const { error: giftErr } = await supabase.rpc('send_gift', {
      p_recipient_id: recipientId,
      p_item_id:      item.id,
      p_item_name:    item.name,
      p_sender_name:  senderName,
      p_price:        price,
    })

    setSending(false)

    if (giftErr) {
      console.error('send_gift error:', giftErr)
      if (giftErr.message?.includes('already owns')) {
        onClose(); onSent('already_owned', recipientName)
      } else if (giftErr.message?.includes('Insufficient')) {
        onClose(); onSent('insufficient', recipientName)
      } else {
        onClose(); onSent('network_error', recipientName)
      }
      return
    }

    refetchWallet()
    if (user) triggerAchievementCheck(user.id).catch(console.error)
    if (user) updateMissionProgress(user.id, 'gifts_sent', 1).catch(console.error)
    onClose()
    onSent('success', recipientName)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'giftPageIn 0.22s ease-out both' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 8px', flexShrink: 0 }}>
        <button type="button" onClick={onClose}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)', marginRight: 34 }}>Send a gift</h1>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto' }}>

        {/* Promo card */}
        <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', marginBottom: 24, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)' }}>
          <img src={CARD_IMG} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(14,14,18,0.72)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '6px 11px 6px 8px', boxShadow: 'var(--elev-raise)' }}>
            <Logo size={16} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>ChillVerse</span>
          </div>
        </div>

        {/* Send To */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Send To</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
          <SharedAvatar src={recipientAvatar} name={recipientName} size={34} radius={10} disabled />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{recipientName}</span>
        </div>

        {/* Item */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Your Gift</div>
        {itemLoading ? (
          <div style={{ height: 66, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }} />
        ) : itemUnavailable || !item ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, fontWeight: 600, marginBottom: 20 }}>
            <AlertCircle size={14} /> This item is no longer available to gift.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} style={{ width: 46, height: 46, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: 11, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GiftIcon size={20} color="var(--text-muted)" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: rarityMeta.bg, color: rarityMeta.color }}>{item.rarity}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>💎 {price}</span>
          </div>
        )}

        {!itemLoading && item && !canAfford && (
          <div style={{ fontSize: 11.5, color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: 5, marginTop: -10, marginBottom: 20 }}>
            <AlertCircle size={12} /> Not enough diamonds (need {price}, have {wallet?.gem_balance ?? 0})
          </div>
        )}

        {/* Achievement progress info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.2)' }}>
          <Sparkles size={16} color="#9b6dff" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', lineHeight: 1.4 }}>
            {progressCount >= BLESSED_HANDS_GOAL
              ? "You've unlocked the Blessed Hands achievement 🙌"
              : <>Gift <strong style={{ color: 'var(--text)' }}>{progressCount}/{BLESSED_HANDS_GOAL}</strong> users to collect the Blessed Hands achievement</>}
          </span>
        </div>
      </div>

      {/* Buy Gift */}
      <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', flexShrink: 0, maxWidth: 480, width: '100%', margin: '0 auto', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={(e) => { ripple(e); handleBuyGift() }}
          disabled={!item || itemUnavailable || !canAfford || sending}
          className="ripple-wrap"
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            cursor: !item || itemUnavailable || !canAfford || sending ? 'not-allowed' : 'pointer',
            background: !item || itemUnavailable || !canAfford || sending ? 'var(--surface3)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
            color: !item || itemUnavailable || !canAfford || sending ? 'var(--text-muted)' : '#fff',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: item && !itemUnavailable && canAfford && !sending ? '0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none',
            transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
          }}>
          {sending ? (
            <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Sending…</>
          ) : (
            <><GiftIcon size={16} /> Buy Gift{item ? ` for ${price} 💎` : ''}</>
          )}
        </button>
      </div>

      <style>{`
        @keyframes giftPageIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
