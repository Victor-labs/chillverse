// src/pages/Gift.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gift, X, Search, Check, AlertCircle, WifiOff, User } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useWallet } from './useWallet'
import { useMallItems } from './useMallItems'
import type { MallItem, MallRarity } from '../../shared/types'
import PageOnboarding from '../onboarding/PageOnboarding'

const SEND_IMG   = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/e0cda9106501f1ad6c3c37ff5c1cbe98.jpg'
const RECV_IMG   = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/0eda2173d4487db6bf6c7868e62a00a3.webp.jpg'

// ─── Rarity ───────────────────────────────────────────────────
const RARITY_META: Record<MallRarity, { color: string; bg: string }> = {
  Common: { color: '#888899', bg: 'rgba(136,136,153,0.14)' },
  Rare:   { color: '#4f8ef7', bg: 'rgba(79,142,247,0.14)'  },
  Epic:   { color: '#9b6dff', bg: 'rgba(155,109,255,0.14)' },
  Mythic: { color: '#ff6b00', bg: 'rgba(255,107,0,0.14)'   },
}

// ─── Recipient search ───────────────────────────────────────────
interface SearchedUser {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
}

function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string | null; size?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','#ff9a3c','#00e5ff']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.32, background:color, color:'#fff', fontWeight:700, fontSize:size*0.4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
      {avatar && avatar.startsWith('http')
        ? <img src={avatar} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : (name || '?').charAt(0).toUpperCase()
      }
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────
type ToastKind = 'success' | 'error' | 'warn'
interface ToastState { msg: string; kind: ToastKind }

function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [toast])
  const colors: Record<ToastKind, { bg: string; border: string; icon: React.ReactNode }> = {
    success: { bg: 'rgba(20,20,24,0.96)', border: 'rgba(62,207,142,0.4)',  icon: <Check size={14} color="#3ecf8e" /> },
    error:   { bg: 'rgba(20,20,24,0.96)', border: 'rgba(255,107,107,0.4)', icon: <AlertCircle size={14} color="#ff6b6b" /> },
    warn:    { bg: 'rgba(20,20,24,0.96)', border: 'rgba(245,197,66,0.4)',  icon: <WifiOff size={14} color="#f5c542" /> },
  }
  const c = colors[toast.kind]
  return (
    <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', zIndex:9999, background:c.bg, border:`1px solid ${c.border}`, borderRadius:14, padding:'11px 18px', display:'flex', alignItems:'center', gap:9, boxShadow:'0 8px 32px rgba(0,0,0,0.55)', backdropFilter:'blur(10px)', animation:'feedIn 0.25s ease-out both', whiteSpace:'nowrap' }}>
      {c.icon}
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{toast.msg}</span>
    </div>
  )
}

