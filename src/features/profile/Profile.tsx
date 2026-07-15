// src/pages/Profile.tsx
import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Settings, Edit3, Users, UserPlus,
  Zap, X, Check, Search, Heart,
  ImageIcon, Package, Star, Trophy, Gamepad2,
  Sparkles, Sunrise, Moon as MoonIcon, Globe2, Gift,
} from 'lucide-react'
import { useProfile } from './useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import { getUserRankTier, type RankTier } from './ranks'
import { getGameMeta, getGameById } from '../games/games'
import { getAllPlayerRanks } from '../games/gameSession'
import EditProfileModal, { type EditProfileSavedFields } from './EditProfileModal'
import { AchIcon, RARITY_COLOR } from '../achievements/Achievements'
import PageOnboarding from '../onboarding/PageOnboarding'
import SharedAvatar from '../../shared/components/Avatar'
import { usePlayerBadges } from '../badges/usePlayerBadges'
import { checkAndAwardAutoBadges } from '../badges/badges'
import BadgeRow from '../badges/BadgeRow'
import BadgesStatRow from '../badges/BadgesStatRow'
import BadgesModal from '../badges/BadgesModal'

/** Use the real rank system (lib/ranks.ts) everywhere on this page —
 *  this used to be a hardcoded 7-tier placeholder ("Newcomer" etc).
 *  getRank() is now a thin wrapper so call sites barely changed. */
function getRank(xp: number): RankTier { return getUserRankTier(xp) }

// Lower is better — used to pick a player's 3 best (rarest) unlocked
// achievements to show off, instead of just the 3 most recently earned.
const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }



// Real presence values, matching Settings.tsx / the profiles.presence column.
type Presence = 'online' | 'idle' | 'offline' | 'invisible'

const PRESENCE_COLORS: Record<Presence, string> = {
  online: '#3ecf8e',
  idle: '#f5c542',
  offline: '#888899',
  invisible: '#555566',
}

// ── Game rank (beginner/intermediate/advanced/master) -> star count ──
const GAME_RANK_STARS: Record<string, number> = {
  beginner: 1, intermediate: 3, advanced: 4, master: 5,
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
  avatar: string | null
}

// ── Mini avatar ───────────────────────────────────────────────
function MiniAvatar({ name, avatar, size = 38 }: { name: string; avatar?: string | null; size?: number }) {
  // Delegates to the shared Avatar component so a missing/broken image
  // always falls back to a letter, instead of the old behaviour of
  // hiding the <img> on error and leaving an empty box.
  return <SharedAvatar src={avatar} name={name} size={size} radius={Math.round(size * 0.3)} disabled />
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

const GENDER_LABELS: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' }

// ── Info tag pills — renders the player's chosen tags (max 2) under the
//    avatar. Preferred-play-time shows icon-only by design. ──────────────
function InfoTagPills({
  tags, gender, playTime, country, presence,
}: {
  tags: string[]
  gender: string | null
  playTime: string | null
  country: string | null
  presence: Presence
}) {
  function Pill({ icon, label }: { icon: React.ReactNode; label?: string }) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', boxShadow: '2px 2px 6px var(--neu-dark)' }}>
        {icon}
        {label && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}>{label}</span>}
      </div>
    )
  }

  return (
    <>
      {tags.includes('gender') && gender && (
        <Pill icon={<Users size={12} style={{ color: 'var(--text-muted)' }} />} label={GENDER_LABELS[gender] ?? gender} />
      )}
      {tags.includes('play_time') && playTime && (
        <Pill icon={playTime === 'morning' ? <Sunrise size={13} style={{ color: '#f5c542' }} /> : <MoonIcon size={13} style={{ color: '#9b6dff' }} />} />
      )}
      {tags.includes('country') && country && (
        <Pill icon={<Globe2 size={12} style={{ color: 'var(--text-muted)' }} />} label={country} />
      )}
      {tags.includes('presence') && (
        <Pill icon={<span style={{ width: 7, height: 7, borderRadius: '50%', background: PRESENCE_COLORS[presence], display: 'inline-block' }} />} label={presence.charAt(0).toUpperCase() + presence.slice(1)} />
      )}
    </>
  )
}

