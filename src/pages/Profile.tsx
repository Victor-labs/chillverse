// src/pages/Profile.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideProps } from 'lucide-react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import {
  ArrowLeft, Settings, Edit3, Users, UserPlus,
  Zap, Flame, Sprout, Shield, Moon, Crown, Sword,
  Gamepad2, Clapperboard, Trophy, ChevronRight, X, Check,
} from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { getRecentSessions } from '../lib/gameSession'
import { ripple } from '../lib/ripple'

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>

// ─── Rank system ─────────────────────────────────────────────
const RANKS = [
  { min: 0,      max: 999,      title: 'Newcomer', color: '#888899' },
  { min: 1000,   max: 4999,     title: 'Scout',    color: '#3ecf8e' },
  { min: 5000,   max: 9999,     title: 'Warrior',  color: '#4f8ef7' },
  { min: 10000,  max: 24999,    title: 'Elite',    color: '#9b6dff' },
  { min: 25000,  max: 49999,    title: 'Shadow',   color: '#ff4d8b' },
  { min: 50000,  max: 99999,    title: 'Legend',   color: '#f5c542' },
  { min: 100000, max: Infinity, title: 'Mythic',   color: '#ff6b00' },
]
const RANK_ICONS: Record<string, LucideIcon> = {
  Newcomer: Sprout, Scout: Zap, Warrior: Sword,
  Elite: Shield, Shadow: Moon, Legend: Crown, Mythic: Flame,
}
function getRank(xp: number) { return RANKS.find(r => xp >= r.min && xp <= r.max) ?? RANKS[0] }

// ─── Activity types ───────────────────────────────────────────
const GAME_LABELS: Record<string, string> = {
  neon_blitz: 'Neon Blitz', grid_ghost: 'Grid Ghost', flux_sort: 'Flux Sort',
  trivia_clash: 'Trivia Clash', tac_zone: 'Tac Zone', flag_rush: 'Flag Rush',
}
function activityIcon(game: string): React.ComponentType<{ size?: number; style?: React.CSSProperties }> {
  if (game === 'studio') return Clapperboard
  if (['tac_zone', 'neon_blitz', 'grid_ghost', 'flux_sort', 'flag_rush'].includes(game)) return Gamepad2
  if (game === 'trivia_clash') return Trophy
  return Gamepad2
}

