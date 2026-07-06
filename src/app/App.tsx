import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from '../features/marketing/Landing'
import Login from '../features/auth/Login'
import Signup from '../features/auth/Signup'
import ForgotPassword from '../features/auth/ForgotPassword'
import Privacy from '../features/marketing/Privacy'
import Terms from '../features/marketing/Terms'
import Dashboard from '../features/dashboard/Dashboard'
import ComingSoon from '../features/marketing/ComingSoon'
import Games from '../features/games/Games'
import AppLayout from '../layout/AppLayout'
import ProtectedRoute from '../features/auth/ProtectedRoute'
import { supabase } from '../shared/lib/supabase'
import { updateStreak } from '../features/auth/auth'
import { triggerAchievementCheck } from '../features/achievements/triggerAchievements'

const Profile            = lazy(() => import('../features/profile/Profile'))
const PlayerProfile      = lazy(() => import('../features/profile/PlayerProfile'))
const Chat               = lazy(() => import('../features/chat/Chat'))
const Streak             = lazy(() => import('../features/missions/Streak'))
const Settings           = lazy(() => import('../features/settings/Settings'))
const Ranks              = lazy(() => import('../features/profile/Ranks'))
const Watch              = lazy(() => import('../features/watch/Watch'))
const Mall               = lazy(() => import('../features/economy/Mall'))
const GiftPage           = lazy(() => import('../features/economy/Gift'))
const BuyDiamonds        = lazy(() => import('../features/economy/BuyDiamonds'))
const Achievements       = lazy(() => import('../features/achievements/Achievements'))
const Artifacts          = lazy(() => import('../features/economy/Artifacts'))
const Notifications      = lazy(() => import('../features/notifications/Notifications'))
const Inventory          = lazy(() => import('../features/economy/Inventory'))
const Wallet             = lazy(() => import('../features/economy/Wallet'))
const WeeklyMissions     = lazy(() => import('../features/missions/WeeklyMissions'))
const Exploration        = lazy(() => import('../features/exploration/Exploration'))
const Version            = lazy(() => import('../features/marketing/Version'))
const HaloAI             = lazy(() => import('../features/halo-ai/HaloAI'))
const Pro                = lazy(() => import('../features/economy/Pro'))
const Multiplayer        = lazy(() => import('../features/multiplayer/Multiplayer'))
const Rooms              = lazy(() => import('../features/multiplayer/Rooms'))
const Room                = lazy(() => import('../features/multiplayer/Room'))
const FeedPage            = lazy(() => import('../features/posts/FeedPage'))
const SinglePostPage      = lazy(() => import('../features/posts/SinglePostPage'))
const HighlightsPage      = lazy(() => import('../features/highlights/HighlightsPage'))
const ReferralPage        = lazy(() => import('../features/referral/Referral'))
const SearchPage          = lazy(() => import('../features/search/SearchPage'))
const Support             = lazy(() => import('../features/support/Support'))
const SupportCategory     = lazy(() => import('../features/support/SupportCategory'))
const SupportArticle      = lazy(() => import('../features/support/SupportArticle'))
const NewTicket           = lazy(() => import('../features/support/NewTicket'))
const MyTickets           = lazy(() => import('../features/support/MyTickets'))

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
        <Route path="/dashboard"        element={<Dashboard />} />
        <Route path="/coming-soon"      element={<ComingSoon />} />
        <Route path="/games"            element={<Games />} />
        <Route path="/exploration"      element={<Exploration />} />
        <Route path="/mall"             element={<Suspense fallback={<Fallback />}><Mall /></Suspense>} />
        <Route path="/gift"             element={<Suspense fallback={<Fallback />}><GiftPage /></Suspense>} />
        <Route path="/buy-diamonds"     element={<Suspense fallback={<Fallback />}><BuyDiamonds /></Suspense>} />
        <Route path="/profile"          element={<Suspense fallback={<Fallback />}><Profile /></Suspense>} />
        <Route path="/profile/:userId"  element={<Suspense fallback={<Fallback />}><PlayerProfile /></Suspense>} />
        <Route path="/chat"             element={<Suspense fallback={<Fallback />}><Chat /></Suspense>} />
        <Route path="/streak"           element={<Suspense fallback={<Fallback />}><Streak /></Suspense>} />
        <Route path="/settings"         element={<Suspense fallback={<Fallback />}><Settings /></Suspense>} />
        <Route path="/ranks"            element={<Suspense fallback={<Fallback />}><Ranks /></Suspense>} />
        <Route path="/achievements"     element={<Suspense fallback={<Fallback />}><Achievements /></Suspense>} />
        <Route path="/artifacts"        element={<Suspense fallback={<Fallback />}><Artifacts /></Suspense>} />
        <Route path="/notifications"    element={<Suspense fallback={<Fallback />}><Notifications /></Suspense>} />
        <Route path="/inventory"        element={<Suspense fallback={<Fallback />}><Inventory /></Suspense>} />
        <Route path="/wallet"           element={<Suspense fallback={<Fallback />}><Wallet /></Suspense>} />
        <Route path="/weekly-missions"  element={<Suspense fallback={<Fallback />}><WeeklyMissions /></Suspense>} />
        <Route path="/version"          element={<Suspense fallback={<Fallback />}><Version /></Suspense>} />
        <Route path="/halo"             element={<Suspense fallback={<Fallback />}><HaloAI /></Suspense>} />
        <Route path="/pro"              element={<Suspense fallback={<Fallback />}><Pro /></Suspense>} />
        <Route path="/multiplayer"      element={<Suspense fallback={<Fallback />}><Multiplayer /></Suspense>} />
        <Route path="/rooms"            element={<Suspense fallback={<Fallback />}><Rooms /></Suspense>} />
        <Route path="/rooms/:roomId"    element={<Suspense fallback={<Fallback />}><Room /></Suspense>} />
        <Route path="/feed"             element={<Suspense fallback={<Fallback />}><FeedPage /></Suspense>} />
        <Route path="/feed/highlights"  element={<Suspense fallback={<Fallback />}><HighlightsPage /></Suspense>} />
        <Route path="/feed/:postId"     element={<Suspense fallback={<Fallback />}><SinglePostPage /></Suspense>} />
        <Route path="/referral"         element={<Suspense fallback={<Fallback />}><ReferralPage /></Suspense>} />
        <Route path="/search"           element={<Suspense fallback={<Fallback />}><SearchPage /></Suspense>} />
        <Route path="/support"                          element={<Suspense fallback={<Fallback />}><Support /></Suspense>} />
        <Route path="/support/tickets"                  element={<Suspense fallback={<Fallback />}><MyTickets /></Suspense>} />
        <Route path="/support/tickets/new"               element={<Suspense fallback={<Fallback />}><NewTicket /></Suspense>} />
        <Route path="/support/:categorySlug"             element={<Suspense fallback={<Fallback />}><SupportCategory /></Suspense>} />
        <Route path="/support/:categorySlug/:articleSlug" element={<Suspense fallback={<Fallback />}><SupportArticle /></Suspense>} />
      </Route>
    </Routes>
  )
      }
