// src/components/AppLayout.tsx
import { useState, useEffect } from 'react'
import { Outlet, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AchievementToast from '../features/achievements/AchievementToast'
import BadgeEarnedModal from '../features/badges/BadgeEarnedModal'
import NotificationToastRenderer from '../features/notifications/NotificationToastRenderer'
import PromoOverlay from '../features/notifications/PromoOverlay'
import { useReferralPromoAd } from '../features/referral/useReferralPromoAd'
import { useProfile } from '../features/profile/useProfile'
import { useAuth } from '../features/auth/useAuth'
import { getUserRankTier } from '../features/profile/ranks'
import { getGlobalSessionInfo } from '../features/games/gameSession'
import { checkSessionResetNotification, checkMoviesOpenNotification } from '../features/notifications/liveNotifications'
import { getSessionLimits } from '../shared/lib/proPlans'
import CallProvider from '../features/chat/calling/CallContext'
import { ProfilePreviewProvider } from '../context/ProfilePreview'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/profile':    'Profile',
  '/chat':       'Chat',
  '/games':      'Games',
  '/leaderboards': 'Leaderboards',
  '/ranks':      'Rank',
  '/mall':       'Mall',
  '/streak':     'Streak',
  '/settings':   'Settings',
}

const TOP_LEVEL_ROUTES = [
  '/dashboard', '/games', '/leaderboards', '/chat', '/profile',
  '/ranks', '/mall', '/streak', '/settings',
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
  const { active: referralAd, dismiss: dismissReferralAd } = useReferralPromoAd(myId)

  // ── Sidebar responsiveness ──
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    setSidebarCollapsed(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Live notifications: session limit reset + Movies reopening ──
  // Checked on mount and every 60s while the app is open, so the toast
  // fires immediately if the person is already in the app when either
  // transition happens, and the notification is waiting for them
  // (via the bell / Notifications page) if they weren't.
  useEffect(() => {
    if (!myId) return
    const username = profile?.display_name || profile?.username || 'Player'
    const run = () => {
      checkSessionResetNotification(myId, username, getSessionLimits(profile).limit).catch(console.error)
      checkMoviesOpenNotification(myId).catch(console.error)
    }
    run()
    const t = setInterval(run, 60_000)
    return () => clearInterval(t)
  }, [myId, profile?.display_name, profile?.username])

  // Suppress unused var warnings — kept for future use
  void user
  void getUserRankTier
  void getGlobalSessionInfo

  const title =
    pathname === '/coming-soon'
      ? searchParams.get('feature') || 'Coming Soon'
      : pathname.startsWith('/support')
        ? 'Support'
        : ROUTE_TITLES[pathname] || 'Dashboard'

  const isTopLevel = TOP_LEVEL_ROUTES.includes(pathname)
  const sidebarWidth = sidebarCollapsed ? 72 : 280

  return (
    <CallProvider myId={myId}>
      <ProfilePreviewProvider>
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
        <BadgeEarnedModal />
        <NotificationToastRenderer />
        {referralAd && <PromoOverlay notification={referralAd} onDismiss={dismissReferralAd} />}

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
      </ProfilePreviewProvider>
    </CallProvider>
  )
}
