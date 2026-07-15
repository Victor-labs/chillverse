// src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Gamepad2, ShoppingBag, Film, Swords, Sparkles, Rss,
  Flame, Zap, ChevronRight, Fan, Trophy,
} from 'lucide-react'
import { useProfile } from '../profile/useProfile'
import { getUserRankTier, getNextRankTier, getRankProgress } from '../profile/ranks'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getGlobalSessionInfo } from '../games/gameSession'
import { getSessionLimits } from '../../shared/lib/proPlans'
import Avatar from '../../shared/components/Avatar'
import PageOnboarding from '../onboarding/PageOnboarding'

interface QuickAction {
  label: string
  sub: string
  to: string
  bg: string
  icon: LucideIcon
}

const MINI_AVATAR_COLORS = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542']

// ─── Smart greeting ───────────────────────────────────────────
function getGreeting(name: string): { line: string; sub: string } {
  const h = new Date().getHours()
  const day = new Date().getDay() // 0=Sun,6=Sat

  // Time-aware pool
  const greetings = {
    lateNight: [   // 0-4
      { line: `Late night, ${name}..`,    sub: "Still up? Respect the grind." },
      { line: `Can't sleep, ${name}?`,    sub: "Neither can we. Let's go." },
      { line: `Night owl mode 🦉`,         sub: `What's good, ${name}?` },
    ],
    earlyMorning: [ // 5-8
      { line: `Early bird, ${name} 🐦`,   sub: "You're up before everyone." },
      { line: `Good morning, ${name}`,    sub: "Coffee first or games first?" },
      { line: `Rise & grind, ${name}`,    sub: "The leaderboard won't climb itself." },
    ],
    morning: [     // 9-11
      { line: `Morning, ${name} ☀️`,      sub: "What are we getting into today?" },
      { line: `Coffee time, ${name}?`,    sub: "Or are you already on it." },
      { line: `Back at it, ${name}`,      sub: "Let's make today count." },
    ],
    afternoon: [   // 12-16
      { line: `Hey ${name} 👋`,           sub: "Good to see you back." },
      { line: `Game time, ${name}?`,      sub: "Sessions are waiting." },
      { line: `Bored?¿ ${name}`,          sub: "Yeah we got you." },
    ],
    evening: [     // 17-20
      { line: `Evening, ${name}`,         sub: "Wind down or heat up?" },
      { line: `Hey ${name}, what's up`,   sub: "The crew's online." },
      { line: `Moonlight chat, ${name}?`, sub: "It's that time of day." },
    ],
    night: [       // 21-23
      { line: `Night mode, ${name} 🌙`,   sub: "Last sessions of the day." },
      { line: `Still here, ${name}?`,     sub: "One more game won't hurt." },
      { line: `Moonlight chat, ${name}?`, sub: "Quiet hours, real ones only." },
    ],
  }

  // Weekend bonus
  if ((day === 0 || day === 6) && h >= 10 && h < 14) {
    return { line: `Weekend energy, ${name}`, sub: "No alarm, no rules. Let's go." }
  }

  let pool
  if (h < 5)       pool = greetings.lateNight
  else if (h < 9)  pool = greetings.earlyMorning
  else if (h < 12) pool = greetings.morning
  else if (h < 17) pool = greetings.afternoon
  else if (h < 21) pool = greetings.evening
  else              pool = greetings.night

  // Pick deterministically by hour — only changes when the hour changes
  const idx = h % pool.length
  return pool[idx]
}

// ─── Streak message ───────────────────────────────────────────
function getStreakMessage(streak: number): { emoji: string; message: string; color: string } {
  if (streak === 0) {
    return { emoji: '👀', message: "No streak yet — today's a good day to start.", color: 'var(--text-muted)' }
  }
  if (streak === 1) {
    return { emoji: '🌱', message: "Day 1. The seed is planted.", color: '#3ecf8e' }
  }
  if (streak <= 3) {
    return { emoji: '🔥', message: `${streak}-day streak — you're just warming up.`, color: '#ff9a3c' }
  }
  if (streak <= 6) {
    return { emoji: '⚡', message: `${streak} days straight. The momentum is real.`, color: '#f5c542' }
  }
  if (streak <= 13) {
    return { emoji: '🚀', message: `${streak}-day streak. You're locked in.`, color: '#4f8ef7' }
  }
  if (streak <= 29) {
    return { emoji: '💎', message: `${streak} days. This is becoming a lifestyle.`, color: '#a8f0ff' }
  }
  if (streak <= 59) {
    return { emoji: '👑', message: `${streak}-day streak. Absolute legend behaviour.`, color: '#9b6dff' }
  }
  return { emoji: '🌌', message: `${streak} days. You ARE Chillverse.`, color: '#f5c542' }
}