// ── Save toast — slides down from the top on "Save Changes" ─────
function SaveToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 280) }, 2400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'fixed', top: visible ? 16 : -80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, transition: 'top 0.32s cubic-bezier(0.34,1.56,0.64,1)', background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(62,207,142,0.4)', borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
      <Check size={14} color="#3ecf8e" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{message}</span>
    </div>
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
        .select('id, username, display_name, xp, avatar')
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
      {/* Mobile: bottom sheet | Desktop: centered modal */}
      <div className="sheet-or-modal" style={{ zIndex: 360 }}>
        <div className="sheet-or-modal-inner" style={{ background: 'var(--surface2)', padding: '24px 20px 36px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}>
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
                      <MiniAvatar name={p.display_name || p.username} avatar={p.avatar} size={42} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.display_name || p.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.username} · <span style={{ color: rank.color }}>{rank.name}</span></div>
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
          .select('profiles!follower_id(id, username, display_name, xp, avatar)').eq('following_id', profileId)
        setList((data ?? []).map((r: Record<string, unknown>) => r.profiles as FollowEntry).filter(Boolean))
      } else {
        const { data } = await supabase.from('follows')
          .select('profiles!following_id(id, username, display_name, xp, avatar)').eq('follower_id', profileId)
        setList((data ?? []).map((r: Record<string, unknown>) => r.profiles as FollowEntry).filter(Boolean))
      }
      setLoading(false)
    }
    fetch()
  }, [profileId, mode])

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div className="sheet-or-modal" style={{ zIndex: 360 }}>
        <div className="sheet-or-modal-inner" style={{ background: 'var(--surface2)', padding: '24px 20px 36px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}>
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
              return (
                <button key={p.id} type="button" onClick={() => { close(); navigate(`/profile/${p.id}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10 }}>
                  <MiniAvatar name={p.display_name || p.username} avatar={p.avatar} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.display_name || p.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11 }}>{rank.emoji}</span>
                      <span style={{ color: rank.color }}>{rank.name}</span>
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
      {/* Mobile: bottom sheet | Desktop: centered modal */}
      <div className="sheet-or-modal" style={{ zIndex: 360 }}>
        <div className="sheet-or-modal-inner" style={{ background: 'var(--surface2)', padding: '24px 20px 36px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}>
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

// ── Achievements detail modal — shows 3 most recent unlocks ─────
function AchievementsModal({
  total, recent, onClose,
}: {
  total: number
  recent: { id: string; title: string; icon: string; rarity: string }[]
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 280) }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 505 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Achievements</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{total} unlocked total</p>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Trophy size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No achievements unlocked yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map(a => {
                const color = RARITY_COLOR[a.rarity] ?? RARITY_COLOR.common
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${color}33,${color}11)`, border: `1.5px solid ${color}44` }}>
                      <AchIcon iconKey={a.icon} size={18} color={color} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{a.title}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Rank detail modal — "comment shaped" card explaining current rank ──
function RankModal({ tier, onClose }: { tier: RankTier; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 280) }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 505 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '28px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
          <button type="button" onClick={close} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{tier.emoji}</div>
          <p style={{ fontSize: 18, fontWeight: 800, color: tier.color, marginBottom: 6 }}>{tier.name}</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>You're currently in {tier.name} rank.</p>
        </div>
      </div>
    </>
  )
}


// ── Album grid — tap a small box to see the full image in a modal,
//    with the mall item name shown underneath. ──────────────────
function AlbumGrid({
  albumPics, rankColor, onEquipBanner,
}: {
  albumPics: AlbumPic[]
  rankColor: string
  onEquipBanner: (pic: AlbumPic) => void
}) {
  const [opened, setOpened] = useState<AlbumPic | null>(null)

  return (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        {albumPics.slice(0, 2).map(pic => (
          <button key={pic.id} type="button" onClick={() => setOpened(pic)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ height: 90, borderRadius: 14, overflow: 'hidden', border: pic.equippedAsBanner ? `2px solid ${rankColor}` : '1px solid rgba(255,255,255,0.08)', boxShadow: pic.equippedAsBanner ? `0 0 14px ${rankColor}44` : '2px 2px 8px var(--neu-dark)' }}>
              <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pic.label}</div>
          </button>
        ))}
      </div>

      {opened && (
        <AlbumDetailModal pic={opened} rankColor={rankColor} onEquipBanner={onEquipBanner} onClose={() => setOpened(null)} />
      )}
    </>
  )
}

