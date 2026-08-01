// src/features/games/GamesZone.tsx
// New entry point for the /games route. Previously /games rendered the
// full game list (Games.tsx) directly; now it lands here first — a
// banner + two section cards — and Games.tsx opens nested underneath
// with its own back arrow. Deep links that carry location.state.openGame
// (game tags in posts, "Vs AI" from Multiplayer, etc.) skip straight past
// this landing screen into the game list, since that's an explicit
// "launch this game" intent rather than browsing.
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Gamepad2, Target, ChevronRight } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { fetchGamesZoneBanner } from './gameGoals'
import Games from './Games'
import ActivityGoals from './ActivityGoals'

type ZoneView = 'landing' | 'games' | 'activity'

export default function GamesZone() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasDeepLink = !!(location.state as { openGame?: string } | null)?.openGame

  const [view, setView] = useState<ZoneView>(hasDeepLink ? 'games' : 'landing')
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    fetchGamesZoneBanner().then(({ data }) => setBanner(data))
  }, [])

  if (view === 'games') return <Games onBack={() => setView('landing')} />
  if (view === 'activity') return <ActivityGoals onBack={() => setView('landing')} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
        {/* Banner */}
        <div className="neu-card" style={{ padding: 0, marginBottom: 18, overflow: 'hidden', position: 'relative', aspectRatio: '16/7', minHeight: 140 }}>
          {banner ? (
            <img src={banner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05) 65%)', display: 'flex', alignItems: 'flex-end', padding: 16 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Games Zone</h1>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', margin: '2px 0 0' }}>Play games, chase goals, earn rewards</p>
            </div>
          </div>
        </div>

        {/* Game Zone */}
        <div
          className="neu-card ripple-wrap"
          onClick={(e) => { ripple(e); setView('games') }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, cursor: 'pointer', marginBottom: 12 }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#4f8ef7,#3ecf8e)', boxShadow: '0 4px 14px rgba(79,142,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gamepad2 size={20} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Game Zone</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>Play all your favorite games</p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>

        {/* Activity Goals */}
        <div
          className="neu-card ripple-wrap"
          onClick={(e) => { ripple(e); setView('activity') }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, cursor: 'pointer' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#f5c542,var(--accent2))', boxShadow: '0 4px 14px rgba(245,197,66,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Target size={20} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Activity Goals</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>Play games, earn XP and rewards</p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}
