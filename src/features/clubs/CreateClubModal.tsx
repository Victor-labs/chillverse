// src/features/clubs/CreateClubModal.tsx
// Phase 4 of the Clubs redesign (see /areas/chillverse-clubs-redesign.md):
// name + an uploaded icon (not a random one — see clubIcons.tsx), an
// optional skippable "what's it for" description, and picking up to 3
// extra channels on top of the auto-created `general`. No template
// picker, no "friends vs community" branch — that Discord-onboarding
// flourish was explicitly ruled out.

import { useState, useEffect, useRef } from 'react'
import { X, Crown, Camera, Plus, Hash } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import { createClub, updateClubSettings, uploadClubIcon } from './clubs'

const MAX_EXTRA_CHANNELS = 3 // + the auto-created `general` = the 4-channel cap

interface CreateClubModalProps {
  onClose: () => void
  onCreated: (roomId: string) => void
}

export default function CreateClubModal({ onClose, onCreated }: CreateClubModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null)
  const [extraChannels, setExtraChannels] = useState<string[]>([])
  const [channelDraft, setChannelDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [isPro, setIsPro] = useState(false) // display only — real gating happens server-side in create_club

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('is_pro, pro_expires_at').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setIsPro(!!data.is_pro && (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date()))
      })
  }, [user])

  // Revoke the object URL when it's replaced or the modal unmounts.
  useEffect(() => () => { if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl) }, [iconPreviewUrl])

  function handlePickIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    setIconFile(file)
    setIconPreviewUrl(URL.createObjectURL(file))
  }

  function addChannelDraft() {
    const trimmed = channelDraft.trim()
    if (!trimmed || extraChannels.length >= MAX_EXTRA_CHANNELS) return
    setExtraChannels(cs => [...cs, trimmed])
    setChannelDraft('')
  }

  function removeChannel(i: number) {
    setExtraChannels(cs => cs.filter((_, idx) => idx !== i))
  }

  async function handleCreate() {
    if (!name.trim() || !user) return
    setCreating(true)
    setError('')
    try {
      let iconUrl: string | undefined
      if (iconFile) iconUrl = await uploadClubIcon(user.id, iconFile)

      const roomId = await createClub({ name: name.trim(), iconUrl, extraChannels })

      // create_club doesn't take a description — set it as a follow-up.
      // Non-fatal if it fails: the club still exists, just without one.
      if (description.trim()) {
        try { await updateClubSettings(roomId, { description: description.trim() }) } catch { /* ignore */ }
      }

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

        {/* Icon upload */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickIcon} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              border: iconPreviewUrl ? 'none' : '2px dashed var(--border-strong)',
              background: iconPreviewUrl ? 'none' : 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3,
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            {iconPreviewUrl
              ? <img src={iconPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><Camera size={20} /><span style={{ fontSize: 9.5, fontWeight: 700 }}>UPLOAD</span></>}
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Club name</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Late Night Ludo"
          maxLength={60}
          autoFocus
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>What's it for? <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Skip this if you're not sure yet"
          maxLength={300}
          rows={2}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Channels <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}>(optional — you'll always have #general)</span>
        </div>
        {extraChannels.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {extraChannels.map((ch, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-dim)' }}>
                <Hash size={10} /> {ch}
                <button type="button" onClick={() => removeChannel(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', marginLeft: 2 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        {extraChannels.length < MAX_EXTRA_CHANNELS && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input
              value={channelDraft}
              onChange={e => setChannelDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChannelDraft() } }}
              placeholder="e.g. announcements"
              maxLength={40}
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={addChannelDraft} disabled={!channelDraft.trim()} style={{ width: 36, borderRadius: 10, border: 'none', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !channelDraft.trim() ? 0.5 : 1 }}>
              <Plus size={15} />
            </button>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 18 }}>
          Every club is invite-only — you'll get a join link right after creating it.
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
