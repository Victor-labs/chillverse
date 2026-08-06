// src/features/support/admin/SupportArticleEditor.tsx
// Create/edit modal for help articles. Uses the same markdownLite syntax as
// the blog editor, so the same toolbar helpers and the same renderer apply —
// and crucially so does scripts/prerender.mjs, which converts that syntax to
// static HTML at build time. Anything written here appears identically to a
// reader, to Google, and to an AI crawler.
import { useEffect, useRef, useState } from 'react'
import { X, Eye, Pencil, Bold, Italic, Heading2, List, ListOrdered, Quote, Link2, ImagePlus, Video, Loader2 } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { renderLiteMarkdown, applyMarkdownAction, type MarkdownAction } from '../../../shared/lib/markdownLite'
import {
  inputStyle, overlayStyle, modalStyle, errorBoxStyle,
  primaryButtonStyle, secondaryButtonStyle, iconButtonStyle, wordCount,
} from '../../blog/admin/styles'
import { createArticle, updateArticle, fetchAllCategories, isSlugTaken } from './api'
// Authors and image hosting are shared with the blog rather than duplicated:
// same `blog-images` bucket (staff-only write, migration 0053), same merged
// picker of real profiles + house personas (migration 0099).
import { uploadBlogImage, fetchAuthorCandidates, fetchAuthorById, fetchPersonaById } from '../../blog/api'
// Videos get their own bucket (support-videos, migration 0107) rather than
// reusing blog-images, since that bucket's mime/size limits are image-only.
import { uploadSupportVideo } from './support-admin-api'
import type { SupportArticle, SupportCategory, BlogAuthor } from '../../../shared/types'

/** Real profiles and personas both have plain UUIDs, so the <select> value
 *  needs a prefix to know which column the choice belongs in. */
function authorOptionValue(a: BlogAuthor): string {
  return `${a.is_persona ? 'persona' : 'user'}:${a.id}`
}

interface Props {
  article: SupportArticle | null
  currentUserId: string | null
  onClose: () => void
  onSaved: () => void
}

