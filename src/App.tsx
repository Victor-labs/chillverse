// src/App.tsx
import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Dashboard from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'
import Games from './pages/Games'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { supabase } from './lib/supabase'
import { updateStreak } from './lib/auth'
import { triggerAchievementCheck } from './lib/triggerAchievements'

const Profile            = lazy(() => import('./pages/Profile'))
const PlayerProfile      = lazy(() => import('./pages/PlayerProfile'))
const Chat               = lazy(() => import('./pages/Chat'))
const Streak             = lazy(() => import('./pages/Streak'))
const Settings           = lazy(() => import('./pages/Settings'))
const Ranks              = lazy(() => import('./pages/Ranks'))
const Watch              = lazy(() => import('./pages/Watch'))
const Mall               = lazy(() => import('./pages/Mall'))
const GiftPage           = lazy(() => import('./pages/Gift'))
const BuyDiamonds        = lazy(() => import('./pages/BuyDiamonds'))
const Achievements       = lazy(() => import('./pages/Achievements'))
const Artifacts          = lazy(() => import('./pages/Artifacts'))
const Notifications      = lazy(() => import('./pages/Notifications'))
const Inventory          = lazy(() => import('./pages/Inventory'))
const Wallet             = lazy(() => import('./pages/Wallet'))
const WeeklyMissions     = lazy(() => import('./pages/WeeklyMissions'))
const HaloAI             = lazy(() => import('./pages/HaloAI'))   // ← ADD THIS

const Fallback = () => (
  <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Loading…</div>
)

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms']

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const flagKey = `streak_done_${session.user.id}`
        const alreadyRanThisSession = sessionStorage.getItem(flagKey)

        if (!alreadyRanThisSession) {
          sessionStorage.setItem(flagKey, '1')
          await updateStreak(session.user.id)
          triggerAchievementCheck(session.user.id).catch(console.error)
        }

        if (PUBLIC_PATHS.includes(window.location.pathname)) {
          navigate('/dashboard', { replace: true })
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <Routes>
      <Route path="/"                element={<Landing />} />
      <Route path="/login"           element={<Login />} />
      <Route path="/signup"          element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/privacy"         element={<Privacy />} />
      <Route path="/terms"           element={<Terms />} />

      <Route path="/watch" element={<ProtectedRoute><Suspense fallback={<Fallback />}><Watch /></Suspense></ProtectedRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"                        element={<Dashboard />} />
        <Route path="/coming-soon"                      element={<ComingSoon />} />
        <Route path="/games"                            element={<Games />} />
        <Route path="/halo"                             element={<Suspense fallback={<Fallback />}><HaloAI /></Suspense>} /> {/* ← ADD THIS */}
        <Route path="/mall"                             element={<Suspense fallback={<Fallback />}><Mall /></Suspense>} />
        <Route path="/gift"                             element={<Suspense fallback={<Fallback />}><GiftPage /></Suspense>} />
        <Route path="/buy-diamonds"                     element={<Suspense fallback={<Fallback />}><BuyDiamonds /></Suspense>} />
        <Route path="/profile"                          element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
        <Route path="/profile/:userId"                  element={<Suspense fallback={<Fallback />}><PlayerProfile /></Suspense>} />
        <Route path="/chat"                             element={<Suspense fallback={<Fallback />}><Chat /></Suspense>} />
        <Route path="/streak"                           element={<Suspense fallback={<Fallback />}><Streak /></Suspense>} />
        <Route path="/settings"                         element={<Suspense fallback={<Fallback />}><Settings /></Suspense>} />
        <Route path="/ranks"                            element={<Suspense fallback={<Fallback />}><Ranks /></Suspense>} />
        <Route path="/achievements"                     element={<Suspense fallback={<Fallback />}><Achievements /></Suspense>} />
        <Route path="/artifacts"                        element={<Suspense fallback={<Fallback />}><Artifacts /></Suspense>} />
        <Route path="/notifications"                    element={<Suspense fallback={<Fallback />}><Notifications /></Suspense>} />
        <Route path="/inventory"                        element={<Suspense fallback={<Fallback />}><Inventory /></Suspense>} />
        <Route path="/wallet"                           element={<Suspense fallback={<Fallback />}><Wallet /></Suspense>} />
        <Route path="/weekly-missions"                  element={<Suspense fallback={<Fallback />}><WeeklyMissions /></Suspense>} />
      </Route>
    </Routes>
  )
}
