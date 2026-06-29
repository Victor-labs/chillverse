// src/pages/Settings.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Trash2,
  Calendar, Tag, Lock, Eye,
  Circle, Moon, EyeOff, Check, Mail, Key,
  AlertTriangle, Edit2, X, LogOut, Layers,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'

const PRESENCE_OPTIONS = [
  { id: 'online',    label: 'Online',    desc: 'Visible to everyone, shown as active.',     color: '#3ecf8e', Icon: Circle },
  { id: 'idle',      label: 'Idle',      desc: 'Visible, but marked as away.',              color: '#f5c542', Icon: Moon   },
  { id: 'offline',   label: 'Offline',   desc: 'Appears offline to others.',                color: '#888899', Icon: Circle },
  { id: 'invisible', label: 'Invisible', desc: "Others can't search or add you to a game.", color: '#555566', Icon: EyeOff },
]

function Row({ icon, iconBg, iconColor, label, value, danger = false, onClick, rightEl }: {
  icon: React.ReactNode; iconBg: string; iconColor?: string
  label: string; value?: string; danger?: boolean
  onClick?: (e: React.MouseEvent) => void
  rightEl?: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={onClick ? 'ripple-wrap' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, cursor: onClick ? 'pointer' : 'default', boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg, color: danger ? '#ff6b6b' : iconColor }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: danger ? '#ff6b6b' : 'var(--text)' }}>{label}</div>
      {value && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{value}</div>}
      {rightEl}
      {onClick && !rightEl && <ChevronRight size={15} color="var(--text-muted)" />}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12, marginTop: 26 }}>{children}</div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'popIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Input({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { session } = useAuth()

  const [modal, setModal] = useState<'logout' | 'delete' | 'email' | 'username' | 'password' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const [presence, setPresence] = useState('online')
  const [showFollowCounts, setShowFollowCounts] = useState(true)
  const [savingFollowToggle, setSavingFollowToggle] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const userEmail = session?.user?.email ?? ''
  const displayName = profile?.display_name || profile?.username || 'You'

  useEffect(() => {
    if (profile && (profile as any).presence) setPresence((profile as any).presence)
    if (profile && typeof (profile as any).show_follow_counts === 'boolean') {
      setShowFollowCounts((profile as any).show_follow_counts)
    }
    if (profile?.username) setNewUsername(profile.username)
  }, [profile])

  async function handleSetPresence(id: string) {
    setPresence(id)
    if (!profile?.id) return
    await supabase.from('profiles').update({ presence: id }).eq('id', profile.id)
  }

  async function toggleShowFollowCounts() {
    if (!profile?.id || savingFollowToggle) return
    const next = !showFollowCounts
    setShowFollowCounts(next)
    setSavingFollowToggle(true)
    const { error } = await supabase.from('profiles').update({ show_follow_counts: next }).eq('id', profile.id)
    setSavingFollowToggle(false)
    if (error) setShowFollowCounts(!next)
  }

  async function handleSaveUsername() {
    if (!newUsername.trim() || !profile?.id) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', profile.id)
    setSaving(false)
    setFeedback(error ? 'Failed to update username.' : 'Username updated!')
    setTimeout(() => { setFeedback(''); setModal(null) }, 1500)
  }

  async function handleSaveEmail() {
    if (!newEmail.trim()) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setSaving(false)
    setFeedback(error ? 'Failed to update email.' : 'Confirmation sent to new email.')
    setTimeout(() => { setFeedback(''); setModal(null) }, 2000)
  }

  async function handleSavePassword() {
    if (newPass !== confirmPass) { setFeedback("Passwords don't match."); return }
    if (newPass.length < 8) { setFeedback('Minimum 8 characters.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSaving(false)
    setFeedback(error ? 'Failed to update password.' : 'Password updated!')
    setTimeout(() => { setFeedback(''); setModal(null); setNewPass(''); setConfirmPass('') }, 1500)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  async function handleLogoutAllDevices() {
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) {
        setDeleteError('Failed to delete account. Please try again.')
        setDeleting(false)
        return
      }
      await supabase.auth.signOut()
      navigate('/login')
    } catch {
      setDeleteError('Failed to delete account. Please try again.')
      setDeleting(false)
    }
  }

  const presenceDot = PRESENCE_OPTIONS.find(p => p.id === presence)

  return (
    <>
      <style>{`
        @keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>

        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
            <ArrowLeft size={15} />
          </button>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '20px 18px', marginBottom: 8, boxShadow: '4px 4px 12px var(--neu-dark),-2px -2px 8px var(--neu-light)', animation: 'feedIn 0.3s ease-out both', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 58, height: 58, borderRadius: 17, background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 16px rgba(155,109,255,0.3)' }}>
              {profile?.avatar && profile.avatar.startsWith('http') ? (
                <img src={profile.avatar} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
              ) : (
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: presenceDot?.color ?? '#3ecf8e', border: '2.5px solid var(--surface)', boxShadow: `0 0 6px ${presenceDot?.color ?? '#3ecf8e'}` }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: presenceDot?.color ?? '#3ecf8e' }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'capitalize' }}>{presence}</span>
            </div>
          </div>
        </div>

        <SectionTitle>Profile</SectionTitle>
        <Row icon={<Tag size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="#4f8ef7"
          label="Username" value={profile?.username ?? '—'}
          onClick={(e) => { ripple(e as any); setModal('username') }}
          rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
        />
        <Row icon={<Mail size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="#3ecf8e"
          label="Email" value={userEmail ? userEmail.replace(/(.{2}).+(@.+)/, '$1…$2') : '—'}
          onClick={(e) => { ripple(e as any); setModal('email') }}
          rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
        />
        <Row icon={<Key size={15} />} iconBg="rgba(245,197,66,0.12)" iconColor="#f5c542"
          label="Change Password"
          onClick={(e) => { ripple(e as any); setModal('password') }}
        />

        <SectionTitle>Status</SectionTitle>
        {PRESENCE_OPTIONS.map(p => (
          <div
            key={p.id}
            onClick={() => handleSetPresence(p.id)}
            className="ripple-wrap"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--surface)', border: presence === p.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 8, cursor: 'pointer', boxShadow: presence === p.id ? '0 0 0 1px var(--accent)' : '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', color: p.color }}>
              <p.Icon size={14} fill={p.id === 'online' || p.id === 'offline' ? p.color : 'none'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{p.desc}</div>
            </div>
            {presence === p.id && <Check size={16} color="var(--accent)" />}
          </div>
        ))}

        <SectionTitle>Privacy</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79,142,247,0.12)', color: '#4f8ef7' }}>
            <Eye size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Show follower & following counts</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>Let other players see these on your profile</div>
          </div>
          <Toggle on={showFollowCounts} onToggle={toggleShowFollowCounts} />
        </div>

        <SectionTitle>Account info</SectionTitle>
        <Row icon={<Calendar size={15} />} iconBg="var(--surface2)" iconColor="var(--text-dim)"
          label="Date joined"
          value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
        />

        <SectionTitle>Chillverse</SectionTitle>
        <Row icon={<Layers size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="#9b6dff"
          label="Version"
          value="v1.0"
          onClick={(e) => { ripple(e as any); navigate('/version') }}
        />

        <SectionTitle>Danger zone</SectionTitle>
        <Row icon={<LogOut size={15} />} iconBg="rgba(255,107,0,0.12)" iconColor="var(--accent)"
          label="Log out"
          onClick={(e) => { ripple(e as any); setModal('logout') }}
        />
        <Row icon={<Lock size={15} />} iconBg="rgba(255,107,107,0.12)" iconColor="#ff6b6b"
          label="Log out all devices"
          onClick={(e) => { ripple(e as any); handleLogoutAllDevices() }}
        />
        <Row icon={<Trash2 size={15} />} iconBg="rgba(255,107,107,0.12)"
          label="Delete account" danger
          onClick={(e) => { ripple(e as any); setModal('delete') }}
        />
      </div>

      {modal === 'logout' && (
        <Modal title="Log out?" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>You'll need to sign back in to access your account.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button onClick={handleLogout} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Log out</button>
          </div>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="Delete account?" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, padding: '12px 14px', background: 'rgba(255,107,107,0.08)', borderRadius: 12, border: '1px solid rgba(255,107,107,0.2)' }}>
            <AlertTriangle size={16} style={{ color: '#ff6b6b', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#ff6b6b', lineHeight: 1.6 }}>This is permanent. All your data, XP, streaks and game history will be deleted and cannot be recovered.</p>
          </div>
          {deleteError && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12 }}>{deleteError}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal(null)} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'username' && (
        <Modal title="Change Username" onClose={() => setModal(null)}>
          <Input label="New username" value={newUsername} onChange={setNewUsername} placeholder="e.g. chillking99" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('!') ? '#3ecf8e' : '#ff6b6b', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSaveUsername} disabled={saving} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </Modal>
      )}

      {modal === 'email' && (
        <Modal title="Change Email" onClose={() => setModal(null)}>
          <Input label="New email address" type="email" value={newEmail} onChange={setNewEmail} placeholder="new@email.com" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('Confirmation') ? '#3ecf8e' : '#ff6b6b', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSaveEmail} disabled={saving} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {saving ? 'Sending…' : 'Send confirmation'}
          </button>
        </Modal>
      )}

      {modal === 'password' && (
        <Modal title="Change Password" onClose={() => setModal(null)}>
          <Input label="New password" type="password" value={newPass} onChange={setNewPass} placeholder="Min 8 characters" />
          <Input label="Confirm password" type="password" value={confirmPass} onChange={setConfirmPass} placeholder="Repeat new password" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('!') ? '#3ecf8e' : '#ff6b6b', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSavePassword} disabled={saving} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </Modal>
      )}
    </>
  )
}
