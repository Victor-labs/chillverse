// src/pages/Profile.tsx
import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Settings, Edit3, Users, UserPlus,
  Zap, Flame, Sprout, Shield, Moon, Crown, Sword,
  Gamepad2, Trophy, X, Check, Search, Heart,
  ImageIcon, Package,
} from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { ripple } from '../lib/ripple'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

const RANKS = [
  { min: 0,      max: 999,      title: 'Newcomer', color: '#888899' },
  { min: 1000,   max: 4999,     title: 'Scout',    color: '#3ecf8e' },
  { min: 5000,   max: 9999,     title: 'Warrior',  color: '#4f8ef7' },
  { min: 10000,  max: 24999,    title: 'Elite',    color: '#9b6dff' },
  { min: 25000,  max: 49999,    title: 'Shadow',   color: '#ff4d8b' },
  { min: 50000,  max: 99999,    title: 'Legend',   color: '#f5c542' },
  { min: 100000, max: Infinity, title: 'Mythic',   color: '#ff6b00' },
]
const RANK_ICONS: Record<string, LucideIcon> = {
  Newcomer: Sprout, Scout: Zap, Warrior: Sword,
  Elite: Shield, Shadow: Moon, Legend: Crown, Mythic: Flame,
}
function getRank(xp: number) { return RANKS.find(r => xp >= r.min && xp <= r.max) ?? RANKS[0] }

const GAME_LABELS: Record<string, string> = {
  neon_blitz: 'Neon Blitz', grid_ghost: 'Grid Ghost', flux_sort: 'Flux Sort',
  trivia_clash: 'Trivia Clash', tac_zone: 'Tac Zone', flag_rush: 'Flag Rush',
}

type Presence = 'online' | 'away' | 'offline'

const PRESENCE_COLORS: Record<Presence, string> = {
  online: '#3ecf8e',
  away: '#f5c542',
  offline: '#888899',
}

interface WishlistItem {
  id: string
  item_id: string
  item_name: string
  item_type: string
  item_image: string | null
  added_at: string
}

interface AlbumPic {
  id: string
  label: string
  imageUrl: string
  equippedAsBanner: boolean
}

interface FollowEntry {
  id: string
  username: string
  display_name: string | null
  xp: number
}

// ── Mini avatar ───────────────────────────────────────────────
function MiniAvatar({ name, size = 38 }: { name: string; size?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','#ff9a3c']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: color, color: '#fff', fontWeight: 700, fontSize: size * 0.36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

// ── Presence dot ──────────────────────────────────────────────
function PresenceDot({ status }: { status: Presence }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: PRESENCE_COLORS[status] + '18', border: `1px solid ${PRESENCE_COLORS[status]}44` }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRESENCE_COLORS[status], boxShadow: status === 'online' ? `0 0 6px ${PRESENCE_COLORS[status]}` : 'none' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: PRESENCE_COLORS[status], textTransform: 'capitalize' }}>{status}</span>
    </div>
  )
}

