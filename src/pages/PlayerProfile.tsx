// src/pages/PlayerProfile.tsx
import { useState, useEffect } from 'react'
import type React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, UserPlus, UserCheck, ShieldOff, Swords, X,
  MessageCircle, Zap, Flame, Sprout, Shield, Heart,
  Moon, Crown, Sword, Gamepad2, Trophy, Users, ImageIcon, Film,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ripple } from '../lib/ripple'
import { notifyFollow, notifyProfileView, notifyProfileLike } from '../lib/achievements'

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
  online: '#3ecf8e', away: '#f5c542', offline: '#888899',
}
function PresenceDot({ status }: { status: Presence }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: PRESENCE_COLORS[status] + '18', border: `1px solid ${PRESENCE_COLORS[status]}44` }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRESENCE_COLORS[status], boxShadow: status === 'online' ? `0 0 6px ${PRESENCE_COLORS[status]}` : 'none' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: PRESENCE_COLORS[status], textTransform: 'capitalize' }}>{status}</span>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
function MiniToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(255,77,139,0.4)', borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
      <Heart size={14} color="#ff4d8b" style={{ fill: '#ff4d8b' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{msg}</span>
    </div>
  )
}

// ── Challenge placeholder modal ─────────────────────────────────
function ChallengeModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', padding: '26px 22px', textAlign: 'center', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={13} />
        </button>
        <div style={{ width: 54, height: 54, borderRadius: 16, background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Swords size={24} color="var(--accent)" />
        </div>
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Challenges coming soon</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 18 }}>
          Soon you'll be able to challenge <strong style={{ color: 'var(--text)' }}>{name}</strong> to a head-to-head match. Stay tuned!
        </p>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--surface3)', color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>
          Got it
        </button>
      </div>
    </div>
  )
}

interface PlayerData {
  id: string
  username: string
  display_name: string | null
  avatar: string
  country: string | null
  interests: string[]
  xp: number
  level: number
  streak: number
}
interface AlbumPic { id: string; label: string; imageUrl: string }