export default function Dashboard() {
  const { profile, loading, error } = useProfile()
  const sessionLimit = getSessionLimits(profile).limit
  const { session } = useAuth()
  const userId = session?.user?.id ?? ''

  const [onlineCount, setOnlineCount]      = useState<number | null>(null)
  const [activeSessions, setActiveSessions] = useState<number>(0)
  const [sessionsToday, setSessionsToday]   = useState(0)

  // Live: global online count (presence)
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId || 'anon' } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Live: game sessions today
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_sessions' }, loadTodaySessions)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  // User's personal sessions today
  useEffect(() => {
    if (!userId) return
    const refresh = async () => { const info = await getGlobalSessionInfo(userId, sessionLimit); setSessionsToday(info?.count ?? 0) }
    refresh()
    const iv = setInterval(refresh, 5000)
    return () => clearInterval(iv)
  }, [userId, sessionLimit])

  // currentHour drives greeting — must be before any early returns
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const iv = setInterval(() => {
      const h = new Date().getHours()
      setCurrentHour(prev => prev !== h ? h : prev)
    }, 60_000)
    return () => clearInterval(iv)
  }, [])
  const greeting = useMemo(
    () => getGreeting(profile?.display_name || profile?.username || 'friend'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, currentHour],
  )

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

  const displayName = profile?.display_name || profile?.username || ''
  const _userXp   = profile?.xp ?? 0
  const _userTier = getUserRankTier(_userXp)
  const _nextTier = getNextRankTier(_userTier)
  const { pct: xpPct } = getRankProgress(_userXp)
  const streakInfo = getStreakMessage(profile?.streak ?? 0)

  const QUICK_ACTIONS: QuickAction[] = [
    { label: 'Play Games',  sub: onlineCount != null ? `${onlineCount} online` : '…', to: '/games',      bg: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', icon: Gamepad2 },
    { label: 'Mall',        sub: 'New drops',    to: '/mall',       bg: 'linear-gradient(135deg,#ff6b00,#ff9a3c)', icon: ShoppingBag },
    { label: 'Feed',        sub: 'See what\'s new', to: '/feed',    bg: 'linear-gradient(135deg,#00e5ff,#4f8ef7)', icon: Rss },
    { label: 'Leaderboards', sub: 'Stats & top scores', to: '/leaderboards', bg: 'linear-gradient(135deg,#f5c542,#ff9a3c)', icon: Trophy },
  ]

  return (
    <div className="flex flex-col max-w-[800px] mx-auto">
      <PageOnboarding pageKey="dashboard" />

      {/* ── Welcome card ── */}
      <section className="su d1">
        <div
          className="neu-card ripple-wrap"
          style={{ padding: '22px 20px', position: 'relative', overflow: 'hidden' }}
          onClick={(e) => ripple(e)}
        >
          <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,0,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div className="flex items-center justify-between gap-4">
            <div>
              {/* Smart greeting line */}
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 3 }}>{greeting.sub}</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 8 }}>
                {greeting.line}
              </h1>

              {/* Streak — conditional message */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', borderRadius: 10, padding: '5px 10px' }}>
                <span style={{ fontSize: 13 }}>{streakInfo.emoji}</span>
                <span style={{ fontSize: 11, color: streakInfo.color, fontWeight: 600, lineHeight: 1.4 }}>
                  {streakInfo.message}
                </span>
              </div>
            </div>

            {/* Avatar — NO level badge */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, boxShadow: '0 4px 16px rgba(155,109,255,0.32)' }}>
                <Avatar src={profile.avatar} name={displayName} size={54} radius={16} disabled style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }} />
              </div>
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

      {/* ── XP Bar ── */}
      <section className="su d2" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
          <span>Level {profile.level} · XP</span>
          <span>{_userXp.toLocaleString()} / {(_nextTier?.xpRequired ?? _userTier.xpRequired).toLocaleString()}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="su d3">
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Link key={a.label} to={a.to} onClick={(e) => ripple(e)} className="neu-card ripple-wrap" style={{ padding: 18, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: a.bg, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', color: '#fff', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{a.sub}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Multiplayer ── */}
      <section className="su d4">
        <p className="section-label">Multiplayer</p>
        <Link
          to="/multiplayer"
          onClick={(e) => ripple(e)}
          className="neu-card ripple-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18 }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: 'linear-gradient(135deg, var(--blue), var(--purple))', boxShadow: '0 4px 14px rgba(79,142,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Swords size={24} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Join a Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {activeSessions > 0
                ? `${activeSessions} sessions played today · ${onlineCount ?? '…'} players online`
                : `${onlineCount ?? '…'} players online`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {MINI_AVATAR_COLORS.slice(0, 5).map((bg, i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: 8, background: bg, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', marginLeft: i === 0 ? 0 : -6 }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {onlineCount != null && onlineCount > 5 && (
                <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 6 }}>+{onlineCount - 5}</span>
              )}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: 'var(--blue)', flexShrink: 0 }} />
        </Link>
      </section>

      {/* ── Explore Chillverse ── */}
      <section className="su d5">
        <p className="section-label">Explore Chillverse</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Watch',            desc: 'Trending videos & streams',    icon: Film,     iconBg: 'rgba(62,207,142,0.12)',  iconColor: '#3ecf8e', to: '/watch'           },
            { label: 'Leaderboards',     desc: 'Personal stats & top scores', icon: Trophy,   iconBg: 'rgba(245,197,66,0.12)',  iconColor: '#f5c542', to: '/leaderboards'    },
            { label: 'Weekly Missions',  desc: 'Complete missions, earn XP',    icon: Sparkles, iconBg: 'rgba(155,109,255,0.12)', iconColor: '#9b6dff', to: '/weekly-missions' },
            { label: 'Artifacts',        desc: 'Collect & explore relics',      icon: Fan,      iconBg: 'rgba(239,68,68,0.12)',   iconColor: '#ef4444', to: '/artifacts'       },
          ].map((tile) => {
            const Icon = tile.icon
            return (
              <Link key={tile.label} to={tile.to} onClick={(e) => ripple(e)} className="neu-card ripple-wrap" style={{ padding: 20, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: tile.iconBg, boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 6px var(--neu-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: tile.iconColor }}>
                  <Icon size={20} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{tile.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tile.desc}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Today's game activity ── */}
      {sessionsToday > 0 && (
        <section className="su" style={{ animationDelay: '0.3s' }}>
          <p className="section-label">Today's Activity</p>
          <div className="neu-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Gamepad2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sessionsToday}/{sessionLimit} sessions played today</p>
              <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (sessionsToday / sessionLimit) * 100)}%`, background: sessionsToday >= sessionLimit ? '#9b6dff' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
            <Link to="/games" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Play</Link>
          </div>
        </section>
      )}

      {/* ── Halo AI ── */}
      <section className="su" style={{ animationDelay: '0.35s', paddingBottom: 8 }}>
        <p className="section-label">Halo AI</p>
        <Link
          to="/halo"
          onClick={(e) => ripple(e)}
          className="neu-card ripple-wrap"
          style={{
            display: 'block', padding: 20, cursor: 'pointer',
            border: '1px solid rgba(155,109,255,0.18)',
            position: 'relative', overflow: 'hidden', textDecoration: 'none',
          }}
        >
          <div style={{
            position: 'absolute', bottom: -20, right: -20,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(155,109,255,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--purple)',
            letterSpacing: 1, textTransform: 'uppercase',
            marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Sparkles size={11} /> AI COACH
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            Ask Halo
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
            Your personal guide — XP tips, rank strategy, missions, and more.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'conic-gradient(#9b6dff, #4f8ef7, #3ecf8e, #9b6dff)',
              boxShadow: '0 0 20px rgba(155,109,255,0.4)',
              animation: 'spin 4s linear infinite',
            }} />
            <div style={{
              flex: 1, background: 'var(--bg)', borderRadius: 10,
              padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              "How do I rank up faster?"
            </div>
          </div>
        </Link>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
        }
