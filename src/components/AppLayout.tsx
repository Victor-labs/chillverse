// src/components/AppLayout.tsx
import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AchievementToast from './AchievementToast'
import NotificationToastRenderer from './NotificationToastRenderer'
import IncomingChallengeOverlay from './IncomingChallengeOverlay'
import PromoOverlay from './PromoOverlay'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getUserRankTier } from '../lib/ranks'
import { getGlobalSessionInfo } from '../lib/gameSession'
import { useChallengeListener } from '../hooks/useChallengeListener'
import { usePromoNotifications } from '../hooks/usePromoNotifications'
import type { IncomingChallenge } from '../hooks/useChallengeListener'

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

// ── Rematch drop-in banner (like achievement toast) ──────────────
function RematchBanner({
  opponentName,
  onAccept,
  onDecline,
}: {
  opponentName: string
  onAccept: () => void
  onDecline: () => void
}) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDecline() }, 8000)
    return () => clearTimeout(t)
  }, [onDecline])

  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 99998,
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '12px 16px',
      background: 'rgba(14,14,18,0.96)',
      border: '1px solid rgba(255,107,0,0.4)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(14px)',
      maxWidth: 340,
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(255,107,0,0.18)', border: '1px solid rgba(255,107,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
        ⚔️
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
          {opponentName} wants a rematch!
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={() => { setVisible(false); onDecline() }} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
            Decline
          </button>
          <button onClick={() => { setVisible(false); onAccept() }} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer' }}>
            Accept
          </button>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: '0 0 16px 16px', background: 'rgba(255,107,0,0.2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', animation: 'toastProgress 8s linear forwards' }} />
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { user, session } = useAuth()
  const myId = session?.user?.id ?? null
  const [wishlistNames, setWishlistNames] = useState<string[]>([])

  // ── Challenge listener ──
  const { incoming, update, clearIncoming, clearUpdate } = useChallengeListener()
  const [rematchFrom, setRematchFrom] = useState<{ opponentId: string; opponentName: string; game: string } | null>(null)

  // ── Promo / announcement overlay ──
  const { active: activePromo, dismiss: dismissPromo } = usePromoNotifications(myId)

  // When challenger gets an "accepted" update → navigate to challenge page to start game
  useEffect(() => {
    if (!update) return
    if (update.status === 'accepted') {
      clearUpdate()
      // Navigate challenger to challenges page with context
      // (the ChallengeFullModal inside will already handle this via its own subscription,
      //  but if the user navigated away we redirect them back)
    }
    // Rematch requests come as new challenge inserts — handled by incoming flow
    clearUpdate()
  }, [update, clearUpdate])

  // ── Accept incoming challenge ──
  const handleAcceptIncoming = useCallback((challenge: IncomingChallenge) => {
    clearIncoming()
    // Navigate challenged user to /challenges with params so the TicTacToe board opens
    navigate(`/challenges?cid=${challenge.id}&oid=${challenge.challenger_id}&oname=${encodeURIComponent(challenge.challenger_name)}&game=${challenge.game}`)
  }, [clearIncoming, navigate])

  // Wishlist
  useEffect(() => {
    if (!user) { setWishlistNames([]); return }
    let active = true
    supabase.from('wishlist').select('item_name').eq('user_id', user.id)
      .then(({ data }) => { if (active) setWishlistNames((data ?? []).map((row: { item_name: string }) => row.item_name)) })
    return () => { active = false }
  }, [user])

  const xp = profile?.xp ?? 0
  const rankTier = getUserRankTier(xp)
  const sessionInfo = user ? getGlobalSessionInfo(user.id) : { count: 0 }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    setSidebarCollapsed(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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

        {/* Global incoming challenge overlay */}
        {incoming && myId && (
          <IncomingChallengeOverlay
            challenge={incoming}
            myId={myId}
            onAccept={handleAcceptIncoming}
            onDismiss={clearIncoming}
          />
        )}

        {/* Promo / announcement overlay — never shows on top of an actual challenge invite */}
        {activePromo && !incoming && (
          <PromoOverlay
            notification={activePromo}
            onDismiss={dismissPromo}
          />
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
          <div
            className="hidden lg:block transition-all duration-300"
            style={{ paddingLeft: sidebarWidth }}
          />
          <div className="lg:transition-all lg:duration-300" style={{ paddingLeft: 0 }}>
            <style>{`
              @media (min-width: 1024px) {
                .cv-main-inner { padding-left: ${sidebarWidth + 24}px !important; }
              }
            `}</style>
            <div className="cv-main-inner">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
  )
}
