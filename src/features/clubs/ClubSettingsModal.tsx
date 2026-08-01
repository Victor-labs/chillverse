// src/features/clubs/ClubSettingsModal.tsx
// One modal for everyone: club name/icon/description + a "Members" row that
// opens ClubMembersPanel. Welcome message is president OR VP. Everything
// else below that — name/description, invite link/code, mute club,
// transfer ownership, clear chat, delete club — stays president-only.
// Every club is invite-only now, so there's no privacy toggle and no
// waiting list. Reached from a single header icon in ClubChat — no
// separate members-only icon anymore.

import { useState, type CSSProperties } from 'react'
import { X, Copy, Check, RefreshCw, Users, Link2 } from 'lucide-react'
import {
  updateClubSettings, fetchClub, regenerateClubCode, transferClubOwnership, clearClubChat, deleteClub,
  buildClubInviteLink,
  type ClubRoom, type ClubMemberRow, type ClubRole,
} from './clubs'
import ClubIcon from './clubIcons'
import ClubMembersPanel from './ClubMembersPanel'

interface ClubSettingsModalProps {
  club: ClubRoom
  members: ClubMemberRow[]
  myId: string
  myRole: ClubRole
  onClose: () => void
  onUpdated: (club: ClubRoom) => void
  onLeftOrDeleted: () => void
}

const DEFAULT_WELCOME = 'Welcome {display_name} to {club_name}! You are member #{member_count}. I hope you enjoy your stay 🎉'

export default function ClubSettingsModal({ club, members, myId, myRole, onClose, onUpdated, onLeftOrDeleted }: ClubSettingsModalProps) {
  const isPresident = myRole === 'president'

  const [name, setName] = useState(club.name)
  const [description, setDescription] = useState(club.description ?? '')
  const [muted, setMuted] = useState(club.muted)
  const [welcomeMessage, setWelcomeMessage] = useState(club.welcome_message ?? DEFAULT_WELCOME)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [busy, setBusy] = useState(false)

  const vps = members.filter(m => m.role === 'vp')

  async function saveField(patch: Partial<{
    name: string; description: string; welcomeMessage: string; muted: boolean
  }>) {
    setSaving(true)
    setError('')
    try {
      await updateClubSettings(club.id, patch)
      const fresh = await fetchClub(club.id)
      if (fresh) onUpdated(fresh)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    if (!club.join_code) return
    navigator.clipboard.writeText(buildClubInviteLink(club.id, club.join_code)).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    })
  }

  async function handleRegenerate() {
    setRegenerating(true)
    setError('')
    try {
      await regenerateClubCode(club.id)
      const fresh = await fetchClub(club.id)
      if (fresh) onUpdated(fresh)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleTransfer() {
    if (!transferTo) return
    setBusy(true)
    setError('')
    try {
      await transferClubOwnership(club.id, transferTo)
      onLeftOrDeleted() // my role just changed to VP — simplest is to close out like leaving the settings context
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function handleClear() {
    setBusy(true)
    setError('')
    try {
      await clearClubChat(club.id)
      setConfirmClear(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await deleteClub(club.id)
      onLeftOrDeleted()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  const sectionTitle: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 20 }
  const inputStyle: CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201,
        background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 18,
        padding: '20px 20px 20px', width: Math.min(420, window.innerWidth - 32),
        maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--elev-popover)',
      }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>

        {/* Header — everyone sees this */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), #7c5cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <ClubIcon iconKey={club.icon_key} size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isPresident ? 'President' : myRole === 'vp' ? 'VP' : 'Member'}</p>
          </div>
        </div>
        {club.description && !isPresident && (
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.4 }}>{club.description}</p>
        )}

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12, marginTop: 14 }}>{error}</div>
        )}

        {/* Members — everyone, always visible */}
        <button
          onClick={() => setMembersOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 16, padding: '11px 14px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}
        >
          <Users size={15} style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'left' }}>Members</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{members.length}</span>
        </button>

        {/* Welcome message — president or VP, per spec */}
        {(isPresident || myRole === 'vp') && (
          <>
            <div style={sectionTitle}>Welcome message</div>
            <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontWeight: 400, lineHeight: 1.4 }}
              onBlur={() => { if (welcomeMessage !== (club.welcome_message ?? DEFAULT_WELCOME)) saveField({ welcomeMessage }) }} />
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Placeholders: <code>{'{display_name}'}</code> <code>{'{club_name}'}</code> <code>{'{member_count}'}</code> — remove any you don't want, or leave as default.
            </p>
            <button onClick={() => { setWelcomeMessage(DEFAULT_WELCOME); saveField({ welcomeMessage: DEFAULT_WELCOME }) }} style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              Reset to default
            </button>
          </>
        )}

        {!isPresident ? null : (
          <>
            <div style={sectionTitle}>Club name</div>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={60} style={inputStyle}
              onBlur={() => { if (name.trim() && name !== club.name) saveField({ name: name.trim() }) }} />

            <div style={sectionTitle}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 300))} maxLength={300} rows={3}
              placeholder="What's this club about?"
              style={{ ...inputStyle, resize: 'vertical', fontWeight: 400, lineHeight: 1.4 }}
              onBlur={() => { if (description !== (club.description ?? '')) saveField({ description }) }} />
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{description.length}/300</p>

            <div style={sectionTitle}>Invite link</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <Link2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {club.join_code ? buildClubInviteLink(club.id, club.join_code) : ''}
              </span>
              <button onClick={copyLink} style={{ background: 'none', border: 'none', cursor: 'pointer', color: linkCopied ? '#3ecf8e' : 'var(--text-dim)', display: 'flex', flexShrink: 0 }}>
                {linkCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button onClick={handleRegenerate} disabled={regenerating} title="Generate a new link — the old one stops working immediately" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', flexShrink: 0, opacity: regenerating ? 0.5 : 1 }}>
                <RefreshCw size={14} />
              </button>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Share the link or the code — either gets someone straight in. Regenerating kills the old one immediately.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Mute club</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Only you and VPs can send messages</div>
              </div>
              <button onClick={() => { setMuted(!muted); saveField({ muted: !muted }) }}
                style={{ width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: muted ? 'var(--accent)' : 'var(--surface3)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: muted ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
            </div>

            {vps.length > 0 && (
              <>
                <div style={sectionTitle}>Transfer ownership</div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Only a current VP can become president.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={transferTo} onChange={e => setTransferTo(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Choose a VP…</option>
                    {vps.map(v => <option key={v.user_id} value={v.user_id}>{v.display_name || v.username}</option>)}
                  </select>
                  <button onClick={handleTransfer} disabled={!transferTo || busy} style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--surface3)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: !transferTo || busy ? 0.6 : 1 }}>
                    Transfer
                  </button>
                </div>
              </>
            )}

            <div style={sectionTitle}>Danger zone</div>
            {confirmClear ? (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Clear all messages for every member? This can't be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleClear} disabled={busy} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>Clear chat</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,107,107,0.3)', background: 'transparent', color: '#ff6b6b', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
                Clear chat
              </button>
            )}
            {confirmDelete ? (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Delete this club for everyone? This can't be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleDelete} disabled={busy} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>Delete club</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Delete club
              </button>
            )}
          </>
        )}

        {saving && <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>Saving…</p>}
      </div>

      {membersOpen && (
        <ClubMembersPanel
          club={club}
          myRole={myRole}
          myId={myId}
          onClose={() => setMembersOpen(false)}
          onLeftOrDeleted={onLeftOrDeleted}
        />
      )}
    </>
  )
}
