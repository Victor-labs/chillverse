// src/features/posts/PostCard.tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Sparkles, MoreVertical, Share2, Trash2, Check, Flag } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useModRole } from '../moderation/useModRole'
import { toggleLike, deletePost } from './posts'
import { ripple } from '../../shared/lib/ripple'
import CommentThread from './CommentThread'
import FollowButton from './FollowButton'
import InfluenceModal from './InfluenceModal'
import { AchievementTagInline, AchievementTagModal } from './AchievementTagPreview'
import PostBody from './PostBody'
import { getTagColor } from './tagColor'
import ReportModal from '../safety/ReportModal'
import type { Post, PostTag } from './types'
import { getRankGroupInfo, type RankGroupId } from '../profile/ranks'
import HiddenContentNotice from '../moderation/HiddenContentNotice'
import Avatar from '../../shared/components/Avatar'
import { useProfilePreviewOptional } from '../../context/ProfilePreview'
import { updateMissionProgress } from '../missions/weeklyMissions'

const TAG_ICON: Record<string, string> = {
  achievement: '🏆', game_result: '🎮', multiplayer_result: '⚔️', rank: '🎖️',
  streak: '🔥', mission: '📋', user: '👤', avatar: '🖼️', artifact: '💎', mall_item: '🛍️',
}

// Long-form staff posts (see migration 0100) get clipped on the card with a
// "Read more" link into /feed/:id (SinglePostPage), same shape as the blog
// card → blog article pattern. Regular user posts are capped at 500 chars
// server-side, so this never fires for them.
const CARD_TRUNCATE_AT = 600

