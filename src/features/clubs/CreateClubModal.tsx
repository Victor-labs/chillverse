// src/features/clubs/CreateClubModal.tsx
import { useState, useEffect } from 'react'
import { X, Crown } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import { createClub } from './clubs'

interface CreateClubModalProps {
  onClose: () => void
  onCreated: (roomId: string) => void
}

export default function CreateClubModal({ onClose, onCreated }: CreateClubModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [isPro, setIsPro] = useState(false) // display only — real gating happens server-side in create_club

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('is_pro, pro_expires_at').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setIsPro(!!data.is_pro && (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date()))
      })
  }, [user])

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      const roomId = await createClub({ name: name.trim(), isPrivate })
      onCreated(roomId)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201,
        background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 18,
        padding: '22px 20px 20px', width: Math.min(380, window.innerWidth - 32),
        maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--elev-popover)',
      }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Create a club</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Free accounts can run 2 clubs at once — go Pro for unlimited.</p>

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12, marginBottom: 14 }}>{error}</div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Club name</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Late Night Ludo"
          maxLength={60}
          autoFocus
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Privacy</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setIsPrivate(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${!isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: !isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: !isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Public</button>
          <button onClick={() => setIsPrivate(true)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Invite-only</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>
          {isPrivate ? 'Only people with the join code can join.' : 'Anyone can find and join from the Clubs browse list, or use the code.'}
        </p>

        <button
          onClick={(e) => { ripple(e); handleCreate() }}
          disabled={creating || !name.trim()}
          className="ripple-wrap"
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: creating || !name.trim() ? 0.6 : 1 }}
        >
          {creating ? 'Creating…' : 'Create Club'}
        </button>

        {!isPro && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            <Crown size={12} /> Pro removes the 2-club limit
          </div>
        )}
      </div>
    </>
  )
}
