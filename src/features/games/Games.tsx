// src/pages/Games.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  getPlaysToday, saveGameSession, savePlayerRank, getAllPlayerRanks,
  getGlobalSessionInfo, incrementGlobalSession, type GameKey,
} from './gameSession'
import { GAMES, type GameId } from './games'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { getSessionLimits } from '../../shared/lib/proPlans'
import { triggerAchievementCheck } from '../achievements/triggerAchievements'
import { updateMissionProgress } from '../missions/weeklyMissions'
import type { GameRank } from './play/types'
import type { GameEndPayload } from './play/types'
import PageOnboarding from '../onboarding/PageOnboarding'
import GameDetailModal from './GameDetailModal'
import { savePinnedGames } from './favorites'
import { useFeatureFlags } from '../../shared/lib/featureFlags'

// ── Game imports ─────────────────────────────────────────────
import ArrowDash from './play/ArrowDash'
import PatternMemory from './play/PatternMemory'
import RapidSort from './play/RapidSort'
import TriviaClash from './play/TriviaClash'
import TacZone from './play/TacZone'
import TwoTruthsOneFalse from './play/TwoTruthsOneFalse'
import SpeedMath from './play/SpeedMath'
import LiarsGrid from './play/LiarsGrid'
import Hangman from './play/Hangman'
import CloseCall from './play/CloseCall'
import PatternKing from './play/PatternKing'
import Uno from './play/Uno'
import ColourBlock from './play/ColourBlock'
import TileMerge from './play/TileMerge'

// ─── Constants ───────────────────────────────────────────────
const MAX_PLAYS    = 7

