// src/features/settings/AccountSettings.tsx — Settings › Account
// Profile card, account information (username / display name / email /
// password edit flows), and account management (log out everywhere, delete).
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Mail, Key, Trash2, Lock, Calendar, AlertTriangle, X, Edit2, User } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../shared/lib/supabase'
import Avatar from '../../shared/components/Avatar'
import { SettingsShell, SectionTitle, Row } from './settingsShared'

// ─── Username validation ────────────────────────────────────────────────────
const RESERVED_WORDS = [
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'support',
  'chillverse', 'official', 'system', 'bot', 'null', 'undefined',
  'help', 'info', 'contact', 'abuse', 'root', 'superuser',
]
const BANNED_PATTERNS = [/nigger/i, /faggot/i, /retard/i, /spastic/i]

function validateUsername(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 3) return 'Username must be at least 3 characters.'
  if (trimmed.length > 20) return 'Username must be 20 characters or fewer.'
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return 'Only letters, numbers, underscores and hyphens allowed.'
  if (/^[_-]|[_-]$/.test(trimmed)) return 'Username can\'t start or end with _ or -.'
  if (RESERVED_WORDS.includes(trimmed.toLowerCase())) return 'That username is reserved.'
  if (BANNED_PATTERNS.some(p => p.test(trimmed))) return 'That username isn\'t allowed.'
  return null
}

function generateSuggestions(base: string): string[] {
  const clean = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user'
  const short = clean.slice(0, 14)
  return [0, 1, 2].map(() => `${short}${Math.floor(Math.random() * 900 + 100)}`)
}

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
function getDaysUntilUsernameChange(lastChangedAt: string | null | undefined): number | null {
  if (!lastChangedAt) return null
  const remaining = USERNAME_COOLDOWN_MS - (Date.now() - new Date(lastChangedAt).getTime())
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000))
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', animation: 'popIn 0.22s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
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
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="cv-input" style={{ width: '100%' }} />
    </div>
  )
}