export default function PostCard({ post, onDeleted, truncate = true }: { post: Post; onDeleted?: (postId: string) => void; truncate?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isStaff } = useModRole()
  const preview = useProfilePreviewOptional()
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [showComments, setShowComments] = useState(false)
  const [showInfluenceModal, setShowInfluenceModal] = useState(false)
  const [modalAchievementId, setModalAchievementId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAuthor = !!user && post.author_type === 'user' && post.author_id === user.id
  // Staff/mod/admin can delete any announcement/system post (RLS in
  // migration 0028 already allows this server-side) — not just their own.
  const isStaffPost = post.author_type === 'admin' || post.author_type === 'system'
  const canDelete = isAuthor || (isStaff && isStaffPost)
  const rankTagInfo = post.post_kind === 'rank_tag' && post.rank_tag_group
    ? getRankGroupInfo(post.rank_tag_group as RankGroupId)
    : null
  // See migration 0092 — blog_slug/title/excerpt/hero_image are a snapshot
  // taken at share time, not a live join, so this renders fine even if the
  // source article (or its category) was since edited, unpublished, or
  // deleted entirely.
  const isBlogFeature = post.post_kind === 'blog_feature' && !!post.blog_slug

  function goToBlogArticle() {
    if (post.blog_slug) navigate(`/blog/${post.blog_slug}`)
  }

  useEffect(() => {
    if (!menuOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  const author = post.author
  const authorName = post.author_type === 'system'
    ? 'Chillverse'
    : post.author_type === 'admin'
      ? (author?.display_name || author?.username || 'Admin')
      : (author?.display_name || author?.username || 'Unknown')

  const isSystemOrAdmin = post.author_type !== 'user'
  const singleAchievementTag = post.tags.length === 1 && post.tags[0].type === 'achievement' ? post.tags[0] : null

  const isClipped = truncate && post.body.length > CARD_TRUNCATE_AT
  // Cut at the last whole word before the limit so we don't slice a word in half.
  const clippedBody = isClipped
    ? `${post.body.slice(0, CARD_TRUNCATE_AT).replace(/\s+\S*$/, '')}…`
    : post.body

  async function handleLike() {
    if (!user) return
    const next = !liked
    setLiked(next)
    setLikesCount(c => c + (next ? 1 : -1))
    const ok = await toggleLike(post.id, user.id, liked)
    if (!ok) {
      setLiked(!next)
      setLikesCount(c => c + (next ? -1 : 1))
    } else if (next) {
      updateMissionProgress(user.id, 'posts_liked', 1).catch(console.error)
    }
  }

  function goToAuthorProfile() {
    if (isSystemOrAdmin || !post.author_id) return
    preview?.openProfilePreview(post.author_id)
  }

  function handleTagClick(tag: PostTag) {
    if (tag.type === 'achievement') { setModalAchievementId(tag.ref_id); return }
    if ((tag.type === 'game_result' || tag.type === 'multiplayer_result') && tag.meta?.gameId) {
      navigate('/games', { state: { openGame: tag.meta.gameId } })
      return
    }
    if (tag.type === 'user') {
      navigate(tag.ref_id === user?.id ? '/profile' : `/profile/${tag.ref_id}`)
    }
    // rank / streak / avatar / artifact / mission / mall_item — display only, no navigation target
  }

  function isClickableTag(tag: PostTag) {
    return tag.type === 'achievement' || tag.type === 'user' ||
      ((tag.type === 'game_result' || tag.type === 'multiplayer_result') && !!tag.meta?.gameId)
  }

  async function handleShare() {
    const url = `${window.location.origin}/feed/${post.id}`
    const shareText = post.body.length > 100 ? `${post.body.slice(0, 100)}…` : post.body

    if (navigator.share) {
      setMenuOpen(false)
      try {
        await navigator.share({ title: `${authorName} on Chillverse`, text: shareText, url })
      } catch {
        // user cancelled the share sheet — no action needed
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => { setLinkCopied(false); setMenuOpen(false) }, 1200)
    } catch (e) {
      console.error('copy link error:', e)
      setMenuOpen(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    const ok = await deletePost(post.id)
    setDeleting(false)
    setConfirmingDelete(false)
    if (ok) onDeleted?.(post.id)
  }

  return (
    <div className="neu-card" style={{ padding: 16, marginBottom: 12, ...(rankTagInfo ? { background: `${rankTagInfo.color}0d`, border: `1px solid ${rankTagInfo.color}55` } : {}) }}>
      <div className="flex items-center gap-3">
        <Avatar
          src={author?.avatar}
          name={authorName}
          userId={isSystemOrAdmin ? null : post.author_id}
          size={38}
          radius={12}
          disabled={isSystemOrAdmin}
          style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center">
            <button
              type="button"
              onClick={goToAuthorProfile}
              disabled={isSystemOrAdmin}
              style={{
                fontSize: 13.5, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', padding: 0, cursor: isSystemOrAdmin ? 'default' : 'pointer',
              }}
            >
              {authorName}
              {isSystemOrAdmin && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '1px 6px', borderRadius: 6 }}>
                  {post.author_type === 'system' ? 'SYSTEM' : 'ADMIN'}
                </span>
              )}
              {rankTagInfo && (
                <span style={{ fontSize: 10, fontWeight: 700, color: rankTagInfo.color, background: `${rankTagInfo.color}22`, padding: '1px 6px', borderRadius: 6 }}>
                  @{rankTagInfo.label} Tag
                </span>
              )}
            </button>
            {user && !isSystemOrAdmin && post.author_id && (
              <FollowButton myId={user.id} authorId={post.author_id} />
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {new Date(post.created_at).toLocaleString()}
          </p>
        </div>

        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="neu-card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, padding: 6, minWidth: 150 }}>
              <button
                type="button"
                onClick={handleShare}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontSize: 12.5, textAlign: 'left' }}
              >
                {linkCopied ? <Check size={14} color="var(--gold)" /> : <Share2 size={14} />}
                {linkCopied ? 'Link copied!' : 'Share'}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setConfirmingDelete(true) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', color: 'var(--red)', fontSize: 12.5, textAlign: 'left' }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              {!isAuthor && !isSystemOrAdmin && user && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setReportOpen(true) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', color: 'var(--red)', fontSize: 12.5, textAlign: 'left' }}
                >
                  <Flag size={14} /> Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {post.hidden ? (
        <HiddenContentNotice reason={post.hidden_reason} isOwner={isAuthor} />
      ) : (
        <>
          {post.title && (
            <h3 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, margin: '10px 0 0' }}>
              {post.title}
            </h3>
          )}
          <PostBody body={isClipped ? clippedBody : post.body} />
          {isClipped && (
            <button
              type="button"
              onClick={() => navigate(`/feed/${post.id}`)}
              style={{
                background: 'none', border: 'none', padding: 0, marginTop: 4,
                color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Read more
            </button>
          )}
        </>
      )}

      {!post.hidden && isBlogFeature && (
        <button
          type="button"
          onClick={(e) => { ripple(e); goToBlogArticle() }}
          className="ripple-wrap"
          style={{
            display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer',
            background: 'var(--surface2)', border: 'none', borderRadius: 14,
            padding: 0, width: '100%', marginTop: 10, overflow: 'hidden',
          }}
        >
          {post.blog_hero_image_url && (
            <img
              src={post.blog_hero_image_url}
              alt=""
              loading="lazy"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{ padding: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              📰 From the blog
            </span>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: '4px 0 4px', lineHeight: 1.3 }}>
              {post.blog_title}
            </h4>
            {post.blog_excerpt && (
              <p style={{
                fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4, margin: 0,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {post.blog_excerpt}
              </p>
            )}
          </div>
        </button>
      )}

      {!post.hidden && !isBlogFeature && post.media_type === 'image' && post.media_url && (
        <img
          src={post.media_url}
          alt=""
          loading="lazy"
          style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 14, marginTop: 10, display: 'block' }}
        />
      )}

      {/* Single achievement tag gets the rich inline card; anything else gets compact chips. */}
      {singleAchievementTag ? (
        <div style={{ marginTop: 10 }}>
          <AchievementTagInline achievementId={singleAchievementTag.ref_id} />
        </div>
      ) : post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
          {post.tags.map((tag, i) => {
            const clickable = isClickableTag(tag)
            const color = getTagColor(tag)
            return (
              <button
                key={i}
                type="button"
                onClick={() => clickable && handleTagClick(tag)}
                className="chip"
                style={{
                  fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none',
                  cursor: clickable ? 'pointer' : 'default',
                  textDecoration: clickable ? 'underline' : 'none', textUnderlineOffset: 2,
                  ...(color ? { color, borderColor: `${color}44` } : {}),
                }}
              >
                {TAG_ICON[tag.type] ?? '🏷️'} {tag.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-4" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="ripple-wrap"
          onClick={(e) => { ripple(e); handleLike() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
            cursor: 'pointer', color: liked ? 'var(--red)' : 'var(--text-dim)', fontSize: 12.5, fontWeight: 600,
          }}
        >
          <Heart size={15} fill={liked ? 'var(--red)' : 'none'} />
          {likesCount}
        </button>

        {post.commentable && (
          <button
            type="button"
            onClick={() => setShowComments(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 600 }}
          >
            <MessageCircle size={15} />
            {post.comments_count}
          </button>
        )}

        {post.influence > 0 && (
          <button
            type="button"
            onClick={() => setShowInfluenceModal(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gold)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Sparkles size={12} /> {post.influence}
          </button>
        )}
      </div>

      {post.commentable && showComments && (
        <div style={{ marginTop: 12 }}>
          <CommentThread postId={post.id} />
        </div>
      )}

      <InfluenceModal
        open={showInfluenceModal}
        onClose={() => setShowInfluenceModal(false)}
        authorName={authorName}
        influence={post.influence}
      />

      {modalAchievementId && (
        <AchievementTagModal achievementId={modalAchievementId} onClose={() => setModalAchievementId(null)} />
      )}

      {confirmingDelete && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div className="neu-card" style={{ width: '100%', maxWidth: 320, padding: 20, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Delete this post?</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              This can't be undone — comments and likes on it will be removed too.
            </p>
            <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--surface2)', border: 'none', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--red)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {reportOpen && user && (
        <ReportModal
          reporterId={user.id}
          targetType="post"
          targetId={post.id}
          targetLabel="this post"
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
