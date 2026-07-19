// src/features/profile/ModeratorProfile.tsx
//
// Reddit-style showcase profile shown instead of the normal PlayerProfile
// layout when the viewed account has user_moderation.role = 'moderator'.
// Deliberately narrow: badges, presence, bio, a locked profile pic, feed
// posts, staff "Official Notice" comments, drip-fed achievements, a
// hardcoded member-since date, and Follow/Share — nothing else (no XP,
// level, streak, inventory, or game stats; see migration 0030 + the
// mod-showcase-achievement-drip edge function for the backing data).
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, ShieldCheck, Megaphone, Check, Heart, Users } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { ripple } from '../../shared/lib/ripple'
import { usePlayerBadges } from '../badges/usePlayerBadges'
import BadgeRow from '../badges/BadgeRow'
import BadgesModal from '../badges/BadgesModal'
import Avatar from '../../shared/components/Avatar'
import FollowButton from '../posts/FollowButton'
import PostCard from '../posts/PostCard'
import { fetchPostsByAuthor } from '../posts/posts'
import type { Post } from '../posts/types'
import { getAllAchievements, getPlayerAchievements } from '../achievements/achievements'
import type { Achievement } from '../achievements/achievements'
import { AchIcon, RARITY_COLOR } from '../achievements/Achievements'
import { notifyProfileLike } from '../achievements/achievements'
import { MOD_AVATAR_URL } from '../moderation/modShowcase'

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

interface ModProfileData {
  id: string
  username: string
  original_username: string
  display_name: string | null
  bio: string | null
  presence: Presence
  staff_member_since: string | null
  created_at: string
}

interface NoticeRow {
  id: string
  post_id: string
  body: string
  created_at: string
}