export default function AccountSettings() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { session } = useAuth()
  const isPro = isProActive(profile)

  const [modal, setModal] = useState<'delete' | 'email' | 'username' | 'password' | 'displayName' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const userEmail = session?.user?.email ?? ''
  const displayName = profile?.display_name || profile?.username || 'You'

  useEffect(() => {
    if (profile?.username) setNewUsername(profile.username)
    if (profile?.display_name) setNewDisplayName(profile.display_name)
  }, [profile])

  async function handleSaveUsername() {
    const trimmed = newUsername.trim()
    if (!trimmed || !profile?.id) return
    const daysLeft = getDaysUntilUsernameChange(profile.username_changed_at)
    if (daysLeft !== null && daysLeft > 0) {
      setFeedback(`You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`)
      return
    }
    const validationError = validateUsername(trimmed)
    if (validationError) {
      setFeedback(validationError)
      setUsernameSuggestions(generateSuggestions(trimmed))
      return
    }
    setSaving(true)
    setUsernameSuggestions([])
    const { error } = await supabase.from('profiles')
      .update({ username: trimmed, username_changed_at: new Date().toISOString() })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      if (error.code === '23505') {
        setFeedback('That username is already taken.')
        setUsernameSuggestions(generateSuggestions(trimmed))
      } else setFeedback('Failed to update username.')
    } else {
      setFeedback('Username updated!')
      setTimeout(() => { setFeedback(''); setModal(null) }, 1500)
    }
  }

  async function handleSaveDisplayName() {
    const trimmed = newDisplayName.trim()
    if (!profile?.id) return
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ display_name: trimmed || profile.username })
      .eq('id', profile.id)
    setSaving(false)
    setFeedback(error ? 'Failed to update display name.' : 'Display name updated!')
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

  async function handleLogoutAllDevices() {
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) { setDeleteError('Failed to delete account. Please try again.'); setDeleting(false); return }
      await supabase.auth.signOut()
      navigate('/login')
    } catch {
      setDeleteError('Failed to delete account. Please try again.')
      setDeleting(false)
    }
  }

  const daysLeft = getDaysUntilUsernameChange(profile?.username_changed_at)
  const locked = daysLeft !== null && daysLeft > 0

  return (
    <SettingsShell title="Account">
      {/* Profile card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 18px', marginBottom: 8, boxShadow: 'var(--elev-raise)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar src={profile?.avatar} name={displayName} size={58} radius={17} disabled style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }} />
          {isPro && (
            <span style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
              color: 'var(--accent)', background: 'var(--nav)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
              borderRadius: 6, padding: '1.5px 6px', whiteSpace: 'nowrap',
            }}>
              {profile?.pro_tier === 'void' ? 'Void' : 'Orbit'}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        </div>
      </div>

      <SectionTitle>Account information</SectionTitle>
      <div className="settings-card">
        <Row icon={<Tag size={15} />} iconBg="rgba(79,142,247,0.12)" iconColor="var(--blue)"
          label="Username" value={profile?.username ?? '—'}
          onClick={(e) => { ripple(e); setModal('username') }}
          rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
        />
        <Row icon={<User size={15} />} iconBg="rgba(155,109,255,0.12)" iconColor="var(--purple)"
          label="Display name" value={profile?.display_name ?? '—'}
          onClick={(e) => { ripple(e); setModal('displayName') }}
          rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
        />
        <Row icon={<Mail size={15} />} iconBg="rgba(62,207,142,0.12)" iconColor="var(--green)"
          label="Email" value={userEmail ? userEmail.replace(/(.{2}).+(@.+)/, '$1…$2') : '—'}
          onClick={(e) => { ripple(e); setModal('email') }}
          rightEl={<Edit2 size={13} color="var(--text-muted)" style={{ marginRight: 4 }} />}
        />
        <Row icon={<Key size={15} />} iconBg="rgba(245,197,66,0.12)" iconColor="var(--gold)"
          label="Change Password"
          onClick={(e) => { ripple(e); setModal('password') }}
        />
      </div>
      {locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: -12, marginBottom: 20, padding: '7px 12px', background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.18)', borderRadius: 10 }}>
          <Calendar size={12} color="var(--gold)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
            Username can be changed again in <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
          </span>
        </div>
      )}

      <SectionTitle>Account management</SectionTitle>
      <div className="settings-card">
        <Row icon={<Lock size={15} />} iconBg="rgba(255,79,79,0.12)" danger
          label="Log out on all devices"
          onClick={(e) => { ripple(e); handleLogoutAllDevices() }}
        />
        <Row icon={<Trash2 size={15} />} iconBg="rgba(255,79,79,0.12)" danger
          label="Delete account"
          onClick={(e) => { ripple(e); setModal('delete') }}
        />
      </div>

      {modal === 'delete' && (
        <Modal title="Delete account?" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, padding: '12px 14px', background: 'rgba(255,79,79,0.08)', borderRadius: 12, border: '1px solid rgba(255,79,79,0.2)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>This is permanent. All your data, XP, streaks and game history will be deleted and cannot be recovered.</p>
          </div>
          {deleteError && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{deleteError}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModal(null)} disabled={deleting} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>Cancel</button>
            <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'username' && (
        <Modal title="Change Username" onClose={() => { setModal(null); setFeedback(''); setUsernameSuggestions([]) }}>
          {locked ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,197,66,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={22} color="var(--gold)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Username locked</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  You changed your username recently.<br />
                  You can change it again in <strong style={{ color: 'var(--gold)' }}>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>.
                </div>
              </div>
              <button onClick={() => { setModal(null); setFeedback(''); setUsernameSuggestions([]) }} className="btn-secondary" style={{ width: '100%', padding: '11px 0', fontSize: 13 }}>Got it</button>
            </div>
          ) : (
            <>
              <Input label="New username" value={newUsername} onChange={(v) => { setNewUsername(v); setUsernameSuggestions([]) }} placeholder="e.g. chillking99" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                3–20 chars · letters, numbers, _ and - only · can only change once every 30 days
              </div>
              {feedback && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: feedback.includes('!') ? 'var(--green)' : 'var(--red)', marginBottom: usernameSuggestions.length ? 8 : 0 }}>{feedback}</p>
                  {usernameSuggestions.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Try one of these instead:</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {usernameSuggestions.map(s => (
                          <button key={s} onClick={() => { setNewUsername(s); setUsernameSuggestions([]); setFeedback('') }}
                            style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(79,142,247,0.35)', background: 'rgba(79,142,247,0.1)', color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button onClick={handleSaveUsername} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 13 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </Modal>
      )}

      {modal === 'displayName' && (
        <Modal title="Change Display Name" onClose={() => { setModal(null); setFeedback('') }}>
          <Input label="Display name" value={newDisplayName} onChange={setNewDisplayName} placeholder="How your name appears" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('!') ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSaveDisplayName} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </Modal>
      )}

      {modal === 'email' && (
        <Modal title="Change Email" onClose={() => setModal(null)}>
          <Input label="New email address" type="email" value={newEmail} onChange={setNewEmail} placeholder="new@email.com" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('Confirmation') ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSaveEmail} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 13 }}>
            {saving ? 'Sending…' : 'Send confirmation'}
          </button>
        </Modal>
      )}

      {modal === 'password' && (
        <Modal title="Change Password" onClose={() => setModal(null)}>
          <Input label="New password" type="password" value={newPass} onChange={setNewPass} placeholder="Min 8 characters" />
          <Input label="Confirm password" type="password" value={confirmPass} onChange={setConfirmPass} placeholder="Repeat new password" />
          {feedback && <p style={{ fontSize: 12, color: feedback.includes('!') ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{feedback}</p>}
          <button onClick={handleSavePassword} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </Modal>
      )}
    </SettingsShell>
  )
}
