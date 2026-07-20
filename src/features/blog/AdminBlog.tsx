// src/features/blog/AdminBlog.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Pencil, Trash2, ShieldAlert, Link2, RefreshCw, X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { useModRole } from '../moderation/useModRole'
import { fetchAllBlogPostsForAdmin, createBlogPost, updateBlogPost, deleteBlogPost } from './api'
import { BLOG_CATEGORIES, BLOG_LOCALES } from './constants'
import type { BlogCategory, BlogLocale, BlogPost, BlogPostInput } from '../../shared/types'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const EMPTY_FORM: BlogPostInput = {
  slug: '', title: '', excerpt: '', content: '', heroImageUrl: '',
  category: 'chillverse-hq', series: '', tags: [], locale: 'en',
  translationGroupId: null, isPublished: false,
}

export default function AdminBlog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAdmin, loading: roleLoading } = useModRole()

  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null) // null while list is shown
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState<BlogPostInput>(EMPTY_FORM)
  const [tagsInput, setTagsInput] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const editingPost = useMemo(() => posts.find(p => p.id === editingId) ?? null, [posts, editingId])

  function load() {
    setLoading(true)
    fetchAllBlogPostsForAdmin()
      .then(rows => { setPosts(rows); setError(null) })
      .catch((err: Error) => setError(err.message || 'Could not load posts.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setTagsInput('')
    setSlugTouched(false)
    setSaveError(null)
    setShowEditor(true)
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id)
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: post.content,
      heroImageUrl: post.hero_image_url ?? '',
      category: post.category,
      series: post.series ?? '',
      tags: post.tags,
      locale: post.locale,
      translationGroupId: post.translation_group_id,
      isPublished: post.is_published,
    })
    setTagsInput(post.tags.join(', '))
    setSlugTouched(true)
    setSaveError(null)
    setShowEditor(true)
  }

  function closeEditor() {
    setShowEditor(false)
  }

  function handleTitleChange(title: string) {
    setForm(f => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }))
  }

  function handleTagsChange(value: string) {
    setTagsInput(value)
    setForm(f => ({ ...f, tags: value.split(',').map(t => t.trim()).filter(Boolean) }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setSaveError('Title, slug, and content are required.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (editingPost) {
        await updateBlogPost(editingPost.id, form, editingPost.is_published)
      } else {
        await createBlogPost(form, user.id)
      }
      setShowEditor(false)
      load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this post.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return
    try {
      await deleteBlogPost(post.id)
      setPosts(prev => prev.filter(p => p.id !== post.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete this post.')
    }
  }

  if (roleLoading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <ShieldAlert size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Admins only</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>This page is for Chillverse admins.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/blog') }}
        className="ripple-wrap"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 18,
        }}
      >
        <ChevronLeft size={15} /> Back to Blog
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Manage Blog</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{posts.length} post{posts.length === 1 ? '' : 's'} total</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); load() }}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            type="button"
            onClick={(e) => { ripple(e); openCreate() }}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, color: '#fff',
              background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '9px 14px',
            }}
          >
            <Plus size={13} /> New post
          </button>
        </div>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>No posts yet — create the first one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {posts.map(post => {
            const category = BLOG_CATEGORIES.find(c => c.slug === post.category)
            return (
              <div key={post.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{post.title}</span>
                    <span style={statusBadgeStyle(post.is_published)}>{post.is_published ? 'Published' : 'Draft'}</span>
                    {post.translation_group_id && (
                      <span title="Part of a translation pair"><Link2 size={12} color="var(--text-muted)" /></span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    /blog/{post.slug} · {category?.label ?? post.category} · {post.locale.toUpperCase()}
                    {post.series && ` · ${post.series}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={(e) => { ripple(e); openEdit(post) }} className="ripple-wrap" style={iconButtonStyle}>
                    <Pencil size={14} color="var(--text-dim)" />
                  </button>
                  <button type="button" onClick={(e) => { ripple(e); handleDelete(post) }} className="ripple-wrap" style={iconButtonStyle}>
                    <Trash2 size={14} color="var(--red)" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showEditor && (
        <div style={overlayStyle} onClick={closeEditor}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {editingPost ? 'Edit post' : 'New post'}
              </h2>
              <button type="button" onClick={closeEditor} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Title">
                <input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} style={inputStyle} required />
              </Field>

              <Field label="Slug (URL: /blog/…)">
                <input
                  value={form.slug}
                  onChange={(e) => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })) }}
                  style={inputStyle}
                  required
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value as BlogCategory }))}
                    style={inputStyle}
                  >
                    {BLOG_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Language">
                  <select
                    value={form.locale}
                    onChange={(e) => setForm(f => ({ ...f, locale: e.target.value as BlogLocale }))}
                    style={inputStyle}
                  >
                    {BLOG_LOCALES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Series (optional — e.g. update-log)">
                  <input
                    value={form.series}
                    onChange={(e) => setForm(f => ({ ...f, series: e.target.value }))}
                    style={inputStyle}
                    placeholder="update-log"
                    list="blog-series-suggestions"
                  />
                  <datalist id="blog-series-suggestions">
                    <option value="update-log" />
                  </datalist>
                </Field>
                <Field label="Tags (comma-separated)">
                  <input value={tagsInput} onChange={(e) => handleTagsChange(e.target.value)} style={inputStyle} placeholder="patch-notes, whot" />
                </Field>
              </div>

              <Field label="Hero image URL (optional)">
                <input value={form.heroImageUrl} onChange={(e) => setForm(f => ({ ...f, heroImageUrl: e.target.value }))} style={inputStyle} placeholder="https://…" />
              </Field>

              <Field label="Excerpt (shown on cards)">
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm(f => ({ ...f, excerpt: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }}
                />
              </Field>

              <Field label="Content (paragraphs separated by a blank line)">
                <textarea
                  value={form.content}
                  onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 180, resize: 'vertical' as const }}
                  required
                />
              </Field>

              <Field label="Translation group ID (optional — link two locale variants of the same post)">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.translationGroupId ?? ''}
                    onChange={(e) => setForm(f => ({ ...f, translationGroupId: e.target.value.trim() || null }))}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="none"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, translationGroupId: crypto.randomUUID() }))}
                    className="ripple-wrap"
                    style={{ ...iconButtonStyle, width: 'auto', padding: '0 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)' }}
                  >
                    Generate
                  </button>
                </div>
              </Field>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                />
                Published (visible to all players)
              </label>

              {saveError && <div style={errorBoxStyle}>{saveError}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="ripple-wrap"
                  style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer',
                    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ripple-wrap"
                  style={{
                    fontSize: 13, fontWeight: 700, color: '#fff', cursor: saving ? 'default' : 'pointer',
                    background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 18px',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : editingPost ? 'Save changes' : 'Create post'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  fontSize: 13, fontWeight: 400, outline: 'none', fontFamily: 'inherit',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: '13px 16px',
}

const iconButtonStyle: React.CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9,
}

function statusBadgeStyle(published: boolean): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: published ? 'var(--green)' : 'var(--text-muted)',
    background: published ? 'color-mix(in srgb, var(--green) 14%, transparent)' : 'var(--surface2)',
    borderRadius: 999, padding: '3px 8px',
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
  alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto',
}

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 620, background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16,
}
