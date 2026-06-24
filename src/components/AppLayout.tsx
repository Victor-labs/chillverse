// src/components/AppLayout.tsx
import { useState } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile':   'Profile',
  '/chat':      'Chat',
  '/games':     'Games',
  '/ranks':     'Leaderboard',
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()

  const title =
    pathname === '/coming-soon'
      ? searchParams.get('feature') || 'Coming Soon'
      : ROUTE_TITLES[pathname] || 'Dashboard'

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* Ambient bubbles */}
      <div className="bubble-bg">
        <div className="bubble" style={{ width: 420, height: 420, background: '#ff6b00', left: '-10%', top: '10%', animationDuration: '22s' }} />
        <div className="bubble" style={{ width: 300, height: 300, background: '#9b6dff', right: '5%', top: '30%', animationDuration: '28s', animationDelay: '-8s' }} />
        <div className="bubble" style={{ width: 250, height: 250, background: '#4f8ef7', left: '40%', bottom: '15%', animationDuration: '18s', animationDelay: '-4s' }} />
        <div className="bubble" style={{ width: 180, height: 180, background: '#3ecf8e', right: '25%', top: '5%', animationDuration: '32s', animationDelay: '-12s' }} />
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} />

      {/*
        Desktop (≥1024px lg): sidebar is always visible, offset main by sidebar width.
        Tablet (768–1023px): sidebar slides in as drawer, main takes full width.
        Mobile (<768px): same as tablet.
      */}
      <main className="lg:pl-[280px] pt-[68px] px-4 sm:px-6 md:px-8 pb-12 relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
