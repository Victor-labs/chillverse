// src/features/posts/StaffComposer.tsx
// Announcements-tab composer for staff (staff/moderator/admin — see
// useModRole). Deliberately kept separate from Composer.tsx rather than
// bolted on with conditionals: the two have different eligibility rules
// (no Gold-Rank gate here), different fields (post kind, pin, image), and
// keeping them apart means neither file grows into an unreadable branchy mess.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Megaphone, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ripple } from '../../shared/lib/ripple'
import { createAnnouncement, uploadFeedImage } from './staffPosts'
import type { PostKind } from './types'
import { RANK_GROUPS, type RankGroupId } from '../profile/ranks'

interface StaffComposerProps {
  open: boolean
  onClose: () => void
  onPosted: () => void
}

const KIND_OPTIONS: { value: PostKind; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'feature_update', label: 'Feature Update' },
  { value: 'general', label: 'General' },
  { value: 'rank_tag', label: 'Rank Tag' },
]

export default function StaffComposer({ open, onClose, onPosted }: StaffComposerProps) {
  const { user } = useAuth()

  const [postKind, setPostKind] = useState<PostKind>('announcement')
  const [rankTagGroup, setRankTagGroup] = useState<RankGroupId | null>(null)
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [commentable, setCommentable] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset the form each time the composer is opened fresh, and revoke any
  // outstanding object URL so we don't leak memory across opens.
  useEffect(() => {
    if (!open) return
    setPostKind('announcement')
    setRankTagGroup(null)
    setBody('')
    setImageFile(null)
    setImagePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPinned(false)
    setCommentable(true)
    setSubmitError('')
  }, [open])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  if (!open) return null

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setSubmitError('')
  }

  function removeImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!user || !body.trim() || submitting) return
    if (postKind === 'rank_tag' && !rankTagGroup) { setSubmitError('Pick a rank group to tag.'); return }
    setSubmitting(true)
    setSubmitError('')

    try {
      let mediaUrl: string | null = null
      if (imageFile) {
        mediaUrl = await uploadFeedImage(user.id, imageFile)
      }

      const { error } = await createAnnouncement({
        authorId: user.id,
        body: body.trim(),
        postKind,
        mediaUrl,
        pinned,
        commentable,
        rankTagGroup,
      })

      if (error) {
        setSubmitError(error.message || 'Failed to post. Please try again.')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
      onPosted()
      onClose()
    } catch (e) {
      setSubmitting(false)
      setSubmitError(e instanceof Error ? e.message : 'Failed to post. Please try again.')
    }
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="neu-card"
        style={{
          width: '100%', maxWidth: 800, margin: '0 auto', padding: 18, borderRadius: '20px 20px 0 0',
          maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2">
            <Megaphone size={16} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>New Staff Post</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Post kind selector */}
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
          {KIND_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className="ripple-wrap"
              onClick={(e) => { ripple(e); setPostKind(opt.value) }}
              style={{
                padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                border: postKind === opt.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                background: postKind === opt.value ? 'rgba(255,107,0,0.12)' : 'var(--surface2)',
                color: postKind === opt.value ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {postKind === 'rank_tag' && (
          <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
            {RANK_GROUPS.map(g => (
              <button
                key={g.id}
                type="button"
                className="ripple-wrap"
                onClick={(e) => { ripple(e); setRankTagGroup(g.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  border: rankTagGroup === g.id ? `1px solid ${g.color}` : '1px solid rgba(255,255,255,0.08)',
                  background: rankTagGroup === g.id ? `${g.color}22` : 'var(--surface2)',
                  color: rankTagGroup === g.id ? g.color : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                {g.label}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={500}
          placeholder="What's the announcement?"
          rows={4}
          style={{
            width: '100%', background: 'var(--surface2)', borderRadius: 12, padding: 12,
            fontSize: 14, lineHeight: 1.45, fontFamily: 'inherit', color: 'var(--text)',
            border: 'none', outline: 'none', resize: 'none',
          }}
        />

        {/* Image attach */}
        <div style={{ marginTop: 10 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            style={{ display: 'none' }}
          />
          {imagePreviewUrl ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
              <img src={imagePreviewUrl} alt="Attachment preview" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
              <button
                type="button"
                onClick={removeImage}
                style={{
                  position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ripple-wrap"
              onClick={(e) => { ripple(e); fileInputRef.current?.click() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px dashed rgba(255,255,255,0.15)',
                color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer',
              }}
            >
              <ImageIcon size={14} /> Attach an image
            </button>
          )}
        </div>

        <label className="flex items-center gap-2" style={{ marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Pin to top of Announcements</span>
        </label>

        <label className="flex items-center gap-2" style={{ marginTop: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={commentable} onChange={e => setCommentable(e.target.checked)} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Allow comments on this post</span>
        </label>

        {submitError && (
          <p style={{ fontSize: 11.5, color: '#ff6b6b', marginTop: 10 }}>{submitError}</p>
        )}

        <button
          type="button"
          className="btn-primary ripple-wrap"
          onClick={(e) => { ripple(e); handleSubmit() }}
          disabled={!body.trim() || submitting || (postKind === 'rank_tag' && !rankTagGroup)}
          style={{ width: '100%', padding: '11px 0', marginTop: 14, opacity: !body.trim() || submitting || (postKind === 'rank_tag' && !rankTagGroup) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Sparkles size={14} /> {submitting ? 'Posting…' : 'Post to Announcements'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
