// src/features/clubs/ClubSettingsModal.tsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { updateClubSettings, fetchClubIcons, fetchClub, type ClubIconItem, type ClubRoom } from './clubs'

interface ClubSettingsModalProps {
  club: ClubRoom
  onClose: () => void
  onUpdated: (club: ClubRoom) => void
}

export default function ClubSettingsModal({ club, onClose, onUpdated }: ClubSettingsModalProps) {
  const [name, setName] = useState(club.name)
  const [isPrivate, setIsPrivate] = useState(club.is_private)
  const [icons, setIcons] = useState<ClubIconItem[]>([])
  const [selectedIcon, setSelectedIcon] = useState<string | null>(club.icon_mall_item_id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchClubIcons().then(setIcons).catch(() => setIcons([]))
  }, [])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateClubSettings(club.id, { name: name.trim(), isPrivate, iconMallItemId: selectedIcon })
      const fresh = await fetchClub(club.id)
      if (fresh) onUpdated(fresh)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
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
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 18 }}>Club settings</p>

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12, marginBottom: 14 }}>{error}</div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Club name</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Privacy</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setIsPrivate(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${!isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: !isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: !isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Public</button>
          <button onClick={() => setIsPrivate(true)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Invite-only</button>
        </div>

        {icons.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setSelectedIcon(null)}
                style={{ aspectRatio: '1', borderRadius: 10, border: `2px solid ${selectedIcon === null ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }}
              >
                None
              </button>
              {icons.map(icon => (
                <button
                  key={icon.id}
                  onClick={() => setSelectedIcon(icon.id)}
                  title={icon.name}
                  style={{ aspectRatio: '1', borderRadius: 10, border: `2px solid ${selectedIcon === icon.id ? 'var(--accent)' : 'var(--border)'}`, padding: 0, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg)' }}
                >
                  {icon.image_url && <img src={icon.image_url} alt={icon.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={(e) => { ripple(e); handleSave() }}
          disabled={saving || !name.trim()}
          className="ripple-wrap"
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  )
}
