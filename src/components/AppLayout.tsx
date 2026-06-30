// src/components/AppLayout.tsx
import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AchievementToast from './AchievementToast'
import NotificationToastRenderer from './NotificationToastRenderer'
import IncomingChallengeOverlay from './IncomingChallengeOverlay'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getUserRankTier } from '../lib/ranks'
import { getGlobalSessionInfo } from '../lib/gameSession'
import { useChallengeListener } from '../hooks/useChallengeListener'
import type { IncomingChallenge } from '../hooks/useChallengeListener'
import { Swords, Home } from 'lucide-react'

// ── Global game-starting overlay ─────────────────────────────────
function GameStartingOverlay({ gameName, countdown }: { gameName: string; countdown: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>GAME STARTING</div>
      <div style={{ fontSize: 96, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{countdown || '🔥'}</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{gameName}</div>
    </div>
  )
}

// ── Room invite overlay ───────────────────────────────────────────
interface RoomInviteData { room_id: string; sender_id: string; sender_name: string; game_label: string; invite_id: string }

function IncomingRoomInviteOverlay({ invite, onAccept, onDecline }: { invite: RoomInviteData; onAccept: () => void; onDecline: () => void }) {
  const [secs, setSecs] = useState(12)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(t); onDecline(); return 0 } return s - 1 }), 1000)
    return () => clearInterval(t)
  }, [onDecline])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9995, padding: '12px 16px', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'all', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(14,14,18,0.97)', border: '1px solid rgba(255,107,0,0.45)', borderRadius: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)', maxWidth: 360, width: '100%', animation: 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both', position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,107,0,0.15)', border: '1.5px solid rgba(255,107,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🎮</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{invite.sender_name} invited you to a room</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{invite.game_label} · expires in {secs}s</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDecline} style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>Decline</button>
            <button onClick={onAccept} style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Swords size={11} /> Join Room</button>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,107,0,0.15)' }}>
          <div style={{ height: '100%', background: 'var(--accent)', animation: `toastProgress ${secs}s linear forwards` }} />
        </div>
      </div>
    </div>
  )
}

// ── Return-to-lobby floating bar ──────────────────────────────────
function FloatingLobbyBar({ onReturn }: { onReturn: () => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 400, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(14,14,18,0.96)', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 40, boxShadow: '0 8px 28px rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)', whiteSpace: 'nowrap', pointerEvents: 'all' }}>
      <Home size={14} color="var(--accent)" />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>You're in a lobby</span>
      <button onClick={onReturn} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Return</button>
    </div>
  )
}

// ── Rematch banner ────────────────────────────────────────────────
function RematchBanner({ opponentName, onAccept, onDecline }: { opponentName: string; onAccept: () => void; onDecline: () => void }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDecline() }, 8000)
    return () => clearTimeout(t)
  }, [onDecline])

  if (!visible) return null
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99998, display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', background: 'rgba(14,14,18,0.96)', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)', maxWidth: 340, animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(255,107,0,0.18)', border: '1px solid rgba(255,107,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚔️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{opponentName} wants a rematch!</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={() => { setVisible(false); onDecline() }} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>Decline</button>
          <button onClick={() => { setVisible(false); onAccept() }} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer' }}>Accept</button>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: '0 0 16px 16px', background: 'rgba(255,107,0,0.2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', animation: 'toastProgress 8s linear forwards' }} />
      </div>
    </div>
  )
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/profile':    'Profile',
  '/chat':       'Chat',
  '/games':      'Games',
  '/ranks':      'Rank',
  '/mall':       'Mall',
  '/streak':     'Streak',
  '/settings':   'Settings',
  '/challenges': 'Challenges',
}