// ── Edit Sheet ────────────────────────────────────────────────
function EditSheet({ profile, onClose, onSaved }: {
  profile: { display_name: string | null; username: string; id: string }
  onClose: () => void
  onSaved: (displayName: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [username, setUsername] = useState(profile.username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  async function save() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('profiles')
      .update({ display_name: displayName.trim() || username.trim(), username: username.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(displayName.trim() || username.trim()); close()
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '28px 24px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Edit Profile</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          {[
            { key: 'displayName', label: 'Display Name', value: displayName, set: setDisplayName },
            { key: 'username',    label: 'Username',     value: username,     set: setUsername    },
          ].map(({ key, label, value, set }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</label>
              <input type="text" value={value} onChange={e => set(e.target.value)}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxShadow: 'inset 2px 2px 6px var(--neu-dark)', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }} />
            </div>
          ))}
          {error && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{error}</p>}
          <button type="button" onClick={save} disabled={saving} className="btn-primary"
            style={{ width: '100%', padding: 13, borderRadius: 14, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Add Friend Sheet ──────────────────────────────────────────
function AddFriendSheet({ myId, onClose, onFollowed }: {
  myId: string
  onClose: () => void
  onFollowed: () => void
}) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FollowEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, username, display_name, xp')
        .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
        .neq('id', myId).limit(8)
      setResults((data ?? []) as FollowEntry[])
      setSearching(false)
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  async function follow(targetId: string) {
    await supabase.from('follows').insert({ follower_id: myId, following_id: targetId })
    setFollowed(prev => new Set([...prev, targetId]))
    onFollowed()
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Find Players</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '10px 14px', marginBottom: 16, boxShadow: 'inset 2px 2px 6px var(--neu-dark)' }}>
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input autoFocus type="text" placeholder="Search by username or display name…" value={query} onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }} />
            {query && <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={13} /></button>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {searching ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : results.length === 0 && query.trim() ? (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>No players found</p>
            ) : (
              results.map(p => {
                const rank = getRank(p.xp)
                const isFollowed = followed.has(p.id)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <button type="button" onClick={() => { close(); navigate(`/profile/${p.id}`) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <MiniAvatar name={p.display_name || p.username} size={42} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.display_name || p.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.username} · <span style={{ color: rank.color }}>{rank.title}</span></div>
                    </div>
                    <button type="button" onClick={() => follow(p.id)} disabled={isFollowed}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: isFollowed ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, background: isFollowed ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: isFollowed ? '#3ecf8e' : '#fff', flexShrink: 0 }}>
                      {isFollowed ? <><Check size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Follow List Sheet ─────────────────────────────────────────
type ListMode = 'followers' | 'following'

function FollowListSheet({ profileId, mode, onClose }: {
  profileId: string
  mode: ListMode
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [list, setList] = useState<FollowEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  useEffect(() => {
    setLoading(true)
    const fetch = async () => {
      if (mode === 'followers') {
        const { data } = await supabase.from('follows')
          .select('profiles!follower_id(id, username, display_name, xp)').eq('following_id', profileId)
        setList((data ?? []).map((r: Record<string, unknown>) => r.profiles as FollowEntry).filter(Boolean))
      } else {
        const { data } = await supabase.from('follows')
          .select('profiles!following_id(id, username, display_name, xp)').eq('follower_id', profileId)
        setList((data ?? []).map((r: Record<string, unknown>) => r.profiles as FollowEntry).filter(Boolean))
      }
      setLoading(false)
    }
    fetch()
  }, [profileId, mode])

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{mode === 'followers' ? 'Followers' : 'Following'}</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Users size={32} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No {mode} yet</p>
              </div>
            ) : list.map(p => {
              const rank = getRank(p.xp)
              const RankIcon = RANK_ICONS[rank.title] ?? Zap
              return (
                <button key={p.id} type="button" onClick={() => { close(); navigate(`/profile/${p.id}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10 }}>
                  <MiniAvatar name={p.display_name || p.username} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.display_name || p.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RankIcon size={10} style={{ color: rank.color }} />
                      <span style={{ color: rank.color }}>{rank.title}</span>
                      <span>· @{p.username}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Wishlist Sheet ────────────────────────────────────────────
function WishlistSheet({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 320) }

  useEffect(() => {
    setLoading(true)
    supabase.from('wishlist').select('*').eq('user_id', profileId).order('added_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as WishlistItem[]); setLoading(false) })
  }, [profileId])

  async function removeItem(id: string) {
    await supabase.from('wishlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>My Wishlist</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Heart size={32} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your wishlist is empty</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Heart items in the Mall to add them here</p>
              </div>
            ) : items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.item_image
                    ? <img src={item.item_image} alt={item.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Package size={18} style={{ color: 'var(--text-muted)' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.item_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.item_type}</div>
                </div>
                <button type="button" onClick={() => removeItem(item.id)}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Profile Page ─────────────────────────────────────────
export default function Profile() {
  const { profile, loading } = useProfile()
  const navigate = useNavigate()

  const [showEdit, setShowEdit]                     = useState(false)
  const [showAddFriend, setShowAddFriend]           = useState(false)
  const [followListMode, setFollowListMode]         = useState<ListMode | null>(null)
  const [showWishlist, setShowWishlist]             = useState(false)
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null)
  const [followers, setFollowers]                   = useState<number | null>(null)
  const [following, setFollowing]                   = useState<number | null>(null)
  const [presence, setPresence]                     = useState<Presence>('online')
  const [lbPosition, setLbPosition]                 = useState<number | null>(null)
  const [wishlistCount, setWishlistCount]           = useState(0)
  const [equippedAvatar, setEquippedAvatar]         = useState<string | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying]     = useState<string | null>(null)
  const [albumPics, setAlbumPics]                   = useState<AlbumPic[]>([])
  const [bannerUrl, setBannerUrl]                   = useState<string | null>(null)
  const [xpBarWidth, setXpBarWidth]                 = useState(0)
  const [liked, setLiked]                           = useState(false)
  const [likeCount, setLikeCount]                   = useState(0)
  const [liking, setLiking]                         = useState(false)
  const [likeToast, setLikeToast]                   = useState<string | null>(null)

  const displayName = displayNameOverride ?? profile?.display_name ?? profile?.username ?? ''

  // Animate XP bar
  useEffect(() => {
    if (!profile) return
    setXpBarWidth(0)
    const t = setTimeout(() => {
      setXpBarWidth(Math.min(100, Math.round(((profile.xp % 1000) / 1000) * 100)))
    }, 120)
    return () => clearTimeout(t)
  }, [profile?.xp])

  // Load follow counts
  const loadCounts = () => {
    if (!profile?.id) return
    supabase.from('profile_follow_counts').select('followers_count, following_count')
      .eq('id', profile.id).single()
      .then(({ data }) => {
        setFollowers(data ? Number(data.followers_count) : 0)
        setFollowing(data ? Number(data.following_count) : 0)
      })
  }
  useEffect(loadCounts, [profile?.id])

  // Load presence from profiles
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profiles').select('presence').eq('id', profile.id).single()
      .then(({ data }) => {
        if (data?.presence) setPresence(data.presence as Presence)
      })
  }, [profile?.id])

  // Load leaderboard position
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profiles').select('id, xp').order('xp', { ascending: false })
      .then(({ data }) => {
        const pos = (data ?? []).findIndex((p: { id: string }) => p.id === profile.id)
        setLbPosition(pos >= 0 ? pos + 1 : null)
      })
  }, [profile?.id])

  // Load wishlist count
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('wishlist').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
      .then(({ count }) => setWishlistCount(count ?? 0))
  }, [profile?.id])

  // Load equipped avatar + album pics + banner
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profiles').select('equipped_avatar, banner_url').eq('id', profile.id).single()
      .then(({ data }) => {
        if (data?.equipped_avatar) setEquippedAvatar(data.equipped_avatar)
        if (data?.banner_url) setBannerUrl(data.banner_url)
      })
    // Load album pics from user_items
    supabase.from('user_items').select('item_id, item_name, item_image, equipped_as_banner')
      .eq('user_id', profile.id).eq('item_type', 'album_pic')
      .then(({ data }) => {
        setAlbumPics((data ?? []).map((d: Record<string, unknown>) => ({
          id: d.item_id as string,
          label: d.item_name as string,
          imageUrl: d.item_image as string,
          equippedAsBanner: !!d.equipped_as_banner,
        })))
      })
  }, [profile?.id])

  // Check if currently playing a game (active session in last 5 mins)
  useEffect(() => {
    if (!profile?.id) return
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    supabase.from('game_sessions').select('game').eq('user_id', profile.id)
      .gte('played_at', fiveMinAgo).order('played_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setCurrentlyPlaying(data[0].game as string)
      })
  }, [profile?.id])

  // Load like count + whether I've liked my own profile
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profile_likes').select('liker_id', { count: 'exact', head: true }).eq('profile_id', profile.id)
      .then(({ count }) => setLikeCount(count ?? 0))
    supabase.from('profile_likes').select('liker_id').eq('profile_id', profile.id).eq('liker_id', profile.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [profile?.id])

  async function handleLike() {
    if (!profile?.id || liking) return
    setLiking(true)
    if (liked) {
      const { error } = await supabase.from('profile_likes').delete().eq('profile_id', profile.id).eq('liker_id', profile.id)
      if (!error) {
        setLiked(false)
        setLikeCount(c => Math.max(0, c - 1))
        setLikeToast('Like removed')
      }
    } else {
      const { error } = await supabase.from('profile_likes').insert({ profile_id: profile.id, liker_id: profile.id })
      if (!error) {
        setLiked(true)
        setLikeCount(c => c + 1)
        setLikeToast('Like added ❤️')
      }
    }
    setLiking(false)
  }

  useEffect(() => {
    if (!likeToast) return
    const t = setTimeout(() => setLikeToast(null), 2600)
    return () => clearTimeout(t)
  }, [likeToast])

  // Equip album pic as banner
  async function equipAsBanner(pic: AlbumPic) {
    if (!profile?.id) return
    await supabase.from('profiles').update({ banner_url: pic.imageUrl }).eq('id', profile.id)
    setBannerUrl(pic.imageUrl)
    setAlbumPics(prev => prev.map(p => ({ ...p, equippedAsBanner: p.id === pic.id })))
  }

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const rank = getRank(profile.xp)
  const RankIcon = RANK_ICONS[rank.title] ?? Zap

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 160, background: bannerUrl ? 'transparent' : `linear-gradient(135deg, ${rank.color}44, #4f8ef722)`, overflow: 'hidden' }}>
        {bannerUrl && (
          <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />

        {/* Topbar over banner */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>My Profile</span>
          <button type="button" onClick={() => navigate('/settings')}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ── Profile pic + name row ── */}
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 16, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>

          {/* Square profile pic — left aligned */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 20px ${rank.color}55`, border: '3px solid var(--bg)' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 16, background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
            {/* Like — below avatar, left side. Self-likes count too, once. */}
            <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); handleLike() }} disabled={liking}
              className="ripple-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.1)'}`, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', cursor: liking ? 'default' : 'pointer', boxShadow: '2px 2px 6px var(--neu-dark)' }}>
              <Heart size={14} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
            </button>
          </div>

          {/* Name + presence */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{displayName}</span>
              <PresenceDot status={presence} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{profile.username}</div>
          </div>
        </div>
      </div>

      {/* ── Rank badge ── */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: rank.color + '18', border: `1px solid ${rank.color}44` }}>
          <RankIcon size={12} style={{ color: rank.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: rank.color }}>{rank.title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Lv {profile.level}</span>
        </div>
      </div>

      {/* ── Currently playing ── */}
      {currentlyPlaying && (
        <div style={{ margin: '0 20px 16px', padding: '10px 14px', borderRadius: 14, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f8ef7', boxShadow: '0 0 8px #4f8ef7', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <Gamepad2 size={14} style={{ color: '#4f8ef7', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
            Playing <strong style={{ color: '#4f8ef7' }}>{GAME_LABELS[currentlyPlaying] ?? currentlyPlaying}</strong>
          </span>
        </div>
      )}

      {/* ── XP bar ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          <span>Level {profile.level}</span>
          <span style={{ color: rank.color, fontWeight: 700 }}>{profile.xp.toLocaleString()} XP</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${xpBarWidth}%`, background: `linear-gradient(90deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 10px ${rank.color}66`, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Followers', value: followers === null ? '—' : followers.toLocaleString(), onClick: () => setFollowListMode('followers'), icon: <Users size={14} />, color: '#4f8ef7' },
            { label: 'Following', value: following === null ? '—' : following.toLocaleString(), onClick: () => setFollowListMode('following'), icon: <Users size={14} />, color: '#9b6dff' },
            { label: 'Streak',    value: `${profile.streak}d`,  onClick: null, icon: <Flame size={14} />, color: 'var(--accent)' },
            { label: 'Leaderboard', value: lbPosition ? `#${lbPosition}` : '—', onClick: () => navigate('/ranks'), icon: <Trophy size={14} />, color: '#f5c542' },
            { label: 'Wishlist',  value: wishlistCount.toString(), onClick: () => setShowWishlist(true), icon: <Heart size={14} />, color: '#ff4d8b' },
            { label: 'Total XP',  value: profile.xp >= 1000 ? `${(profile.xp / 1000).toFixed(1)}k` : profile.xp.toString(), onClick: null, icon: <Zap size={14} />, color: '#f5c542' },
          ].map(s => (
            <button key={s.label} type="button" onClick={s.onClick ?? undefined} disabled={!s.onClick}
              style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', cursor: s.onClick ? 'pointer' : 'default', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)', transition: 'transform 0.15s' }}
              onMouseEnter={e => { if (s.onClick) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ color: s.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', gap: 8 }}>
        <button type="button" className="btn-primary"
          onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); setShowEdit(true) }}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Edit3 size={13} /> Edit Profile
        </button>
        <button type="button" className="btn-secondary"
          onClick={() => setShowAddFriend(true)}
          style={{ padding: '10px 14px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <UserPlus size={13} /> Find Players
        </button>
      </div>

      {/* ── Equipped Avatar ── */}
      {equippedAvatar && (
        <div style={{ padding: '0 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Equipped Avatar</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: rank.color, boxShadow: `0 0 8px ${rank.color}` }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{equippedAvatar}</span>
          </div>
        </div>
      )}

      {/* ── Album ── */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Album</p>
        {albumPics.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <ImageIcon size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No album pics yet</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Earn album pics through ranks</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {albumPics.slice(0, 2).map(pic => (
              <div key={pic.id} style={{ flex: 1, position: 'relative' }}>
                <div style={{ height: 110, borderRadius: 14, overflow: 'hidden', border: pic.equippedAsBanner ? `2px solid ${rank.color}` : '1px solid rgba(255,255,255,0.08)', boxShadow: pic.equippedAsBanner ? `0 0 14px ${rank.color}44` : '2px 2px 8px var(--neu-dark)' }}>
                  <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pic.label}</div>
                <button type="button" onClick={() => equipAsBanner(pic)}
                  style={{ marginTop: 4, width: '100%', padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, background: pic.equippedAsBanner ? `${rank.color}20` : 'rgba(255,255,255,0.06)', color: pic.equippedAsBanner ? rank.color : 'var(--text-muted)' }}>
                  {pic.equippedAsBanner ? '✓ Banner' : 'Set as Banner'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheets */}
      {showEdit && (
        <EditSheet profile={profile} onClose={() => setShowEdit(false)} onSaved={(name) => setDisplayNameOverride(name)} />
      )}
      {showAddFriend && profile?.id && (
        <AddFriendSheet myId={profile.id} onClose={() => setShowAddFriend(false)} onFollowed={loadCounts} />
      )}
      {followListMode && profile?.id && (
        <FollowListSheet profileId={profile.id} mode={followListMode} onClose={() => setFollowListMode(null)} />
      )}
      {showWishlist && profile?.id && (
        <WishlistSheet profileId={profile.id} onClose={() => setShowWishlist(false)} />
      )}
      {likeToast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(255,77,139,0.4)', borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
          <Heart size={14} color="#ff4d8b" style={{ fill: '#ff4d8b' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{likeToast}</span>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  )
}
