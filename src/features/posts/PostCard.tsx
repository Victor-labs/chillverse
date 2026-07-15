// src/features/posts/PostCard.tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Sparkles, MoreVertical, Share2, Trash2, Check, Flag, Pin, PinOff, Megaphone } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useModRole } from '../moderation/useModRole'
import { toggleLike, deletePost } from './posts'
import { setAnnouncementPinned } from './staffPosts'
import { ripple } from '../../shared/lib/ripple'
import CommentThread from './CommentThread'
import FollowButton from './FollowButton'
import InfluenceModal from './InfluenceModal'
import { AchievementTagInline, AchievementTagModal } from './AchievementTagPreview'
import PostBody from './PostBody'
import { getTagColor } from './tagColor'
import ReportModal from '../safety/ReportModal'
import Avatar from '../../shared/components/Avatar'
import { useProfilePreview } from '../../context/ProfilePreview'
import type { Post, PostTag } from './types'

const TAG_ICON: Record<string, string> = {
  achievement: '🏆', game_result: '🎮', multiplayer_result: '⚔️', rank: '🎖️',
  streak: '🔥', mission: '📋', user: '👤', avatar: '🖼️', artifact: '💎', mall_item: '🛍️',
}

const KIND_LABEL: Record<string, string> = {
  announcement: 'Announcement',
  feature_update: 'Feature Update',
}

export default function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (postId: string) => void }) {
  const { user } = useAuth()
  const { isStaff } = useModRole()
  const navigate = useNavigate()
  const { openProfilePreview } = useProfilePreview()
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [pinned, setPinned] = useState(post.pinned)
  const [pinning, setPinning] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showInfluenceModal, setShowInfluenceModal] = useState(false)
  const [modalAchievementId, setModalAchievementId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isSystemOrAdmin = post.author_type !== 'user'
  const isAuthor = !!user && post.author_type === 'user' && post.author_id === user.id
  const isStaffPost = isSystemOrAdmin
  const canManageAsStaff = isStaff && isStaffPost
  const canDelete = isAuthor || canManageAsStaff

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

  const singleAchievementTag = post.tags.length === 1 && post.tags[0].type === 'achievement' ? post.tags[0] : null
  const kindLabel = isStaffPost ? KIND_LABEL[post.post_kind] : undefined

  async function handleLike() {
    if (!user) return
    const next = !liked
    setLiked(next)
    setLikesCount(c => c + (next ? 1 : -1))
    const ok = await toggleLike(post.id, user.id, liked)
    if (!ok) {
      setLiked(!next)
      setLikesCount(c => c + (next ? -1 : 1))
    }
  }

  async function handleTogglePin() {
    if (pinning) return
    setPinning(true)
    const next = !pinned
    const ok = await setAnnouncementPinned(post.id, next)
    setPinning(false)
    if (ok) {
      setPinned(next)
      setMenuOpen(false)
    }
  }

  function goToAuthorProfile() {
    if (isSystemOrAdmin || !post.author_id) return
    openProfilePreview(post.author_id)
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
    <div className="neu-card" style={{ padding: 16, marginBottom: 12, position: 'relative' }}>
      {pinned && isStaffPost && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Pin size={11} fill="var(--gold)" /> Pinned
        </div>
      )}
      <div className="flex items-center gap-3">
        {isStaffPost ? (
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--purple), var(--blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Megaphone size={16} />
          </div>
        ) : (
          <Avatar
            src={author?.avatar} name={authorName} size={38}
            onClick={goToAuthorProfile}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
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
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(255,107,0,0.12)', padding: '1px 6px', borderRadius: 6 }}>
                  {post.author_type === 'system' ? 'SYSTEM' : 'ADMIN'}
                </span>
              )}
            </button>
            {kindLabel && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', background: 'rgba(91,156,255,0.12)', padding: '1px 6px', borderRadius: 6 }}>
                {kindLabel}
              </span>
            )}
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
            <div className="neu-card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, padding: 6, minWidth: 170 }}>
              <button
                type="button"
                onClick={handleShare}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontSize: 12.5, textAlign: 'left' }}
              >
                {linkCopied ? <Check size={14} color="var(--gold)" /> : <Share2 size={14} />}
                {linkCopied ? 'Link copied!' : 'Share'}
              </button>
              {canManageAsStaff && (
                <button
                  type="button"
                  onClick={handleTogglePin}
                  disabled={pinning}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: pinning ? 'default' : 'pointer', color: 'var(--gold)', fontSize: 12.5, textAlign: 'left', opacity: pinning ? 0.6 : 1 }}
                >
                  {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  {pinned ? 'Unpin' : 'Pin to top'}
                </button>
              )}
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

      <PostBody body={post.body} />

      {post.media_url && (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
          <img src={post.media_url} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} loading="lazy" />
        </div>
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
