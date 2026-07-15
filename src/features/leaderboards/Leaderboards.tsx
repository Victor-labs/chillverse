import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Crown, Gamepad2, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { GAMES, type GameMeta } from '../games/games'
import { ripple } from '../../shared/lib/ripple'
import Avatar from '../../shared/components/Avatar'
import { fetchGlobalLeaderboard, fetchPersonalGameStats, type LeaderboardEntry, type PersonalGameStats } from './leaderboardData'

const EMPTY_STATS: PersonalGameStats = {
  sessionsPlayed: 0,
  bestScore: 0,
  recentRank: 'unranked',
  currentStreak: 0,
  xpEarned: 0,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="neu-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 10, color: 'var(--text)', fontSize: 22, fontWeight: 850 }}>{value}</div>
    </div>
  )
}

export default function Leaderboards() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [selectedId, setSelectedId] = useState<GameMeta['id']>(GAMES[0].id)
  const [stats, setStats] = useState<PersonalGameStats>(EMPTY_STATS)
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedGame = useMemo(() => GAMES.find(game => game.id === selectedId) ?? GAMES[0], [selectedId])
  const GameIcon = selectedGame.icon

  useEffect(() => {
    let active = true
    async function load() {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const [personalStats, globalRows] = await Promise.all([
          fetchPersonalGameStats(userId, selectedGame.dbKey),
          fetchGlobalLeaderboard(selectedGame.dbKey),
        ])
        if (!active) return
        setStats(personalStats)
        setLeaders(globalRows)
      } catch (err) {
        if (!active) return
        console.error('leaderboards load error:', err)
        setStats(EMPTY_STATS)
        setLeaders([])
        setError('Leaderboard data could not be loaded right now.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [selectedGame.dbKey, userId])

  return (
    <div className="flex flex-col max-w-[980px] mx-auto" style={{ gap: 18 }}>
      <section className="neu-card" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 'auto -50px -70px auto', width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${selectedGame.accent}33 0%, transparent 68%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: selectedGame.accent, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={13} /> Read-only rankings
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 900, margin: '8px 0 6px' }}>Leaderboards</h1>
            <p style={{ color: 'var(--text-dim)', maxWidth: 620, fontSize: 13, lineHeight: 1.6 }}>
              Pick a game to review your personal performance and compare top scores pulled from completed game sessions. Rankings are read-only and respect existing Supabase RLS on session and rank tables.
            </p>
          </div>
          <Link to="/games" onClick={(e) => ripple(e)} className="neu-card ripple-wrap" style={{ padding: '12px 14px', display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text)', textDecoration: 'none' }}>
            <Gamepad2 size={18} style={{ color: selectedGame.accent }} /> Play games <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <section className="neu-card" style={{ padding: 16 }}>
        <label htmlFor="leaderboard-game" style={{ display: 'block', color: 'var(--text-dim)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Select game</label>
        <select
          id="leaderboard-game"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value as GameMeta['id'])}
          style={{ width: '100%', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', outline: 'none' }}
        >
          {GAMES.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
        </select>
      </section>

      <section className="neu-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: selectedGame.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GameIcon size={22} /></div>
          <div>
            <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 850, margin: 0 }}>Your {selectedGame.name} stats</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{selectedGame.tagline}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Sessions" value={stats.sessionsPlayed} icon={<BarChart3 size={14} />} />
          <StatCard label="Best score" value={stats.bestScore.toLocaleString()} icon={<Crown size={14} />} />
          <StatCard label="Recent rank" value={stats.recentRank} icon={<ShieldCheck size={14} />} />
          <StatCard label="Streak" value={stats.currentStreak} icon={<Sparkles size={14} />} />
          <StatCard label="XP earned" value={stats.xpEarned.toLocaleString()} icon={<Zap size={14} />} />
        </div>
      </section>

      <section className="neu-card" style={{ padding: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 850, margin: 0 }}>Global {selectedGame.name} leaderboard</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sorted by best score, then XP and sessions played.</p>
          </div>
          {loading && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Loading…</span>}
        </div>

        {error && <div style={{ color: '#ff9a3c', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>#</th>
                <th style={{ padding: '10px 8px' }}>Player</th>
                <th style={{ padding: '10px 8px' }}>Best</th>
                <th style={{ padding: '10px 8px' }}>XP</th>
                <th style={{ padding: '10px 8px' }}>Sessions</th>
                <th style={{ padding: '10px 8px' }}>Rank</th>
                <th style={{ padding: '10px 8px' }}>Streak</th>
                <th style={{ padding: '10px 8px' }}>Last played</th>
              </tr>
            </thead>
            <tbody>
              {!loading && leaders.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center' }}>No completed sessions yet for this game.</td></tr>
              )}
              {leaders.map((entry, index) => (
                <tr key={entry.userId} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: entry.userId === userId ? 'var(--text)' : 'var(--text-dim)', background: entry.userId === userId ? `${selectedGame.accent}14` : 'transparent' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 800, color: index < 3 ? selectedGame.accent : 'inherit' }}>{index + 1}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={entry.avatar ?? undefined} name={entry.name} size={32} radius={10} disabled />
                      <span style={{ fontWeight: 750 }}>{entry.name}{entry.userId === userId ? ' (you)' : ''}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 750 }}>{entry.bestScore.toLocaleString()}</td>
                  <td style={{ padding: '12px 8px' }}>{entry.xpEarned.toLocaleString()}</td>
                  <td style={{ padding: '12px 8px' }}>{entry.sessionsPlayed}</td>
                  <td style={{ padding: '12px 8px' }}>{entry.rank}</td>
                  <td style={{ padding: '12px 8px' }}>{entry.currentStreak}</td>
                  <td style={{ padding: '12px 8px' }}>{formatDate(entry.lastPlayedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