// ─── Send Gift Modal ──────────────────────────────────────────
function SendModal({ item, senderName, onClose, onSent }: {
  item: MallItem
  senderName: string
  onClose: () => void
  onSent: (recipient: string) => void
}) {
  const { user } = useAuth()
  const { wallet } = useWallet()
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState<SearchedUser | null>(null)
  const [results, setResults]   = useState<SearchedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending]   = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const price = item.price_gems ?? 0
  const canAfford = (wallet?.gem_balance ?? 0) >= price
  const hasValidPick = !!selected && (
    selected.username.toLowerCase() === query.trim().toLowerCase() ||
    (selected.display_name ?? '').toLowerCase() === query.trim().toLowerCase()
  )

  function onQueryChange(value: string) {
    setQuery(value)
    if (selected) {
      const v = value.trim().toLowerCase()
      const matchesUsername = selected.username.toLowerCase() === v
      const matchesDisplay = (selected.display_name ?? '').toLowerCase() === v
      if (!matchesUsername && !matchesDisplay) setSelected(null)
    }
    setResults([])
  }

  // Live search on `profiles.username`, case-insensitive
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = query.trim()
    if (!q || hasValidPick) { setResults([]); setSearching(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6)
      setResults((data as SearchedUser[]) ?? [])
      setSearching(false)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, hasValidPick])

  function pickUser(u: SearchedUser) {
    setSelected(u)
    setQuery(u.display_name || u.username)
    setResults([])
  }

  async function handleGift() {
    if (!hasValidPick || !selected || !user || sending) return
    setSending(true)

    if (selected.id === user.id) {
      setSending(false)
      onSent('__self__')
      return
    }

    // Whole gift transaction (wallet deduction, inventory credit,
    // gift record, notification) runs server-side via RPC so it isn't
    // blocked by `user_inventory` RLS (which only allows a user to
    // insert rows for themselves — the sender can't write directly into
    // the recipient's inventory). See migration 0005_gift_rpc_and_wishlist_cleanup.sql.
    const { error: giftErr } = await supabase.rpc('send_gift', {
      p_recipient_id: selected.id,
      p_item_id:      item.id,
      p_item_name:    item.name,
      p_sender_name:  senderName,
      p_price:        price,
    })

    setSending(false)

    if (giftErr) {
      console.error('send_gift error:', giftErr)
      if (giftErr.message?.includes('already owns')) {
        onSent('__already_owned__')
      } else if (giftErr.message?.includes('Insufficient')) {
        onSent('__insufficient__')
      } else {
        onSent('__network_error__')
      }
      return
    }

    onSent(selected.display_name || selected.username)
  }

  const rarityMeta = RARITY_META[item.rarity]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeIn 0.2s ease both' }}>

      <div style={{ width:'100%', maxWidth:360, background:'var(--surface2)', borderRadius:24, border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 24px 80px rgba(0,0,0,0.7)', overflow:'visible', position:'relative', animation:'popIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both' }}>

        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute', top:14, right:14, width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'none', cursor:'pointer', color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
          <X size={13} />
        </button>

        {/* Big box — promo image area */}
        <div style={{ position:'relative', height:200, borderRadius:'24px 24px 0 0', overflow:'visible', background:'linear-gradient(160deg,rgba(255,107,0,0.12),rgba(155,109,255,0.08))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {/* background blurred img */}
          <div style={{ position:'absolute', inset:0, borderRadius:'24px 24px 0 0', overflow:'hidden' }}>
            <img src={SEND_IMG} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.18, filter:'blur(4px)', transform:'scale(1.1)' }} />
          </div>
          {/* character cutout — overflows box slightly */}
          <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:160, height:220, zIndex:5 }}>
            <img
              src={SEND_IMG}
              alt="Gift character"
              style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', borderRadius:16, boxShadow:'0 12px 40px rgba(0,0,0,0.45)', filter:'drop-shadow(0 8px 24px rgba(255,107,0,0.3))' }}
            />
          </div>
          {/* item badge */}
          <div style={{ position:'absolute', top:14, left:16, background:'var(--surface)', borderRadius:10, padding:'5px 10px', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 12px rgba(0,0,0,0.4)', zIndex:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>💎 {price}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:'28px 20px 22px' }}>
          {/* Item info */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, background:'var(--surface)', borderRadius:14, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.06)' }}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} style={{ width:44, height:44, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
            ) : (
              <div style={{ width:44, height:44, borderRadius:10, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Gift size={20} color="var(--text-muted)" />
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{item.name}</div>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:7, background:rarityMeta.bg, color:rarityMeta.color }}>{item.rarity}</span>
            </div>
          </div>

          {/* Recipient search */}
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>Recipient</div>
          <div style={{ position:'relative', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 13px', boxShadow:'inset 2px 2px 6px var(--neu-dark)' }}>
              {hasValidPick ? <Check size={14} color="#3ecf8e" style={{ flexShrink:0 }} /> : <User size={14} color="var(--text-muted)" style={{ flexShrink:0 }} />}
              <input
                type="text"
                placeholder="Search by username…"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && hasValidPick) handleGift() }}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13.5, color:'var(--text)', fontFamily:'inherit' }}
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); setSelected(null); setResults([]) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex', flexShrink:0 }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Live results dropdown */}
            {query.trim() && !hasValidPick && (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:20, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:14, boxShadow:'0 16px 40px rgba(0,0,0,0.55)', maxHeight:220, overflowY:'auto' }}>
                {searching ? (
                  <div style={{ display:'flex', justifyContent:'center', padding:14 }}>
                    <span style={{ width:18, height:18, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                  </div>
                ) : results.length === 0 ? (
                  <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>No players found</div>
                ) : (
                  results.map(u => (
                    <button key={u.id} type="button" onClick={() => pickUser(u)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      <Avatar name={u.display_name || u.username} avatar={u.avatar} size={30} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.display_name || u.username}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{u.username}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Balance warning */}
          {!canAfford && (
            <div style={{ fontSize:11, color:'#ff6b6b', display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
              <AlertCircle size={12} /> Not enough diamonds (need {price}, have {wallet?.gem_balance ?? 0})
            </div>
          )}

          {/* Gift button */}
          <button
            onClick={(e) => { ripple(e); handleGift() }}
            disabled={!hasValidPick || !canAfford || sending}
            className="ripple-wrap"
            style={{ width:'100%', padding:'13px', borderRadius:14, border:'none', cursor: !hasValidPick || !canAfford || sending ? 'not-allowed' : 'pointer', background: !hasValidPick || !canAfford || sending ? 'var(--surface3)' : 'linear-gradient(135deg,var(--accent),#ff9a3c)', color: !hasValidPick || !canAfford || sending ? 'var(--text-muted)' : '#fff', fontSize:14, fontWeight:800, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: hasValidPick && canAfford && !sending ? '0 4px 20px rgba(255,107,0,0.35)' : 'none', transition:'all 0.2s', marginTop:4 }}>
            {sending ? (
              <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} /> Sending…</>
            ) : (
              <><Gift size={15} /> Gift for {price} 💎</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Receive Modal ────────────────────────────────────────────
function ReceiveModal({ itemName, senderName, onClose }: { itemName: string; senderName: string; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeIn 0.2s ease both' }}>
      <div style={{ width:'100%', maxWidth:340, background:'var(--surface2)', borderRadius:24, border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 24px 80px rgba(0,0,0,0.7)', overflow:'visible', position:'relative', animation:'popIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        {/* Big box image */}
        <div style={{ position:'relative', height:180, borderRadius:'24px 24px 0 0', overflow:'visible', background:'linear-gradient(160deg,rgba(62,207,142,0.12),rgba(79,142,247,0.08))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'24px 24px 0 0', overflow:'hidden' }}>
            <img src={RECV_IMG} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.18, filter:'blur(4px)', transform:'scale(1.1)' }} />
          </div>
          <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:140, height:200, zIndex:5 }}>
            <img src={RECV_IMG} alt="Gift received" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', borderRadius:14, boxShadow:'0 12px 40px rgba(0,0,0,0.45)', filter:'drop-shadow(0 8px 24px rgba(62,207,142,0.3))' }} />
          </div>
          {/* confetti dots */}
          {['#ff6b00','#3ecf8e','#f5c542','#9b6dff','#4f8ef7'].map((c,i) => (
            <div key={i} style={{ position:'absolute', width:8, height:8, borderRadius:'50%', background:c, left:`${15+i*18}%`, top:`${20+((i%3)*20)}%`, animation:`confetti 1.8s ease-in-out ${i*0.15}s infinite`, opacity:0.7 }} />
          ))}
        </div>

        <div style={{ padding:'28px 20px 22px', textAlign:'center' }}>
          <div style={{ fontSize:22, marginBottom:8 }}>🎁</div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:6 }}>You received a gift!</div>
          <div style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.6, marginBottom:20 }}>
            <span style={{ color:'var(--text)' }}>{senderName}</span> gifted you <span style={{ color:'var(--accent)', fontWeight:700 }}>"{itemName}"</span>. It's now in your inventory.
          </div>
          <button
            onClick={(e) => { ripple(e); onClose() }}
            className="ripple-wrap"
            style={{ width:'100%', padding:13, borderRadius:14, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#3ecf8e,#4f8ef7)', color:'#fff', fontSize:14, fontWeight:800, fontFamily:'inherit', boxShadow:'0 4px 20px rgba(62,207,142,0.35)' }}>
            Confirm ✓
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────
function GiftCard({ item, onSelect }: { item: MallItem; onSelect: () => void }) {
  const meta = RARITY_META[item.rarity]
  return (
    <div onClick={(e) => { ripple(e); onSelect() }} className="ripple-wrap"
      style={{ background:'var(--surface)', border: item.rarity === 'Mythic' ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)', borderRadius:16, padding:12, cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
      {item.rarity === 'Mythic' && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,107,0,0.04),rgba(245,197,66,0.04))', pointerEvents:'none' }} />}
      <div style={{ width:'100%', aspectRatio:'1', borderRadius:10, overflow:'hidden', marginBottom:10, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <Gift size={32} color="var(--text-muted)" />
        )}
      </div>
      <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 6px', borderRadius:7, background:meta.bg, color:meta.color }}>{item.rarity}</span>
        <span style={{ fontSize:11.5, fontWeight:700, color:'var(--text-dim)', display:'flex', alignItems:'center', gap:3 }}>
          💎 {item.price_gems ?? 0}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function GiftPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { wallet } = useWallet()
  const { items, loading } = useMallItems()
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<MallItem | null>(null)
  const [toast, setToast]           = useState<ToastState | null>(null)
  const [receiveModal, setReceiveModal] = useState<{ itemName: string; senderName: string } | null>(null)
  const [senderName, setSenderName] = useState('Someone')

  // Load sender display name
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) setSenderName(data.display_name || data.username || 'Someone')
    })
  }, [user])

  // Check for pending received gifts on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('gifts')
      .select('*, mall_items(name, image_url)')
      .eq('recipient_id', user.id)
      .eq('status', 'delivered')
      .eq('notified', false)
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        // Mark as notified
        await supabase.from('gifts').update({ notified: true }).eq('id', data.id)
        setReceiveModal({ itemName: data.item_name, senderName: 'A friend' })
      })
  }, [user])

  // Only avatar_skin and profile_pic, non-consumable
  const giftable = items.filter(i =>
    (i.category === 'avatar_skin' || i.category === 'profile_pic') &&
    !i.is_consumable &&
    i.price_gems != null &&
    i.price_gems > 0
  )

  const filtered = search
    ? giftable.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : giftable

  function handleSent(result: string) {
    setSelected(null)
    if (result === '__not_found__') {
      setToast({ msg: 'User not found. Check the username.', kind: 'error' })
    } else if (result === '__network_error__') {
      setToast({ msg: 'Network error. Please try again.', kind: 'warn' })
    } else if (result === '__self__') {
      setToast({ msg: "You can't gift yourself 😅", kind: 'error' })
    } else if (result === '__already_owned__') {
      setToast({ msg: 'That player already owns this item.', kind: 'error' })
    } else if (result === '__insufficient__') {
      setToast({ msg: 'Not enough diamonds for this gift.', kind: 'error' })
    } else {
      setToast({ msg: `Gift sent to ${result}! 🎁`, kind: 'success' })
    }
  }

  return (
    <>
      <PageOnboarding pageKey="gift" />
      <div style={{ maxWidth:800, margin:'0 auto', paddingBottom:48 }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button type="button" onClick={() => navigate(-1)} style={{ width:36, height:36, borderRadius:10, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.07)', boxShadow:'2px 2px 6px var(--neu-dark)', color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <ArrowLeft size={15} />
          </button>
          <h1 style={{ fontSize:20, fontWeight:800, color:'var(--text)', flex:1 }}>Gift Shop</h1>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'6px 12px', boxShadow:'2px 2px 6px var(--neu-dark)' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>💎 {wallet?.gem_balance ?? 0}</span>
          </div>
        </div>

        {/* Hero */}
        <div className="neu-card" style={{ padding:'18px 20px', marginBottom:20, background:'linear-gradient(135deg,rgba(255,107,0,0.08),rgba(155,109,255,0.06))', border:'1px solid rgba(255,107,0,0.15)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,107,0,0.12),transparent 70%)', pointerEvents:'none' }} />
          <div style={{ fontSize:22, marginBottom:4 }}>🎁</div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 }}>Send a gift to a friend</div>
          <div style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>Browse avatars and profile pics below. Tap any item to gift it directly to another player.</div>
        </div>

        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:13, padding:'9px 14px', marginBottom:18, boxShadow:'inset 2px 2px 6px var(--neu-dark)' }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search gifts…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13.5, color:'var(--text)', fontFamily:'inherit' }} />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <span style={{ width:32, height:32, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-muted)', fontSize:14 }}>
            {search ? 'No items match your search.' : 'No giftable items available yet.'}
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} available
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
              {filtered.map(item => (
                <GiftCard key={item.id} item={item} onSelect={() => setSelected(item)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Send modal */}
      {selected && (
        <SendModal item={selected} senderName={senderName} onClose={() => setSelected(null)} onSent={handleSent} />
      )}

      {/* Receive modal */}
      {receiveModal && (
        <ReceiveModal itemName={receiveModal.itemName} senderName={receiveModal.senderName} onClose={() => setReceiveModal(null)} />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes popIn    { from{opacity:0;transform:scale(0.82) translateY(30px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes feedIn   { from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes confetti { 0%,100%{transform:translateY(0) scale(1);opacity:0.7} 50%{transform:translateY(-10px) scale(1.2);opacity:1} }
      `}</style>
    </>
  )
}