export default function ModeratorProfile({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [profile, setProfile] = useState<ModProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [showBadgesModal, setShowBadgesModal] = useState(false)
  const [shared, setShared] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liking, setLiking] = useState(false)
  const { badges: playerBadges, defs: badgeDefs } = usePlayerBadges(userId)

  // Load core profile fields (bio, presence, member-since — no XP/level/streak).
  useEffect(() => {
    setLoading(true)
    supabase.from('profiles')
      .select('id, username, original_username, display_name, bio, presence, staff_member_since, created_at')
      .eq('id', userId).single()
      .then(({ data }) => { setProfile(data as ModProfileData); setLoading(false) })
  }, [userId])

  // Load this mod's feed posts (like/comment already built into PostCard).
  useEffect(() => {
    fetchPostsByAuthor(userId, myId).then(setPosts)
  }, [userId, myId])

  // Load their self-tagged "Official Notice" feed comments only.
  useEffect(() => {
    supabase.from('comments')
      .select('id, post_id, body, created_at')
      .eq('author_id', userId)
      .eq('is_notice', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data ?? []) as NoticeRow[]))
  }, [userId])

  // Load only the achievements actually unlocked so far (drip-fed by the
  // scheduled edge function) — no locked/greyed placeholders for the rest.
  useEffect(() => {
    Promise.all([getAllAchievements(), getPlayerAchievements(userId)]).then(([all, unlocked]) => {
      const byId = new Map(all.map(a => [a.id, a]))
      const ordered = [...unlocked]
        .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())
        .map(u => byId.get(u.achievement_id))
        .filter((a): a is Achievement => !!a)
      setAchievements(ordered)
    })
  }, [userId])

  // Load follower/following counts.
  useEffect(() => {
    supabase.from('profile_follow_counts').select('followers_count, following_count')
      .eq('id', userId).single()
      .then(({ data }) => {
        if (data) { setFollowers(Number(data.followers_count)); setFollowing(Number(data.following_count)) }
      })
  }, [userId])

  // Load like count + whether I've already liked this profile.
  useEffect(() => {
    supabase.from('profile_likes').select('liker_id', { count: 'exact', head: true }).eq('profile_id', userId)
      .then(({ count }) => setLikeCount(count ?? 0))
    if (myId) {
      supabase.from('profile_likes').select('liker_id').eq('profile_id', userId).eq('liker_id', myId).maybeSingle()
        .then(({ data }) => setLiked(!!data))
    }
  }, [userId, myId])

  async function handleLike() {
    if (!myId || liking) return
    setLiking(true)
    if (liked) {
      const { error } = await supabase.from('profile_likes').delete().eq('profile_id', userId).eq('liker_id', myId)
      if (!error) { setLiked(false); setLikeCount(c => Math.max(0, c - 1)) }
    } else {
      const { error } = await supabase.from('profile_likes').insert({ profile_id: userId, liker_id: myId })
      if (!error) { setLiked(true); setLikeCount(c => c + 1); notifyProfileLike(myId, userId) }
    }
    setLiking(false)
  }

  async function handleShare() {
    const url = `${window.location.origin}/profile/${userId}`
    const name = profile?.display_name || profile?.username || 'this moderator'
    if (navigator.share) {
      try { await navigator.share({ title: `${name} on Chillverse`, url }) } catch { /* user cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch (e) {
      console.error('share link copy error:', e)
    }
  }

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const displayName = profile.display_name || profile.username
  const memberSince = new Date(profile.staff_member_since ?? profile.created_at)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 130, background: 'linear-gradient(135deg, #9b6dff44, #4f8ef722)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Moderator Profile</span>
          <div style={{ width: 34 }} />
        </div>
      </div>

      {/* ── Avatar + name row ── */}
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: 'linear-gradient(135deg, #9b6dff, #4f8ef7)', boxShadow: '0 0 20px #9b6dff55', border: '3px solid var(--bg)' }}>
            <Avatar src={MOD_AVATAR_URL} name={displayName} size={74} radius={16} disabled />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{displayName}</span>
              <PresenceDot status={profile.presence} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{profile.username}</div>
              <BadgeRow badges={playerBadges} defs={badgeDefs} originalUsername={profile.original_username ?? profile.username} onOpenAll={() => setShowBadgesModal(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Moderator chip ── */}
      <div style={{ padding: '0 20px', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(155,109,255,0.14)', border: '1px solid rgba(155,109,255,0.4)' }}>
          <ShieldCheck size={13} style={{ color: '#9b6dff' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9b6dff' }}>Moderator</span>
        </div>
      </div>

      {/* ── Bio ── */}
      {profile.bio && (
        <div style={{ padding: '0 20px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{profile.bio}</p>
        </div>
      )}

      {/* ── Likes + Followers/Following ── */}
      <div style={{ padding: '0 20px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <button type="button" onClick={(e) => { ripple(e); handleLike() }} disabled={!myId || liking}
          className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: !myId || liking ? 'default' : 'pointer', boxShadow: 'var(--elev-raise-sm)' }}>
          <Heart size={15} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)' }}>
          <Users size={15} style={{ color: '#4f8ef7' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{followers.toLocaleString()}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Followers</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)' }}>
          <Users size={15} style={{ color: '#9b6dff' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{following.toLocaleString()}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Following</div>
          </div>
        </div>
      </div>

      {/* ── Member since ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Member since {memberSince}</p>
      </div>

      {/* ── Follow + Share ── */}
      <div style={{ padding: '0 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        {myId && myId !== userId && <FollowButton myId={myId} authorId={userId} />}
        <button type="button" onClick={(e) => { ripple(e); handleShare() }}
          className="ripple-wrap"
          style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out)' }}>
          {shared ? <Check size={13} color="var(--gold)" /> : <Share2 size={13} />} {shared ? 'Link copied!' : 'Share'}
        </button>
      </div>

      {/* ── Feed posts ── */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Posts</p>
        {posts.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No posts yet</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard key={post.id} post={post} onDeleted={id => setPosts(p => p.filter(x => x.id !== id))} />
          ))
        )}
      </div>

      {/* ── Official Notices ── */}
      {notices.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Official Notices</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notices.map(n => (
              <button key={n.id} type="button" onClick={() => navigate(`/feed/${n.post_id}`)}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.3)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Megaphone size={12} style={{ color: '#f5c542' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f5c542', textTransform: 'uppercase', letterSpacing: 0.3 }}>Official Notice</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text)' }}>{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Achievements (unlocked-so-far only) ── */}
      {achievements.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
            Achievements ({achievements.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {achievements.map(a => {
              const color = RARITY_COLOR[a.rarity] ?? RARITY_COLOR.common
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${color}33,${color}11)`, border: `1.5px solid ${color}44` }}>
                    <AchIcon iconKey={a.icon} size={18} color={color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', display: 'block' }}>{a.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.description}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showBadgesModal && (
        <BadgesModal badges={playerBadges} allDefs={badgeDefs} originalUsername={profile.original_username ?? profile.username} onClose={() => setShowBadgesModal(false)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
