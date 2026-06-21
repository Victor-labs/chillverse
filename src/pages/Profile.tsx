// src/pages/Profile.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Settings, MoreHorizontal, Camera,
  Edit3, Users, UserPlus, Swords, X, Zap, Flame,
  Sprout, Shield, Moon, Crown, Sword,
  Gamepad2, Clapperboard, Trophy, ChevronRight,
} from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import type { MockUser, FeedItem, GameDetail, StudioDetail, AchievementDetail } from '../types'
import { ripple } from '../lib/ripple'

// ─── Rank system ───────────────────────────────────────────
const RANKS = [
  { min: 0,      max: 999,      title: 'Newcomer', color: '#888899' },
  { min: 1000,   max: 4999,     title: 'Scout',    color: '#3ecf8e' },
  { min: 5000,   max: 9999,     title: 'Warrior',  color: '#4f8ef7' },
  { min: 10000,  max: 24999,    title: 'Elite',    color: '#9b6dff' },
  { min: 25000,  max: 49999,    title: 'Shadow',   color: '#ff4d8b' },
  { min: 50000,  max: 99999,    title: 'Legend',   color: '#f5c542' },
  { min: 100000, max: Infinity, title: 'Mythic',   color: '#ff6b00' },
]

function getRank(xp: number) {
  return RANKS.find(r => xp >= r.min && xp <= r.max) ?? RANKS[0]
}

const RANK_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Newcomer: Sprout,
  Scout:    Zap,
  Warrior:  Sword,
  Elite:    Shield,
  Shadow:   Moon,
  Legend:   Crown,
  Mythic:   Flame,
}

// ─── Mock other users ───────────────────────────────────────
const OTHER_USERS: MockUser[] = [
  {
    id: 2, username: 'maya_k', displayName: 'Maya K.', bio: 'Studio queen 🎬 Content creator & gamer.',
    xp: 18400, level: 18, streak: 22, followers: 3201, following: 412, friends: 148,
    color: '#4f8ef7', joinDate: 'Feb 2024',
  },
  {
    id: 3, username: 'zion_t', displayName: 'Zion T.', bio: 'Competitive gamer. Top 0.1% ranked.',
    xp: 67800, level: 67, streak: 45, followers: 8920, following: 203, friends: 311,
    color: '#9b6dff', joinDate: 'Jan 2024',
  },
  {
    id: 4, username: 'jamie_l', displayName: 'Jamie L.', bio: 'Just here to vibe and win 🏆',
    xp: 4200, level: 4, streak: 7, followers: 532, following: 178, friends: 64,
    color: '#3ecf8e', joinDate: 'Apr 2024',
  },
]

// ─── Mock feed ──────────────────────────────────────────────
function genFeed(): FeedItem[] {
  return [
    { id: 1, type: 'game',        time: '2h ago',  title: 'Battle Royale Win',       sub: 'Top 1 of 64 players · Neon City map', detail: { score: '#1 / 64', duration: '18 min', xpEarned: 320, players: ['AR', 'MK', 'ZT'], map: 'Neon City' } as GameDetail },
    { id: 2, type: 'achievement', time: '5h ago',  title: 'Streak Master',            sub: 'Achieved 14-day login streak',         detail: { name: 'Streak Master', desc: 'Logged in 14 days in a row', xpEarned: 500, rarity: 'Rare' } as AchievementDetail },
    { id: 3, type: 'studio',      time: '1d ago',  title: 'Posted "Neon City Clips"', sub: '142 likes · 38 comments',              detail: { caption: 'Best clips from last night\'s session 🔥', likes: 142, comments: 38, shares: 17 } as StudioDetail },
    { id: 4, type: 'game',        time: '1d ago',  title: 'Arcade Rush — Score 9,240',sub: 'Personal best · Beat 3 friends',       detail: { score: '9,240 pts', duration: '6 min', xpEarned: 180, players: ['AR'], map: 'Arcade' } as GameDetail },
    { id: 5, type: 'achievement', time: '2d ago',  title: 'First Blood',              sub: 'First kill in Battle Royale',          detail: { name: 'First Blood', desc: 'Score the first elimination in a match', xpEarned: 200, rarity: 'Common' } as AchievementDetail },
    { id: 6, type: 'studio',      time: '3d ago',  title: 'Posted "Strategy 101"',    sub: '89 likes · 22 comments',               detail: { caption: 'How I climbed to Elite rank 🎯', likes: 89, comments: 22, shares: 9 } as StudioDetail },
    { id: 7, type: 'game',        time: '4d ago',  title: 'Trivia Night — 2nd Place', sub: '18/20 correct · 340 XP earned',       detail: { score: '2nd / 48', duration: '22 min', xpEarned: 340, players: ['MK', 'ZT', 'JL', 'BP'], map: 'Trivia Hall' } as GameDetail },
  ]
}

