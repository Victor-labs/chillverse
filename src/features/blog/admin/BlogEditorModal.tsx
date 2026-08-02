// src/features/blog/admin/BlogEditorModal.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ImagePlus, Loader2, Bold, Italic, Code, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Table as TableIcon, FileCode, Youtube, Image as ImageIcon,
  Eye, History, Clock, Sparkles,
} from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { useAuth } from '../../auth/useAuth'
import {
  uploadBlogImage, createBlogPost, updateBlogPost, fetchBlogCategoryRows, fetchBlogTagRows,
  fetchAuthorCandidates, fetchPostRevisions, fetchMediaLibrary, friendlyBlogError,
} from '../api'
import { applyMarkdownAction, extractYouTubeId, renderLiteMarkdown, type MarkdownAction } from '../../../shared/lib/markdownLite'
import type {
  BlogAuthor, BlogCategoryRow, BlogPost, BlogPostInput, BlogPostRevision, BlogTagRow,
} from '../../../shared/types'
import { inputStyle, errorBoxStyle, overlayStyle, modalStyle, wordCount, estimateReadingTime } from './styles'

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function toLocalDateTimeValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM: BlogPostInput = {
  slug: '', title: '', excerpt: '', content: '', heroImageUrl: '',
  category: '', series: '', tags: [], locale: 'en',
  translationGroupId: null, authorId: null, isPublished: false,
  status: 'draft', scheduledAt: null, seoTitle: '', metaDescription: '',
}

