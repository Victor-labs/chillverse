// src/pages/multiplayer/MultiplayerHome.tsx
import { useNavigate } from 'react-router-dom'
import { Users, Search, Plus, Zap, Trophy, Gamepad2 } from 'lucide-react'
import { ripple } from '../../lib/ripple'
import { MULTIPLAYER_GAMES, playerCountLabel } from './multiplayerGameData'

export default function MultiplayerHome() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">

      {/* ── Hero ── */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl">🎮</span>
          <h1
            className="text-3xl font-extrabold"
            style={{
              background: 'linear-gradient(135deg, #6c50ff, #a78bfa, #00e5ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Multiplayer
          </h1>
        </div>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
          Play live against real opponents. XP and rank progress carry over to your profile — just like solo play.
        </p>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={e => { ripple(e); navigate('/multiplayer/create') }}
          className="ripple-wrap group relative overflow-hidden rounded-2xl p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(108,80,255,0.18), rgba(108,80,255,0.08))',
            border: '1px solid rgba(108,80,255,0.35)',
            cursor: 'pointer',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(108,80,255,0.2)' }}
          >
            <Plus size={20} style={{ color: '#a78bfa' }} />
          </div>
          <p className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>
            Create Room
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pick a game, set your rules, invite friends or let anyone join.
          </p>
        </button>

        <button
          type="button"
          onClick={e => { ripple(e); navigate('/multiplayer/browse') }}
          className="ripple-wrap group relative overflow-hidden rounded-2xl p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,255,0.12), rgba(0,229,255,0.05))',
            border: '1px solid rgba(0,229,255,0.25)',
            cursor: 'pointer',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(0,229,255,0.15)' }}
          >
            <Search size={20} style={{ color: '#00e5ff' }} />
          </div>
          <p className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>
            Browse Rooms
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Find open public rooms or join a private room with a code.
          </p>
        </button>
      </div>

      {/* ── Stat pills ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Zap size={14} />, label: 'XP Counts', color: '#f5c542' },
          { icon: <Trophy size={14} />, label: 'Rank Progress', color: '#9b6dff' },
          { icon: <Users size={14} />, label: '2–6 Players', color: '#3ecf8e' },
        ].map(({ icon, label, color }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
            style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span style={{ color }}>{icon}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Game catalog ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Gamepad2 size={16} style={{ color: '#a78bfa' }} />
          <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            Available Games
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {MULTIPLAYER_GAMES.map(game => (
            <button
              key={game.id}
              type="button"
              onClick={e => { ripple(e); navigate(`/multiplayer/create?game=${game.id}`) }}
              className="ripple-wrap text-left rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(108,80,255,0.12)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(108,80,255,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(108,80,255,0.12)'
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{game.emoji}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {game.name}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {playerCountLabel(game)}
                    {game.teamCapability === 'optional-2v2' && (
                      <span
                        className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: 'rgba(155,109,255,0.2)', color: '#9b6dff' }}
                      >
                        2v2
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {game.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