// ─── Edit Sheet ───────────────────────────────────────────────
function EditSheet({ profile, onClose, onSaved }: {
  profile: { display_name: string | null; username: string; id: string }
  onClose: () => void
  onSaved: (displayName: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [username, setUsername] = useState(profile.username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() { setVisible(false); setTimeout(onClose, 320) }

  async function save() {
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || username.trim(), username: username.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(displayName.trim() || username.trim())
    close()
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: '28px 28px 0 0', padding: '28px 24px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Edit Profile</p>
            <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          {[
            { key: 'displayName', label: 'Display Name', value: displayName, set: setDisplayName },
            { key: 'username',    label: 'Username',     value: username,     set: setUsername },
          ].map(({ key, label, value, set }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</label>
              <input type="text" value={value} onChange={e => set(e.target.value)}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxShadow: 'inset 2px 2px 6px var(--neu-dark)', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }} />
            </div>
          ))}
          {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
          <button type="button" onClick={save} disabled={saving} className="btn-primary"
            style={{ width: '100%', padding: 13, borderRadius: 14, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function Profile() {
  const { profile, loading } = useProfile()
  const navigate = useNavigate()
  const [xpBarWidth, setXpBarWidth] = useState(0)
  const [showEdit, setShowEdit] = useState(false)
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null)
  const [followers, setFollowers] = useState<number | null>(null)
  const [following, setFollowing] = useState<number | null>(null)
  const [activities, setActivities] = useState<Array<{ id: string; game: string; score: number; xp_earned: number; played_at: string }>>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  const displayName = displayNameOverride ?? profile?.display_name ?? profile?.username ?? ''

  // XP bar animate
  useEffect(() => {
    if (!profile) return
    setXpBarWidth(0)
    const t = setTimeout(() => {
      setXpBarWidth(Math.min(100, Math.round(((profile.xp % 1000) / 1000) * 100)))
    }, 120)
    return () => clearTimeout(t)
  }, [profile?.xp])

  // Load follow counts from DB
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('profile_follow_counts')
      .select('followers_count, following_count')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFollowers(Number(data.followers_count))
          setFollowing(Number(data.following_count))
        } else {
          setFollowers(0); setFollowing(0)
        }
      })
  }, [profile?.id])

  // Load real game session activity
  useEffect(() => {
    if (!profile?.id) return
    setActivitiesLoading(true)
    getRecentSessions(profile.id, 8).then(({ data }) => {
      setActivities(data as Array<{ id: string; game: string; score: number; xp_earned: number; played_at: string }>)
      setActivitiesLoading(false)
    })
  }, [profile?.id])

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const rank = getRank(profile.xp)
  const RankIcon = RANK_ICONS[rank.title] ?? Zap

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      {/* Inner topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>My Profile</span>
        <button type="button" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Settings size={14} />
        </button>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ width: 88, height: 88, borderRadius: 26, padding: 3, background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 24px ${rank.color}44` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 22, background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Rank badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: rank.color + '18', color: rank.color, border: `1px solid ${rank.color}33`, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
          <RankIcon size={12} /> {rank.title}
        </div>

        <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 }}>{displayName}</p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>@{profile.username}</p>

        {/* Stats row */}
        <div style={{ display: 'flex', maxWidth: 340, width: '100%', marginBottom: 16 }}>
          {[
            { label: 'Followers', value: followers === null ? '—' : followers.toLocaleString() },
            { label: 'Following', value: following === null ? '—' : following.toLocaleString() },
            { label: 'Level',     value: profile.level },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', flex: 1 }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />}
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 340, width: '100%', marginBottom: 16 }}>
          <button type="button" className="btn-primary" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); setShowEdit(true) }}
            style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Edit3 size={13} /> Edit Profile
          </button>
          <button type="button" className="btn-secondary"
            style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Users size={13} /> Friends
          </button>
          <button type="button" className="btn-secondary"
            style={{ padding: '10px 12px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <UserPlus size={13} />
          </button>
        </div>

        {/* XP bar */}
        <div style={{ maxWidth: 340, width: '100%', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
            <span>Level {profile.level} · {rank.title}</span>
            <span>{profile.xp.toLocaleString()} XP</span>
          </div>
          <div className="xp-track">
            <div className="xp-fill" style={{ width: `${xpBarWidth}%`, background: `linear-gradient(90deg, ${rank.color}, #4f8ef7)`, boxShadow: `0 0 10px ${rank.color}66` }} />
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          <span className="chip"><Flame size={11} style={{ color: 'var(--accent)' }} /> <strong>{profile.streak}</strong> day streak</span>
          <span className="chip"><Zap size={11} style={{ color: 'var(--gold)' }} /> <strong>{profile.xp.toLocaleString()}</strong> XP</span>
          {profile.country && <span className="chip">📍 <strong>{profile.country}</strong></span>}
          {profile.interests?.slice(0, 2).map(tag => (
            <span key={tag} className="chip">🎯 <strong>{tag}</strong></span>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ padding: '0 20px' }}>
        <p className="section-label">Activity</p>
        {activitiesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <span style={{ display: 'block', width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : activities.length === 0 ? (
          <div className="neu-card-sm" style={{ padding: '32px 20px', textAlign: 'center' }}>
            <Gamepad2 size={32} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No activity yet</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Play some games to see your activity here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 32 }}>
            {activities.map((item, i) => {
              const Icon = activityIcon(item.game)
              const typeColors: Record<string, string> = {
                neon_blitz: '#4f8ef7', grid_ghost: '#9b6dff', flux_sort: '#ff4d8b',
                trivia_clash: '#ff9a3c', tac_zone: '#3ecf8e', flag_rush: '#4f8ef7',
              }
              const color = typeColors[item.game] ?? '#888899'
              const timeAgo = (() => {
                const diff = Date.now() - new Date(item.played_at).getTime()
                const mins = Math.floor(diff / 60000)
                if (mins < 60) return `${mins}m ago`
                const hrs = Math.floor(mins / 60)
                if (hrs < 24) return `${hrs}h ago`
                return `${Math.floor(hrs / 24)}d ago`
              })()
              return (
                <div key={item.id} className="neu-card ripple-wrap"
                  onClick={(e) => ripple(e as Parameters<typeof ripple>[0])}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', cursor: 'pointer', animationDelay: `${i * 0.05}s` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: `${color}18`, boxShadow: '2px 2px 8px var(--neu-dark), -1px -1px 5px var(--neu-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      {GAME_LABELS[item.game] ?? item.game}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Score: {item.score} · +{item.xp_earned} XP
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showEdit && (
        <EditSheet
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={(name) => setDisplayNameOverride(name)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
