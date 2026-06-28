// src/pages/Games.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lock, ChevronRight, Zap, Clock,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import {
  getPlaysToday, saveGameSession, savePlayerRank, getAllPlayerRanks,
  getGlobalSessionInfo, incrementGlobalSession, type GameKey,
} from '../lib/gameSession'
import { GAMES, type GameMeta, type GameId } from '../lib/games'
import { useAuth } from '../hooks/useAuth'
import { ProModal } from '../context/ProModal'
import { triggerAchievementCheck } from '../lib/triggerAchievements'
import { updateMissionProgress } from '../lib/weeklyMissions'
import type { GameRank } from './games/types'
import { getRankConfig, RankProgressBar } from './games/GameShell'
import type { GameEndPayload } from './games/types'

// ── Game imports ─────────────────────────────────────────────
import ArrowDash from './games/ArrowDash'
import PatternMemory from './games/PatternMemory'
import RapidSort from './games/RapidSort'
import TriviaClash from './games/TriviaClash'
import TacZone from './games/TacZone'
import TwoTruthsOneFalse from './games/TwoTruthsOneFalse'
import SpeedMath from './games/SpeedMath'
import LiarsGrid from './games/LiarsGrid'
import Hangman from './games/Hangman'
import CloseCall from './games/CloseCall'

// ─── Constants ───────────────────────────────────────────────
const MAX_PLAYS    = 7
const GLOBAL_LIMIT = 15
// Game catalog (id, dbKey, name, tagline, accent, icon, etc.) now lives in
// ../lib/games.ts so other pages can reference it without pulling in every
// game component below. Premium games carry an explicit sessionCost.
const STANDARD_GAMES = GAMES.filter(g => !g.sessionCost)
const PREMIUM_GAMES  = GAMES.filter(g => !!g.sessionCost)