// ─── Main component ───────────────────────────────────────────
export default function Games({ onBack, openGameId, onFavoritesChanged }: { onBack?: () => void; openGameId?: GameId | null; onFavoritesChanged?: () => void } = {}) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { profile, refetch: refetchProfile } = useProfile()
  const { isEnabled: isFlagEnabled } = useFeatureFlags()
  const { limit: GLOBAL_LIMIT, cooldownHours: SESSION_COOLDOWN_HRS } = getSessionLimits(profile)

  const [activeGame, setActiveGame]   = useState<GameId | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null)
  const [activeDifficulty, setActiveDifficulty] = useState<string | undefined>(undefined)
  const [favorites, setFavorites] = useState<Set<GameId>>(new Set())

  // Pinned games live on the profile row (private, per-user), not
  // localStorage — so they follow the player across devices. `profile`
  // is already fetched by useProfile() for isPro/pro_tier above, so this
  // just mirrors its pinned_games column into local Set state whenever
  // it (re)loads, rather than firing a second network request.
  useEffect(() => {
    setFavorites(new Set((profile?.pinned_games ?? []) as GameId[]))
  }, [profile?.pinned_games])

  const toggleFavorite = useCallback((id: GameId) => {
    if (!userId) return
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      savePinnedGames(userId, next)
        .then(() => { refetchProfile(); onFavoritesChanged?.() })
        .catch(console.error)
      return next
    })
  }, [userId, refetchProfile, onFavoritesChanged])

  const [playsToday,  setPlaysToday]  = useState<Partial<Record<GameId, number>>>({})
  const [ranks,       setRanks]       = useState<Partial<Record<GameId, GameRank>>>({})
  const [streaks,     setStreaks]     = useState<Partial<Record<GameId, number>>>({})
  const [allTimeStreaks, setAllTimeStreaks] = useState<Partial<Record<GameId, number>>>({})
  const [dataLoaded,  setDataLoaded]  = useState(false)
  const [globalCount, setGlobalCount] = useState(0)
  const [, setGlobalReset] = useState(0)

  // In-app browsing (Trending Now / Favorite Games / Categories, from
  // GamesZone) hands the id straight through as a prop instead of a
  // router deep link — this always opens the detail sheet (GameDetailModal)
  // first, same screen every time, never this page's own old grid.
  useEffect(() => {
    if (openGameId) setSelectedGame(openGameId)
  }, [openGameId])

  // Deep-link support: navigate('/games', { state: { openGame: 'tac-zone' } })
  // lets a post's game tag, or Multiplayer's "Vs AI" hub (which already
  // shows its own brief pre-game sheet), jump straight into that game —
  // but only if it's actually unlocked. Waits for dataLoaded so it can
  // apply the exact same lock check LobbyCard used to use; without that
  // gate this would silently bypass the daily-play limit and the global
  // session cooldown entirely.
  useEffect(() => {
    const openGame = (location.state as { openGame?: GameId } | null)?.openGame
    if (!openGame || !dataLoaded) return

    const meta = GAMES.find(g => g.id === openGame)
    if (meta) {
      const cost = meta.sessionCost ?? 1
      const maxed = !meta.unlimitedPlays && (playsToday[meta.id] ?? 0) >= MAX_PLAYS
      const notEnoughSessions = globalCount + cost > GLOBAL_LIMIT
      const disabledByFlag = !isFlagEnabled(`game:${meta.dbKey}`)
      if (!maxed && !notEnoughSessions && !disabledByFlag) setActiveGame(openGame)
    }

    // Clear the pending nav state either way, so this can't re-fire or be raced.
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded])

  const refreshGlobalInfo = useCallback(async () => {
    if (!userId) return
    const info = await getGlobalSessionInfo(userId, GLOBAL_LIMIT)
    setGlobalCount(info.count)
    setGlobalReset(info.resetAt)
  }, [userId, GLOBAL_LIMIT])

  useEffect(() => {
    if (!userId) return
    refreshGlobalInfo()
    Promise.all(GAMES.map(g => getPlaysToday(userId, g.dbKey))).then(counts => {
      const map: Partial<Record<GameId, number>> = {}
      GAMES.forEach((g, i) => { map[g.id] = counts[i] })
      setPlaysToday(map)
      setDataLoaded(true)
    })
    getAllPlayerRanks(userId).then(allRanks => {
      const rankMap:    Partial<Record<GameId, GameRank>> = {}
      const streakMap:  Partial<Record<GameId, number>>   = {}
      const allTimeMap: Partial<Record<GameId, number>>   = {}
      GAMES.forEach(g => {
        const row = allRanks[g.dbKey as GameKey]
        rankMap[g.id]    = row?.rank ?? 'beginner'
        streakMap[g.id]  = row?.current_streak ?? 0
        allTimeMap[g.id] = row?.all_time_streak ?? 0
      })
      setRanks(rankMap)
      setStreaks(streakMap)
      setAllTimeStreaks(allTimeMap)
    })
  }, [userId])

  async function handleResult(payload: GameEndPayload) {
    const game = GAMES.find(g => g.id === payload.gameId)
    if (!game) return

    setPlaysToday(p => ({ ...p, [payload.gameId]: (p[payload.gameId as GameId] ?? 0) + 1 }))
    setRanks(r => ({ ...r, [payload.gameId]: payload.rank }))
    setStreaks(s => ({ ...s, [payload.gameId]: payload.streak }))
    setAllTimeStreaks(a => ({ ...a, [payload.gameId]: Math.max(payload.streak, a[payload.gameId as GameId] ?? 0) }))

    if (!userId) return

    const cost = game.sessionCost ?? 1
    await saveGameSession(userId, {
      game: game.dbKey,
      score: payload.score,
      xpEarned: payload.xpEarned,
      durationSec: payload.durationSec,
      rank: payload.rank,
      streak: payload.streak,
      metadata: payload.detail as Record<string, unknown>,
    })
    const incResult = await incrementGlobalSession(userId, cost, GLOBAL_LIMIT, SESSION_COOLDOWN_HRS)
    if (incResult) {
      setGlobalCount(incResult.count)
      setGlobalReset(incResult.resetAt)
    } else {
      refreshGlobalInfo()
    }

    await savePlayerRank(userId, game.dbKey, payload.rank, payload.streak,
      Math.max(payload.streak, allTimeStreaks[payload.gameId as GameId] ?? 0))

    // Fire achievement check in background
    triggerAchievementCheck(userId).catch(console.error)

    // NOTE: referral crediting used to happen here (first completed game),
    // but that was replaced by immediate server-side crediting at account
    // creation — see handle_new_user() in migration 0093. This call is
    // dead code now, removed to fix the build.

    // ── Weekly mission progress ──────────────────────────────
    updateMissionProgress(userId, 'sessions_played', 1).catch(console.error)

    if (payload.score > 0) {
      updateMissionProgress(userId, 'games_won', 1).catch(console.error)
    }

    if (payload.streak >= 3) {
      updateMissionProgress(userId, 'win_streak', payload.streak, true).catch(console.error)
    }

    updateMissionProgress(userId, 'unique_games_played', 1).catch(console.error)

    const gameMetricMap: Partial<Record<GameId, string[]>> = {
      'hangman':        ['hangman_played'],
      'speed-math':     ['speed_math_played'],
      'pattern-memory': ['pattern_memory_played'],
      'arrow-dash':     ['arrow_dash_played'],
      'rapid-sort':     ['rapid_sort_played'],
      'tac-zone':       ['tac_zone_played'],
      'two-truths':     ['two_truths_played'],
      'liars-grid':     ['liars_grid_played'],
      'trivia-clash':   ['trivia_clash_played'],
      'close-call':     ['close_call_played'],
      'pattern-king':   ['pattern_king_played'],
      'colour-block':   ['colour_block_played'],
      'tile-merge':     ['tile_merge_played'],
    }
    const extraMetrics = gameMetricMap[payload.gameId as GameId]
    if (extraMetrics) {
      for (const mk of extraMetrics) {
        updateMissionProgress(userId, mk, 1).catch(console.error)
      }
    }

    if (payload.gameId === 'hangman' && payload.correct > 0) {
      updateMissionProgress(userId, 'hangman_correct', payload.correct).catch(console.error)
    }

    if (payload.gameId === 'speed-math' && payload.total > 0) {
      const acc = Math.round((payload.correct / payload.total) * 100)
      if (acc >= 80) updateMissionProgress(userId, 'speed_math_80pct', 1).catch(console.error)
    }

    if (payload.gameId === 'pattern-memory' && payload.correct === payload.total && payload.total > 0) {
      updateMissionProgress(userId, 'pattern_memory_perfect', 1).catch(console.error)
    }

    if (payload.gameId === 'uno' && payload.score > 0) {
      updateMissionProgress(userId, 'uno_won', 1).catch(console.error)
    }

    updateMissionProgress(userId, 'games_today', 1).catch(console.error)

    if (payload.xpEarned > 0) {
      updateMissionProgress(userId, 'xp_earned', payload.xpEarned).catch(console.error)
    }

    refreshGlobalInfo()
  }

  const activeGameDef = activeGame ? GAMES.find(g => g.id === activeGame) : null
  const sessionsLeft = Math.max(0, GLOBAL_LIMIT - globalCount)

  const gameProps = {
    rank: (activeGame ? (ranks[activeGame] ?? 'beginner') : 'beginner') as GameRank,
    onEnd: handleResult,
    onBack: () => { setActiveGame(null); onBack?.() },
    sessionsLeft,
    sessionCost: activeGameDef?.sessionCost ?? 1,
    // Every solo game launch here is always preceded by an equivalent
    // intro — either GameDetailModal (image1-style detail sheet) or,
    // for deep-linked entries (a post's game tag, Multiplayer's "Vs AI"
    // hub sheet), the screen that sent the player here. So the game's
    // own internal info/rules screen would just be a redundant second
    // intro — skip it every time.
    skipIntro: true,
  }
  const tacZoneProps = { ...gameProps, initialMode: activeDifficulty as 'easy' | 'hard' | 'expert' | undefined }

  if (activeGame === 'arrow-dash')     return <ArrowDash         {...gameProps} />
  if (activeGame === 'pattern-memory') return <PatternMemory     {...gameProps} />
  if (activeGame === 'rapid-sort')     return <RapidSort         {...gameProps} />
  if (activeGame === 'trivia-clash')   return <TriviaClash       {...gameProps} />
  if (activeGame === 'tac-zone')       return <TacZone           {...tacZoneProps} />
  if (activeGame === 'two-truths')     return <TwoTruthsOneFalse {...gameProps} />
  if (activeGame === 'speed-math')     return <SpeedMath         {...gameProps} />
  if (activeGame === 'liars-grid')     return <LiarsGrid         {...gameProps} />
  if (activeGame === 'hangman')        return <Hangman           {...gameProps} />
  if (activeGame === 'close-call')     return <CloseCall         {...gameProps} />
  if (activeGame === 'pattern-king')   return <PatternKing       {...gameProps} />
  if (activeGame === 'uno')            return <Uno                {...gameProps} />
  if (activeGame === 'colour-block')   return <ColourBlock         {...gameProps} />
  if (activeGame === 'tile-merge')     return <TileMerge           {...gameProps} />

  return (
    <div>
      <PageOnboarding pageKey="games" />

      {selectedGame && (() => {
        const meta = GAMES.find(g => g.id === selectedGame)
        if (!meta) return null
        const cost = meta.sessionCost ?? 1
        const maxed = dataLoaded && !meta.unlimitedPlays && (playsToday[selectedGame] ?? 0) >= MAX_PLAYS
        const notEnoughSessions = dataLoaded && (globalCount + cost > GLOBAL_LIMIT)
        const disabledByFlag = !isFlagEnabled(`game:${meta.dbKey}`)
        const locked = maxed || notEnoughSessions || disabledByFlag
        const lockedReason = disabledByFlag
          ? 'Temporarily unavailable'
          : maxed
          ? 'Daily limit reached'
          : notEnoughSessions
            ? 'Not enough sessions left'
            : null

        return (
          <GameDetailModal
            game={meta}
            rank={(ranks[selectedGame] ?? 'beginner') as GameRank}
            streak={streaks[selectedGame] ?? 0}
            bestStreak={allTimeStreaks[selectedGame] ?? 0}
            isFavorite={favorites.has(selectedGame)}
            onToggleFavorite={() => toggleFavorite(selectedGame)}
            locked={locked}
            lockedReason={lockedReason}
            onPlay={(difficulty) => { const id = selectedGame; setSelectedGame(null); setActiveDifficulty(difficulty); setActiveGame(id) }}
            onClose={() => { setSelectedGame(null); if (onBack) onBack() }}
          />
        )
      })()}
    </div>
  )
}
