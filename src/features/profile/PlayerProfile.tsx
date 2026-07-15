// src/pages/PlayerProfile.tsx
import { useState, useEffect } from 'react'
import type React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, UserPlus, UserCheck, ShieldOff, X, Flag,
  MessageCircle, Zap, Heart, Star, Package,
  Gamepad2, Trophy, Users, ImageIcon, Film,
  Sparkles, Sunrise, Moon as MoonIcon, Globe2,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { ripple } from '../../shared/lib/ripple'
import { notifyFollow, notifyProfileView, notifyProfileLike } from '../achievements/achievements'
import { AchIcon, RARITY_COLOR } from '../achievements/Achievements'
import { getUserRankTier, type RankTier } from './ranks'
import { getGameMeta, getGameById } from '../games/games'
import { getAllPlayerRanks } from '../games/gameSession'
import ReportModal from '../safety/ReportModal'
import { usePlayerBadges } from '../badges/usePlayerBadges'
import BadgeRow from '../badges/BadgeRow'
import BadgesStatRow from '../badges/BadgesStatRow'
import BadgesModal from '../badges/BadgesModal'
import Avatar from '../../shared/components/Avatar'

function getRank(xp: number): RankTier { return getUserRankTier(xp) }

// Lower is better — used to pick a player's 3 best (rarest) unlocked
// achievements to show off, instead of just the 3 most recently earned.
const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }


const GAME_RANK_STARS: Record<string, number> = {
  beginner: 1, intermediate: 3, advanced: 4, master: 5,
}

// Real presence values, matching Settings.tsx / the profiles.presence column.
type Presence = 'online' | 'idle' | 'offline' | 'invisible'
const PRESENCE_COLORS: Record<Presence, string> = {
  online: '#3ecf8e', idle: '#f5c542', offline: '#888899', invisible: '#555566',
}
function PresenceDot({ status }: { status: Presence }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: PRESENCE_COLORS[status] + '18', border: `1px solid ${PRESENCE_COLORS[status]}44` }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRESENCE_COLORS[status], boxShadow: status === 'online' ? `0 0 6px ${PRESENCE_COLORS[status]}` : 'none' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: PRESENCE_COLORS[status], textTransform: 'capitalize' }}>{status}</span>
    </div>
  )
}

const GENDER_LABELS: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' }

// ── Info tag pills — mirrors Profile.tsx, but reads the owner's saved
//    choices (read-only here, no editing on the viewer-facing page). ──
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

interface PlayerData {
  id: string
  username: string
  original_username: string
  display_name: string | null
  avatar: string
  country: string | null
  interests: string[]
  xp: number
  level: number
  streak: number
  bio: string | null
  gender: string | null
  play_time: 'morning' | 'night' | null
  info_tags: string[]
  favorite_game: string | null
  grid_cards: string[]
  show_follow_counts: boolean
}
interface AlbumPic { id: string; label: string; imageUrl: string; equippedAsBanner?: boolean }

