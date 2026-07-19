// src/features/admin/AdminUserSearch.tsx
//
// Small rectangular dropdown anchored under the wing-tabs row — replaces
// the old full-height slide-in AdminUsersDrawer. Shows live results as the
// admin types (debounced) and routes straight to /admin/users/:id on pick,
// instead of opening a second nested drawer. Capped at a handful of rows
// since this is meant to read as a quick composer, not a full paginated list.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, Crown, ShieldCheck, ShieldBan, Gem } from 'lucide-react'
import Avatar from '../../shared/components/Avatar'
import { fetchAdminUserList, type AdminUserRow } from './adminStats'

const RESULT_LIMIT = 8

interface AdminUserSearchProps {
  onClose: () => void
}

function RolePill({ role }: { role: AdminUserRow['staff_role'] }) {
  if (!role || role === 'user') return null
  const color = role === 'admin' ? 'var(--red)' : role === 'moderator' ? 'var(--blue)' : 'var(--purple)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.04em', color, background: `${color}1c`,
      border: `1px solid ${color}40`, borderRadius: 6, padding: '1px 5px', flexShrink: 0,
    }}>
      <ShieldCheck size={8} /> {role}
    </span>
  )
}

export default function AdminUserSearch({ onClose }: AdminUserSearchProps) {
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Autofocus the input the moment the dropdown opens.
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on outside click or Escape.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let active = true
    setError('')
    if (!debouncedSearch.trim()) {
      setRows([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchAdminUserList(1, RESULT_LIMIT, debouncedSearch).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error)
      setRows(data?.rows ?? [])
      setTotal(data?.total ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [debouncedSearch])

  function selectUser(id: string) {
    onClose()
    navigate(`/admin/users/${id}`)
  }

  return (
    <div
      ref={wrapRef}
      className="neu-card"
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 20,
        width: 320, maxWidth: 'calc(100vw - 40px)', borderRadius: 14,
        boxShadow: '0 12px 28px rgba(0,0,0,0.4), 4px 4px 12px var(--neu-dark)',
        border: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', padding: 10 }}>
        <Search size={13} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search username, name, or email…"
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '9px 12px 9px 32px', fontSize: 12.5, color: 'var(--text)', outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
        />
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
        {error ? (
          <p style={{ fontSize: 11.5, color: 'var(--red)', textAlign: 'center', padding: '18px 12px' }}>{error}</p>
        ) : !debouncedSearch.trim() ? (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 12px' }}>
            Start typing to find a user.
          </p>
        ) : loading ? (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 12px' }}>Searching…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 12px' }}>No matches.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', padding: 6, gap: 2 }}>
            {rows.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                  borderRadius: 10, padding: '8px 8px', cursor: 'pointer', background: 'transparent', border: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Avatar src={u.avatar} name={u.display_name || u.username} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center gap-1.5">
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.display_name || u.username}
                    </p>
                    <RolePill role={u.staff_role} />
                    {u.is_pro && <Crown size={10} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                    {u.is_banned && <ShieldBan size={10} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </p>
                </div>
                <div style={{
                  textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 800, color: u.balance_flagged ? 'var(--red)' : 'var(--gold)',
                }}>
                  {u.balance_flagged ? <AlertTriangle size={10} /> : <Gem size={10} />}
                  {u.gem_balance.toLocaleString()}
                </div>
              </button>
            ))}
            {total > RESULT_LIMIT && (
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 4px 2px' }}>
                {total - RESULT_LIMIT} more match{total - RESULT_LIMIT === 1 ? '' : 'es'} — refine your search
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
