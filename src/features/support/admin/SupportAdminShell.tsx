// src/features/support/admin/SupportAdminShell.tsx
// The help center CMS, mounted at /support/admin. Deliberately mirrors
// BlogAdminShell — same permission model (is_staff to write, is_admin_role
// to delete), same tab layout, same shared style tokens — so anyone who has
// used the blog CMS already knows how this one works.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldAlert, LayoutDashboard, FileText, FolderTree, MessagesSquare } from 'lucide-react'
import { ripple } from '../../../shared/lib/ripple'
import { useAuth } from '../../auth/useAuth'
import { useModRole } from '../../moderation/useModRole'
import type { SupportArticle } from '../../../shared/types'
import SupportArticlesTab from './SupportArticlesTab'
import SupportCategoriesTab from './SupportCategoriesTab'
import SupportFeedbackTab from './SupportFeedbackTab'
import SupportArticleEditor from './SupportArticleEditor'

type Tab = 'articles' | 'categories' | 'feedback'

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'articles', label: 'Articles', icon: FileText },
  { key: 'categories', label: 'Categories', icon: FolderTree },
  { key: 'feedback', label: 'Feedback', icon: MessagesSquare },
]

export default function SupportAdminShell() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role, isStaff, isAdmin, loading: roleLoading } = useModRole()

  const [tab, setTab] = useState<Tab>('articles')
  const [editorArticle, setEditorArticle] = useState<SupportArticle | 'new' | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  if (roleLoading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
  }

  if (!isStaff) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <ShieldAlert size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Staff only</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>
          This page is for Chillverse staff, moderators, and admins.
        </p>
      </div>
    )
  }

  const roleLabel = role === 'admin' ? 'Administrator' : role === 'moderator' ? 'Editor' : 'Writer'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/support') }}
        className="ripple-wrap"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)',
          background: 'none', border: 'none', marginBottom: 14,
        }}
      >
        <ChevronLeft size={15} /> Back to Help Center
      </button>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Help Center CMS</h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Signed in as {roleLabel}</p>
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

      {tab === 'articles' && (
        <SupportArticlesTab
          isAdmin={isAdmin}
          refreshToken={refreshToken}
          onCreate={() => setEditorArticle('new')}
          onEdit={(article) => setEditorArticle(article)}
        />
      )}
      {tab === 'categories' && <SupportCategoriesTab canDelete={isAdmin} />}
      {tab === 'feedback' && <SupportFeedbackTab canDelete={isAdmin} />}

      {editorArticle && (
        <SupportArticleEditor
          article={editorArticle === 'new' ? null : editorArticle}
          currentUserId={user?.id ?? null}
          onClose={() => setEditorArticle(null)}
          onSaved={() => { setEditorArticle(null); setRefreshToken(t => t + 1) }}
        />
      )}
    </div>
  )
}