function AlbumDetailModal({
  pic, rankColor, onEquipBanner, onClose,
}: {
  pic: AlbumPic
  rankColor: string
  onEquipBanner: (pic: AlbumPic) => void
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 280) }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 505 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 510, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', padding: 18, transform: visible ? 'scale(1)' : 'scale(0.9)', opacity: visible ? 1 : 0, transition: 'all 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
          <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', border: pic.equippedAsBanner ? `2px solid ${rankColor}` : '1px solid rgba(255,255,255,0.1)' }}>
            <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', marginTop: 12 }}>
            You've acquired <strong style={{ color: 'var(--text)' }}>{pic.label}</strong>
          </p>
          <button type="button" onClick={() => onEquipBanner(pic)}
            style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: pic.equippedAsBanner ? `${rankColor}20` : 'rgba(255,255,255,0.06)', color: pic.equippedAsBanner ? rankColor : 'var(--text-dim)' }}>
            {pic.equippedAsBanner ? '✓ Set as Banner' : 'Set as Banner'}
          </button>
        </div>
      </div>
    </>
  )
}


// ── Main Profile Page ─────────────────────────────────────────
export default function Profile() {
  const { profile, loading, refetch: refetchProfile } = useProfile()
  const navigate = useNavigate()

  const [showEdit, setShowEdit]                     = useState(false)
  const [showAddFriend, setShowAddFriend]           = useState(false)
  const [followListMode, setFollowListMode]         = useState<ListMode | null>(null)
  const [showWishlist, setShowWishlist]             = useState(false)
  const [showAchievements, setShowAchievements]     = useState(false)
  const [showRankInfo, setShowRankInfo]             = useState(false)
  const [profileOverride, setProfileOverride]       = useState<Partial<EditProfileSavedFields>>({})
  const [followers, setFollowers]                   = useState<number | null>(null)
  const [following, setFollowing]                   = useState<number | null>(null)
  const [showFollowCounts, setShowFollowCounts]     = useState(true)
  const [presence, setPresence]                     = useState<Presence>('online')
  const [lbPosition, setLbPosition]                 = useState<number | null>(null)
  const [wishlistCount, setWishlistCount]           = useState(0)
  const [equippedAvatar, setEquippedAvatar]         = useState<string | null>(null)
  const [equippedArtifact, setEquippedArtifact]     = useState<string | null>(null)
  const [equippedArtifactImage, setEquippedArtifactImage] = useState<string | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying]     = useState<string | null>(null)
  const [albumPics, setAlbumPics]                   = useState<AlbumPic[]>([])
  const [bannerUrl, setBannerUrl]                   = useState<string | null>(null)
  const [favoriteGameRank, setFavoriteGameRank]     = useState<string | null>(null)
  const [recentAchievements, setRecentAchievements] = useState<{ id: string; title: string; icon: string; rarity: string }[]>([])
  const [achievementCount, setAchievementCount]     = useState(0)
  const [liked, setLiked]                           = useState(false)
  const [likeCount, setLikeCount]                   = useState(0)
  const [liking, setLiking]                         = useState(false)
  const [likeToast, setLikeToast]                   = useState<string | null>(null)
  const [saveToast, setSaveToast]                   = useState<string | null>(null)
  const [showBadgesModal, setShowBadgesModal]       = useState(false)
  const { badges: playerBadges, defs: badgeDefs }   = usePlayerBadges(profile?.id)

  // Re-check auto badges every time the owner opens their own profile —
  // catches streak/gift/version changes that happened elsewhere in the app.
  useEffect(() => {
    if (profile?.id) checkAndAwardAutoBadges(profile.id)
  }, [profile?.id])

  const displayName = profileOverride.display_name ?? profile?.display_name ?? profile?.username ?? ''
  const bio          = profileOverride.bio          ?? profile?.bio          ?? null
  const infoTags     = profileOverride.info_tags    ?? profile?.info_tags    ?? []
  const genderVal    = profileOverride.gender       ?? profile?.gender       ?? null
  const playTimeVal  = profileOverride.play_time    ?? profile?.play_time    ?? null
  const favoriteGame = profileOverride.favorite_game ?? profile?.favorite_game ?? null
  const gridCards    = profileOverride.grid_cards   ?? profile?.grid_cards   ?? []

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

  // Re-fetch profile when avatar/banner changes (e.g. equipped from Inventory)
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`profile-avatar-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}`,
      }, () => { refetchProfile() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, refetchProfile])

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
    supabase.from('profiles').select('equipped_avatar, banner_url, show_follow_counts').eq('id', profile.id).single()
      .then(({ data }) => {
        if (data?.equipped_avatar) setEquippedAvatar(data.equipped_avatar)
        if (data?.banner_url) setBannerUrl(data.banner_url)
        if (typeof data?.show_follow_counts === 'boolean') setShowFollowCounts(data.show_follow_counts)
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
    // Load equipped artifact (shown "untappable" alongside avatar/album)
    supabase.from('user_items').select('item_name, item_image').eq('user_id', profile.id)
      .eq('item_type', 'artifact').eq('is_equipped', true).maybeSingle()
      .then(({ data }) => {
        if (data?.item_name) setEquippedArtifact(data.item_name as string)
        if (data?.item_image) setEquippedArtifactImage(data.item_image as string)
      })
  }, [profile?.id])

  // Load this player's rank (beginner..master) for their chosen favorite game,
  // used to render the 1-5 star score on the favorite-game card.
  useEffect(() => {
    if (!profile?.id || !favoriteGame) { setFavoriteGameRank(null); return }
    getAllPlayerRanks(profile.id).then(ranks => {
      const row = ranks[favoriteGame as keyof typeof ranks]
      setFavoriteGameRank(row?.rank ?? null)
    })
  }, [profile?.id, favoriteGame])

  // Load achievement count + best 3 (rarest first) for the Achievements grid card
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('player_achievements').select('achievement_id, unlocked_at, achievements(title, icon, rarity)')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as { achievement_id: string; unlocked_at: string; achievements: { title: string; icon: string; rarity: string } | null }[]
        const best = [...rows]
          .sort((a, b) => {
            const rA = RARITY_RANK[a.achievements?.rarity ?? 'common'] ?? 3
            const rB = RARITY_RANK[b.achievements?.rarity ?? 'common'] ?? 3
            if (rA !== rB) return rA - rB
            // Tie-break: most recently unlocked first
            return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime()
          })
          .slice(0, 3)
        setRecentAchievements(best.map(r => ({
          id: r.achievement_id,
          title: r.achievements?.title ?? 'Achievement',
          icon: r.achievements?.icon ?? 'trophy',
          rarity: r.achievements?.rarity ?? 'common',
        })))
      })
    supabase.from('player_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', profile.id)
      .then(({ count }) => setAchievementCount(count ?? 0))
  }, [profile?.id])

  // Live "currently playing" ticker — was previously a poll of game_sessions
  // for "any session in the last 5 minutes", which is why it used to keep
  // showing "Playing X" for up to 5 minutes after a game actually ended.
  // Now subscribes to the same Realtime Presence channel useGamePresence
  // broadcasts to, so it appears and disappears instantly, matching the
  // "watching movie" ticker's behavior on the viewer-facing profile page.
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase.channel(`user-activity:${profile.id}`, {
      config: { presence: { key: profile.id } },
    })

    function syncActivity() {
      const state = channel.presenceState<{ activity: string; game?: string }>()
      const entries = Object.values(state).flat()
      const gameEntry = entries.find(e => e.activity === 'playing' && e.game)
      setCurrentlyPlaying(gameEntry?.game ?? null)
    }

    channel
      .on('presence', { event: 'sync' }, syncActivity)
      .on('presence', { event: 'join' }, syncActivity)
      .on('presence', { event: 'leave' }, syncActivity)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
  const isPro = isProActive(profile)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      <PageOnboarding pageKey="profile" />

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 160, background: bannerUrl ? 'transparent' : `linear-gradient(135deg, ${rank.color}44, #4f8ef722)`, overflow: 'hidden' }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={26} style={{ color: 'rgba(255,255,255,0.18)' }} />
          </div>
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
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>

          {/* Square profile pic — left aligned */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 20px ${rank.color}55`, border: '3px solid var(--bg)' }}>
              <SharedAvatar src={profile?.avatar} name={displayName} size={74} radius={16} disabled />
            </div>
          </div>

          {/* Name + presence */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{displayName}</span>
              <PresenceDot status={presence} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{profile.username}</div>
              <BadgeRow badges={playerBadges} defs={badgeDefs} originalUsername={profile.original_username ?? profile.username} onOpenAll={() => setShowBadgesModal(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bio ── */}
      {bio && (
        <div style={{ padding: '0 20px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{bio}</p>
        </div>
      )}

      {/* ── Info tags row (Likes locked + up to 2 chosen) ── */}
      <div style={{ padding: '0 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={(e) => { ripple(e); handleLike() }} disabled={liking}
          className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.1)'}`, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', cursor: liking ? 'default' : 'pointer', boxShadow: '2px 2px 6px var(--neu-dark)' }}>
          <Heart size={13} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
        </button>
        <InfoTagPills tags={infoTags} gender={genderVal} playTime={playTimeVal} country={profile.country} presence={presence} />
      </div>

      {/* ── Rank badge ── */}
      <div style={{ padding: '0 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {isPro && (
          <>
            <style>{`
              @keyframes cvAuroraBadge {
                0%   { box-shadow: 0 0 0 1px rgba(155,109,255,0.55), 0 0 14px rgba(155,109,255,0.4); }
                33%  { box-shadow: 0 0 0 1px rgba(79,142,247,0.55),  0 0 14px rgba(79,142,247,0.4); }
                66%  { box-shadow: 0 0 0 1px rgba(62,207,142,0.55),  0 0 14px rgba(62,207,142,0.4); }
                100% { box-shadow: 0 0 0 1px rgba(155,109,255,0.55), 0 0 14px rgba(155,109,255,0.4); }
              }
            `}</style>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20,
              background: profile.pro_tier === 'void' ? 'rgba(155,109,255,0.14)' : 'rgba(79,142,247,0.14)',
              animation: 'cvAuroraBadge 5s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 13 }}>✦</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: profile.pro_tier === 'void' ? '#9b6dff' : '#4f8ef7' }}>
                {profile.pro_tier === 'void' ? 'Void' : 'Orbit'}
              </span>
            </div>
          </>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: rank.color + '18', border: `1px solid ${rank.color}44` }}>
          <span style={{ fontSize: 13 }}>{rank.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: rank.color }}>{rank.name}</span>
        </div>
      </div>

      {/* ── Currently playing ── */}
      {currentlyPlaying && (() => {
        const gameMeta = getGameById(currentlyPlaying)
        const GameIcon = gameMeta?.icon ?? Gamepad2
        return (
          <div style={{ margin: '0 20px 16px', padding: '10px 14px', borderRadius: 14, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f8ef7', boxShadow: '0 0 8px #4f8ef7', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <GameIcon size={14} style={{ color: '#4f8ef7', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              Playing <strong style={{ color: '#4f8ef7' }}>{gameMeta?.name ?? currentlyPlaying}</strong>
            </span>
          </div>
        )
      })()}

      {/* ── Grid Advert: rectangle bars, tap for detail ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Locked: Followers / Following (combined, can't be removed) */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => showFollowCounts && setFollowListMode('followers')} disabled={!showFollowCounts}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: showFollowCounts ? 'pointer' : 'default', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <Users size={15} style={{ color: '#4f8ef7' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{!showFollowCounts ? '—' : (followers ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Followers</div>
              </div>
            </button>
            <button type="button" onClick={() => showFollowCounts && setFollowListMode('following')} disabled={!showFollowCounts}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: showFollowCounts ? 'pointer' : 'default', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <Users size={15} style={{ color: '#9b6dff' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{!showFollowCounts ? '—' : (following ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Following</div>
              </div>
            </button>
          </div>

          {/* Locked: Wishlist */}
          <button type="button" onClick={() => setShowWishlist(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Heart size={15} style={{ color: '#ff4d8b' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Wishlist</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{wishlistCount}/10</span>
          </button>

          {/* Badges */}
          <BadgesStatRow collected={playerBadges.length} total={badgeDefs.length} onClick={() => setShowBadgesModal(true)} />

          {/* Locked: Current XP (tap does nothing) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={15} style={{ color: '#f5c542' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Current XP</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: rank.color }}>{profile.xp.toLocaleString()}</span>
          </div>

          {/* Optional, up to 3: Achievements / Rank / Leaderboard */}
          {gridCards.includes('achievements') && (
            <button type="button" onClick={() => setShowAchievements(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trophy size={15} style={{ color: '#f5c542' }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Achievements</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{achievementCount}</span>
            </button>
          )}
          {gridCards.includes('rank') && (
            <button type="button" onClick={() => setShowRankInfo(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{rank.emoji}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Rank</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: rank.color }}>{rank.name}</span>
            </button>
          )}
          {gridCards.includes('leaderboard') && (
            <button type="button" onClick={() => navigate('/ranks')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trophy size={15} style={{ color: '#4f8ef7' }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Leaderboard</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{lbPosition ? `#${lbPosition}` : '—'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', gap: 8 }}>
        <button type="button" className="btn-primary"
          onClick={(e) => { ripple(e); setShowEdit(true) }}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Edit3 size={13} /> Edit Profile
        </button>
        <button type="button" className="btn-secondary"
          onClick={() => setShowAddFriend(true)}
          style={{ padding: '10px 14px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <UserPlus size={13} /> Find Players
        </button>
        <button type="button" className="btn-secondary"
          onClick={() => navigate('/referral')}
          style={{ padding: '10px 14px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Gift size={13} /> Refer & Earn
        </button>
      </div>

      {/* ── Middle Advert: favorite game, with star score ── */}
      {favoriteGame && (() => {
        const meta = getGameMeta(favoriteGame)
        if (!meta) return null
        const stars = GAME_RANK_STARS[favoriteGameRank ?? ''] ?? 0
        return (
          <div style={{ padding: '0 20px', marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Favorite Game</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${meta.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <meta.icon size={19} style={{ color: meta.accent }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>{meta.name}</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} style={{ color: i < stars ? '#f5c542' : 'var(--surface3)' }} fill={i < stars ? '#f5c542' : 'none'} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Down Last: Album, Avatar, Artifact ── */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Album</p>
        {albumPics.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <ImageIcon size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No album pics yet</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Earn album pics through ranks</p>
          </div>
        ) : (
          <AlbumGrid albumPics={albumPics} rankColor={rank.color} onEquipBanner={equipAsBanner} />
        )}
      </div>

      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', gap: 12 }}>
        {/* Equipped Avatar — image preview + name, tap to change in Mall */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Avatar</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ width: 54, height: 54, borderRadius: 12, background: equippedAvatar ? `${rank.color}18` : 'var(--surface2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: equippedAvatar ? `1px solid ${rank.color}33` : '1px solid rgba(255,255,255,0.06)' }}>
              {equippedAvatar && equippedAvatar.startsWith('http')
                ? <img src={equippedAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <Sparkles size={17} style={{ color: equippedAvatar ? rank.color : 'var(--text-muted)' }} />
              }
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: equippedAvatar ? 'var(--text)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
              {equippedAvatar ? (equippedAvatar.startsWith('http') ? 'Equipped' : equippedAvatar) : 'No avatar equipped'}
            </span>
          </div>
        </div>

        {/* Equipped Artifact — image preview + name, tap to change in Mall */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Artifact</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ width: 54, height: 54, borderRadius: 12, background: equippedArtifact ? `${rank.color}18` : 'var(--surface2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: equippedArtifact ? `1px solid ${rank.color}33` : '1px solid rgba(255,255,255,0.06)' }}>
              {equippedArtifactImage && equippedArtifactImage.startsWith('http')
                ? <img src={equippedArtifactImage} alt="artifact" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <Package size={17} style={{ color: equippedArtifact ? rank.color : 'var(--text-muted)' }} />
              }
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: equippedArtifact ? 'var(--text)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
              {equippedArtifact || 'No artifact equipped'}
            </span>
          </div>
        </div>
      </div>

      {/* Sheets */}
      {showEdit && (
        <EditProfileModal
          profile={profile}
          albumPics={albumPics}
          bannerUrl={bannerUrl}
          presence={presence}
          onClose={() => setShowEdit(false)}
          onSaved={(updates) => {
            setProfileOverride(prev => ({ ...prev, ...updates }))
            setBannerUrl(updates.banner_url)
          }}
          onToast={(msg) => setSaveToast(msg)}
        />
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

      {showBadgesModal && profile?.id && (
        <BadgesModal badges={playerBadges} allDefs={badgeDefs} originalUsername={profile.original_username ?? profile.username} onClose={() => setShowBadgesModal(false)} />
      )}
      {showAchievements && (
        <AchievementsModal total={achievementCount} recent={recentAchievements} onClose={() => setShowAchievements(false)} />
      )}
      {showRankInfo && (
        <RankModal tier={rank} onClose={() => setShowRankInfo(false)} />
      )}
      {likeToast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(255,77,139,0.4)', borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
          <Heart size={14} color="#ff4d8b" style={{ fill: '#ff4d8b' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{likeToast}</span>
        </div>
      )}
      {saveToast && <SaveToast message={saveToast} onDone={() => setSaveToast(null)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  )
}
