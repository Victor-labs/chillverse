// src/pages/Settings.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, User, LogOut, Trash2,
  Calendar, Tag, Globe, Shield, Bell, Lock,
  Circle, Moon, EyeOff, Check, Mail, Key,
  Smartphone, AlertTriangle, Edit2, Eye, BellOff,
  BellRing, MessageSquare, Gamepad2, Zap, X,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'

// ─── Presence ────────────────────────────────────────────────
const PRESENCE_OPTIONS = [
  { id: 'online',    label: 'Online',    desc: 'Visible to everyone, shown as active.',              color: '#3ecf8e', Icon: Circle  },
  { id: 'idle',      label: 'Idle',      desc: 'Visible, but marked as away.',                       color: '#f5c542', Icon: Moon    },
  { id: 'offline',   label: 'Offline',   desc: 'Appears offline to others.',                         color: '#888899', Icon: Circle  },
  { id: 'invisible', label: 'Invisible', desc: "Others can't search or add you to a game.",          color: '#555566', Icon: EyeOff  },
]

// ─── Notification options ─────────────────────────────────────
const NOTIF_OPTIONS = [
  { id: 'game_invites',   label: 'Game Invites',    desc: 'When someone invites you to play',    Icon: Gamepad2     },
  { id: 'messages',       label: 'Messages',        desc: 'New chat messages',                   Icon: MessageSquare },
  { id: 'achievements',   label: 'Achievements',    desc: 'When you unlock a badge or milestone',Icon: Zap          },
  { id: 'friend_activity',label: 'Friend Activity', desc: 'When friends go online or post',      Icon: User         },
  { id: 'promotions',     label: 'Promotions',      desc: 'Deals, events, and announcements',    Icon: Bell         },
]

// ─── Privacy options ──────────────────────────────────────────
const PRIVACY_OPTIONS = [
  { id: 'who_can_message',  label: 'Who can message me',   values: ['Everyone', 'Friends only', 'Nobody'] },
  { id: 'who_can_invite',   label: 'Who can invite me',    values: ['Everyone', 'Friends only', 'Nobody'] },
  { id: 'show_online',      label: 'Show online status',   values: ['Everyone', 'Friends only', 'Nobody'] },
  { id: 'show_activity',    label: 'Show game activity',   values: ['Everyone', 'Friends only', 'Nobody'] },
]

