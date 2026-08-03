// src/features/games/GamesZone.tsx
// Games Home — entry point for the /games route. Hero slider up top, then
// Trending Now, today's session status, the Categories row, and Favorite
// (starred) Games. Deep links that carry location.state.openGame (game
// tags in posts, "Vs AI" from Multiplayer, etc.) skip straight past this
// landing screen into the game list, since that's an explicit "launch
// this game" intent rather than browsing.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Lock, ChevronRight } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { isProActive, getSessionLimits } from '../../shared/lib/proPlans'
import { getGlobalSessionInfo } from './gameSession'
import { GAMES, CATEGORIES, type CategoryKey, type GameId } from './games'
import { fetchTrendingGames, type TrendingEntry, type MultiplayerTrendingGame } from './gamesHomeData'
import HeroSlider, { type SlideDef } from './HeroSlider'
import TrendingGameCard from './TrendingGameCard'
import SessionStatusBar from './SessionStatusBar'
import FavoriteGamesRow from './FavoriteGamesRow'
import CategoryPage from './CategoryPage'
import Toast, { useToast } from '../../shared/components/Toast'
import { useHaloDailyFlow } from '../halo-moments/useHaloDailyFlow'
import MysteryBoxModal from '../halo-moments/MysteryBoxModal'
import Games from './Games'
import ActivityGoals from './ActivityGoals'

type ZoneView = 'landing' | 'games' | 'activity' | 'category'

const SLIDE_IMAGES = {
  diamond:    'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/00d02f00d03fbbcb65ba14e97e509491.jpg',
  fortune:    'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/0eda2173d4487db6bf6c7868e62a00a3.webp.jpg',
  leaderboard:'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Pics/23bf1450a7fc18f82d6b22d0b7545a00.webp.jpg',
  goals:      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Untitled%20folder/fb163cb2b77ad565dd6be458ddbdf3aa.jpg',
  multiplayer:'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Pics/file_000000000f2c71f4b5f22c29bcd8508b.png',
  exploration:'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Untitled%20folder/Explore.jpg',
}