// ─── Lobby Card ───────────────────────────────────────────────
function LobbyCard({
  game, rank, streak, playsToday, globalCount, globalLimit, dataLoaded, onPlay,
}: {
  game: GameMeta
  rank: GameRank
  streak: number
  playsToday: number
  globalCount: number
  globalLimit: number
  dataLoaded: boolean
  onPlay: () => void
}) {
  const Icon = game.icon
  const rankCfg = getRankConfig(rank)
  const cost = game.sessionCost ?? 1
  const maxed = dataLoaded && !game.unlimitedPlays && playsToday >= MAX_PLAYS
  const notEnoughSessions = dataLoaded && (globalCount + cost > globalLimit)
  const globalLimitReached = dataLoaded && (globalCount >= globalLimit)
  const locked = maxed || notEnoughSessions

  return (
    <div
      className="neu-card ripple-wrap"
      onClick={(e) => { if (!locked) { ripple(e as Parameters<typeof ripple>[0]); onPlay() } }}
      style={{ padding: 18, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${game.accent}18`, filter: 'blur(20px)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${game.accent}18`, border: `1px solid ${game.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${game.accent}20` }}>
          <Icon size={20} style={{ color: game.accent }} />
        </div>
        {locked ? (
          <Lock size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} />
        )}
      </div>

      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{game.name}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{game.tagline}</p>

      {cost > 1 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: game.accent, background: `${game.accent}12`, border: `1px solid ${game.accent}30`, borderRadius: 8, padding: '2px 7px', marginBottom: 8 }}>
          <Zap size={9} /> Costs {cost} sessions
        </div>
      )}

      <RankProgressBar rank={rank} streak={streak} streakRequired={rankCfg.streakRequired} />

      {maxed && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Daily limit reached</p>}
      {!maxed && globalLimitReached && <p style={{ fontSize: 10, color: '#9b6dff', marginTop: 6 }}>Not enough sessions left</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────
export default function Games() {
  const navigate  = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [activeGame, setActiveGame]   = useState<GameId | null>(null)
  const [showProModal, setShowProModal] = useState(false)
  const [playsToday,  setPlaysToday]  = useState<Partial<Record<GameId, number>>>({})
  const [ranks,       setRanks]       = useState<Partial<Record<GameId, GameRank>>>({})
  const [streaks,     setStreaks]     = useState<Partial<Record<GameId, number>>>({})
  const [allTimeStreaks, setAllTimeStreaks] = useState<Partial<Record<GameId, number>>>({})
  const [results,     setResults]     = useState<GameEndPayload[]>([])
  const [dataLoaded,  setDataLoaded]  = useState(false)
  const [globalCount, setGlobalCount] = useState(0)
  const [globalReset, setGlobalReset] = useState(0)
  const [sessionResetTime, setSessionResetTime] = useState('')

  useEffect(() => {
    function computeReset() {
      if (!globalReset) return
      const ms = Math.max(0, globalReset - Date.now())
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setSessionResetTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    computeReset()
    const t = setInterval(computeReset, 1000)
    return () => clearInterval(t)
  }, [globalReset])

  const refreshGlobalInfo = useCallback(() => {
    if (!userId) return
    const info = getGlobalSessionInfo(userId)
    setGlobalCount(info.count)
    setGlobalReset(info.resetAt)
  }, [userId])

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

    setResults(r => [...r, payload])
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
    incrementGlobalSession(userId, cost)

    await savePlayerRank(userId, game.dbKey, payload.rank, payload.streak,
      Math.max(payload.streak, allTimeStreaks[payload.gameId as GameId] ?? 0))

    // Fire achievement check in background
    triggerAchievementCheck(userId).catch(console.error)

    // ── Weekly mission progress ──────────────────────────────
    updateMissionProgress(userId, 'sessions_played', 1).catch(console.error)

    if (payload.score > 0) {
      updateMissionProgress(userId, 'games_won', 1).catch(console.error)
    }

    if (payload.streak >= 3) {
      updateMissionProgress(userId, 'win_streak', payload.streak).catch(console.error)
    }

    updateMissionProgress(userId, 'unique_games_played', 1).catch(console.error)

    const gameMetricMap: Partial<Record<GameId, string[]>> = {
      'hangman':        ['hangman_played'],
      'speed-math':     ['speed_math_played'],
      'pattern-memory': ['pattern_memory_played'],
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

    updateMissionProgress(userId, 'games_today', 1).catch(console.error)

    if (payload.xpEarned > 0) {
      updateMissionProgress(userId, 'xp_earned', payload.xpEarned).catch(console.error)
    }

    refreshGlobalInfo()
  }

  const globalLimitReached = globalCount >= GLOBAL_LIMIT

  const gameProps = {
    rank: (activeGame ? (ranks[activeGame] ?? 'beginner') : 'beginner') as GameRank,
    onEnd: handleResult,
    onBack: () => setActiveGame(null),
  }

  if (activeGame === 'arrow-dash')     return <ArrowDash         {...gameProps} />
  if (activeGame === 'pattern-memory') return <PatternMemory     {...gameProps} />
  if (activeGame === 'rapid-sort')     return <RapidSort         {...gameProps} />
  if (activeGame === 'trivia-clash')   return <TriviaClash       {...gameProps} />
  if (activeGame === 'tac-zone')       return <TacZone           {...gameProps} />
  if (activeGame === 'two-truths')     return <TwoTruthsOneFalse {...gameProps} />
  if (activeGame === 'speed-math')     return <SpeedMath         {...gameProps} />
  if (activeGame === 'liars-grid')     return <LiarsGrid         {...gameProps} />
  if (activeGame === 'hangman')        return <Hangman           {...gameProps} />
  if (activeGame === 'close-call')     return <CloseCall         {...gameProps} />

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width:34, height:34, borderRadius:10, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.07)', boxShadow:'2px 2px 6px var(--neu-dark)', color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      <div style={{ maxWidth:720, margin:'0 auto', paddingBottom:48 }}>

        {/* Low session warning */}
        {!globalLimitReached && dataLoaded && (GLOBAL_LIMIT - globalCount) <= 4 && (GLOBAL_LIMIT - globalCount) > 0 && (
          <div style={{ background:'rgba(245,197,66,0.08)', border:'1px solid rgba(245,197,66,0.25)', borderRadius:16, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
            <Clock size={16} style={{ color:'#f5c542', flexShrink:0 }} />
            <p style={{ fontSize:13, fontWeight:700, color:'#f5c542' }}>
              {GLOBAL_LIMIT - globalCount} session{(GLOBAL_LIMIT - globalCount) === 1 ? '' : 's'} left till session limit
            </p>
          </div>
        )}

        {/* Global limit banner */}
        {globalLimitReached && (
          <div style={{ background:'rgba(155,109,255,0.08)', border:'1px solid rgba(155,109,255,0.28)', borderRadius:16, padding:'16px 18px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <Lock size={18} style={{ color:'#9b6dff', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:14, fontWeight:800, color:'#9b6dff', marginBottom:4 }}>
                  You are out of sessions until
                </p>
                <p style={{ fontSize:22, fontWeight:900, color:'#fff', fontFamily:'monospace', letterSpacing:2 }}>
                  {sessionResetTime}
                </p>
              </div>
            </div>
            <button type="button" onClick={(e) => { ripple(e as Parameters<typeof ripple>[0]); setShowProModal(true) }} className="ripple-wrap"
              style={{ display:'inline-flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#9b6dff,#4f8ef7)', color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              <Zap size={12} /> Upgrade to Pro
            </button>
          </div>
        )}

        {/* Hero */}
        <section className="su d1">
          <div className="neu-card" style={{ padding:'22px 20px', marginBottom:0 }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginBottom:4 }}>Game Zone</h1>
            <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:12 }}>
              {GLOBAL_LIMIT} sessions per day
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <span className="chip">🎮 <strong>{globalCount}</strong>/{GLOBAL_LIMIT} sessions today</span>
              {results.length > 0 && <span className="chip">🏆 <strong>{Math.max(...results.map(r => r.score))}</strong> top score</span>}
            </div>
          </div>
        </section>

        {/* Standard games grid */}
        <section className="su d2">
          <p className="section-label">Games</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {STANDARD_GAMES.map(game => (
              <LobbyCard
                key={game.id}
                game={game}
                rank={(ranks[game.id] ?? 'beginner') as GameRank}
                streak={streaks[game.id] ?? 0}
                playsToday={playsToday[game.id] ?? 0}
                globalCount={globalCount}
                globalLimit={GLOBAL_LIMIT}
                dataLoaded={dataLoaded}
                onPlay={() => setActiveGame(game.id)}
              />
            ))}
          </div>
        </section>

        {/* Higher session games */}
        <section className="su d3">
          <p className="section-label">Higher Session Games</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, marginBottom: 14 }}>
            These games cost more sessions but offer a deeper experience.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PREMIUM_GAMES.map(game => (
              <LobbyCard
                key={game.id}
                game={game}
                rank={(ranks[game.id] ?? 'beginner') as GameRank}
                streak={streaks[game.id] ?? 0}
                playsToday={playsToday[game.id] ?? 0}
                globalCount={globalCount}
                globalLimit={GLOBAL_LIMIT}
                dataLoaded={dataLoaded}
                onPlay={() => setActiveGame(game.id)}
              />
            ))}
          </div>
        </section>

        {/* Recent results */}
        <section className="su d4">
          <p className="section-label">Recent Results</p>
          {results.length === 0 ? (
            <div className="neu-card-sm" style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              No games played yet this session. Pick one above!
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[...results].reverse().slice(0, 5).map((r, i) => {
                const g = GAMES.find(gm => gm.id === r.gameId)
                if (!g) return null
                const Icon = g.icon
                return (
                  <div key={i} className="neu-card-sm" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${g.accent}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={16} style={{ color:g.accent }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.gameName}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)' }}>+{r.xpEarned} XP · {r.correct}/{r.total} correct · {r.durationSec}s</p>
                    </div>
                    <span style={{ fontSize:15, fontWeight:800, fontFamily:'monospace', color:g.accent }}>{r.score}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>

      <ProModal
        visible={showProModal}
        onClose={() => setShowProModal(false)}
        onGoPro={() => { setShowProModal(false); navigate('/pro') }}
      />
    </div>
  )
}