// ─── Helpers ─────────────────────────────────────────────────
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
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12, marginTop: 22 }}>{children}</div>
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 700, background: 'var(--bg)', overflowY: 'auto', animation: 'slideInRight 0.28s cubic-bezier(0.4,0,0.2,1) both' }}>
      <div style={{ position: 'sticky', top: 0, height: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', background: 'rgba(17,17,19,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 710 }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 20px 48px', maxWidth: 600, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────
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

// ─── Toggle ──────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════
// SUB-PAGES
// ══════════════════════════════════════════════════════

// ─── Account ─────────────────────────────────────────
function AccountPage({ onBack, profile, userEmail, onLogout }: {
  onBack: () => void; profile: any; userEmail: string; onLogout: () => void
}) {
  const [modal, setModal]       = useState<'logout' | 'delete' | 'email' | 'username' | 'password' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newUsername, setNewUsername] = useState(profile?.username ?? '')
  const [newPass, setNewPass]   = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSaveUsername() {
    if (!newUsername.trim()) return
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

  return (
    <SubPage title="Account" onBack={onBack}>
      <SectionTitle>Profile</SectionTitle>
      <Row icon={<Tag size={15} />}  iconBg="rgba(79,142,247,0.12)" iconColor="#4f8ef7"
        label="Username" value={profile?.username ?? '—'}
        onClick={(e) => { ripple(e as any); setModal('username') }}
        rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
      />
      <Row icon={<Mail size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="#3ecf8e"
        label="Email" value={userEmail ? userEmail.replace(/(.{2}).+(@.+)/, '$1…$2') : '—'}
        onClick={(e) => { ripple(e as any); setModal('email') }}
        rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
      />

      <SectionTitle>Security</SectionTitle>
      <Row icon={<Key size={15} />}       iconBg="rgba(245,197,66,0.12)" iconColor="#f5c542"
        label="Change Password"
        onClick={(e) => { ripple(e as any); setModal('password') }}
      />
      <Row icon={<Smartphone size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="#9b6dff"
        label="Active sessions" value="1 device"
        onClick={(e) => ripple(e as any)}
      />

      <SectionTitle>Account info</SectionTitle>
      <Row icon={<Calendar size={15} />} iconBg="var(--surface2)" iconColor="var(--text-dim)"
        label="Date joined"
        value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
      />
      <Row icon={<Tag size={15} />} iconBg="var(--surface2)" iconColor="var(--text-dim)"
        label="App version" value="8.0"
      />

      <SectionTitle>Danger zone</SectionTitle>
      <Row icon={<LogOut size={15} />}     iconBg="rgba(255,107,0,0.12)"   iconColor="var(--accent)" label="Log out"       onClick={(e) => { ripple(e as any); setModal('logout') }} />
      <Row icon={<Trash2 size={15} />}     iconBg="rgba(255,107,107,0.12)" label="Delete account"  danger onClick={(e) => { ripple(e as any); setModal('delete') }} />

      {/* ── Modals ── */}
      {modal === 'logout' && (
        <Modal title="Log out?" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>You'll need to sign back in to access your account.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button onClick={onLogout} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Log out</button>
          </div>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="Delete account?" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, padding: '12px 14px', background: 'rgba(255,107,107,0.08)', borderRadius: 12, border: '1px solid rgba(255,107,107,0.2)' }}>
            <AlertTriangle size={16} style={{ color: '#ff6b6b', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#ff6b6b', lineHeight: 1.6 }}>This is permanent. All your data, XP, streaks and game history will be deleted and cannot be recovered.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Delete</button>
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
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </Modal>
      )}
    </SubPage>
  )
}

// ─── Preferences ─────────────────────────────────────
function PreferencesPage({ onBack, presence, setPresence, userId }: {
  onBack: () => void; presence: string; setPresence: (p: string) => void; userId: string
}) {
  const [saving, setSaving] = useState(false)

  async function handlePresence(id: string) {
    setPresence(id)
    setSaving(true)
    await supabase.from('profiles').update({ presence: id }).eq('id', userId)
    setSaving(false)
  }

  return (
    <SubPage title="Preferences" onBack={onBack}>
      <SectionTitle>Live feed status {saving && <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 6 }}>Saving…</span>}</SectionTitle>
      {PRESENCE_OPTIONS.map(p => (
        <div
          key={p.id}
          onClick={(e) => { ripple(e as any); handlePresence(p.id) }}
          className="ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: presence === p.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 8, cursor: 'pointer', boxShadow: presence === p.id ? '0 0 0 1px var(--accent)' : '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}
        >
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: p.color, boxShadow: `0 0 8px ${p.color}`, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
          </div>
          {presence === p.id && <Check size={16} color="var(--accent)" />}
        </div>
      ))}
    </SubPage>
  )
}

// ─── Notifications ────────────────────────────────────
function NotificationsPage({ onBack }: { onBack: () => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    game_invites: true, messages: true, achievements: true,
    friend_activity: false, promotions: false,
  })
  const [pushOn, setPushOn] = useState(true)

  return (
    <SubPage title="Notifications" onBack={onBack}>
      <SectionTitle>Push notifications</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,107,0,0.12)', color: 'var(--accent)' }}>
          {pushOn ? <BellRing size={15} /> : <BellOff size={15} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>All notifications</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{pushOn ? 'Notifications are on' : 'All notifications muted'}</div>
        </div>
        <Toggle on={pushOn} onToggle={() => setPushOn(p => !p)} />
      </div>

      <SectionTitle>Notify me about</SectionTitle>
      {NOTIF_OPTIONS.map(opt => (
        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)', opacity: pushOn ? 1 : 0.45, transition: 'opacity 0.2s' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', color: 'var(--text-dim)' }}>
            <opt.Icon size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{opt.desc}</div>
          </div>
          <Toggle on={enabled[opt.id] && pushOn} onToggle={() => {
            if (!pushOn) return
            setEnabled(prev => ({ ...prev, [opt.id]: !prev[opt.id] }))
          }} />
        </div>
      ))}
    </SubPage>
  )
}