const TOOLBAR: { action: MarkdownAction; icon: typeof Bold; title: string }[] = [
  { action: 'bold', icon: Bold, title: 'Bold' },
  { action: 'italic', icon: Italic, title: 'Italic' },
  { action: 'h2', icon: Heading2, title: 'Heading' },
  { action: 'bullet', icon: List, title: 'Bullet list' },
  { action: 'numbered', icon: ListOrdered, title: 'Numbered list' },
  { action: 'quote', icon: Quote, title: 'Quote' },
  { action: 'link', icon: Link2, title: 'Link' },
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default function SupportArticleEditor({ article, currentUserId, onClose, onSaved }: Props) {
  const isNew = article === null
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoryId, setCategoryId] = useState(article?.category_id ?? '')
  const [title, setTitle] = useState(article?.title ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [summary, setSummary] = useState(article?.summary ?? '')
  const [content, setContent] = useState(article?.content ?? '')
  const [tagsText, setTagsText] = useState((article?.tags ?? []).join(', '))
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false)
  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [authorId, setAuthorId] = useState<string | null>(article?.author_id ?? null)
  const [personaAuthorId, setPersonaAuthorId] = useState<string | null>(article?.persona_author_id ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [sortOrder, setSortOrder] = useState(article?.sort_order ?? 0)

  // Only auto-derive the slug for new articles. Changing a live article's
  // slug breaks its URL, so an existing one is never rewritten silently.
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllCategories()
      .then(rows => {
        setCategories(rows)
        setCategoryId(current => current || rows[0]?.id || '')
      })
      .catch((err: Error) => setError(err.message || 'Could not load categories.'))
  }, [])

  useEffect(() => {
    fetchAuthorCandidates()
      .then(setAuthors)
      .catch(() => { /* picker falls back to "Chillverse Team"; not worth blocking a save */ })
  }, [])

  // Default a new article to whoever is writing it.
  useEffect(() => {
    if (isNew && currentUserId && !authorId && !personaAuthorId) setAuthorId(currentUserId)
  }, [isNew, currentUserId, authorId, personaAuthorId])

  // The dropdown only lists current candidates, so an article written by
  // someone since demoted (or a since-removed persona) would silently lose
  // its byline on the next save. Pull the missing one in so it stays.
  useEffect(() => {
    if (!authorId || authors.some(a => !a.is_persona && a.id === authorId)) return
    fetchAuthorById(authorId)
      .then(a => { if (a) setAuthors(prev => prev.some(p => p.id === a.id) ? prev : [...prev, a]) })
      .catch(() => {})
  }, [authorId, authors])

  useEffect(() => {
    if (!personaAuthorId || authors.some(a => a.is_persona && a.id === personaAuthorId)) return
    fetchPersonaById(personaAuthorId)
      .then(a => { if (a) setAuthors(prev => prev.some(p => p.id === a.id) ? prev : [...prev, a]) })
      .catch(() => {})
  }, [personaAuthorId, authors])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  function runAction(action: MarkdownAction) {
    const el = textareaRef.current
    if (!el) return

    let promptValue: string | null | undefined
    if (action === 'link') {
      promptValue = window.prompt('Link URL', 'https://')
      if (!promptValue) return
    }

    const result = applyMarkdownAction(el.value, el.selectionStart, el.selectionEnd, action, promptValue)
    setContent(result.value)

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  async function handleImageUpload(file: File) {
    if (!currentUserId) { setError('Sign in again before uploading images.'); return }
    setUploading(true)
    setError(null)
    try {
      const url = await uploadBlogImage(currentUserId, file)
      const el = textareaRef.current
      const start = el?.selectionStart ?? content.length
      const end = el?.selectionEnd ?? content.length
      const result = applyMarkdownAction(content, start, end, 'image', url)
      setContent(result.value)
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(result.selectionStart, result.selectionEnd)
      })
    } catch (err) {
      setError((err as Error).message || 'Could not upload that image.')
    } finally {
      setUploading(false)
    }
  }

  async function handleVideoUpload(file: File) {
    if (!currentUserId) { setError('Sign in again before uploading videos.'); return }
    setUploadingVideo(true)
    setError(null)
    try {
      const url = await uploadSupportVideo(currentUserId, file)
      const el = textareaRef.current
      const start = el?.selectionStart ?? content.length
      const end = el?.selectionEnd ?? content.length
      const result = applyMarkdownAction(content, start, end, 'video', url)
      setContent(result.value)
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(result.selectionStart, result.selectionEnd)
      })
    } catch (err) {
      setError((err as Error).message || 'Could not upload that video.')
    } finally {
      setUploadingVideo(false)
    }
  }

  async function handleSave() {
    const cleanTitle = title.trim()
    const cleanSlug = slugify(slug)

    if (!categoryId) { setError('Pick a category.'); return }
    if (cleanTitle.length < 3) { setError('Give the article a title.'); return }
    if (!cleanSlug) { setError('The slug can\'t be empty.'); return }
    if (content.trim().length < 20) { setError('Write some content before saving.'); return }

    setSaving(true)
    setError(null)

    try {
      if (await isSlugTaken(categoryId, cleanSlug, article?.id)) {
        setError(`Another article in this category already uses /${cleanSlug}.`)
        setSaving(false)
        return
      }

      const draft = {
        category_id: categoryId,
        author_id: authorId,
        persona_author_id: personaAuthorId,
        slug: cleanSlug,
        title: cleanTitle,
        summary: summary.trim() || null,
        content: content.trim(),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        is_published: isPublished,
        sort_order: sortOrder,
      }

      if (article) await updateArticle(article.id, draft)
      else await createArticle(draft)

      onSaved()
    } catch (err) {
      setError((err as Error).message || 'Could not save the article.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {isNew ? 'New article' : 'Edit article'}
          </h2>
          <button type="button" onClick={onClose} style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}>
            <X size={15} />
          </button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 220px' }}>
            <Label>Category</Label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 0 110px' }}>
            <Label>Sort order</Label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
        </div>

        <Label>Author</Label>
        <select
          value={personaAuthorId ? `persona:${personaAuthorId}` : authorId ? `user:${authorId}` : ''}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(':')
            setAuthorId(kind === 'user' ? id : null)
            setPersonaAuthorId(kind === 'persona' ? id : null)
          }}
          style={{ ...inputStyle, cursor: 'pointer', marginBottom: 12 }}
        >
          <option value="">Chillverse Team (no byline)</option>
          {authors.map(a => (
            <option key={authorOptionValue(a)} value={authorOptionValue(a)}>
              {a.display_name || a.username}{a.is_persona ? ' (house)' : ''}
            </option>
          ))}
        </select>

        <Label>Title</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="How to reset your streak"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <Label>Slug</Label>
        <input
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }}
          style={{ ...inputStyle, marginBottom: 4 }}
        />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          {isNew
            ? 'Generated from the title — edit it before publishing if you want something different.'
            : 'Changing this breaks existing links and search results pointing at the old URL.'}
        </p>

        <Label>Summary</Label>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One line shown in search results and category lists"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Label>Content</Label>
          <button
            type="button"
            onClick={(e) => { ripple(e); setPreview(p => !p) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 10px',
            }}
          >
            {preview ? <><Pencil size={11} /> Write</> : <><Eye size={11} /> Preview</>}
          </button>
        </div>

        {!preview && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {TOOLBAR.map(({ action, icon: Icon, title: label }) => (
              <button
                key={action}
                type="button"
                title={label}
                onClick={() => runAction(action)}
                style={{ ...iconButtonStyle, width: 30, height: 30, color: 'var(--text-dim)' }}
              >
                <Icon size={13} />
              </button>
            ))}

            {/* Uploads to the shared blog-images bucket and drops an
                ![](url) block at the cursor. */}
            <label
              title={uploading ? 'Uploading…' : 'Insert image'}
              style={{
                ...iconButtonStyle, width: 30, height: 30,
                color: 'var(--text-dim)', cursor: uploading ? 'default' : 'pointer',
              }}
            >
              {uploading ? <Loader2 size={13} /> : <ImagePlus size={13} />}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImageUpload(file)
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>

            {/* Uploads to the staff-only support-videos bucket and drops a
                {{video:url}} block at the cursor. */}
            <label
              title={uploadingVideo ? 'Uploading…' : 'Insert video'}
              style={{
                ...iconButtonStyle, width: 30, height: 30,
                color: 'var(--text-dim)', cursor: uploadingVideo ? 'default' : 'pointer',
              }}
            >
              {uploadingVideo ? <Loader2 size={13} /> : <Video size={13} />}
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                disabled={uploadingVideo}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleVideoUpload(file)
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {preview ? (
          <div style={{
            minHeight: 240, padding: '14px 16px', borderRadius: 10,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)',
          }}>
            {content.trim() ? renderLiteMarkdown(content) : <span style={{ color: 'var(--text-muted)' }}>Nothing to preview yet.</span>}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder="Write the article. Markdown: ## heading, - list, **bold**, [text](url)"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65, fontSize: 13.5 }}
          />
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 12px' }}>
          {wordCount(content)} words
        </p>

        <Label>Tags</Label>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="streak, xp, account (comma separated)"
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 18,
        }}>
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          Published
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)' }}>
            — drafts stay invisible to the public and are skipped by prerendering
          </span>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => { ripple(e); void handleSave() }}
            style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : isNew ? 'Create article' : 'Save changes'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 0', textAlign: 'right' }}>
          Published changes reach Google on the next deploy, when prerendering runs.
        </p>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5,
    }}>
      {children}
    </label>
  )
}
