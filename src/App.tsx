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
const Notifications      = lazy(() => import('./pages/Notifications'))
const Inventory          = lazy(() => import('./pages/Inventory'))
const Wallet             = lazy(() => import('./pages/Wallet'))
const WeeklyMissions     = lazy(() => import('./pages/WeeklyMissions'))
const HaloAIPage          = lazy(() => import('./pages/HaloAI'))
// Multiplayer imports removed — files deleted, will be restored when rebuilt
// const MultiplayerHome    = lazy(() => import('./pages/multiplayer/MultiplayerHome'))
// const BrowseRooms        = lazy(() => import('./pages/multiplayer/BrowseRooms'))
// const CreateRoom         = lazy(() => import('./pages/multiplayer/CreateRoom'))
// const RoomLobby          = lazy(() => import('./pages/multiplayer/RoomLobby'))
// const MultiplayerGameShell = lazy(() => import('./pages/multiplayer/MultiplayerGameShell'))

const Fallback = () => (
  <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Loading…</div>
)

// Only redirect to /dashboard when the user is on a public page.
// Supabase fires SIGNED_IN on every silent token refresh (~every 1hr).
// Without this guard that refresh triggers navigate('/dashboard') which
// unmounts the current page mid-render and leaves a black screen.
const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms']

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // SIGNED_IN fires on both real logins AND silent token refreshes (~every 1hr).
      // We must not run streak/achievement logic on token refreshes — that would
      // allow a streak increment every time midnight passes mid-session.
      //
      // Strategy: only run on SIGNED_IN, and guard with a sessionStorage flag so
      // that a hard page reload within the same browser session doesn't re-fire.
      // (The DB RPC is also idempotent — it is safe to call multiple times per day —
      // but the sessionStorage guard avoids unnecessary round-trips on every reload.)
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

      {/* Standalone full-screen experience — no sidebar/topbar chrome */}
      <Route path="/watch" element={<ProtectedRoute><Suspense fallback={<Fallback />}><Watch /></Suspense></ProtectedRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"                        element={<Dashboard />} />
        <Route path="/coming-soon"                      element={<ComingSoon />} />
        <Route path="/games"                            element={<Games />} />
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
        <Route path="/notifications"                    element={<Suspense fallback={<Fallback />}><Notifications /></Suspense>} />
        <Route path="/inventory"                        element={<Suspense fallback={<Fallback />}><Inventory /></Suspense>} />
        <Route path="/wallet"                           element={<Suspense fallback={<Fallback />}><Wallet /></Suspense>} />
        <Route path="/weekly-missions"                  element={<Suspense fallback={<Fallback />}><WeeklyMissions /></Suspense>} />
        <Route path="/halo"                             element={<Suspense fallback={<Fallback />}><HaloAIPage /></Suspense>} />
        {/* Multiplayer routes removed — will be restored when rebuilt */}
        {/* <Route path="/multiplayer"                      element={<Suspense fallback={<Fallback />}><MultiplayerHome /></Suspense>} /> */}
        {/* <Route path="/multiplayer/browse"               element={<Suspense fallback={<Fallback />}><BrowseRooms /></Suspense>} /> */}
        {/* <Route path="/multiplayer/create"               element={<Suspense fallback={<Fallback />}><CreateRoom /></Suspense>} /> */}
        {/* <Route path="/multiplayer/room/:roomId"         element={<Suspense fallback={<Fallback />}><RoomLobby /></Suspense>} /> */}
        {/* <Route path="/multiplayer/game/:gameId/:roomId" element={<Suspense fallback={<Fallback />}><MultiplayerGameShell /></Suspense>} /> */}
      </Route>
    </Routes>
  )
}