// ─── Privacy ──────────────────────────────────────────
function PrivacyPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({
    who_can_message: 'Friends only',
    who_can_invite: 'Everyone',
    show_online: 'Everyone',
    show_activity: 'Friends only',
  })

  return (
    <SubPage title="Privacy" onBack={onBack}>
      <SectionTitle>Visibility & access</SectionTitle>
      {PRIVACY_OPTIONS.map(opt => (
        <div key={opt.id} style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, overflow: 'hidden', boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
          <div style={{ padding: '12px 16px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
          <div style={{ display: 'flex', padding: '0 12px 12px', gap: 7 }}>
            {opt.values.map(v => (
              <button
                key={v}
                onClick={() => setSettings(s => ({ ...s, [opt.id]: v }))}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: settings[opt.id] === v ? 'var(--accent)' : 'var(--bg)',
                  color: settings[opt.id] === v ? '#fff' : 'var(--text-dim)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{v}</button>
            ))}
          </div>
        </div>
      ))}

      <SectionTitle>Blocked users</SectionTitle>
      <Row icon={<EyeOff size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="#9b6dff"
        label="Manage blocked users" value="0 blocked"
        onClick={(e) => ripple(e as any)}
      />
    </SubPage>
  )
}

// ─── Security ─────────────────────────────────────────
function SecurityPage({ onBack }: { onBack: () => void }) {
  const [twoFa, setTwoFa] = useState(false)
  const [loginAlerts, setLoginAlerts] = useState(true)

  return (
    <SubPage title="Security" onBack={onBack}>
      <SectionTitle>Login</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,197,66,0.12)', color: '#f5c542' }}>
          <Shield size={15} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Two-factor authentication</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{twoFa ? 'Enabled — extra secure' : 'Off — recommended to enable'}</div>
        </div>
        <Toggle on={twoFa} onToggle={() => setTwoFa(p => !p)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 9, boxShadow: '3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79,142,247,0.12)', color: '#4f8ef7' }}>
          <Bell size={15} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Login alerts</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>Email me when a new device logs in</div>
        </div>
        <Toggle on={loginAlerts} onToggle={() => setLoginAlerts(p => !p)} />
      </div>

      <SectionTitle>Sessions</SectionTitle>
      <Row icon={<Smartphone size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="#3ecf8e"
        label="Active sessions" value="1 device"
        onClick={(e) => ripple(e as any)}
      />
      <Row icon={<Lock size={15} />} iconBg="rgba(255,107,107,0.12)" iconColor="#ff6b6b"
        label="Log out all devices" danger
        onClick={(e) => ripple(e as any)}
      />
    </SubPage>
  )
}

// ══════════════════════════════════════════════════════
// CATEGORIES CONFIG
// ══════════════════════════════════════════════════════
const CATEGORIES = [
  { id: 'account',       label: 'Account',       sub: 'Profile, email, password',    Icon: User,    iconBg: 'rgba(79,142,247,0.15)',  iconColor: '#4f8ef7' },
  { id: 'notifications', label: 'Notifications', sub: 'Push alerts & preferences',   Icon: Bell,    iconBg: 'rgba(255,107,0,0.15)',   iconColor: 'var(--accent)' },
  { id: 'privacy',       label: 'Privacy',       sub: 'Who can see & contact you',   Icon: Eye,     iconBg: 'rgba(155,109,255,0.15)', iconColor: '#9b6dff' },
  { id: 'security',      label: 'Security',      sub: '2FA, login alerts, sessions', Icon: Shield,  iconBg: 'rgba(245,197,66,0.15)',  iconColor: '#f5c542' },
  { id: 'preferences',   label: 'Preferences',   sub: 'Online status, live feed',    Icon: Globe,   iconBg: 'rgba(62,207,142,0.15)',  iconColor: '#3ecf8e' },
]

// ══════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ══════════════════════════════════════════════════════
export default function Settings() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { session } = useAuth()
  const [openSub, setOpenSub]   = useState<string | null>(null)
  const [presence, setPresence] = useState('online')

  const userEmail = session?.user?.email ?? ''
  const displayName = profile?.display_name || profile?.username || 'You'

  // Load persisted presence on mount
  useEffect(() => {
    if (profile && (profile as any).presence) {
      setPresence((profile as any).presence)
    }
  }, [profile])

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const presenceDot = PRESENCE_OPTIONS.find(p => p.id === presence)

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Back button */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
            <ArrowLeft size={15} />
          </button>
        </div>

        {/* ── Profile header card ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '20px 18px', marginBottom: 24, boxShadow: '4px 4px 12px var(--neu-dark),-2px -2px 8px var(--neu-light)', animation: 'feedIn 0.3s ease-out both', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 58, height: 58, borderRadius: 17, background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', boxShadow: '0 4px 16px rgba(155,109,255,0.3)' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            {/* Presence dot */}
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

          <button
            onClick={() => setOpenSub('account')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexShrink: 0 }}
          >
            <Edit2 size={14} />
          </button>
        </div>

        {/* ── Category list ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>Settings</div>
        {CATEGORIES.map((cat, i) => (
          <div
            key={cat.id}
            onClick={(e) => { ripple(e as any); setOpenSub(cat.id) }}
            className="ripple-wrap"
            style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 18, padding: 16, marginBottom: 11, cursor: 'pointer', boxShadow: '4px 4px 10px var(--neu-dark),-2px -2px 8px var(--neu-light)', animation: 'feedIn 0.35s ease-out both', animationDelay: `${i * 0.05}s` }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: cat.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.iconColor, boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}>
              <cat.Icon size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{cat.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{cat.sub}</div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        ))}
      </div>

      {/* ── Sub pages ── */}
      {openSub === 'account'       && <AccountPage       onBack={() => setOpenSub(null)} profile={profile} userEmail={userEmail} onLogout={handleLogout} />}
      {openSub === 'preferences'   && <PreferencesPage   onBack={() => setOpenSub(null)} presence={presence} setPresence={setPresence} userId={profile?.id ?? ''} />}
      {openSub === 'notifications' && <NotificationsPage onBack={() => setOpenSub(null)} />}
      {openSub === 'privacy'       && <PrivacyPage       onBack={() => setOpenSub(null)} />}
      {openSub === 'security'      && <SecurityPage      onBack={() => setOpenSub(null)} />}
    </>
  )
}
