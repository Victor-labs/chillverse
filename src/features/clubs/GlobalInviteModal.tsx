// src/features/clubs/GlobalInviteModal.tsx
// Staff-only. Global Chat's invite link works exactly like a club's —
// same join_code column, same link shape — the only difference is who
// can turn it on/off: any club president can regenerate their club's
// code, but Global Chat's link is admin-only (is_staff()), like a
// WhatsApp group invite toggle. See supabase/migrations/0093.

import { useEffect, useState } from 'react'
import { X, Copy, Check, Link2 } from 'lucide-react'
import { fetchGlobalInviteStatus, toggleGlobalInvite, buildGlobalInviteLink } from './invites'

export default function GlobalInviteModal({ onClose }: { onClose: () => void }) {
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    fetchGlobalInviteStatus()
      .then(s => setJoinCode(s.joinCode))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(enabled: boolean) {
    setToggling(true)
    setError('')
    try {
      const code = await toggleGlobalInvite(enabled)
      setJoinCode(code)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setToggling(false)
    }
  }

  function copyLink() {
    if (!joinCode) return
    navigator.clipboard.writeText(buildGlobalInviteLink(joinCode)).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    })
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301, background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 18, padding: '20px 20px 18px', width: 'min(360px, calc(100vw - 32px))', boxShadow: 'var(--elev-popover)' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={15} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Link2 size={15} style={{ color: 'var(--text-dim)' }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Global Chat invite link</p>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Staff only. When on, anyone with the link can join Global Chat. Turning it off invalidates the current link immediately.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Loading…</div>
        ) : (
          <>
            {joinCode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {buildGlobalInviteLink(joinCode)}
                </span>
                <button onClick={copyLink} style={{ background: 'none', border: 'none', cursor: 'pointer', color: linkCopied ? '#3ecf8e' : 'var(--text-dim)', display: 'flex', flexShrink: 0 }}>
                  {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleToggle(true)}
                disabled={toggling || !!joinCode}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: joinCode ? 'var(--surface)' : 'var(--accent)', color: joinCode ? 'var(--text-dim)' : '#fff', fontWeight: 700, fontSize: 12.5, cursor: joinCode ? 'default' : 'pointer', opacity: toggling ? 0.7 : 1 }}
              >
                {joinCode ? 'Link is on' : 'Turn on'}
              </button>
              <button
                onClick={() => handleToggle(false)}
                disabled={toggling || !joinCode}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: !joinCode ? 'var(--text-dim)' : '#ff6b6b', fontWeight: 700, fontSize: 12.5, cursor: !joinCode ? 'default' : 'pointer', opacity: toggling ? 0.7 : 1 }}
              >
                Turn off
              </button>
            </div>
            {joinCode && (
              <button
                onClick={() => handleToggle(true)}
                disabled={toggling}
                style={{ width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 10, border: 'none', background: 'none', color: 'var(--text-dim)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
              >
                Generate a new link (invalidates this one)
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}