// ─── Mock followers / following ─────────────────────────────
interface SocialUser { id: number; displayName: string; username: string; color: string; following: boolean }

const FOLLOWERS_LIST: SocialUser[] = [
  { id: 10, displayName: 'Alex R.',   username: 'alex_r',   color: '#ff6b6b', following: true  },
  { id: 11, displayName: 'Maya K.',   username: 'maya_k',   color: '#4f8ef7', following: true  },
  { id: 12, displayName: 'Zion T.',   username: 'zion_t',   color: '#9b6dff', following: false },
  { id: 13, displayName: 'Jamie L.',  username: 'jamie_l',  color: '#3ecf8e', following: false },
  { id: 14, displayName: 'Brett P.',  username: 'brett_p',  color: '#f5c542', following: true  },
  { id: 15, displayName: 'Cleo M.',   username: 'cleo_m',   color: '#ff4d8b', following: false },
]
const FOLLOWING_LIST: SocialUser[] = [
  { id: 10, displayName: 'Alex R.',   username: 'alex_r',   color: '#ff6b6b', following: true  },
  { id: 11, displayName: 'Maya K.',   username: 'maya_k',   color: '#4f8ef7', following: true  },
  { id: 14, displayName: 'Brett P.',  username: 'brett_p',  color: '#f5c542', following: true  },
]

// ─── Icon button helper ─────────────────────────────────────
function IconBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-dim)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

