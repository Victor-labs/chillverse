// src/features/settings/BlockedAccounts.tsx — Settings › Social › Blocked accounts
import { useEffect, useState } from 'react'
import { Ban } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import Avatar from '../../shared/components/Avatar'
import { SettingsShell, InfoLine } from './settingsShared'

interface BlockedRow {
  blocked_id: string
  username: string
  display_name: string | null
  avatar: string | null
}

export default function BlockedAccounts() {
  const { user } = useAuth()
  const [rows, setRows] = useState<BlockedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    ;(async () => {
      const { data: blocks } = await supabase
        .from('blocks').select('blocked_id').eq('blocker_id', user.id)
      const ids = (blocks ?? []).map(b => b.blocked_id)
      if (!ids.length) { if (active) { setRows([]); setLoading(false) } ; return }
      const { data: profiles } = await supabase
        .from('profiles').select('id, username, display_name, avatar').in('id', ids)
      if (!active) return
      setRows((profiles ?? []).map(p => ({
        blocked_id: p.id, username: p.username, display_name: p.display_name, avatar: p.avatar,
      })))
      setLoading(false)
    })()
    return () => { active = false }
  }, [user?.id])

  async function unblock(id: string) {
    if (!user?.id || busyId) return
    setBusyId(id)
    const { error } = await supabase.from('blocks')
      .delete().eq('blocker_id', user.id).eq('blocked_id', id)
    setBusyId(null)
    if (!error) setRows(prev => prev.filter(r => r.blocked_id !== id))
  }

  return (
    <SettingsShell title="Blocked accounts">
      <InfoLine>Blocked accounts can't message you, invite you to games, or see your activity. They stay listed here so you can unblock anytime.</InfoLine>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '56px 0', color: 'var(--text-muted)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ban size={22} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No blocked accounts</div>
        </div>
      ) : (
        <div className="settings-card">
          {rows.map(r => (
            <div key={r.blocked_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <Avatar src={r.avatar ?? undefined} name={r.display_name || r.username} size={38} radius={12} disabled />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.display_name || r.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{r.username}</div>
              </div>
              <button
                onClick={() => unblock(r.blocked_id)}
                disabled={busyId === r.blocked_id}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: 12, opacity: busyId === r.blocked_id ? 0.6 : 1 }}
              >
                {busyId === r.blocked_id ? 'Unblocking…' : 'Unblock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsShell>
  )
}
