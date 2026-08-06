// src/features/support/admin/SupportCategoriesTab.tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, Pencil, ArrowUp, ArrowDown } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import {
  inputStyle, rowStyle, iconButtonStyle, primaryButtonStyle, errorBoxStyle,
} from '../../blog/admin/styles'
import {
  fetchAllCategories, fetchAllArticles, createCategory, updateCategory,
  deleteCategory, reorderCategories,
} from './api'
import { getSupportCategoryIcon } from '../constants'
import type { SupportCategory } from '../../../shared/types'

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export default function SupportCategoriesTab({ canDelete }: { canDelete: boolean }) {
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [articleCounts, setArticleCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [cats, articles] = await Promise.all([fetchAllCategories(), fetchAllArticles()])
      const counts: Record<string, number> = {}
      for (const a of articles) counts[a.category_id] = (counts[a.category_id] ?? 0) + 1
      setCategories(cats)
      setArticleCounts(counts)
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Could not load categories.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    setBusy(true)
    try {
      await createCategory({
        slug: slugify(name),
        name,
        description: newDescription.trim() || null,
        // The public grid picks an icon by slug via getSupportCategoryIcon,
        // so this column is a fallback label rather than a rendered asset.
        icon: slugify(name),
        sort_order: categories.length,
      })
      setNewName('')
      setNewDescription('')
      setCreating(false)
      await load()
    } catch (err) {
      setError((err as Error).message || 'Could not create that category.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit(id: string) {
    setBusy(true)
    try {
      await updateCategory(id, { name: editName.trim(), description: editDescription.trim() || null })
      setEditingId(null)
      await load()
    } catch (err) {
      setError((err as Error).message || 'Could not save that category.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(category: SupportCategory) {
    const count = articleCounts[category.id] ?? 0
    if (count > 0) {
      // support_articles.category_id is NOT NULL, so the database would
      // reject this anyway — better to explain than to surface a raw error.
      setError(`"${category.name}" still has ${count} article${count === 1 ? '' : 's'}. Move or delete them first.`)
      return
    }
    if (!window.confirm(`Delete the category "${category.name}"?`)) return

    setBusy(true)
    try {
      await deleteCategory(category.id)
      await load()
    } catch (err) {
      setError((err as Error).message || 'Could not delete that category.')
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= categories.length) return

    const next = [...categories]
    ;[next[index], next[target]] = [next[target], next[index]]
    setCategories(next) // optimistic — the reorder below just persists it

    try {
      await reorderCategories(next.map(c => c.id))
    } catch (err) {
      setError((err as Error).message || 'Could not save the new order.')
      await load()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · order here controls the public grid
        </p>
        {!creating && (
          <button type="button" className="ripple-wrap" onClick={(e) => { ripple(e); setCreating(true) }} style={primaryButtonStyle}>
            <Plus size={14} /> New category
          </button>
        )}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {creating && (
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, marginBottom: 10 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" style={inputStyle} autoFocus />
          <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description (optional)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setCreating(false); setNewName(''); setNewDescription('') }} style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}>
              <X size={14} />
            </button>
            <button type="button" disabled={busy || !newName.trim()} onClick={(e) => { ripple(e); void handleCreate() }} style={{ ...iconButtonStyle, color: 'var(--green, #35c46a)' }}>
              <Check size={14} />
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.map((category, index) => {
          const Icon = getSupportCategoryIcon(category.icon ?? category.slug)
          const count = articleCounts[category.id] ?? 0
          const isEditing = editingId === category.id

          return (
            <div key={category.id} style={{ ...rowStyle, alignItems: isEditing ? 'stretch' : 'center', flexDirection: isEditing ? 'column' : 'row', gap: isEditing ? 8 : 12 }}>
              {isEditing ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} autoFocus />
                  <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" style={inputStyle} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setEditingId(null)} style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}><X size={14} /></button>
                    <button type="button" disabled={busy} onClick={(e) => { ripple(e); void handleSaveEdit(category.id) }} style={{ ...iconButtonStyle, color: 'var(--green, #35c46a)' }}><Check size={14} /></button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <Icon size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{category.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        /{category.slug} · {count} article{count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" title="Move up" disabled={index === 0} onClick={() => void move(index, -1)} style={{ ...iconButtonStyle, color: 'var(--text-dim)', opacity: index === 0 ? 0.4 : 1 }}><ArrowUp size={13} /></button>
                    <button type="button" title="Move down" disabled={index === categories.length - 1} onClick={() => void move(index, 1)} style={{ ...iconButtonStyle, color: 'var(--text-dim)', opacity: index === categories.length - 1 ? 0.4 : 1 }}><ArrowDown size={13} /></button>
                    <button type="button" title="Rename" onClick={(e) => { ripple(e); setEditingId(category.id); setEditName(category.name); setEditDescription(category.description ?? '') }} style={{ ...iconButtonStyle, color: 'var(--text-dim)' }}><Pencil size={13} /></button>
                    {canDelete && (
                      <button type="button" title="Delete" disabled={busy} onClick={(e) => { ripple(e); void handleDelete(category) }} style={{ ...iconButtonStyle, color: 'var(--red, #ff5f56)' }}><Trash2 size={13} /></button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 14 }}>
        Slugs are set when a category is created and aren't editable here — changing one would break every article URL underneath it.
      </p>
    </div>
  )
}