const TOP_LEVEL_ROUTES = [
  '/dashboard', '/games', '/chat', '/profile',
  '/ranks', '/mall', '/streak', '/settings', '/challenges',
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { user, session } = useAuth()
  const myId = session?.user?.id ?? null

  // ── Room invite state ──
  const [roomInvite, setRoomInvite]               = useState<RoomInviteData | null>(null)
  const [activeLobbyRoomId, setActiveLobbyRoomId] = useState<string | null>(null)
  const [inLobbyPage, setInLobbyPage]             = useState(false)
  const [gameCountdown, setGameCountdown]         = useState<{ gameName: string; count: number } | null>(null)

  // ── Listen for room invites ──
  useEffect(() => {
    if (!myId) return
    const ch = supabase.channel(`global-room-invites:${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_invites', filter: `receiver_id=eq.${myId}` }, async (payload) => {
        const inv = payload.new as { id: string; room_id: string; sender_id: string }
        const [{ data: sender }, { data: room }] = await Promise.all([
          supabase.from('profiles').select('display_name,username').eq('id', inv.sender_id).single(),
          supabase.from('game_rooms').select('game_id').eq('id', inv.room_id).single(),
        ])
        const GAME_LABELS: Record<string, string> = { tictactoe: 'Tic Tac Toe', colourblock: 'Colour Block' }
        setRoomInvite({
          invite_id: inv.id,
          room_id: inv.room_id,
          sender_id: inv.sender_id,
          sender_name: (sender as { display_name?: string; username?: string } | null)?.display_name ?? (sender as { display_name?: string; username?: string } | null)?.username ?? 'Someone',
          game_label: GAME_LABELS[(room as { game_id?: string } | null)?.game_id ?? ''] ?? 'Game',
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId])

  // ── Listen for game start from active room ──
  useEffect(() => {
    if (!activeLobbyRoomId) return
    const ch = supabase.channel(`global-room-start:${activeLobbyRoomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${activeLobbyRoomId}` }, (payload) => {
        const updated = payload.new as { status: string; game_id: string }
        if (updated.status === 'countdown') {
          const GAME_LABELS: Record<string, string> = { tictactoe: 'Tic Tac Toe', colourblock: 'Colour Block' }
          const gameName = GAME_LABELS[updated.game_id] ?? 'Game'
          let c = 5
          setGameCountdown({ gameName, count: c })
          const t = setInterval(() => {
            c--
            setGameCountdown({ gameName, count: c })
            if (c <= 0) {
              clearInterval(t)
              setGameCountdown(null)
              navigate(`/challenges?room=${activeLobbyRoomId}&game=${updated.game_id}`)
            }
          }, 1000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeLobbyRoomId, navigate])

  // ── Global bridge for Challenges page to update lobby state ──
  useEffect(() => {
    // @ts-ignore
    window.__cvSetActiveLobby = (roomId: string | null) => setActiveLobbyRoomId(roomId)
    // @ts-ignore
    window.__cvSetInLobbyPage = (v: boolean) => setInLobbyPage(v)
    return () => {
      // @ts-ignore
      delete window.__cvSetActiveLobby
      // @ts-ignore
      delete window.__cvSetInLobbyPage
    }
  }, [])

  // ── Challenge listener ──
  const { incoming, update, clearIncoming, clearUpdate } = useChallengeListener()
  const [rematchFrom, setRematchFrom] = useState<{ opponentId: string; opponentName: string; game: string } | null>(null)

  useEffect(() => {
    if (!update) return
    clearUpdate()
  }, [update, clearUpdate])

  const handleAcceptIncoming = useCallback((challenge: IncomingChallenge) => {
    clearIncoming()
    navigate(`/challenges?cid=${challenge.id}&oid=${challenge.challenger_id}&oname=${encodeURIComponent(challenge.challenger_name)}&game=${challenge.game}`)
  }, [clearIncoming, navigate])

  // ── Sidebar responsiveness ──
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    setSidebarCollapsed(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Suppress unused var warnings — profile/user kept for future use
  void profile
  void user
  void getUserRankTier
  void getGlobalSessionInfo

  const title =
    pathname === '/coming-soon'
      ? searchParams.get('feature') || 'Coming Soon'
      : ROUTE_TITLES[pathname] || 'Dashboard'

  const isTopLevel = TOP_LEVEL_ROUTES.includes(pathname)
  const sidebarWidth = sidebarCollapsed ? 72 : 280

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* Ambient bubbles */}
      <div className="bubble-bg">
        <div className="bubble" style={{ width: 420, height: 420, background: '#ff6b00', left: '-10%', top: '10%', animationDuration: '22s' }} />
        <div className="bubble" style={{ width: 300, height: 300, background: '#9b6dff', right: '5%', top: '30%', animationDuration: '28s', animationDelay: '-8s' }} />
        <div className="bubble" style={{ width: 250, height: 250, background: '#4f8ef7', left: '40%', bottom: '15%', animationDuration: '18s', animationDelay: '-4s' }} />
        <div className="bubble" style={{ width: 180, height: 180, background: '#3ecf8e', right: '25%', top: '5%', animationDuration: '32s', animationDelay: '-12s' }} />
      </div>

      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      <Topbar
        title={title}
        showBack={!isTopLevel}
        onBack={() => navigate(-1)}
        onMenuClick={() => setSidebarOpen(true)}
      />

      <AchievementToast />
      <NotificationToastRenderer />

      {/* Incoming 1v1 challenge overlay */}
      {incoming && myId && (
        <IncomingChallengeOverlay
          challenge={incoming}
          myId={myId}
          onAccept={handleAcceptIncoming}
          onDismiss={clearIncoming}
        />
      )}

      {/* Room invite overlay */}
      {roomInvite && (
        <IncomingRoomInviteOverlay
          invite={roomInvite}
          onAccept={() => {
            const rid = roomInvite.room_id
            setRoomInvite(null)
            navigate(`/challenges?joinroom=${rid}`)
          }}
          onDecline={async () => {
            await supabase.from('room_invites').update({ status: 'declined' }).eq('id', roomInvite.invite_id)
            setRoomInvite(null)
          }}
        />
      )}

      {/* Game starting countdown overlay */}
      {gameCountdown && (
        <GameStartingOverlay gameName={gameCountdown.gameName} countdown={gameCountdown.count} />
      )}

      {/* Return-to-lobby bar */}
      {activeLobbyRoomId && !inLobbyPage && pathname !== '/challenges' && (
        <FloatingLobbyBar onReturn={() => navigate(`/challenges?lobby=${activeLobbyRoomId}`)} />
      )}

      {/* Rematch banner */}
      {rematchFrom && (
        <RematchBanner
          opponentName={rematchFrom.opponentName}
          onAccept={() => {
            navigate(`/challenges?oid=${rematchFrom.opponentId}&oname=${encodeURIComponent(rematchFrom.opponentName)}&game=${rematchFrom.game}`)
            setRematchFrom(null)
          }}
          onDecline={() => setRematchFrom(null)}
        />
      )}

      <main
        className="pt-[68px] pb-12 relative z-10 transition-all duration-300"
        style={{ paddingLeft: 'clamp(1rem, 4vw, 2rem)', paddingRight: 'clamp(1rem, 4vw, 2rem)' }}
      >
        <style>{`
          @media (min-width: 1024px) {
            .cv-main-inner { padding-left: ${sidebarWidth + 24}px !important; }
          }
        `}</style>
        <div className="cv-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
