// src/features/admin/AdminUsersDrawer.tsx
import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Crown, ShieldCheck, ShieldBan } from 'lucide-react'
import AdminDrawer from './AdminDrawer'
import AdminUserDetailDrawer from './AdminUserDetailDrawer'
import { fetchAdminUserList, type AdminUserRow } from './adminStats'

const PAGE_SIZE = 20

interface AdminUsersDrawerProps {
  open: boolean
  onClose: () => void
}

export default function AdminUsersDrawer({ open, onClose }: AdminUsersDrawerProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Reset to page 1 whenever the drawer is (re)opened or the search changes.
  useEffect(() => { if (open) setPage(1) }, [open, debouncedSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError('')
    fetchAdminUserList(page, PAGE_SIZE, debouncedSearch).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error)
      setRows(data?.rows ?? [])
      setTotal(data?.total ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [open, page, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <AdminDrawer open={open} onClose={onClose} title="Users" subtitle={`${total.toLocaleString()} total`}>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username, name, or email…"
            style={{
              width: '100%', background: 'var(--surface2)', border: 'none', borderRadius: 10,
              padding: '9px 12px 9px 34px', fontSize: 12.5, color: 'var(--text)', outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}

        {loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No users match that search.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  background: 'var(--surface2)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff',
                }}>
                  {u.avatar.startsWith('http')
                    ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (u.display_name || u.username).charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center gap-1.5">
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.display_name || u.username}
                    </p>
                    {u.staff_role && <ShieldCheck size={11} style={{ color: 'var(--blue)', flexShrink: 0 }} />}
                    {u.is_pro && <Crown size={11} style={{ color: 'var(--purple)', flexShrink: 0 }} />}
                    {u.is_banned && <ShieldBan size={11} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    fontSize: 12.5, fontWeight: 800, margin: 0,
                    color: u.balance_flagged ? 'var(--red)' : 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
                  }}>
                    {u.balance_flagged && <AlertTriangle size={11} />}
                    {u.gem_balance.toLocaleString()}
                  </p>
                  <p style={{ fontSize: 9.5, color: 'var(--text-muted)', margin: 0 }}>diamonds</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-dim)', fontSize: 12, cursor: page <= 1 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-dim)', fontSize: 12, cursor: page >= totalPages ? 'default' : 'pointer' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </AdminDrawer>

      <AdminUserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onBack={() => setSelectedUserId(null)}
      />
    </>
  )
}
