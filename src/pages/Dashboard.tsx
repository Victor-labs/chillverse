// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Gamepad2, ShoppingBag, Film, Swords, Brain,
  Bot, Flame, Zap, Clapperboard,
  Trophy, User, ChevronRight,
} from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { getXpProgress } from '../lib/level'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getGlobalSessionInfo } from '../lib/gameSession'

interface QuickAction {
  label: string
  sub: string
  to: string
  bg: string
  icon: LucideIcon
}

interface FeatureTile {
  label: string
  desc: string
  to: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
}

const FEATURE_TILES: FeatureTile[] = [
  { label: 'Studio',       desc: 'Create & publish content',    icon: Clapperboard, iconBg: 'rgba(255,77,139,0.12)',  iconColor: '#ff4d8b', to: '/coming-soon?feature=Studio'      },
  { label: 'Achievements', desc: 'Track goals & unlock badges', icon: Trophy,       iconBg: 'rgba(245,197,66,0.12)', iconColor: '#f5c542', to: '/coming-soon?feature=Achievements' },
  { label: 'Mall',         desc: 'Shop exclusive drops',        icon: ShoppingBag,  iconBg: 'rgba(255,107,0,0.12)',  iconColor: '#ff6b00', to: '/mall'         },
  { label: 'Profile',      desc: 'Your stats, rank & showcase', icon: User,         iconBg: 'rgba(62,207,142,0.12)', iconColor: '#3ecf8e', to: '/profile'                          },
  { label: 'Games',        desc: 'Quick-fire mini games',       icon: Gamepad2,     iconBg: 'rgba(79,142,247,0.12)', iconColor: '#4f8ef7', to: '/games'                            },
  { label: 'Trivia Night', desc: 'Weekly live trivia rooms',    icon: Brain,        iconBg: 'rgba(155,109,255,0.12)',iconColor: '#9b6dff', to: '/games'                            },
]

const MINI_AVATAR_COLORS = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface ChatRoom {
  id: string
  name: string | null
  type: string
  lastMsg: string
  lastMsgTime: string
  unread: number
  initials: string
  bg: string
}

