// src/features/blog/admin/BlogArticlesTab.tsx
import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, Copy, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import {
  fetchAllBlogPostsForAdmin, fetchBlogCategoryRows, fetchAuthorCandidates,
  duplicateBlogPost, setBlogPostStatus, deleteBlogPost, friendlyBlogError,
} from '../api'
import type { BlogAuthor, BlogCategoryRow, BlogPost } from '../../../shared/types'
import { inputStyle, statusBadgeStyle, statusMeta } from './styles'
import { getBlogIconComponent } from './icons'

type SortKey = 'updated_desc' | 'created_desc' | 'title_asc' | 'published_desc'
type StatusFilter = 'all' | BlogPost['status']

export default function BlogArticlesTab({
  currentUserId, isEditorPlus, isAdmin, onEdit, refreshToken,
}: {
  currentUserId: string | null
  isEditorPlus: boolean    // moderator or admin
  isAdmin: boolean
  onEdit: (post: BlogPost) => void
  refreshToken: number     // bump to force a reload from the parent (e.g. after saving in the editor)
}) {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategoryRow[]>([])
  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc')

  function load() {
    setLoading(true)
    Promise.all([fetchAllBlogPostsForAdmin(), fetchBlogCategoryRows(), fetchAuthorCandidates()])
      .then(([p, c, a]) => { setPosts(p); setCategories(c); setAuthors(a); setError(null) })
      .catch((err: Error) => setError(err.message || 'Could not load articles.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [refreshToken])

  const authorById = useMemo(() => new Map(authors.map(a => [a.id, a])), [authors])
  const categoryBySlug = useMemo(() => new Map(categories.map(c => [c.slug, c])), [categories])

  const visible = useMemo(() => {
    let rows = posts
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(p => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    }
    if (categoryFilter !== 'all') rows = rows.filter(p => p.category === categoryFilter)
    if (statusFilter !== 'all') rows = rows.filter(p => p.status === statusFilter)

    const sorted = [...rows]
    switch (sortKey) {
      case 'title_asc': sorted.sort((a, b) => a.title.localeCompare(b.title)); break
      case 'created_desc': sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break
      case 'published_desc': sorted.sort((a, b) => +new Date(b.published_at ?? 0) - +new Date(a.published_at ?? 0)); break
      default: sorted.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    }
    return sorted
  }, [posts, search, categoryFilter, statusFilter, sortKey])

  function canEdit(post: BlogPost): boolean {
    if (isEditorPlus) return true
    return post.status === 'draft' && post.author_id === currentUserId
  }

  async function handleDuplicate(post: BlogPost) {
    if (!currentUserId) return
    setBusyId(post.id)
    try {
      const copy = await duplicateBlogPost(post, currentUserId)
      setPosts(prev => [copy, ...prev])
    } catch (err) {
      alert(friendlyBlogError(err as Error))
    } finally {
      setBusyId(null)
    }
  }

  async function handleArchive(post: BlogPost) {
    setBusyId(post.id)
    try {
      const updated = await setBlogPostStatus(post.id, post.status === 'archived' ? 'draft' : 'archived')
      setPosts(prev => prev.map(p => p.id === post.id ? updated : p))
    } catch (err) {
      alert(friendlyBlogError(err as Error))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!window.confirm(`Permanently delete "${post.title}"? This can't be undone.`)) return
    setBusyId(post.id)
    try {
      await deleteBlogPost(post.id)
      setPosts(prev => prev.filter(p => p.id !== post.id))
    } catch (err) {
      alert(friendlyBlogError(err as Error))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: '#ff8080', fontSize: 13.5 }}>{error}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or slug…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={{ ...inputStyle, width: 'auto', minWidth: 120 }}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ ...inputStyle, width: 'auto', minWidth: 150 }}>
          <option value="updated_desc">Last edited</option>
          <option value="created_desc">Newest created</option>
          <option value="published_desc">Publish date</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>{visible.length} article{visible.length === 1 ? '' : 's'}</p>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>No articles match these filters.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(post => {
            const cat = categoryBySlug.get(post.category)
            const CatIcon = getBlogIconComponent(cat?.icon)
            const author = post.author_id ? authorById.get(post.author_id) : null
            const editable = canEdit(post)
            const busy = busyId === post.id
            return (
              <div key={post.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
                opacity: busy ? 0.6 : 1,
              }}>
                {post.hero_image_url ? (
                  <img src={post.hero_image_url} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 9, background: 'var(--surface2)', flexShrink: 0 }} />
                )}

                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {cat && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: cat.color, fontWeight: 700 }}>
                        <CatIcon size={11} /> {cat.label}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {author?.display_name || author?.username || 'Unassigned'}</span>
                  </div>
                </div>

                <span style={statusBadgeStyle(post.status)}>{statusMeta(post.status).label}</span>

                <div style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 90 }}>
                  {post.status === 'scheduled' && post.scheduled_at ? (
                    <>Publishes<br />{new Date(post.scheduled_at).toLocaleDateString()}</>
                  ) : post.published_at ? (
                    <>Published<br />{new Date(post.published_at).toLocaleDateString()}</>
                  ) : (
                    <>Edited<br />{new Date(post.updated_at).toLocaleDateString()}</>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <ActionButton title={editable ? 'Edit' : 'View'} icon={Pencil} onClick={() => onEdit(post)} />
                  <ActionButton title="Duplicate" icon={Copy} onClick={() => handleDuplicate(post)} disabled={busy} />
                  {isEditorPlus && (
                    <ActionButton
                      title={post.status === 'archived' ? 'Restore to draft' : 'Archive'}
                      icon={post.status === 'archived' ? ArchiveRestore : Archive}
                      onClick={() => handleArchive(post)}
                      disabled={busy}
                    />
                  )}
                  {isAdmin && (
                    <ActionButton title="Delete" icon={Trash2} onClick={() => handleDelete(post)} disabled={busy} danger />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionButton({ title, icon: Icon, onClick, disabled, danger }: {
  title: string; icon: typeof Pencil; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { ripple(e); onClick() }}
      className="ripple-wrap"
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
        color: danger ? '#ff8080' : 'var(--text-dim)',
      }}
    >
      <Icon size={13} />
    </button>
  )
}