export default function PlayerProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [xpBarWidth, setXpBarWidth] = useState(0)
  const [followers, setFollowers] = useState<number>(0)
  const [following, setFollowing] = useState<number>(0)
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'blocked'>('none')
  const [actionLoading, setActionLoading] = useState(false)
  const [presence, setPresence] = useState<Presence>('offline')
  const [lbPosition, setLbPosition] = useState<number | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [watchingMovie, setWatchingMovie] = useState(false)
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [albumPics, setAlbumPics] = useState<AlbumPic[]>([])
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liking, setLiking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (myId && userId === myId) navigate('/profile', { replace: true })
  }, [myId, userId, navigate])

  // Log profile view + notify
  useEffect(() => {
    if (!userId || !myId || userId === myId) return
    supabase.from('profile_views').insert({ viewer_id: myId, profile_id: userId })
    notifyProfileView(myId, userId)
  }, [userId, myId])

  // Load player data
  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase.from('profiles').select('id, username, display_name, avatar, country, interests, xp, level, streak')
      .eq('id', userId).single()
      .then(({ data }) => {
        setPlayer(data as PlayerData)
        setLoading(false)
      })
  }, [userId])

  // Animate XP bar
  useEffect(() => {
    if (!player) return
    setXpBarWidth(0)
    const t = setTimeout(() => {
      setXpBarWidth(Math.min(100, Math.round(((player.xp % 1000) / 1000) * 100)))
    }, 120)
    return () => clearTimeout(t)
  }, [player?.xp])

  // Load follower counts
  useEffect(() => {
    if (!userId) return
    supabase.from('profile_follow_counts').select('followers_count, following_count')
      .eq('id', userId).single()
      .then(({ data }) => {
        if (data) { setFollowers(Number(data.followers_count)); setFollowing(Number(data.following_count)) }
      })
  }, [userId])

  // Check follow/block status
  useEffect(() => {
    if (!myId || !userId) return
    const check = async () => {
      const { data: followRow } = await supabase.from('follows')
        .select('id').eq('follower_id', myId).eq('following_id', userId).maybeSingle()
      if (followRow) { setFollowStatus('following'); return }
      const { data: blockRow } = await supabase.from('blocks')
        .select('id').eq('blocker_id', myId).eq('blocked_id', userId).maybeSingle()
      if (blockRow) setFollowStatus('blocked')
    }
    check()
  }, [myId, userId])

  // Load presence
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('presence').eq('id', userId).single()
      .then(({ data }) => { if (data?.presence) setPresence(data.presence as Presence) })
  }, [userId])

  // Load leaderboard position
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('id, xp').order('xp', { ascending: false })
      .then(({ data }) => {
        const pos = (data ?? []).findIndex((p: { id: string }) => p.id === userId)
        setLbPosition(pos >= 0 ? pos + 1 : null)
      })
  }, [userId])

  // ── Live activity via Realtime Presence ─────────────────────
  // Subscribes to the viewed user's presence channel.
  // Watch.tsx broadcasts { activity: 'watching_movie' } when they're
  // in the movie area. Games broadcast { activity: 'playing', game: '...' }.
  // This gives us instant, accurate status — no polling delay.
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`user-activity:${userId}`, {
      config: { presence: { key: userId } },
    })

    function syncActivity() {
      const state = channel.presenceState<{ activity: string; game?: string }>()
      const entries = Object.values(state).flat()
      const movieEntry = entries.find(e => e.activity === 'watching_movie')
      const gameEntry  = entries.find(e => e.activity === 'playing' && e.game)

      setWatchingMovie(!!movieEntry)
      setCurrentlyPlaying(gameEntry?.game ?? null)
    }

    channel
      .on('presence', { event: 'sync' },  syncActivity)
      .on('presence', { event: 'join' },  syncActivity)
      .on('presence', { event: 'leave' }, syncActivity)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Load equipped avatar + banner + album pics
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('equipped_avatar, banner_url').eq('id', userId).single()
      .then(({ data }) => {
        if (data?.equipped_avatar) setEquippedAvatar(data.equipped_avatar)
        if (data?.banner_url) setBannerUrl(data.banner_url)
      })
    supabase.from('user_items').select('item_id, item_name, item_image').eq('user_id', userId).eq('item_type', 'album_pic')
      .then(({ data }) => {
        setAlbumPics((data ?? []).map((d: Record<string, unknown>) => ({
          id: d.item_id as string, label: d.item_name as string, imageUrl: d.item_image as string,
        })))
      })
  }, [userId])

  // Load like count + whether I've already liked this profile
  useEffect(() => {
    if (!userId) return
    supabase.from('profile_likes').select('liker_id', { count: 'exact', head: true }).eq('profile_id', userId)
      .then(({ count }) => setLikeCount(count ?? 0))
    if (myId) {
      supabase.from('profile_likes').select('liker_id').eq('profile_id', userId).eq('liker_id', myId).maybeSingle()
        .then(({ data }) => setLiked(!!data))
    }
  }, [userId, myId])

  async function handleLike() {
    if (!myId || !userId || liking) return
    setLiking(true)
    if (liked) {
      const { error } = await supabase.from('profile_likes').delete().eq('profile_id', userId).eq('liker_id', myId)
      if (!error) {
        setLiked(false)
        setLikeCount(c => Math.max(0, c - 1))
        setToast('Like removed')
      }
    } else {
      const { error } = await supabase.from('profile_likes').insert({ profile_id: userId, liker_id: myId })
      if (!error) {
        setLiked(true)
        setLikeCount(c => c + 1)
        setToast('Like added ❤️')
        notifyProfileLike(myId, userId)
      }
    }
    setLiking(false)
  }

  async function handleFollow() {
    if (!myId || !userId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'following') {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', userId)
      setFollowStatus('none')
      setFollowers(f => Math.max(0, f - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: myId, following_id: userId })
      await notifyFollow(myId, userId)
      setFollowStatus('following')
      setFollowers(f => f + 1)
    }
    setActionLoading(false)
  }

  async function handleBlock() {
    if (!myId || !userId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'blocked') {
      await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', userId)
      setFollowStatus('none')
    } else {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', userId)
      await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: userId })
      setFollowStatus('blocked')
      setFollowers(f => Math.max(0, f - 1))
    }
    setActionLoading(false)
  }

  async function handleMessage() {
    if (!myId || !userId) return
    const { data: myRooms } = await supabase.from('room_members').select('room_id').eq('user_id', myId)
    const roomIds = (myRooms ?? []).map((r: { room_id: string }) => r.room_id)
    let existingRoomId: string | null = null
    if (roomIds.length > 0) {
      const { data: theirRooms } = await supabase.from('room_members').select('room_id').eq('user_id', userId).in('room_id', roomIds)
      if (theirRooms && theirRooms.length > 0) {
        const { data: dmRoom } = await supabase.from('chat_rooms').select('id').eq('type', 'dm').in('id', theirRooms.map((r: { room_id: string }) => r.room_id)).maybeSingle()
        if (dmRoom) existingRoomId = dmRoom.id
      }
    }
    let newRoom = null
    if (!existingRoomId) {
      const { data } = await supabase.from('chat_rooms').insert({ type: 'dm', created_by: myId }).select().single()
      newRoom = data
    }
    if (newRoom) {
      await supabase.from('room_members').insert([
        { room_id: newRoom.id, user_id: myId },
        { room_id: newRoom.id, user_id: userId },
      ])
    }
    navigate('/chat')
  }

  if (loading || !player) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const rank = getRank(player.xp)
  const RankIcon = RANK_ICONS[rank.title] ?? Zap
  const displayName = player.display_name || player.username

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 160, background: bannerUrl ? 'transparent' : `linear-gradient(135deg, ${rank.color}44, #4f8ef722)`, overflow: 'hidden' }}>
        {bannerUrl && <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Player Profile</span>
          <div style={{ width: 34 }} />
        </div>
      </div>

      {/* ── Profile pic + name row ── */}
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 16, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 20px ${rank.color}55`, border: '3px solid var(--bg)' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 16, background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
            {/* Like — below avatar, left side */}
            <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); handleLike() }} disabled={liking}
              className="ripple-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.1)'}`, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', cursor: liking ? 'default' : 'pointer', boxShadow: '2px 2px 6px var(--neu-dark)' }}>
              <Heart size={14} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
            </button>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{displayName}</span>
              <PresenceDot status={presence} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{player.username}</div>
          </div>
        </div>
      </div>

      {/* ── Rank badge ── */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: rank.color + '18', border: `1px solid ${rank.color}44` }}>
          <RankIcon size={12} style={{ color: rank.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: rank.color }}>{rank.title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Lv {player.level}</span>
        </div>
      </div>

      {/* ── Currently watching movie ── */}
      {watchingMovie && (
        <div style={{ margin: '0 20px 10px', padding: '10px 14px', borderRadius: 14, background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b00', boxShadow: '0 0 8px #ff6b00', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <Film size={14} style={{ color: '#ff9a3c', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
            Watching <strong style={{ color: '#ff9a3c' }}>Chillverse Movies</strong>
          </span>
        </div>
      )}

      {/* ── Currently playing game ── */}
      {currentlyPlaying && (
        <div style={{ margin: `0 20px ${watchingMovie ? '6px' : '16px'}`, padding: '10px 14px', borderRadius: 14, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <span>Level {player.level}</span>
          <span style={{ color: rank.color, fontWeight: 700 }}>{player.xp.toLocaleString()} XP</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${xpBarWidth}%`, background: `linear-gradient(90deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 10px ${rank.color}66`, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Followers',   value: followers.toLocaleString(), icon: <Users size={14} />, color: '#4f8ef7' },
            { label: 'Following',   value: following.toLocaleString(), icon: <Users size={14} />, color: '#9b6dff' },
            { label: 'Streak',      value: `${player.streak}d`, icon: <Flame size={14} />, color: 'var(--accent)' },
            { label: 'Leaderboard', value: lbPosition ? `#${lbPosition}` : '—', icon: <Trophy size={14} />, color: '#f5c542' },
            { label: 'Level',       value: player.level, icon: <Zap size={14} />, color: '#3ecf8e' },
            { label: 'Total XP',    value: player.xp >= 1000 ? `${(player.xp / 1000).toFixed(1)}k` : player.xp.toString(), icon: <Zap size={14} />, color: '#f5c542' },
          ].map(s => (
            <div key={s.label}
              style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ color: s.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', gap: 8 }}>
        <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); handleFollow() }} disabled={actionLoading || followStatus === 'blocked'}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: actionLoading || followStatus === 'blocked' ? 'not-allowed' : 'pointer', background: followStatus === 'following' ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: followStatus === 'following' ? '#3ecf8e' : '#fff', opacity: followStatus === 'blocked' ? 0.4 : 1, transition: 'all 0.15s' }}>
          {followStatus === 'following' ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
        </button>
        <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); handleMessage() }}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}>
          <MessageCircle size={13} /> Message
        </button>
        <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); setChallengeOpen(true) }}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(255,107,0,0.25)', background: 'rgba(255,107,0,0.08)', color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.15s' }}>
          <Swords size={13} /> Challenge
        </button>
        <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); handleBlock() }} disabled={actionLoading}
          style={{ padding: '10px 12px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer', background: followStatus === 'blocked' ? 'rgba(255,107,107,0.2)' : 'rgba(255,107,107,0.08)', color: followStatus === 'blocked' ? '#ff6b6b' : 'var(--text-muted)', transition: 'all 0.15s' }}>
          <ShieldOff size={13} />
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
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {albumPics.slice(0, 2).map(pic => (
              <div key={pic.id} style={{ flex: 1 }}>
                <div style={{ height: 110, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '2px 2px 8px var(--neu-dark)' }}>
                  <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pic.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {challengeOpen && <ChallengeModal name={displayName} onClose={() => setChallengeOpen(false)} />}
      {toast && <MiniToast msg={toast} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