export default function Dashboard() {
  const { profile, loading, error } = useProfile()
  const { session } = useAuth()
  const userId = session?.user?.id ?? ''

  // Live data states
  const [onlineCount, setOnlineCount]     = useState<number | null>(null)
  const [activeSessions, setActiveSessions] = useState<number>(0)
  const [chatRooms, setChatRooms]         = useState<ChatRoom[]>([])
  const [unreadTotal, setUnreadTotal]     = useState(0)
  const [sessionsToday, setSessionsToday] = useState(0)

  // ── Live: global online count (presence channel) ──────────────
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId || 'anon' } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Live: active game sessions count (today) ──────────────────
  useEffect(() => {
    async function loadTodaySessions() {
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0)
      const { count } = await supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('played_at', startOfDay.toISOString())
      setActiveSessions(count ?? 0)
    }
    loadTodaySessions()

    const sub = supabase
      .channel('game-sessions-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_sessions' }, () => {
        loadTodaySessions()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  // ── Live: user's sessions today (global limit) ────────────────
  useEffect(() => {
    if (!userId) return
    const info = getGlobalSessionInfo(userId)
    setSessionsToday(info.count)

    const iv = setInterval(() => {
      const i = getGlobalSessionInfo(userId)
      setSessionsToday(i.count)
    }, 5000)
    return () => clearInterval(iv)
  }, [userId])

  // ── Live: chat rooms preview ──────────────────────────────────
  useEffect(() => {
    if (!userId) return
    async function loadChatRooms() {
      const { data: memberships } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', userId)
        .limit(5)

      if (!memberships?.length) return

      const roomIds = memberships.map(m => m.room_id)
      const { data: rooms } = await supabase
        .from('chat_rooms')
        .select('id, name, type')
        .in('id', roomIds)
        .limit(3)

      if (!rooms?.length) return

      const roomsWithMeta: ChatRoom[] = await Promise.all(
        rooms.map(async (room, i) => {
          // Last message
          const { data: msgs } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)

          const lastMsg = msgs?.[0]
          const timeAgo = lastMsg?.created_at
            ? getTimeAgo(lastMsg.created_at)
            : ''

          // Unread (messages after last read — approximate as last 5 mins)
          const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString()
          const { count: unread } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .neq('sender_id', userId)
            .gte('created_at', fiveMinsAgo)

          const roomName = room.name || `Room ${i + 1}`
          const initials = roomName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

          return {
            id: room.id,
            name: roomName,
            type: room.type,
            lastMsg: lastMsg?.content?.slice(0, 50) ?? 'No messages yet',
            lastMsgTime: timeAgo,
            unread: unread ?? 0,
            initials,
            bg: MINI_AVATAR_COLORS[i % MINI_AVATAR_COLORS.length],
          }
        })
      )
      setChatRooms(roomsWithMeta)
      setUnreadTotal(roomsWithMeta.reduce((s, r) => s + r.unread, 0))
    }

    loadChatRooms()
    const iv = setInterval(loadChatRooms, 30000)
    return () => clearInterval(iv)
  }, [userId])

  if (loading) {
    return (
      <div className="neu-card p-10 flex items-center justify-center max-w-[800px] mx-auto mt-8">
        <span className="block w-9 h-9 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--surface3)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="neu-card p-8 text-center max-w-[800px] mx-auto mt-8" style={{ color: 'var(--text-dim)' }}>
        Couldn't load your profile. Try refreshing.
      </div>
    )
  }

  const displayName = profile.display_name || profile.username
  const { current, max } = getXpProgress(profile.xp)
  const xpPct = Math.min(100, Math.round((current / max) * 100))

  const QUICK_ACTIONS: QuickAction[] = [
    { label: 'Play Games', sub: onlineCount != null ? `${onlineCount} online` : '…',  to: '/games',                          bg: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', icon: Gamepad2   },
    { label: 'Mall',       sub: 'New drops',    to: '/mall',       bg: 'linear-gradient(135deg,#ff6b00,#ff9a3c)', icon: ShoppingBag },
    { label: 'Watch',      sub: 'Trending now', to: '/watch',      bg: 'linear-gradient(135deg,#ff4d8b,#ff6b6b)', icon: Film        },
  ]

  // Preview: use live rooms if loaded, else fall back to placeholder rows
  const chatPreview = chatRooms.length > 0 ? chatRooms : [
    { id: '1', name: 'Lobby',  initials: 'LB', lastMsg: 'GG! That last round was insane', lastMsgTime: '2m',  unread: 0, bg: '#ff6b6b', type: 'group' },
    { id: '2', name: 'Gaming', initials: 'GM', lastMsg: "You up for a run tonight?",       lastMsgTime: '9m',  unread: 0, bg: '#4f8ef7', type: 'group' },
    { id: '3', name: 'Studio', initials: 'ST', lastMsg: 'Check my new Studio drop!',       lastMsgTime: '1h',  unread: 0, bg: '#9b6dff', type: 'group' },
  ]

  return (
    <div className="flex flex-col max-w-[800px] mx-auto">

      {/* Welcome card */}
      <section className="su d1">
        <div
          className="neu-card ripple-wrap"
          style={{ padding: '22px 20px', position: 'relative', overflow: 'hidden' }}
          onClick={(e) => ripple(e as Parameters<typeof ripple>[0])}
        >
          <div style={{
            position: 'absolute', right: -30, top: -30,
            width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,107,0,0.10) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{getGreeting()}</p>
              <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 }}>
                {displayName}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {profile.streak}-day streak — keep it up!
              </p>
            </div>

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 54, height: 54, borderRadius: 16,
                background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                boxShadow: '0 4px 16px rgba(155,109,255,0.32)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 800, color: '#fff',
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={{
                position: 'absolute', bottom: -5, right: -8,
                background: 'var(--gold)', color: '#222',
                fontSize: 9, fontWeight: 800, padding: '2px 5px',
                borderRadius: 6, border: '2px solid var(--bg)',
              }}>
                LV {profile.level}
              </span>
              <div className="flex gap-2 mt-3">
                <span style={{ background: 'var(--surface2)', padding: '4px 8px', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Flame size={11} style={{ color: 'var(--accent)' }} />
                  <strong style={{ color: 'var(--text)' }}>{profile.streak}</strong>
                </span>
                <span style={{ background: 'var(--surface2)', padding: '4px 8px', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={11} style={{ color: 'var(--gold)' }} />
                  <strong style={{ color: 'var(--text)' }}>{profile.xp.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* XP Bar */}
      <section className="su d2" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          <span>Level {profile.level} · XP</span>
          <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </section>

      {/* Quick Actions */}
      <section className="su d3">
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.label}
                to={a.to}
                onClick={(e) => ripple(e)}
                className="neu-card ripple-wrap"
                style={{ padding: 18, textAlign: 'center', cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: a.bg,
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                  color: '#fff', margin: '0 auto 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{a.sub}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Multiplayer — live data */}
      <section className="su d4">
        <p className="section-label">Multiplayer</p>
        <Link
          to="/coming-soon?feature=Multiplayer"
          onClick={(e) => ripple(e)}
          className="neu-card ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18 }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            boxShadow: '0 4px 14px rgba(79,142,247,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Swords size={24} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Join a Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {activeSessions > 0
                ? `${activeSessions} sessions played today · ${onlineCount ?? '…'} players online`
                : `${onlineCount ?? '…'} players online`
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {MINI_AVATAR_COLORS.slice(0, 5).map((bg, i) => (
                <div key={i} style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: bg, color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--surface)',
                  marginLeft: i === 0 ? 0 : -6,
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {onlineCount != null && onlineCount > 5 && (
                <span style={{
                  marginLeft: 4, fontSize: 10, color: 'var(--text-dim)',
                  background: 'var(--surface2)', padding: '2px 6px', borderRadius: 6,
                }}>+{onlineCount - 5}</span>
              )}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: 'var(--blue)', flexShrink: 0 }} />
        </Link>
      </section>

      {/* Feature Tiles */}
      <section className="su d5">
        <p className="section-label">Explore Chillverse</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.label}
                to={tile.to}
                onClick={(e) => ripple(e)}
                className="neu-card ripple-wrap"
                style={{ padding: 20, cursor: 'pointer' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: tile.iconBg,
                  boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14, color: tile.iconColor,
                }}>
                  <Icon size={20} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{tile.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tile.desc}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Chat section — live */}
      <section className="su d6">
        <p className="section-label">Messages</p>
        <div className="neu-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Messages</span>
              {unreadTotal > 0 && (
                <span style={{
                  background: 'rgba(255,107,0,0.15)', color: 'var(--accent)',
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                }}>
                  {unreadTotal} new
                </span>
              )}
            </div>
            <Link to="/chat" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
              Open Chat
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {chatPreview.map((row) => (
              <Link
                key={row.id}
                to="/chat"
                onClick={(e) => ripple(e)}
                className="ripple-wrap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: row.bg, color: '#fff',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {row.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.lastMsg}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{row.lastMsgTime}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Today's game activity */}
      {sessionsToday > 0 && (
        <section className="su" style={{ animationDelay: '0.3s' }}>
          <p className="section-label">Today's Game Activity</p>
          <div className="neu-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Gamepad2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {sessionsToday}/10 sessions played today
              </p>
              <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (sessionsToday / 10) * 100)}%`, background: sessionsToday >= 10 ? '#9b6dff' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
            <Link to="/games" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Play</Link>
          </div>
        </section>
      )}

      {/* Halo AI */}
      <section className="su" style={{ animationDelay: '0.35s', paddingBottom: 8 }}>
        <p className="section-label">Halo AI</p>
        <Link
          to="/coming-soon?feature=Halo%20AI"
          onClick={(e) => ripple(e)}
          className="neu-card ripple-wrap"
          style={{
            display: 'block', padding: 20, cursor: 'pointer',
            border: '1px solid rgba(155,109,255,0.1)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', bottom: -20, right: -20,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(155,109,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Bot size={11} /> POWERED BY CVWT
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Halo AI Assistant</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
            Your personal game coach — strategy, tips, and analysis on demand.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'conic-gradient(#9b6dff, #4f8ef7, #3ecf8e, #9b6dff)',
              boxShadow: '0 0 20px rgba(155,109,255,0.4)',
              animation: 'spin 4s linear infinite',
            }} />
            <div style={{
              flex: 1, background: 'var(--bg)', borderRadius: 10,
              padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, color: 'var(--text-muted)', cursor: 'text',
            }}>
              Ask Halo anything…
            </div>
          </div>
        </Link>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
