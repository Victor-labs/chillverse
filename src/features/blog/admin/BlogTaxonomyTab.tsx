// src/features/blog/admin/BlogTaxonomyTab.tsx
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Check } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import {
  fetchBlogCategoryRows, createBlogCategory, updateBlogCategory, deleteBlogCategory, reorderBlogCategories,
  fetchBlogTagRows, createBlogTag, updateBlogTag, deleteBlogTag, reorderBlogTags,
} from '../api'
import type { BlogCategoryRow, BlogTagRow } from '../../../shared/types'
import { inputStyle, rowStyle, iconButtonStyle } from './styles'
import { getBlogIconComponent, BLOG_ICON_OPTIONS, CATEGORY_COLOR_OPTIONS } from './icons'

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export default function BlogTaxonomyTab({ canDelete }: { canDelete: boolean }) {
  const [section, setSection] = useState<'categories' | 'tags'>('categories')
  const [categories, setCategories] = useState<BlogCategoryRow[]>([])
  const [tags, setTags] = useState<BlogTagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([fetchBlogCategoryRows(), fetchBlogTagRows()])
      .then(([c, t]) => { setCategories(c); setTags(t); setError(null) })
      .catch((err: Error) => setError(err.message || 'Could not load categories/tags.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: '#ff8080', fontSize: 13.5 }}>{error}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['categories', 'tags'] as const).map(s => (
          <button
            key={s} type="button"
            onClick={(e) => { ripple(e); setSection(s) }}
            className="ripple-wrap"
            style={{
              fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', padding: '8px 16px', borderRadius: 10,
              background: section === s ? 'var(--accent)' : 'var(--surface2)', color: section === s ? '#fff' : 'var(--text-dim)', border: 'none',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {section === 'categories' ? (
        <CategoryManager categories={categories} setCategories={setCategories} canDelete={canDelete} />
      ) : (
        <TagManager tags={tags} setTags={setTags} canDelete={canDelete} />
      )}
    </div>
  )
}

// ── Categories ──────────────────────────────────────────────────────────

function CategoryManager({ categories, setCategories, canDelete }: {
  categories: BlogCategoryRow[]
  setCategories: React.Dispatch<React.SetStateAction<BlogCategoryRow[]>>
  canDelete: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(CATEGORY_COLOR_OPTIONS[0])
  const [icon, setIcon] = useState(BLOG_ICON_OPTIONS[0].name)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setCreating(false); setEditingId(null); setLabel(''); setColor(CATEGORY_COLOR_OPTIONS[0]); setIcon(BLOG_ICON_OPTIONS[0].name); setSaveError(null)
  }

  function startEdit(cat: BlogCategoryRow) {
    setEditingId(cat.id); setCreating(false); setLabel(cat.label); setColor(cat.color); setIcon(cat.icon); setSaveError(null)
  }

  async function handleSave() {
    if (!label.trim()) { setSaveError('Name is required.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      if (editingId) {
        await updateBlogCategory(editingId, { label: label.trim(), color, icon })
        setCategories(prev => prev.map(c => c.id === editingId ? { ...c, label: label.trim(), color, icon } : c))
      } else {
        const slug = slugify(label)
        if (!slug) { setSaveError('Enter a valid name.'); setSaving(false); return }
        const created = await createBlogCategory({ slug, label: label.trim(), color, icon, sortOrder: categories.length })
        setCategories(prev => [...prev, created])
      }
      resetForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this category.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: BlogCategoryRow) {
    if (!window.confirm(`Delete "${cat.label}"? Posts already using this category will block the delete until reassigned.`)) return
    try {
      await deleteBlogCategory(cat.id)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
    } catch (err) {
      alert('Could not delete — likely still assigned to at least one article. Reassign those first.')
      void err
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...categories]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setCategories(next)
    await reorderBlogCategories(next.map(c => c.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {categories.map((cat, i) => {
        const Icon = getBlogIconComponent(cat.icon)
        if (editingId === cat.id) {
          return <TaxonomyEditForm key={cat.id} label={label} setLabel={setLabel} color={color} setColor={setColor} icon={icon} setIcon={setIcon}
            saving={saving} saveError={saveError} onSave={handleSave} onCancel={resetForm} showColor showIcon />
        }
        return (
          <div key={cat.id} style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${cat.color}22`, color: cat.color, flexShrink: 0 }}>
                <Icon size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{cat.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{cat.slug}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="ripple-wrap" style={{ ...iconButtonStyle, opacity: i === 0 ? 0.4 : 1 }}><ChevronUp size={13} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === categories.length - 1} className="ripple-wrap" style={{ ...iconButtonStyle, opacity: i === categories.length - 1 ? 0.4 : 1 }}><ChevronDown size={13} /></button>
              <button type="button" onClick={(e) => { ripple(e); startEdit(cat) }} className="ripple-wrap" style={iconButtonStyle}><Pencil size={13} /></button>
              {canDelete && <button type="button" onClick={(e) => { ripple(e); handleDelete(cat) }} className="ripple-wrap" style={{ ...iconButtonStyle, color: '#ff8080' }}><Trash2 size={13} /></button>}
            </div>
          </div>
        )
      })}

      {creating ? (
        <TaxonomyEditForm label={label} setLabel={setLabel} color={color} setColor={setColor} icon={icon} setIcon={setIcon}
          saving={saving} saveError={saveError} onSave={handleSave} onCancel={resetForm} showColor showIcon />
      ) : (
        <button type="button" onClick={(e) => { ripple(e); setCreating(true); setLabel(''); setColor(CATEGORY_COLOR_OPTIONS[0]); setIcon(BLOG_ICON_OPTIONS[0].name) }} className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '11px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> New category
        </button>
      )}
    </div>
  )
}

// ── Tags ────────────────────────────────────────────────────────────────

function TagManager({ tags, setTags, canDelete }: {
  tags: BlogTagRow[]
  setTags: React.Dispatch<React.SetStateAction<BlogTagRow[]>>
  canDelete: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function resetForm() { setCreating(false); setEditingId(null); setLabel(''); setSaveError(null) }
  function startEdit(tag: BlogTagRow) { setEditingId(tag.id); setCreating(false); setLabel(tag.label); setSaveError(null) }

  async function handleSave() {
    if (!label.trim()) { setSaveError('Name is required.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      if (editingId) {
        await updateBlogTag(editingId, { label: label.trim() })
        setTags(prev => prev.map(t => t.id === editingId ? { ...t, label: label.trim() } : t))
      } else {
        const slug = slugify(label)
        if (!slug) { setSaveError('Enter a valid name.'); setSaving(false); return }
        const created = await createBlogTag({ slug, label: label.trim(), sortOrder: tags.length })
        setTags(prev => [...prev, created])
      }
      resetForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this tag.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tag: BlogTagRow) {
    if (!window.confirm(`Remove "${tag.label}" from the tag list? Existing articles keep the tag text, it just won't be suggested anymore.`)) return
    try {
      await deleteBlogTag(tag.id)
      setTags(prev => prev.filter(t => t.id !== tag.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete this tag.')
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...tags]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setTags(next)
    await reorderBlogTags(next.map(t => t.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tags.map((tag, i) => {
        if (editingId === tag.id) {
          return <TaxonomyEditForm key={tag.id} label={label} setLabel={setLabel} saving={saving} saveError={saveError} onSave={handleSave} onCancel={resetForm} />
        }
        return (
          <div key={tag.id} style={rowStyle}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{tag.label}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{tag.slug}</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="ripple-wrap" style={{ ...iconButtonStyle, opacity: i === 0 ? 0.4 : 1 }}><ChevronUp size={13} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === tags.length - 1} className="ripple-wrap" style={{ ...iconButtonStyle, opacity: i === tags.length - 1 ? 0.4 : 1 }}><ChevronDown size={13} /></button>
              <button type="button" onClick={(e) => { ripple(e); startEdit(tag) }} className="ripple-wrap" style={iconButtonStyle}><Pencil size={13} /></button>
              {canDelete && <button type="button" onClick={(e) => { ripple(e); handleDelete(tag) }} className="ripple-wrap" style={{ ...iconButtonStyle, color: '#ff8080' }}><Trash2 size={13} /></button>}
            </div>
          </div>
        )
      })}

      {creating ? (
        <TaxonomyEditForm label={label} setLabel={setLabel} saving={saving} saveError={saveError} onSave={handleSave} onCancel={resetForm} />
      ) : (
        <button type="button" onClick={(e) => { ripple(e); setCreating(true); setLabel('') }} className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '11px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> New tag
        </button>
      )}
    </div>
  )
}

// ── Shared inline create/edit form ───────────────────────────────────────

function TaxonomyEditForm({ label, setLabel, color, setColor, icon, setIcon, saving, saveError, onSave, onCancel, showColor, showIcon }: {
  label: string; setLabel: (v: string) => void
  color?: string; setColor?: (v: string) => void
  icon?: string; setIcon?: (v: string) => void
  saving: boolean; saveError: string | null
  onSave: () => void; onCancel: () => void
  showColor?: boolean; showIcon?: boolean
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" style={inputStyle} autoFocus />

      {showColor && setColor && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORY_COLOR_OPTIONS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{
                width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '2px solid var(--text)' : '2px solid transparent',
              }} />
          ))}
        </div>
      )}

      {showIcon && setIcon && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BLOG_ICON_OPTIONS.map(({ name, icon: Icon }) => (
            <button key={name} type="button" onClick={() => setIcon(name)}
              style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: icon === name ? 'var(--accent)' : 'var(--surface2)', color: icon === name ? '#fff' : 'var(--text-dim)',
                border: '1px solid var(--border)',
              }}>
              <Icon size={13} />
            </button>
          ))}
        </div>
      )}

      {saveError && <p style={{ fontSize: 11.5, color: '#ff8080', margin: 0 }}>{saveError}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="ripple-wrap" style={{ ...iconButtonStyle, width: 'auto', padding: '0 12px' }}><X size={13} /></button>
        <button type="button" onClick={onSave} disabled={saving} className="ripple-wrap"
          style={{ ...iconButtonStyle, width: 'auto', padding: '0 12px', background: 'var(--accent)', border: 'none', color: '#fff' }}>
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}