export default function GamesZone() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasDeepLink = !!(location.state as { openGame?: string } | null)?.openGame

  const [view, setView] = useState<ZoneView>(hasDeepLink ? 'games' : 'landing')
  const [category, setCategory] = useState<CategoryKey>('all')

  const { session } = useAuth()
  const userId = session?.user?.id ?? ''
  const { profile } = useProfile()
  const sessionLimit = getSessionLimits(profile).limit

  const [sessionInfo, setSessionInfo] = useState({ count: 0, limit: sessionLimit, limitReached: false, resetAt: 0 })
  const [trending, setTrending] = useState<TrendingEntry[] | null>(null)
  const [showMysteryBox, setShowMysteryBox] = useState(false)

  const { handleBoxOpened } = useHaloDailyFlow(userId || null)
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (!userId) return
    getGlobalSessionInfo(userId, sessionLimit).then(setSessionInfo)
  }, [userId, sessionLimit])

  useEffect(() => {
    fetchTrendingGames().then(setTrending)
  }, [])

  // Deep-link into a specific game's detail card without leaving this
  // page — mirrors how Multiplayer's "Vs AI" already opens Games.tsx.
  const navigateToGame = useCallback((id: GameId) => {
    navigate('/games', { state: { openGame: id }, replace: true })
    setView('games')
  }, [navigate])

  function openCategory(key: CategoryKey) {
    setCategory(key)
    setView('category')
  }

  function handleOpenTrendingEntry(entry: TrendingEntry) {
    if (entry.isMultiplayer) {
      const mp = entry.meta as MultiplayerTrendingGame
      if (mp.requiresActiveSub && !isProActive(profile)) {
        showToast({ message: 'Needs an active subscription to play', icon: Lock, iconColor: 'var(--red, #ff4f4f)' })
        return
      }
      navigate(mp.route)
      return
    }
    navigateToGame((entry.meta as { id: GameId }).id)
  }

  const subTierLabel = isProActive(profile)
    ? (profile?.pro_tier === 'void' ? 'Void' : 'Orbit')
    : null

  const favoriteGames = GAMES.filter(g => profile?.pinned_games?.includes(g.id))

  const slides: SlideDef[] = [
    {
      img: SLIDE_IMAGES.diamond, tag: 'Welcome Bonus', header: 'Diamond Bonus',
      text: 'Top up in Chillverse for the first time and get a bonus amount back.',
      buttonLabel: 'Claim', onAction: () => navigate('/buy-diamonds'),
    },
    {
      img: SLIDE_IMAGES.fortune, tag: 'Fortune', header: 'Halo Moments',
      text: 'Daily claim on Chillverse Fortune — come back everyday for goodies.',
      buttonLabel: 'Claim Goodies', onAction: () => setShowMysteryBox(true),
    },
    {
      img: SLIDE_IMAGES.leaderboard, tag: 'Rank Up', header: 'Leaderboards',
      text: 'Check your position in all the games you have played so far.',
      buttonLabel: 'Check', onAction: () => navigate('/leaderboards'),
    },
    {
      img: SLIDE_IMAGES.goals, tag: 'Goals', header: 'Activity Goals',
      text: 'Play games, have fun, get rewarded instantly. Tap in to see your current goal progress.',
      buttonLabel: 'Goal', onAction: () => setView('activity'),
    },
    {
      img: SLIDE_IMAGES.multiplayer, tag: 'Versus Unlimited', header: 'Multiplayer',
      text: 'Play against AI, against other players, and explore other cooler games you have never tried before.',
      buttonLabel: 'Go', onAction: () => navigate('/multiplayer'),
    },
    {
      img: SLIDE_IMAGES.exploration, tag: 'Adventure', header: 'Exploration',
      text: 'Explore mysterious maps, uncover hidden artifacts, and discover secrets waiting to be found.',
      buttonLabel: 'Dive In', onAction: () => navigate('/exploration'),
    },
  ]

  if (view === 'games') return <Games onBack={() => setView('landing')} />
  if (view === 'activity') return <ActivityGoals onBack={() => setView('landing')} />
  if (view === 'category') {
    return (
      <CategoryPage
        category={category}
        onBack={() => setView('landing')}
        onOpenGame={navigateToGame}
      />
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ArrowLeft size={15} />
        </button>
        {subTierLabel && (
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: subTierLabel === 'Void' ? 'var(--purple, #9b6dff)' : 'var(--blue, #4f8ef7)',
            background: subTierLabel === 'Void' ? 'rgba(155,109,255,0.12)' : 'rgba(79,142,247,0.12)',
            border: `1px solid ${subTierLabel === 'Void' ? 'rgba(155,109,255,0.3)' : 'rgba(79,142,247,0.3)'}`,
            borderRadius: 8, padding: '4px 10px',
          }}>
            {subTierLabel}
          </span>
        )}
      </div>

      {/* Hero slider */}
      <HeroSlider slides={slides} />

      {/* Trending Now */}
      <section style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px' }}>🔥 Trending Now</p>
        {trending === null ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 148, aspectRatio: '1/1', borderRadius: 16, background: 'var(--surface2)', flexShrink: 0 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {trending.map(entry => {
              const meta = entry.meta
              const locked = entry.isMultiplayer && (meta as MultiplayerTrendingGame).requiresActiveSub && !isProActive(profile)
              return (
                <TrendingGameCard
                  key={entry.key}
                  name={meta.name}
                  tag={entry.isMultiplayer ? (meta as MultiplayerTrendingGame).tag : ((meta as { category?: string }).category ?? 'Game')}
                  accent={meta.accent}
                  icon={meta.icon}
                  bannerUrl={meta.bannerUrl}
                  isHot={entry.isHot}
                  isNew={entry.isNew}
                  locked={locked}
                  onOpen={() => handleOpenTrendingEntry(entry)}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Session status */}
      <SessionStatusBar {...sessionInfo} />

      {/* Categories */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px' }}>Categories</p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={(e) => { ripple(e); openCategory(c.key) }}
              style={{
                flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                boxShadow: 'var(--elev-raise-sm)', borderRadius: 12, padding: '9px 16px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {c.label} <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          ))}
        </div>
      </section>

      {/* Favorite Games (was Hot Games — now shows starred games) */}
      <FavoriteGamesRow games={favoriteGames} onOpenGame={navigateToGame} />

      <MysteryBoxModal
        isOpen={showMysteryBox}
        onClose={() => setShowMysteryBox(false)}
        onOpened={handleBoxOpened}
      />
      <Toast toast={toast} />
    </div>
  )
}