export default function PlayerProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [followers, setFollowers] = useState<number>(0)
  const [following, setFollowing] = useState<number>(0)
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'blocked'>('none')
  const [reportOpen, setReportOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [presence, setPresence] = useState<Presence>('offline')
  const [lbPosition, setLbPosition] = useState<number | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [watchingMovie, setWatchingMovie] = useState(false)
  const [exploring, setExploring] = useState(false)
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [albumPics, setAlbumPics] = useState<AlbumPic[]>([])
  const [wishlistCount, setWishlistCount] = useState(0)
  const [achievementCount, setAchievementCount] = useState(0)
  const [recentAchievements, setRecentAchievements] = useState<{ id: string; title: string; icon: string; rarity: string }[]>([])
  const [favoriteGameRank, setFavoriteGameRank] = useState<string | null>(null)
  const [equippedArtifact, setEquippedArtifact] = useState<string | null>(null)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showWishlist, setShowWishlist] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liking, setLiking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showBadgesModal, setShowBadgesModal] = useState(false)
  const { badges: playerBadges, defs: badgeDefs } = usePlayerBadges(userId)

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
    supabase.from('profiles').select('id, username, original_username, display_name, avatar, country, interests, xp, level, streak, bio, gender, play_time, info_tags, favorite_game, grid_cards, show_follow_counts')
      .eq('id', userId).single()
      .then(({ data }) => {
        setPlayer(data as PlayerData)
        setLoading(false)
      })
  }, [userId])

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
      const exploreEntry = entries.find(e => e.activity === 'exploring')

      setWatchingMovie(!!movieEntry)
      setCurrentlyPlaying(gameEntry?.game ?? null)
      setExploring(!!exploreEntry)
    }

    channel
      .on('presence', { event: 'sync' },  syncActivity)
      .on('presence', { event: 'join' },  syncActivity)
      .on('presence', { event: 'leave' }, syncActivity)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Load equipped avatar + banner + album pics + artifact
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('equipped_avatar, banner_url').eq('id', userId).single()
      .then(({ data }) => {
        if (data?.equipped_avatar) setEquippedAvatar(data.equipped_avatar)
        if (data?.banner_url) setBannerUrl(data.banner_url)
      })
    supabase.from('user_items').select('item_id, item_name, item_image, equipped_as_banner').eq('user_id', userId).eq('item_type', 'album_pic')
      .then(({ data }) => {
        setAlbumPics((data ?? []).map((d: Record<string, unknown>) => ({
          id: d.item_id as string, label: d.item_name as string, imageUrl: d.item_image as string,
          equippedAsBanner: !!d.equipped_as_banner,
        })))
      })
    supabase.from('user_items').select('item_name').eq('user_id', userId)
      .eq('item_type', 'artifact').eq('is_equipped', true).maybeSingle()
      .then(({ data }) => { if (data?.item_name) setEquippedArtifact(data.item_name as string) })
  }, [userId])

  // Load wishlist count (always visible to viewers — wishlist can't be hidden)
  useEffect(() => {
    if (!userId) return
    supabase.from('wishlist').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => setWishlistCount(count ?? 0))
  }, [userId])

  // Load achievement count + best 3 (rarest first)
  useEffect(() => {
    if (!userId) return
    supabase.from('player_achievements').select('achievement_id, unlocked_at, achievements(title, icon, rarity)')
      .eq('user_id', userId)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as { achievement_id: string; unlocked_at: string; achievements: { title: string; icon: string; rarity: string } | null }[]
        const best = [...rows]
          .sort((a, b) => {
            const rA = RARITY_RANK[a.achievements?.rarity ?? 'common'] ?? 3
            const rB = RARITY_RANK[b.achievements?.rarity ?? 'common'] ?? 3
            if (rA !== rB) return rA - rB
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
    supabase.from('player_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => setAchievementCount(count ?? 0))
  }, [userId])

  // Load this player's rank for their favorite game (for the star score)
  useEffect(() => {
    if (!userId || !player?.favorite_game) { setFavoriteGameRank(null); return }
    getAllPlayerRanks(userId).then(ranks => {
      const row = ranks[player.favorite_game as keyof typeof ranks]
      setFavoriteGameRank(row?.rank ?? null)
    })
  }, [userId, player?.favorite_game])

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

  function handleMessage() {
    if (!myId || !userId) return
    // Room creation/lookup previously happened here, but it inserted a
    // chat_rooms.created_by column that doesn't exist in the schema — the
    // insert failed silently and you'd land on an empty chat list with no
    // conversation opened. Handed off to Chat.tsx's startDmWith() instead,
    // triggered by the `openDmWith` state read in Chat.tsx's useEffect.
    navigate('/chat', { state: { openDmWith: userId } })
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
  const displayName = player.display_name || player.username

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 160, background: bannerUrl ? 'transparent' : `linear-gradient(135deg, ${rank.color}44, #4f8ef722)`, overflow: 'hidden' }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={26} style={{ color: 'rgba(255,255,255,0.18)' }} />
          </div>
        )}
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
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 20px ${rank.color}55`, border: '3px solid var(--bg)' }}>
              <Avatar src={player?.avatar} name={displayName} size={74} radius={16} disabled />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{displayName}</span>
              <PresenceDot status={presence} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{player.username}</div>
              <BadgeRow badges={playerBadges} defs={badgeDefs} originalUsername={player.original_username ?? player.username} onOpenAll={() => setShowBadgesModal(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bio ── */}
      {player.bio && (
        <div style={{ padding: '0 20px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{player.bio}</p>
        </div>
      )}

      {/* ── Info tags row (Likes locked + owner's chosen tags) ── */}
      <div style={{ padding: '0 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={(e) => { ripple(e); handleLike() }} disabled={liking}
          className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.1)'}`, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', cursor: liking ? 'default' : 'pointer', boxShadow: '2px 2px 6px var(--neu-dark)' }}>
          <Heart size={13} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
        </button>
        <InfoTagPills tags={player.info_tags ?? []} gender={player.gender} playTime={player.play_time} country={player.country} presence={presence} />
      </div>

      {/* ── Rank badge ── */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: rank.color + '18', border: `1px solid ${rank.color}44` }}>
          <span style={{ fontSize: 13 }}>{rank.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: rank.color }}>{rank.name}</span>
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
      {currentlyPlaying && (() => {
        const gameMeta = getGameById(currentlyPlaying)
        const GameIcon = gameMeta?.icon ?? Gamepad2
        return (
          <div style={{ margin: `0 20px ${watchingMovie ? '6px' : '16px'}`, padding: '10px 14px', borderRadius: 14, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f8ef7', boxShadow: '0 0 8px #4f8ef7', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <GameIcon size={14} style={{ color: '#4f8ef7', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              Playing <strong style={{ color: '#4f8ef7' }}>{gameMeta?.name ?? currentlyPlaying}</strong>
            </span>
          </div>
        )
      })()}

      {/* ── Currently exploring ── */}
      {exploring && (
        <div style={{ margin: `0 20px ${(watchingMovie || currentlyPlaying) ? '6px' : '16px'}`, padding: '10px 14px', borderRadius: 14, background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', boxShadow: '0 0 8px #3ecf8e', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>⛵️ Exploring</span>
        </div>
      )}

      {/* ── Grid Advert ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Followers / Following — hidden if owner turned this off */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <Users size={15} style={{ color: '#4f8ef7' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{player.show_follow_counts ? followers.toLocaleString() : '—'}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Followers</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <Users size={15} style={{ color: '#9b6dff' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{player.show_follow_counts ? following.toLocaleString() : '—'}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Following</div>
              </div>
            </div>
          </div>

          {/* Wishlist — always visible to viewers */}
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

          {/* Current XP */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={15} style={{ color: '#f5c542' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Current XP</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: rank.color }}>{player.xp.toLocaleString()}</span>
          </div>

          {/* Owner's chosen optional cards */}
          {(player.grid_cards ?? []).includes('achievements') && (
            <button type="button" onClick={() => setShowAchievements(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trophy size={15} style={{ color: '#f5c542' }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Achievements</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{achievementCount}</span>
            </button>
          )}
          {(player.grid_cards ?? []).includes('rank') && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{rank.emoji}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Rank</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: rank.color }}>{rank.name}</span>
            </div>
          )}
          {(player.grid_cards ?? []).includes('leaderboard') && (
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
        <button type="button" onClick={(e) => { ripple(e); handleFollow() }} disabled={actionLoading || followStatus === 'blocked'}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: actionLoading || followStatus === 'blocked' ? 'not-allowed' : 'pointer', background: followStatus === 'following' ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: followStatus === 'following' ? '#3ecf8e' : '#fff', opacity: followStatus === 'blocked' ? 0.4 : 1, transition: 'all 0.15s' }}>
          {followStatus === 'following' ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
        </button>
        <button type="button" onClick={(e) => { ripple(e); handleMessage() }}
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}>
          <MessageCircle size={13} /> Message
        </button>
        <button type="button" onClick={(e) => { ripple(e); handleBlock() }} disabled={actionLoading}
          style={{ padding: '10px 12px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer', background: followStatus === 'blocked' ? 'rgba(255,107,107,0.2)' : 'rgba(255,107,107,0.08)', color: followStatus === 'blocked' ? '#ff6b6b' : 'var(--text-muted)', transition: 'all 0.15s' }}>
          <ShieldOff size={13} />
        </button>
        <button type="button" onClick={(e) => { ripple(e); setReportOpen(true) }}
          style={{ padding: '10px 12px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,107,107,0.08)', color: 'var(--text-muted)', transition: 'all 0.15s' }}>
          <Flag size={13} />
        </button>
      </div>

      {reportOpen && myId && userId && (
        <ReportModal
          reporterId={myId}
          targetType="user"
          targetId={userId}
          targetLabel={`@${player.username}`}
          onClose={() => setReportOpen(false)}
        />
      )}

      {/* ── Middle Advert: favorite game ── */}
      {player.favorite_game && (() => {
        const meta = getGameMeta(player.favorite_game!)
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
          </div>
        ) : (
          <ViewerAlbumGrid albumPics={albumPics} rankColor={rank.color} />
        )}
      </div>

      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Avatar</p>
          <button type="button" onClick={() => navigate('/mall')} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)', cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: equippedAvatar ? `${rank.color}20` : 'var(--surface2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {equippedAvatar && equippedAvatar.startsWith('http')
                ? <img src={equippedAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <Sparkles size={17} style={{ color: equippedAvatar ? rank.color : 'var(--text-muted)' }} />
              }
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: equippedAvatar ? 'var(--text)' : 'var(--text-muted)', textAlign: 'center' }}>
              {equippedAvatar ? (equippedAvatar.startsWith('http') ? 'Equipped' : equippedAvatar) : 'No avatar equipped'}
            </span>
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Artifact</p>
          <button type="button" onClick={() => navigate('/artifacts')} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)', cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: equippedArtifact ? `${rank.color}20` : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={17} style={{ color: equippedArtifact ? rank.color : 'var(--text-muted)' }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: equippedArtifact ? 'var(--text)' : 'var(--text-muted)', textAlign: 'center' }}>
              {equippedArtifact || 'No artifact equipped'}
            </span>
          </button>
        </div>
      </div>

      {showAchievements && (
        <SimpleListModal title="Achievements" subtitle={`${achievementCount} unlocked total`} onClose={() => setShowAchievements(false)}>
          {recentAchievements.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No achievements unlocked yet</p>
          ) : recentAchievements.map(a => {
            const color = RARITY_COLOR[a.rarity] ?? RARITY_COLOR.common
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${color}33,${color}11)`, border: `1.5px solid ${color}44` }}>
                  <AchIcon iconKey={a.icon} size={18} color={color} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{a.title}</span>
              </div>
            )
          })}
        </SimpleListModal>
      )}
      {showWishlist && <ViewerWishlistModal userId={userId!} onClose={() => setShowWishlist(false)} />}
      {showBadgesModal && (
        <BadgesModal badges={playerBadges} allDefs={badgeDefs} originalUsername={player.original_username ?? player.username} onClose={() => setShowBadgesModal(false)} />
      )}
      {toast && <MiniToast msg={toast} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}

// ── Simple bottom-sheet list modal (achievements) ────────────────
function SimpleListModal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  function close() { setVisible(false); setTimeout(onClose, 280) }
  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 505 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{title}</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </>
  )
}

// ── Viewer wishlist (read-only) ──────────────────────────────────
function ViewerWishlistModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; item_name: string; item_image: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('wishlist').select('id, item_name, item_image').eq('user_id', userId).order('added_at', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [userId])
  return (
    <SimpleListModal title="Wishlist" onClose={onClose}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Wishlist is empty</p>
      ) : items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.item_image ? <img src={item.item_image} alt={item.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{item.item_name}</span>
        </div>
      ))}
    </SimpleListModal>
  )
}

// ── Viewer album grid (tap to view full image, no banner control) ──
function ViewerAlbumGrid({ albumPics, rankColor }: { albumPics: AlbumPic[]; rankColor: string }) {
  const [opened, setOpened] = useState<AlbumPic | null>(null)
  return (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        {albumPics.slice(0, 2).map(pic => (
          <button key={pic.id} type="button" onClick={() => setOpened(pic)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ height: 90, borderRadius: 14, overflow: 'hidden', border: pic.equippedAsBanner ? `2px solid ${rankColor}` : '1px solid rgba(255,255,255,0.08)', boxShadow: '2px 2px 8px var(--neu-dark)' }}>
              <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pic.label}</div>
          </button>
        ))}
      </div>
      {opened && (
        <div onClick={() => setOpened(null)} style={{ position: 'fixed', inset: 0, zIndex: 510, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button type="button" onClick={() => setOpened(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={opened.imageUrl} alt={opened.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', marginTop: 12 }}>
              Acquired <strong style={{ color: 'var(--text)' }}>{opened.label}</strong>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
