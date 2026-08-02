// src/features/blog/admin/BlogAdminShell.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldAlert, LayoutDashboard, Newspaper, ImageIcon, Tags } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { useAuth } from '../../auth/useAuth'
import { useModRole } from '../../moderation/useModRole'
import type { BlogPost } from '../../../shared/types'
import BlogDashboardTab from './BlogDashboardTab'
import BlogArticlesTab from './BlogArticlesTab'
import BlogMediaTab from './BlogMediaTab'
import BlogTaxonomyTab from './BlogTaxonomyTab'
import BlogEditorModal from './BlogEditorModal'

type Tab = 'dashboard' | 'articles' | 'media' | 'taxonomy'

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'articles', label: 'Articles', icon: Newspaper },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'taxonomy', label: 'Categories & Tags', icon: Tags },
]

export default function BlogAdminShell() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role, isStaff, isModOrAdmin, isAdmin, loading: roleLoading } = useModRole()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editorPost, setEditorPost] = useState<BlogPost | 'new' | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  if (roleLoading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (!isStaff) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <ShieldAlert size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Staff only</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>This page is for Chillverse staff, moderators, and admins.</p>
      </div>
    )
  }

  const roleLabel = role === 'admin' ? 'Administrator' : role === 'moderator' ? 'Editor' : 'Writer'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/blog') }}
        className="ripple-wrap"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 14 }}
      >
        <ChevronLeft size={15} /> Back to Blog
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Blog CMS</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Signed in as {roleLabel}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={(e) => { ripple(e); setTab(t.key) }}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 10,
              background: tab === t.key ? 'var(--accent)' : 'var(--surface)',
              color: tab === t.key ? '#fff' : 'var(--text-dim)',
              border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <BlogDashboardTab onCreate={() => setEditorPost('new')} onOpenPost={(post) => setEditorPost(post)} />
      )}
      {tab === 'articles' && (
        <BlogArticlesTab
          currentUserId={user?.id ?? null}
          isEditorPlus={isModOrAdmin}
          isAdmin={isAdmin}
          onEdit={(post) => setEditorPost(post)}
          refreshToken={refreshToken}
        />
      )}
      {tab === 'media' && <BlogMediaTab currentUserId={user?.id ?? null} canDeleteAny={isModOrAdmin} />}
      {tab === 'taxonomy' && <BlogTaxonomyTab canDelete={isAdmin} />}

      {editorPost && (
        <BlogEditorModal
          post={editorPost === 'new' ? null : editorPost}
          canPublish={isModOrAdmin}
          currentUserRole={role}
          onClose={() => setEditorPost(null)}
          onSaved={() => { setEditorPost(null); setRefreshToken(t => t + 1); setTab('articles') }}
        />
      )}
    </div>
  )
}
