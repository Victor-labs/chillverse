// src/components/AppLayout.tsx
import { useState, useEffect } from 'react'
import { Outlet, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AchievementToast from './AchievementToast'
import NotificationToastRenderer from './NotificationToastRenderer'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile':   'Profile',
  '/chat':      'Chat',
  '/games':     'Games',
  '/ranks':     'Rank',
  '/mall':      'Mall',
  '/streak':    'Streak',
  '/settings':  'Settings',
}

// Top-level pages — no back button shown
const TOP_LEVEL_ROUTES = [
  '/dashboard', '/games', '/chat', '/profile',
  '/ranks', '/mall', '/streak', '/settings',
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Auto-collapse sidebar on medium desktops (1024–1279px)
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

      <main
        className="pt-[68px] pb-12 relative z-10 transition-all duration-300"
        style={{ paddingLeft: 'clamp(1rem, 4vw, 2rem)', paddingRight: 'clamp(1rem, 4vw, 2rem)' }}
      >
        {/* On desktop, push content right by sidebar width */}
        <div
          className="hidden lg:block transition-all duration-300"
          style={{ paddingLeft: sidebarWidth }}
        />
        <div
          className="lg:transition-all lg:duration-300"
          style={{ paddingLeft: 0 }}
        >
          {/* Inline responsive offset */}
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
