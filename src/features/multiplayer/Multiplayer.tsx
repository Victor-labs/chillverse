// src/pages/Multiplayer.tsx
// Entry point for multiplayer: pick a game, then create or join a room for it.
// Per-game multiplayer logic isn't wired up yet — this just gets players into
// a real, live room (see Room.tsx) tagged with the game they picked.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, X, Plus, Users } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { GAMES, type GameMeta } from '../games/games'
import { createRoom, joinRoomByCode } from './rooms'

const LIVE_GAMES = new Set(['tac_zone', 'pattern_king'])

// ─── Game picker card ───────────────────────────────────────────
function GameCard({ game, onSelect }: { game: GameMeta; onSelect: () => void }) {
  const Icon = game.icon
  const isLive = LIVE_GAMES.has(game.dbKey)
  return (
    <div
      className="neu-card ripple-wrap"
      onClick={(e) => { ripple(e); onSelect() }}
      style={{ padding: 18, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${game.accent}18`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${game.accent}18`, border: `1px solid ${game.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${game.accent}20` }}>
          <Icon size={20} style={{ color: game.accent }} />
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{game.name}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: isLive ? 8 : 0 }}>{game.tagline}</p>
      {isLive && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 800, color: '#3ecf8e', background: 'rgba(62,207,142,0.12)', border: '1px solid rgba(62,207,142,0.3)', borderRadius: 8, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3ecf8e' }} /> Live now
        </span>
      )}
    </div>
  )
}

// ─── Create/join modal for a chosen game ─────────────────────────
function GameRoomModal({ game, onClose }: { game: GameMeta; onClose: () => void }) {
  const navigate = useNavigate()
  const Icon = game.icon
  const isLive = LIVE_GAMES.has(game.dbKey)
  const [isPrivate, setIsPrivate] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(isLive ? 2 : 4)
  const [codeInput, setCodeInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setCreating(true)
    setError('')
    try {
      const { id } = await createRoom({ isPrivate, maxPlayers, gameId: game.dbKey })
      navigate(`/rooms/${id}`)
    } catch (e: any) {
      setError(e.message)
      setCreating(false)
    }
  }

  async function handleJoinByCode() {
    if (!codeInput.trim()) return
    setJoining(true)
    setError('')
    try {
      const roomId = await joinRoomByCode(codeInput.trim())
      navigate(`/rooms/${roomId}`)
    } catch (e: any) {
      setError(e.message)
      setJoining(false)
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '18px 18px 28px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${game.accent}18`, border: `1px solid ${game.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} style={{ color: game.accent }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{game.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Create or join a room</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>{error}</div>
        )}

        {/* Create room */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Create a room</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setIsPrivate(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${!isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: !isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: !isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Public</button>
            <button onClick={() => setIsPrivate(true)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${isPrivate ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: isPrivate ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: isPrivate ? 'var(--accent)' : 'var(--text-dim)' }}>Private (code only)</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {isLive ? (
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>2 players — head to head</span>
            ) : (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max players</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 4, 6, 8].map(n => (
                    <button key={n} onClick={() => setMaxPlayers(n)} style={{ width: 30, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${maxPlayers === n ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, background: maxPlayers === n ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg)', color: maxPlayers === n ? 'var(--accent)' : 'var(--text-dim)' }}>{n}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          {!isLive && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              {game.name} isn't playable live yet — this room will just be a waiting room for now.
            </div>
          )}
          <button onClick={(e) => { ripple(e); handleCreate() }} disabled={creating} className="ripple-wrap" style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: creating ? 0.7 : 1 }}>
            <Plus size={14} /> {creating ? 'Creating…' : 'Create Room'}
          </button>
        </div>

        {/* Join by code */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Have a code?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. 7F3K9Q"
              maxLength={6}
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 13px', fontSize: 15, letterSpacing: 3, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
            />
            <button onClick={handleJoinByCode} disabled={joining || !codeInput.trim()} style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: joining ? 0.7 : 1 }}>
              {joining ? '…' : 'Join'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function Multiplayer() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<GameMeta | null>(null)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Multiplayer</div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
        Pick a game to create or join a room. Playing live together is coming to games one by one.
      </p>

      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 20 }}>
        {GAMES.map(game => (
          <GameCard key={game.id} game={game} onSelect={() => setSelected(game)} />
        ))}
      </div>

      <Link to="/rooms" onClick={(e) => ripple(e)} className="neu-card ripple-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexShrink: 0 }}>
          <Users size={15} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Browse all public rooms</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Any game, or join with a code</div>
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
      </Link>

      {selected && <GameRoomModal game={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