// ─── Detail Popup ───────────────────────────────────────────
function DetailPopup({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const typeMap = {
    game:        { bg: 'rgba(79,142,247,0.15)',  color: '#4f8ef7', Icon: Gamepad2     },
    studio:      { bg: 'rgba(255,77,139,0.15)',  color: '#ff4d8b', Icon: Clapperboard },
    achievement: { bg: 'rgba(245,197,66,0.15)',  color: '#f5c542', Icon: Trophy       },
  }
  const { bg, color, Icon } = typeMap[item.type]
  const d = item.detail

  function rows(): { label: string; value: string }[] {
    if (item.type === 'game') {
      const g = d as GameDetail
      return [
        { label: 'Score',    value: g.score    },
        { label: 'Duration', value: g.duration },
        { label: 'Map',      value: g.map      },
        { label: 'Players',  value: g.players.join(', ') },
      ]
    }
    if (item.type === 'studio') {
      const s = d as StudioDetail
      return [
        { label: 'Likes',    value: String(s.likes)    },
        { label: 'Comments', value: String(s.comments) },
        { label: 'Shares',   value: String(s.shares)   },
      ]
    }
    const a = d as AchievementDetail
    return [
      { label: 'Achievement', value: a.name   },
      { label: 'Rarity',      value: a.rarity },
      { label: 'Description', value: a.desc   },
    ]
  }

  const xpEarned = 'xpEarned' in d ? (d as GameDetail | AchievementDetail).xpEarned : null

  return (
    <div
      className="overlay-backdrop"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 26, padding: 28,
          maxWidth: 360, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          position: 'relative',
          animation: 'popUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none',
            color: 'var(--text-dim)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={12} />
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            <Icon size={26} />
          </div>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--text)', marginBottom: 4 }}>{item.title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 20 }}>{item.time}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows().map(r => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface2)', borderRadius: 12, padding: '10px 14px', fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-dim)' }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {xpEarned != null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 14,
            background: 'linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,154,60,0.06))',
            border: '1px solid rgba(255,107,0,0.2)',
            borderRadius: 12, padding: 10,
            fontSize: 14, fontWeight: 800, color: 'var(--accent)',
          }}>
            <Zap size={15} /> +{xpEarned} XP
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Followers Sheet ────────────────────────────────────────
function FollowersSheet({ user, onClose }: { user: { displayName: string; followers: number; following: number }; onClose: () => void }) {
  const [tab, setTab] = useState<'followers' | 'following'>('followers')
  const [visible, setVisible] = useState(false)
  const [followStates, setFollowStates] = useState<Record<number, boolean>>(
    Object.fromEntries([...FOLLOWERS_LIST, ...FOLLOWING_LIST].map(u => [u.id, u.following]))
  )

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 320)
  }

  const list = tab === 'followers' ? FOLLOWERS_LIST : FOLLOWING_LIST

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 350 }} onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(22,22,28,0.96)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <IconBtn onClick={close}><X size={14} /></IconBtn>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{user.displayName}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
          {(['followers', 'following'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: 9, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-dim)',
                border: tab === t ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
              }}
            >
              {t === 'followers' ? `Followers · ${user.followers}` : `Following · ${user.following}`}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(70vh - 130px)', padding: '0 16px' }}>
          {list.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: u.color, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {u.displayName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{u.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{u.username}</div>
              </div>
              <button
                type="button"
                onClick={() => setFollowStates(s => ({ ...s, [u.id]: !s[u.id] }))}
                className={followStates[u.id] ? 'btn-secondary' : 'btn-primary'}
                style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}
              >
                {followStates[u.id] ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

// ─── Edit Sheet ─────────────────────────────────────────────
function EditSheet({ profile, onClose }: { profile: { display_name: string | null; username: string }; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [form, setForm] = useState({
    displayName: profile.display_name || '',
    username: profile.username,
    bio: '',
  })

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 320)
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={close} style={{ zIndex: 355 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 360 }}>
        <div style={{
          width: '100%', background: 'var(--surface2)',
          borderRadius: '28px 28px 0 0', padding: '28px 24px 36px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>Edit Profile</p>

          {[
            { key: 'displayName', label: 'Display Name', type: 'text' as const },
            { key: 'username',    label: 'Username',     type: 'text' as const },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{
                  width: '100%', background: 'var(--surface)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '11px 14px',
                  color: 'var(--text)', fontSize: 14, outline: 'none',
                  boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Bio</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              style={{
                width: '100%', background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '11px 14px',
                color: 'var(--text)', fontSize: 14, outline: 'none',
                boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
                resize: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(255,107,0,0.4)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={close}
            style={{ width: '100%', padding: 13, borderRadius: 14, fontSize: 14, fontWeight: 800, marginTop: 4 }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Profile component ─────────────────────────────────
export default function Profile() {
  const { profile: ownProfile, loading } = useProfile()
  const navigate = useNavigate()

  const [activeUserId, setActiveUserId] = useState<number | null>(null) // null = own
  const [xpBarWidth, setXpBarWidth] = useState(0)
  const [detailItem, setDetailItem] = useState<FeedItem | null>(null)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const feed = genFeed()

  // Current user data (own or mock)
  const currentUser = activeUserId == null
    ? (ownProfile ? {
        displayName: ownProfile.display_name || ownProfile.username,
        username:    ownProfile.username,
        bio:         'Welcome to my Chillverse profile!',
        xp:          ownProfile.xp,
        level:       ownProfile.level,
        streak:      ownProfile.streak,
        followers:   1284,
        following:   376,
        friends:     89,
        color:       '#9b6dff',
      } : null)
    : (() => {
        const u = OTHER_USERS.find(u => u.id === activeUserId)!
        return { ...u }
      })()

  const isOwn = activeUserId == null

  const rank = currentUser ? getRank(currentUser.xp) : RANKS[0]
  const RankIcon = RANK_ICONS[rank.title] ?? Zap

  // XP bar animation
  useEffect(() => {
    if (!currentUser) return
    setXpBarWidth(0)
    const t = setTimeout(() => {
      const pct = Math.min(100, Math.round(((currentUser.xp % 1000) / 1000) * 100))
      setXpBarWidth(pct)
    }, 120)
    return () => clearTimeout(t)
  }, [currentUser?.xp])

  if (loading && !activeUserId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span className="block w-9 h-9 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--surface3)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (!currentUser) return null

  const xpPct = Math.min(100, Math.round(((currentUser.xp % 1000) / 1000) * 100))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>

      {/* Inner topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <IconBtn onClick={() => navigate('/dashboard')}><ArrowLeft size={14} /></IconBtn>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {isOwn ? 'My Profile' : currentUser.displayName}
        </span>
        <IconBtn>{isOwn ? <Settings size={14} /> : <MoreHorizontal size={14} />}</IconBtn>
      </div>

      {/* Hero */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Avatar */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 28, padding: 3,
            background: `linear-gradient(135deg, ${rank.color}, #4f8ef7)`,
            boxShadow: `0 0 24px ${rank.color}44`,
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: 24,
              background: currentUser.color, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, color: '#fff',
            }}>
              {currentUser.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
          {isOwn && (
            <button type="button" style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 28, height: 28, borderRadius: 9,
              background: 'var(--accent)', border: '2px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <Camera size={13} color="#fff" />
            </button>
          )}
        </div>

        {/* Rank badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          background: rank.color + '18', color: rank.color,
          border: `1px solid ${rank.color}33`, fontSize: 11, fontWeight: 700,
          marginBottom: 10,
        }}>
          <RankIcon size={12} /> {rank.title}
        </div>

        <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 }}>
          {currentUser.displayName}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>@{currentUser.username}</p>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6, marginBottom: 16 }}>
          {currentUser.bio}
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', maxWidth: 360, width: '100%', marginBottom: 16 }}>
          {[
            { label: 'Followers', value: currentUser.followers.toLocaleString() },
            { label: 'Following', value: currentUser.following.toLocaleString() },
            { label: 'Friends',   value: currentUser.friends.toLocaleString()   },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', flex: 1 }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />}
              <button
                type="button"
                onClick={() => setShowFollowers(true)}
                style={{
                  flex: 1, textAlign: 'center', padding: '12px 8px',
                  cursor: 'pointer', borderRadius: 14,
                  background: 'transparent', border: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 2 }}>{s.label}</div>
              </button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 360, width: '100%', marginBottom: 16 }}>
          {isOwn ? (
            <>
              <button type="button" className="btn-primary" onClick={() => setShowEdit(true)} style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Edit3 size={13} /> Edit Profile
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Users size={13} /> Friends
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-primary" style={{ flex: 1, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <UserPlus size={13} /> Follow
              </button>
              <button type="button" className="btn-secondary" style={{ padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Users size={13} /> Add Friend
              </button>
              <button type="button" className="btn-secondary" style={{ padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Swords size={13} /> Challenge
              </button>
            </>
          )}
        </div>

        {/* XP bar */}
        <div style={{ maxWidth: 360, width: '100%', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
            <span>Level {currentUser.level} · {rank.title}</span>
            <span>{currentUser.xp.toLocaleString()} XP</span>
          </div>
          <div className="xp-track">
            <div className="xp-fill" style={{
              width: `${xpBarWidth}%`,
              background: `linear-gradient(90deg, ${rank.color}, #4f8ef7)`,
              boxShadow: `0 0 10px ${rank.color}66`,
            }} />
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          <span className="chip"><Flame size={11} style={{ color: 'var(--accent)' }} /> <strong>{currentUser.streak}</strong> day streak</span>
          <span className="chip"><Zap size={11} style={{ color: 'var(--gold)' }} /> <strong>{currentUser.xp.toLocaleString()}</strong> XP</span>
          <span className="chip"><RankIcon size={11} style={{ color: rank.color }} /> <strong>{rank.title}</strong></span>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ padding: 20 }}>
        <p className="section-label">Activity</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 32 }}>
          {feed.map((item, i) => {
            const typeMap = {
              game:        { bg: 'rgba(79,142,247,0.15)',  color: '#4f8ef7', Icon: Gamepad2     },
              studio:      { bg: 'rgba(255,77,139,0.15)',  color: '#ff4d8b', Icon: Clapperboard },
              achievement: { bg: 'rgba(245,197,66,0.15)',  color: '#f5c542', Icon: Trophy       },
            }
            const { bg, color, Icon } = typeMap[item.type]
            return (
              <div
                key={item.id}
                className="neu-card ripple-wrap"
                onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); setDetailItem(item) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13,
                  padding: '14px 16px', cursor: 'pointer',
                  transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: bg, color,
                  boxShadow: '2px 2px 8px var(--neu-dark), -1px -1px 5px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{item.time}</span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Demo switcher bar */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: '6px 8px', display: 'flex', gap: 8,
        boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}>
        {[{ id: null, label: 'My Profile' }, ...OTHER_USERS.map(u => ({ id: u.id, label: u.displayName.split(' ')[0] }))].map(opt => {
          const isActive = opt.id === activeUserId
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => setActiveUserId(opt.id as number | null)}
              style={{
                padding: '6px 12px', borderRadius: 13, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-dim)',
                border: isActive ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Modals */}
      {detailItem && <DetailPopup item={detailItem} onClose={() => setDetailItem(null)} />}
      {showFollowers && <FollowersSheet user={{ displayName: currentUser.displayName, followers: currentUser.followers, following: currentUser.following }} onClose={() => setShowFollowers(false)} />}
      {showEdit && ownProfile && <EditSheet profile={ownProfile} onClose={() => setShowEdit(false)} />}
    </div>
  )
}
