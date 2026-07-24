// src/pages/Multiplayer.tsx
// Multiplayer hub, in three sections:
//   1. Vs AI       — Chess, Ludo, Uno. Tapping opens a small pre-game sheet
//                    (name/tagline/today's hub-XP status) before launching —
//                    see HubPreGameModal.
//   2. Community   — Water the Tree, same pre-game sheet pattern.
//   3. Vs Players  — unchanged: pick any game, create/join a real room.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, X, Plus, Users, Crown, Dices, TreePine, Lock } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { GAMES, getGameMeta, type GameMeta } from '../games/games'
import { getHubXpStatus, HUB_DAILY_XP_CAP } from '../games/play/hubXp'
import { createRoom, joinRoomByCode } from './rooms'

const LIVE_GAMES = new Set(['tac_zone', 'pattern_king'])

// ─── Vs AI / Community game entries ──────────────────────────────
// These three don't go through the room/session flow below — Chess is a
// standalone React game, Ludo and Water the Tree are self-contained HTML
// games rendered in an iframe (see games/play/Ludo.tsx and
// games/play/WaterTheTree.tsx). Each opens its own route after the
// pre-game sheet is confirmed.
interface HubGame {
  name: string
  tagline: string
  accent: string
  icon: typeof Crown
  route: string
  proOnly?: boolean
}

const UNO = getGameMeta('uno')!

const VS_AI_GAMES: HubGame[] = [
  { name: 'Chillverse Chess', tagline: 'Full rules, real AI — castling, en passant, the works.', accent: '#c9a24b', icon: Crown, route: '/play/chess' },
  { name: 'Ludo', tagline: 'Roll, race, and knock the AI back to base.', accent: '#c79a3b', icon: Dices, route: '/play/ludo' },
  { name: UNO.name, tagline: UNO.tagline, accent: UNO.accent, icon: UNO.icon, route: '/games', proOnly: true },
]

const COMMUNITY_GAMES: HubGame[] = [
  { name: 'The Grove', tagline: 'Water the tree, watch it grow through the day.', accent: '#7DB8D9', icon: TreePine, route: '/play/water-the-tree' },
]

function HubGameCard({ game, onSelect }: { game: HubGame; onSelect: () => void }) {
  const Icon = game.icon
  return (
    <div
      className="neu-card ripple-wrap"
      onClick={(e) => { ripple(e); onSelect() }}
      style={{ padding: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden', marginBottom: 10 }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${game.accent}18`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${game.accent}18`, border: `1px solid ${game.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${game.accent}20`, flexShrink: 0 }}>
          <Icon size={20} style={{ color: game.accent }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{game.name}</p>
            {game.proOnly && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#9b6dff', background: 'rgba(155,109,255,0.12)', border: '1px solid rgba(155,109,255,0.3)', borderRadius: 6, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pro</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{game.tagline}</p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  )
}

// ─── Fix 3: pre-game sheet for Vs AI / Community games ──────────
// Shows what you're about to play and today's hub-XP status before
// actually launching the game — tapping a card no longer goes straight in.
function HubPreGameModal({ game, onClose }: { game: HubGame; onClose: () => void }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const Icon = game.icon
  const [status, setStatus] = useState<{ xpToday: number; capReached: boolean } | null>(null)

  useEffect(() => {
    if (!userId) return
    getHubXpStatus(userId).then(setStatus)
  }, [userId])

  function handlePlay() {
    if (game.route === '/games') {
      navigate('/games', { state: { openGame: 'uno' } })
    } else {
      navigate(game.route)
    }
  }

  const capReached = !!status?.capReached

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '18px 18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `${game.accent}18`, border: `1px solid ${game.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} style={{ color: game.accent }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{game.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{game.tagline}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          {capReached
            ? <Lock size={15} style={{ color: '#9b6dff', flexShrink: 0 }} />
            : <span style={{ width: 6, height: 6, borderRadius: '50%', background: game.accent, flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: capReached ? '#9b6dff' : 'var(--text-muted)' }}>
            {status == null
              ? '18 XP for a win'
              : capReached
                ? "You've hit today's XP cap — this game is locked until it resets tomorrow."
                : `18 XP for a win — ${status.xpToday}/${HUB_DAILY_XP_CAP} earned today`}
          </span>
        </div>

        <button
          onClick={(e) => { if (!capReached) { ripple(e); handlePlay() } }}
          disabled={capReached}
          className="ripple-wrap"
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: capReached ? 'var(--surface2)' : 'var(--accent)', color: capReached ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: 13.5, cursor: capReached ? 'not-allowed' : 'pointer' }}
        >
          {capReached ? 'Locked for today' : 'Play'}
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── Vs Players: existing room picker (unchanged behavior) ──────
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

const MULTIPLAYER_AD_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Pics/file_000000000f2c71f4b5f22c29bcd8508b.png'

// ─── Subscription-required sheet ─────────────────────────────────
// Shown instead of the hub for anyone without an active Orbit/Void plan.
function MultiplayerAdSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '18px 18px 28px' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <img src={MULTIPLAYER_AD_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.4, margin: '0 0 18px' }}>
          You need to be on an active subscription to access multiplayer.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={(e) => { ripple(e); onClose() }}
            className="ripple-wrap"
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            onClick={(e) => { ripple(e); navigate('/pro') }}
            className="ripple-wrap"
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
          >
            Take me there
          </button>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            In Multiplayer you get access to other interesting games, and the ability to invite players, battle with AI, and other community-related games.
          </p>
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
  const [hubSelected, setHubSelected] = useState<HubGame | null>(null)
  const { profile, loading: profileLoading } = useProfile()
  const isPro = isProActive(profile)

  // Uno is now launched from the "Vs AI" section above, not as a Vs
  // Players room — it has no live head-to-head implementation.
  const ROOM_GAMES = GAMES.filter(g => g.id !== 'uno')

  // Gate: Multiplayer now requires an active Orbit or Void plan. Free
  // users get the ad sheet instead of the hub; "Close" sends them back
  // to where they came from, "Take me there" routes to /pro.
  if (profileLoading) {
    return <div style={{ minHeight: '40vh' }} />
  }
  if (!isPro) {
    return <MultiplayerAdSheet onClose={() => navigate(-1)} />
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Multiplayer</div>
      </div>

      {/* ─── Vs AI ─────────────────────────────────────────── */}
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Vs AI</div>
      {VS_AI_GAMES.map(game => (
        <HubGameCard key={game.name} game={game} onSelect={() => setHubSelected(game)} />
      ))}

      <div style={{ marginBottom: 24 }} />

      {/* ─── Community ─────────────────────────────────────── */}
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Community</div>
      {COMMUNITY_GAMES.map(game => (
        <HubGameCard key={game.name} game={game} onSelect={() => setHubSelected(game)} />
      ))}

      <div style={{ marginBottom: 24 }} />

      {/* ─── Vs Players ─────────────────────────────────────── */}
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Vs Players</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
        Pick a game to create or join a room. Playing live together is coming to games one by one.
      </p>

      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 20 }}>
        {ROOM_GAMES.map(game => (
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
      {hubSelected && <HubPreGameModal game={hubSelected} onClose={() => setHubSelected(null)} />}
    </div>
  )
}