export default function BlogEditorModal({
  post, canPublish, currentUserRole, onClose, onSaved,
}: {
  post: BlogPost | null // null = creating a new post
  canPublish: boolean   // moderator/admin
  currentUserRole: 'staff' | 'moderator' | 'admin' | 'user'
  onClose: () => void
  onSaved: (post: BlogPost) => void
}) {
  const { user } = useAuth()
  const [categories, setCategories] = useState<BlogCategoryRow[]>([])
  const [tagOptions, setTagOptions] = useState<BlogTagRow[]>([])
  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [revisions, setRevisions] = useState<BlogPostRevision[]>([])
  const [showRevisions, setShowRevisions] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState<'hero' | 'content' | null>(null)

  const readOnly = !!post && currentUserRole === 'staff' && (post.status !== 'draft' || post.author_id !== user?.id)

  const [form, setForm] = useState<BlogPostInput>(() => post ? postToForm(post) : {
    ...EMPTY_FORM,
    authorId: user?.id ?? null,
  })
  const [tagsInput, setTagsInput] = useState(post?.tags.join(', ') ?? '')
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [postId, setPostId] = useState<string | null>(post?.id ?? null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const dirtyRef = useRef(false)

  function postToForm(p: BlogPost): BlogPostInput {
    return {
      slug: p.slug, title: p.title, excerpt: p.excerpt ?? '', content: p.content, heroImageUrl: p.hero_image_url ?? '',
      category: p.category, series: p.series ?? '', tags: p.tags, locale: p.locale,
      translationGroupId: p.translation_group_id, authorId: p.author_id, isPublished: p.is_published,
      status: p.status, scheduledAt: p.scheduled_at, seoTitle: p.seo_title ?? '', metaDescription: p.meta_description ?? '',
    }
  }

  useEffect(() => {
    if (!post && user && !form.authorId) {
      setForm(f => ({ ...f, authorId: user.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    Promise.all([fetchBlogCategoryRows(), fetchBlogTagRows(), fetchAuthorCandidates()])
      .then(([c, t, a]) => {
        setCategories(c)
        setTagOptions(t)
        setAuthors(a)
        setForm(f => f.category ? f : { ...f, category: c[0]?.slug ?? '' })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (postId) fetchPostRevisions(postId).then(setRevisions).catch(() => {})
  }, [postId])

  function update<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    dirtyRef.current = true
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleTitleChange(title: string) {
    dirtyRef.current = true
    setForm(f => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }))
  }

  function handleTagsChange(value: string) {
    setTagsInput(value)
    update('tags', value.split(',').map(t => t.trim()).filter(Boolean))
  }

  function toggleTagChip(slug: string) {
    const has = form.tags.includes(slug)
    const next = has ? form.tags.filter(t => t !== slug) : [...form.tags, slug]
    update('tags', next)
    setTagsInput(next.join(', '))
  }

  function handleMarkdownAction(action: MarkdownAction, promptValue?: string | null) {
    const el = contentRef.current
    if (!el) return
    const result = applyMarkdownAction(form.content, el.selectionStart, el.selectionEnd, action, promptValue)
    update('content', result.value)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  async function handleHeroUpload(file: File) {
    if (!user) return
    setUploadingImage(true)
    try {
      const url = await uploadBlogImage(user.id, file)
      update('heroImageUrl', url)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not upload image.')
    } finally {
      setUploadingImage(false)
    }
  }

  async function persist(status: BlogPostInput['status'], scheduledAt: string | null, options?: { silent?: boolean }): Promise<BlogPost | null> {
    if (!user) return null
    const payload: BlogPostInput = { ...form, status, scheduledAt }
    if (!options?.silent) {
      if (!payload.title.trim() || !payload.slug.trim() || !payload.content.trim()) {
        setSaveError('Title, slug, and content are required.')
        return null
      }
      if (!payload.category) {
        setSaveError('Choose a category.')
        return null
      }
      if (status === 'scheduled' && !scheduledAt) {
        setSaveError('Choose a publish date and time.')
        return null
      }
    }
    if (!options?.silent) { setSaving(true); setSaveError(null) }
    try {
      let saved: BlogPost
      if (postId) {
        saved = await updateBlogPost(postId, payload)
      } else {
        saved = await createBlogPost({ ...payload, authorId: payload.authorId ?? user.id })
        setPostId(saved.id)
      }
      setForm(f => ({ ...f, status: saved.status, scheduledAt: saved.scheduled_at }))
      dirtyRef.current = false
      setLastSavedAt(new Date())
      fetchPostRevisions(saved.id).then(setRevisions).catch(() => {})
      if (!options?.silent) onSaved(saved)
      return saved
    } catch (err) {
      if (!options?.silent) setSaveError(friendlyBlogError(err as Error))
      return null
    } finally {
      if (!options?.silent) setSaving(false)
    }
  }

  // Auto-save: quietly re-save every 20s while the post is a draft the current user is allowed to write to.
  useEffect(() => {
    if (!postId || readOnly) return
    const canAutosave = currentUserRole !== 'staff' || form.status === 'draft'
    if (!canAutosave) return
    const interval = setInterval(() => {
      if (dirtyRef.current && form.title.trim() && form.content.trim()) {
        persist(form.status, form.scheduledAt, { silent: true })
      }
    }, 20000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, form, readOnly, currentUserRole])

  const words = useMemo(() => wordCount(form.content), [form.content])
  const readingTime = useMemo(() => estimateReadingTime(form.content), [form.content])

  const scheduledLocalValue = toLocalDateTimeValue(form.scheduledAt)

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 920 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {postId ? (readOnly ? 'View article' : 'Edit article') : 'New article'}
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {words} words · ~{readingTime} min read
              {lastSavedAt && <> · Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {postId && revisions.length > 0 && (
              <HeaderIconButton title="Revision history" icon={History} onClick={() => setShowRevisions(v => !v)} active={showRevisions} />
            )}
            <HeaderIconButton title="Preview" icon={Eye} onClick={() => setShowPreview(v => !v)} active={showPreview} />
            <HeaderIconButton title="Close" icon={X} onClick={onClose} />
          </div>
        </div>

        {readOnly && (
          <div style={{ ...errorBoxStyle, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
            This article is past the draft stage — only an editor or admin can make further changes here.
          </div>
        )}

        {showRevisions && postId ? (
          <RevisionsPanel revisions={revisions} onRestore={(rev) => {
            update('title', rev.title)
            update('excerpt', rev.excerpt ?? '')
            update('content', rev.content)
            update('heroImageUrl', rev.hero_image_url ?? '')
            if (rev.category) update('category', rev.category)
            update('tags', rev.tags)
            update('seoTitle', rev.seo_title ?? '')
            update('metaDescription', rev.meta_description ?? '')
            setShowRevisions(false)
          }} />
        ) : showPreview ? (
          <PreviewPane form={form} />
        ) : (
          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Title">
              <input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} style={inputStyle} disabled={readOnly} required />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="URL slug">
                <input value={form.slug} onChange={(e) => { setSlugTouched(true); update('slug', slugify(e.target.value)) }} style={inputStyle} disabled={readOnly} required />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={(e) => update('category', e.target.value)} style={inputStyle} disabled={readOnly}>
                  {categories.map(c => <option key={c.id} value={c.slug}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Author">
                <select value={form.authorId ?? ''} onChange={(e) => update('authorId', e.target.value || null)} style={inputStyle} disabled={readOnly || currentUserRole === 'staff'}>
                  <option value="">Unassigned</option>
                  {authors.map(a => <option key={a.id} value={a.id}>{a.display_name || a.username}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Short summary / description (shown on cards)">
              <textarea value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} disabled={readOnly} />
            </Field>

            <Field label="Featured image">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {form.heroImageUrl ? (
                  <img src={form.heroImageUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--surface2)' }} />
                )}
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 32, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 14px' }}>
                      {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                      {uploadingImage ? 'Uploading…' : 'Upload'}
                      <input type="file" accept="image/*" disabled={uploadingImage} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f); e.target.value = '' }} style={{ display: 'none' }} />
                    </label>
                    <button type="button" onClick={(e) => { ripple(e); setShowImagePicker('hero') }} className="ripple-wrap" style={{ height: 32, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 14px', cursor: 'pointer' }}>
                      From library
                    </button>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Tags">
              <input value={tagsInput} onChange={(e) => handleTagsChange(e.target.value)} placeholder="comma, separated, tags" style={inputStyle} disabled={readOnly} />
              {tagOptions.length > 0 && !readOnly && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {tagOptions.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTagChip(t.slug)} className="ripple-wrap"
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                        background: form.tags.includes(t.slug) ? 'var(--accent)' : 'var(--surface2)',
                        color: form.tags.includes(t.slug) ? '#fff' : 'var(--text-dim)', border: '1px solid var(--border)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Content">
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {!readOnly && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <ToolbarButton icon={Bold} label="Bold" onClick={() => handleMarkdownAction('bold')} />
                    <ToolbarButton icon={Italic} label="Italic" onClick={() => handleMarkdownAction('italic')} />
                    <ToolbarButton icon={Code} label="Inline code" onClick={() => handleMarkdownAction('code')} />
                    <ToolbarDivider />
                    <ToolbarButton icon={Heading2} label="Heading" onClick={() => handleMarkdownAction('h2')} />
                    <ToolbarButton icon={Heading3} label="Subheading" onClick={() => handleMarkdownAction('h3')} />
                    <ToolbarDivider />
                    <ToolbarButton icon={List} label="Bullet list" onClick={() => handleMarkdownAction('bullet')} />
                    <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => handleMarkdownAction('numbered')} />
                    <ToolbarButton icon={Quote} label="Quote" onClick={() => handleMarkdownAction('quote')} />
                    <ToolbarButton icon={LinkIcon} label="Link" onClick={() => handleMarkdownAction('link')} />
                    <ToolbarDivider />
                    <ToolbarButton icon={TableIcon} label="Table" onClick={() => handleMarkdownAction('table')} />
                    <ToolbarButton icon={FileCode} label="Code block" onClick={() => handleMarkdownAction('codeblock')} />
                    <ToolbarButton icon={ImageIcon} label="Insert image" onClick={() => setShowImagePicker('content')} />
                    <ToolbarButton icon={Youtube} label="YouTube video" onClick={() => {
                      const url = window.prompt('Paste a YouTube video URL')
                      if (!url) return
                      const id = extractYouTubeId(url)
                      if (!id) { alert("Couldn't find a video in that link."); return }
                      handleMarkdownAction('youtube', id)
                    }} />
                  </div>
                )}
                <textarea
                  ref={contentRef}
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  placeholder="Write your post here. Leave a blank line between paragraphs — select text and use the toolbar above for formatting."
                  readOnly={readOnly}
                  style={{
                    width: '100%', padding: '18px 20px', minHeight: '50vh', resize: 'vertical',
                    background: 'var(--surface2)', border: 'none', color: 'var(--text)',
                    fontSize: 14.5, lineHeight: 1.7, outline: 'none', fontFamily: 'inherit',
                  }}
                  required
                />
              </div>
            </Field>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>SEO</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <Field label="SEO title (optional — falls back to the article title)">
                  <input value={form.seoTitle} onChange={(e) => update('seoTitle', e.target.value)} style={inputStyle} disabled={readOnly} maxLength={70} />
                </Field>
                <Field label="Meta description">
                  <input value={form.metaDescription} onChange={(e) => update('metaDescription', e.target.value)} style={inputStyle} disabled={readOnly} maxLength={160} />
                </Field>
              </div>
            </div>

            {saveError && <div style={errorBoxStyle}>{saveError}</div>}

            {!readOnly && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
                {canPublish && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="datetime-local" value={scheduledLocalValue} onChange={(e) => update('scheduledAt', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ ...inputStyle, width: 'auto' }} />
                    <ActionButton label="Schedule" icon={Clock} onClick={() => { if (form.scheduledAt) persist('scheduled', form.scheduledAt) }} disabled={saving || !form.scheduledAt} secondary />
                  </div>
                )}
                <ActionButton label="Save Draft" onClick={() => persist('draft', null)} disabled={saving} secondary />
                {canPublish && (
                  <ActionButton label={saving ? 'Publishing…' : 'Publish Now'} icon={Sparkles} onClick={() => persist('published', null)} disabled={saving} />
                )}
              </div>
            )}
          </form>
        )}
      </div>

      {showImagePicker && (
        <ImagePickerOverlay
          onClose={() => setShowImagePicker(null)}
          onPick={(url) => {
            if (showImagePicker === 'hero') update('heroImageUrl', url)
            else handleMarkdownAction('image', url)
            setShowImagePicker(null)
          }}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
      {label}
      {children}
    </label>
  )
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Bold; label: string; onClick: () => void }) {
  return (
    <button
      type="button" title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="ripple-wrap"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: 30, height: 30, borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--text-dim)' }}
    >
      <Icon size={14} />
    </button>
  )
}

function ToolbarDivider() {
  return <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
}

function HeaderIconButton({ title, icon: Icon, onClick, active }: { title: string; icon: typeof X; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" title={title} onClick={(e) => { ripple(e); onClick() }} className="ripple-wrap"
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: active ? 'var(--accent)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9,
        color: active ? '#fff' : 'var(--text-dim)',
      }}>
      <Icon size={14} />
    </button>
  )
}

function ActionButton({ label, icon: Icon, onClick, disabled, secondary }: {
  label: string; icon?: typeof Clock; onClick: () => void; disabled?: boolean; secondary?: boolean
}) {
  return (
    <button
      type="button" onClick={(e) => { ripple(e); onClick() }} disabled={disabled} className="ripple-wrap"
      style={{
        fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        color: secondary ? 'var(--text-dim)' : '#fff', background: secondary ? 'var(--surface2)' : 'var(--accent)',
        border: secondary ? '1px solid var(--border)' : 'none', borderRadius: 10, padding: '10px 18px', opacity: disabled ? 0.6 : 1,
      }}
    >
      {Icon && <Icon size={13} />} {label}
    </button>
  )
}

function PreviewPane({ form }: { form: BlogPostInput }) {
  return (
    <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '4px 2px' }}>
      {form.heroImageUrl && <img src={form.heroImageUrl} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 16 }} />}
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>{form.title || 'Untitled article'}</h1>
      {form.excerpt && <p style={{ fontSize: 15, color: 'var(--text-dim)', margin: '0 0 20px' }}>{form.excerpt}</p>}
      {renderLiteMarkdown(form.content || '_Nothing written yet._')}
    </div>
  )
}

function RevisionsPanel({ revisions, onRestore }: { revisions: BlogPostRevision[]; onRestore: (rev: BlogPostRevision) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65vh', overflowY: 'auto' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>Restoring loads that version into the editor — you still need to save it.</p>
      {revisions.map(rev => (
        <div key={rev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rev.title}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {new Date(rev.created_at).toLocaleString()} {rev.editor?.username ? `· ${rev.editor.username}` : ''}
            </p>
          </div>
          <button type="button" onClick={(e) => { ripple(e); onRestore(rev) }} className="ripple-wrap"
            style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Restore
          </button>
        </div>
      ))}
    </div>
  )
}

function ImagePickerOverlay({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<{ id: string; url: string; filename: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { fetchMediaLibrary().then(setItems).catch(() => {}).finally(() => setLoading(false)) }, [])

  async function handleUpload(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const url = await uploadBlogImage(user.id, file)
      onPick(url)
    } catch {
      /* surfaced via alert to keep this overlay dependency-light */
      alert('Could not upload that image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ ...overlayStyle, zIndex: 200, background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Insert image</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
        </div>
        <label className="ripple-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: '11px', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {uploading ? 'Uploading…' : 'Upload new image'}
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} style={{ display: 'none' }} />
        </label>
        {loading ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>Loading library…</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No images in the library yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {items.map(item => (
              <button key={item.id} type="button" onClick={() => onPick(item.url)} className="ripple-wrap"
                style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                <img src={item.url} alt={item.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}