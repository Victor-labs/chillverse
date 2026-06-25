// src/pages/multiplayer/CreateRoom.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, ChevronLeft, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import {
  MULTIPLAYER_GAMES,
  MULTIPLAYER_GAME_MAP,
  playerCountLabel,
  type MultiplayerGameId,
} from './multiplayerGameData'

// bcryptjs — lightweight, no native deps, works in Vite
// Install: npm i bcryptjs @types/bcryptjs
// If not installed yet, we hash via a simple SHA-256 shim fallback
async function hashPassword(plain: string): Promise<string> {
  // Use SubtleCrypto (browser native, no deps needed)
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function CreateRoom() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { profile } = useProfile()

  const preselectedId = searchParams.get('game') as MultiplayerGameId | null

  const [selectedGameId, setSelectedGameId] = useState<MultiplayerGameId | null>(
    preselectedId ?? null
  )
  const [roomName, setRoomName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-populate room name when profile loads
  useEffect(() => {
    if (profile && !roomName) {
      const name = profile.display_name || profile.username || 'Player'
      setRoomName(`${name}'s Room`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const selectedGame = selectedGameId ? MULTIPLAYER_GAME_MAP[selectedGameId] : null

  async function handleCreate() {
    if (!selectedGame || !session?.user) return
    setError(null)
    setCreating(true)

    try {
      const finalName = roomName.trim() || `${profile?.display_name ?? 'Player'}'s Room`
      let passwordHash: string | null = null

      if (isPrivate && password.trim()) {
        passwordHash = await hashPassword(password.trim())
      }

      // Insert room
      const { data: room, error: roomErr } = await supabase
        .from('game_rooms')
        .insert({
          game_id: selectedGame.id,
          room_name: finalName,
          host_id: session.user.id,
          is_private: isPrivate,
          password_hash: passwordHash,
          status: 'waiting',
          max_player_count: selectedGame.maxPlayers,
          min_player_count: selectedGame.minPlayers,
          current_player_count: 1,
        })
        .select('id')
        .single()

      if (roomErr || !room) throw new Error(roomErr?.message ?? 'Failed to create room')

      // Insert creator as host player
      const { error: playerErr } = await supabase.from('room_players').insert({
        room_id: room.id,
        player_id: session.user.id,
        is_host: true,
        team: null,
      })

      if (playerErr) throw new Error(playerErr.message)

      navigate(`/multiplayer/room/${room.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/multiplayer')}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>
          Create a Room
        </h1>
      </div>

      {/* ── Step 1: Game selector ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Choose a game
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {MULTIPLAYER_GAMES.map(game => {
            const active = selectedGameId === game.id
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedGameId(game.id)}
                className="relative rounded-2xl p-3 text-left transition-all duration-150"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, rgba(108,80,255,0.25), rgba(108,80,255,0.12))'
                    : 'var(--surface)',
                  border: active
                    ? '1.5px solid rgba(108,80,255,0.6)'
                    : '1.5px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                {active && (
                  <span
                    className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#6c50ff' }}
                  >
                    <Check size={10} color="#fff" strokeWidth={3} />
                  </span>
                )}
                <div className="text-xl mb-1.5">{game.emoji}</div>
                <p className="font-bold text-xs leading-tight" style={{ color: 'var(--text)' }}>
                  {game.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {playerCountLabel(game)}
                </p>
              </button>
            )
          })}
        </div>

        {/* Team mode note for 2v2-capable games */}
        {selectedGame?.teamCapability === 'optional-2v2' && (
          <p
            className="text-xs rounded-xl px-3 py-2"
            style={{ background: 'rgba(155,109,255,0.1)', color: '#a78bfa', border: '1px solid rgba(155,109,255,0.2)' }}
          >
            Players choose their team (A or B) when joining. With 3 players the match is always FFA.
          </p>
        )}
      </section>

      {/* ── Step 2: Room name ── */}
      <section className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Room name
        </label>
        <input
          type="text"
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Jordan's Room"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(108,80,255,0.2)',
            color: 'var(--text)',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(108,80,255,0.55)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(108,80,255,0.2)' }}
        />
      </section>

      {/* ── Step 3: Privacy ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Privacy
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: false, label: 'Public', sub: 'Anyone can find & join', emoji: '🌐' },
            { value: true,  label: 'Private', sub: 'Join via code only', emoji: '🔒' },
          ].map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setIsPrivate(opt.value)}
              className="rounded-2xl p-4 text-left transition-all duration-150"
              style={{
                background: isPrivate === opt.value
                  ? 'linear-gradient(135deg, rgba(108,80,255,0.2), rgba(108,80,255,0.08))'
                  : 'var(--surface)',
                border: isPrivate === opt.value
                  ? '1.5px solid rgba(108,80,255,0.55)'
                  : '1.5px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <div className="text-xl mb-1">{opt.emoji}</div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{opt.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.sub}</p>
            </button>
          ))}
        </div>

        {/* Password input — shown when private */}
        {isPrivate && (
          <div className="relative">
            <Lock
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Set a room password"
              className="w-full rounded-xl pl-9 pr-10 py-3 text-sm outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(108,80,255,0.2)',
                color: 'var(--text)',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(108,80,255,0.55)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(108,80,255,0.2)' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        )}
      </section>

      {/* ── Error ── */}
      {error && (
        <p
          className="text-sm rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,79,79,0.1)', color: '#ff4f4f', border: '1px solid rgba(255,79,79,0.2)' }}
        >
          {error}
        </p>
      )}

      {/* ── Submit ── */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!selectedGame || creating}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity"
        style={{
          background: selectedGame
            ? 'linear-gradient(135deg, #6c50ff, #a78bfa)'
            : 'var(--surface2)',
          color: selectedGame ? '#fff' : 'var(--text-muted)',
          border: 'none',
          cursor: selectedGame && !creating ? 'pointer' : 'not-allowed',
          opacity: creating ? 0.7 : 1,
        }}
      >
        {creating ? 'Creating…' : 'Create Room'}
      </button>
    </div>
  )
}
