// src/features/profile/ModeratorSelfProfile.tsx
//
// Rendered instead of the full self-edit Profile page when the signed-in
// account itself has user_moderation.role = 'moderator'. Deliberately
// minimal per spec: badges, total achievements, likes on the profile,
// followers/following counts, and their own posts — nothing else (no
// Edit Profile, wishlist, XP, rank, album, avatar/artifact equip cards,
// or settings).
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Trophy } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import { usePlayerBadges } from '../badges/usePlayerBadges'
import BadgeRow from '../badges/BadgeRow'
import BadgesStatRow from '../badges/BadgesStatRow'
import BadgesModal from '../badges/BadgesModal'
import Avatar from '../../shared/components/Avatar'
import PostCard from '../posts/PostCard'
import { fetchPostsByAuthor } from '../posts/posts'
import type { Post } from '../posts/types'
import { MOD_AVATAR_URL } from '../moderation/modShowcase'
import type { Profile } from '../../shared/types'

export default function ModeratorSelfProfile({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [achievementCount, setAchievementCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liking, setLiking] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [showBadgesModal, setShowBadgesModal] = useState(false)
  const { badges: playerBadges, defs: badgeDefs } = usePlayerBadges(profile.id)

  useEffect(() => {
    fetchPostsByAuthor(profile.id, profile.id).then(setPosts)
  }, [profile.id])

  useEffect(() => {
    supabase.from('player_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', profile.id)
      .then(({ count }) => setAchievementCount(count ?? 0))
  }, [profile.id])

  // Like count + whether the account has liked its own profile — mirrors
  // the existing self-like behavior on the regular Profile page.
  useEffect(() => {
    supabase.from('profile_likes').select('liker_id', { count: 'exact', head: true }).eq('profile_id', profile.id)
      .then(({ count }) => setLikeCount(count ?? 0))
    supabase.from('profile_likes').select('liker_id').eq('profile_id', profile.id).eq('liker_id', profile.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [profile.id])

  useEffect(() => {
    supabase.from('profile_follow_counts').select('followers_count, following_count')
      .eq('id', profile.id).single()
      .then(({ data }) => {
        if (data) { setFollowers(Number(data.followers_count)); setFollowing(Number(data.following_count)) }
      })
  }, [profile.id])

  async function handleLike() {
    if (liking) return
    setLiking(true)
    if (liked) {
      const { error } = await supabase.from('profile_likes').delete().eq('profile_id', profile.id).eq('liker_id', profile.id)
      if (!error) { setLiked(false); setLikeCount(c => Math.max(0, c - 1)) }
    } else {
      const { error } = await supabase.from('profile_likes').insert({ profile_id: profile.id, liker_id: profile.id })
      if (!error) { setLiked(true); setLikeCount(c => c + 1) }
    }
    setLiking(false)
  }

  const displayName = profile.display_name || profile.username

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: 130, background: 'linear-gradient(135deg, #9b6dff44, #4f8ef722)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>My Profile</span>
          <div style={{ width: 34 }} />
        </div>
      </div>

      {/* ── Avatar + name ── */}
      <div style={{ padding: '0 20px', marginTop: -44, marginBottom: 20, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, padding: 3, background: 'linear-gradient(135deg, #9b6dff, #4f8ef7)', boxShadow: '0 0 20px #9b6dff55', border: '3px solid var(--bg)' }}>
            <Avatar src={MOD_AVATAR_URL} name={displayName} size={74} radius={16} disabled />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', display: 'block', marginBottom: 4 }}>{displayName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>@{profile.username}</div>
              <BadgeRow
                badges={playerBadges} defs={badgeDefs} originalUsername={profile.original_username ?? profile.username}
                onOpenAll={() => setShowBadgesModal(true)}
                avatarUrl={MOD_AVATAR_URL} displayName={displayName} isOwnProfile
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Likes ── */}
      <div style={{ padding: '0 20px', marginBottom: 10 }}>
        <button type="button" onClick={(e) => { ripple(e); handleLike() }} disabled={liking}
          className="ripple-wrap"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '13px 16px', borderRadius: 16, background: liked ? 'rgba(255,77,139,0.14)' : 'var(--surface)', border: `1px solid ${liked ? 'rgba(255,77,139,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: liking ? 'default' : 'pointer', boxShadow: 'var(--elev-raise-sm)' }}>
          <Heart size={15} color={liked ? '#ff4d8b' : 'var(--text-muted)'} style={{ fill: liked ? '#ff4d8b' : 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: liked ? '#ff4d8b' : 'var(--text-dim)' }}>{likeCount}</span>
        </button>
      </div>

      {/* ── Followers / Following / Badges / Achievements ── */}
      <div style={{ padding: '0 20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{followers.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Followers</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{following.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Following</div>
            </div>
          </div>
        </div>

        <BadgesStatRow collected={playerBadges.length} total={badgeDefs.length} onClick={() => setShowBadgesModal(true)} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={15} style={{ color: '#f5c542' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Achievements</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{achievementCount}</span>
        </div>
      </div>

      {/* ── Posts ── */}
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

      {showBadgesModal && (
        <BadgesModal badges={playerBadges} allDefs={badgeDefs} originalUsername={profile.original_username ?? profile.username} onClose={() => setShowBadgesModal(false)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
