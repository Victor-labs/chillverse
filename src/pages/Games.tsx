// src/pages/Games.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Move, Brain, Layers, BookOpen, Grid3X3, Flag,
  Eye, Calculator, LayoutGrid, ArrowLeft, Lock, ChevronRight, Zap, Hash,
  type LucideIcon,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import {
  getPlaysToday, saveGameSession, savePlayerRank, getAllPlayerRanks,
  getGlobalSessionInfo,
} from '../lib/gameSession'
import type { GameKey } from '../lib/gameSession'
import { useAuth } from '../hooks/useAuth'
import { ProModal } from '../context/ProModal'
import type { GameRank } from './games/types'
import { getRankConfig, RankProgressBar } from './games/GameShell'
import type { GameEndPayload } from './games/types'

// ── Game imports ─────────────────────────────────────────────
import ArrowDash from './games/ArrowDash'
import PatternMemory from './games/PatternMemory'
import RapidSort from './games/RapidSort'
import TriviaClash from './games/TriviaClash'
import TacZone from './games/TacZone'
import FlagRush from './games/FlagRush'
import TwoTruthsOneFalse from './games/TwoTruthsOneFalse'
import SpeedMath from './games/SpeedMath'
import LiarsGrid from './games/LiarsGrid'
import Hangman from './games/Hangman'

// ─── Constants ───────────────────────────────────────────────
const MAX_PLAYS    = 7
const GLOBAL_LIMIT = 10



// ─── Game registry ───────────────────────────────────────────
type GameId =
  | 'arrow-dash' | 'pattern-memory' | 'rapid-sort'
  | 'trivia-clash' | 'tac-zone' | 'flag-rush'
  | 'two-truths' | 'speed-math' | 'liars-grid'
  | 'hangman'

interface GameMeta {
  id: GameId
  dbKey: GameKey
  name: string
  tagline: string
  accent: string
  unlimitedPlays?: boolean
  sessionCost?: number   // how many global sessions this game costs (default 1)
  icon: LucideIcon
}

const GAMES: GameMeta[] = [
  { id: 'arrow-dash',     dbKey: 'arrow_dash',     name: 'Arrow Dash',            tagline: 'Tap the arrow direction. Fast.',                  accent: '#4f8ef7', icon: Move         },
  { id: 'pattern-memory', dbKey: 'pattern_memory', name: 'Pattern Memory',        tagline: 'Watch the sequence, then repeat it.',             accent: '#9b6dff', icon: Brain        },
  { id: 'rapid-sort',     dbKey: 'rapid_sort',     name: 'Rapid Sort',            tagline: 'Sort items into categories fast!',                accent: '#ff4d8b', icon: Layers       },
  { id: 'trivia-clash',   dbKey: 'trivia_clash',   name: 'Trivia Clash',          tagline: 'Drop knowledge. Wreck the scoreboard.',           accent: '#ff9a3c', icon: BookOpen     },
  { id: 'tac-zone',       dbKey: 'tac_zone',       name: 'Tac Zone',              tagline: 'Three in a row. No mercy.',                      accent: '#3ecf8e', icon: Grid3X3, unlimitedPlays: true },
  { id: 'flag-rush',      dbKey: 'flag_rush',      name: 'Flag Rush',             tagline: "Flags don't lie. Can you read them?",             accent: '#4f8ef7', icon: Flag         },
  { id: 'two-truths',     dbKey: 'two_truths',     name: 'Two Truths, One False', tagline: 'Spot the lie among three claims.',                accent: '#9b6dff', icon: Eye          },
  { id: 'speed-math',     dbKey: 'speed_math',     name: 'Speed Math',            tagline: 'Solve as many equations as you can.',             accent: '#3ecf8e', icon: Calculator   },
  { id: 'liars-grid',     dbKey: 'liars_grid',     name: "Liar's Grid",           tagline: 'Find the one wrong equation. One is lying.',      accent: '#ff4f4f', icon: LayoutGrid   },
  { id: 'hangman',        dbKey: 'hangman',        name: 'Hangman',               tagline: 'Guess the word. One letter at a time.',           accent: '#ff6b00', icon: Hash, sessionCost: 3 },
]


// ─── Lobby Card ───────────────────────────────────────────────
function LobbyCard({
  game, rank, streak, playsToday, globalCount, globalLimit, onPlay,
}: {
  game: GameMeta
  rank: GameRank
  streak: number
  playsToday: number
  globalCount: number
  globalLimit: number
  onPlay: () => void
}) {
  const Icon = game.icon
  const rankCfg = getRankConfig(rank)
  const cost = game.sessionCost ?? 1
  const maxed = !game.unlimitedPlays && playsToday >= MAX_PLAYS
  const globalLimitReached = globalCount + cost > globalLimit
  const locked = maxed || globalLimitReached

  return (
    <div
      className="neu-card ripple-wrap"
      onClick={(e) => { if (!locked) { ripple(e as Parameters<typeof ripple>[0]); onPlay() } }}
      style={{ padding: 18, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}
    >
      {/* accent glow */}
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

      {/* session cost badge for Hangman */}
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
  const [globalCount, setGlobalCount] = useState(0)

  const refreshGlobalInfo = useCallback(() => {
    if (!userId) return
    const info = getGlobalSessionInfo(userId)
    setGlobalCount(info.count)
  }, [userId])

  // load player data
  useEffect(() => {
    if (!userId) return
    refreshGlobalInfo()
    Promise.all(GAMES.map(g => getPlaysToday(userId, g.dbKey))).then(counts => {
      const map: Partial<Record<GameId, number>> = {}
      GAMES.forEach((g, i) => { map[g.id] = counts[i] })
      setPlaysToday(map)
    })
    getAllPlayerRanks(userId).then(allRanks => {
      const rankMap:     Partial<Record<GameId, GameRank>> = {}
      const streakMap:   Partial<Record<GameId, number>>   = {}
      const allTimeMap:  Partial<Record<GameId, number>>   = {}
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

    // Hangman costs 3 sessions — save 3 entries
    const cost = game.sessionCost ?? 1
    for (let i = 0; i < cost; i++) {
      await saveGameSession(userId, {
        game: game.dbKey,
        score: i === 0 ? payload.score : 0,
        xpEarned: i === 0 ? payload.xpEarned : 0,
        durationSec: i === 0 ? payload.durationSec : 0,
        rank: payload.rank,
        streak: payload.streak,
        metadata: i === 0 ? (payload.detail as Record<string, unknown>) : {},
      })
    }

    await savePlayerRank(userId, game.dbKey, payload.rank, payload.streak,
      Math.max(payload.streak, allTimeStreaks[payload.gameId as GameId] ?? 0))

    refreshGlobalInfo()
  }

  const globalLimitReached = globalCount >= GLOBAL_LIMIT

  const gameProps = {
    rank: (activeGame ? (ranks[activeGame] ?? 'beginner') : 'beginner') as GameRank,
    onEnd: handleResult,
    onBack: () => setActiveGame(null),
  }

  if (activeGame === 'arrow-dash')     return <ArrowDash        {...gameProps} />
  if (activeGame === 'pattern-memory') return <PatternMemory    {...gameProps} />
  if (activeGame === 'rapid-sort')     return <RapidSort        {...gameProps} />
  if (activeGame === 'trivia-clash')   return <TriviaClash      {...gameProps} />
  if (activeGame === 'tac-zone')       return <TacZone          {...gameProps} />
  if (activeGame === 'flag-rush')      return <FlagRush         {...gameProps} />
  if (activeGame === 'two-truths')     return <TwoTruthsOneFalse {...gameProps} />
  if (activeGame === 'speed-math')     return <SpeedMath        {...gameProps} />
  if (activeGame === 'liars-grid')     return <LiarsGrid        {...gameProps} />
  if (activeGame === 'hangman')        return <Hangman          {...gameProps} />

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width:34, height:34, borderRadius:10, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.07)', boxShadow:'2px 2px 6px var(--neu-dark)', color:'var(--text-dim)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      <div style={{ maxWidth:720, margin:'0 auto', paddingBottom:48 }}>

        {/* Global limit banner */}
        {globalLimitReached && (
          <div style={{ background:'rgba(155,109,255,0.08)', border:'1px solid rgba(155,109,255,0.28)', borderRadius:16, padding:'16px 18px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Lock size={18} style={{ color:'#9b6dff', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:14, fontWeight:800, color:'#9b6dff', marginBottom:2 }}>
                  Daily session limit reached
                </p>
                <p style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>
                  You've played {GLOBAL_LIMIT} sessions today. Come back after the cooldown — or upgrade to Pro for unlimited play.
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
              {MAX_PLAYS} plays/game · {GLOBAL_LIMIT} total sessions per day
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <span className="chip">🎮 <strong>{globalCount}</strong>/{GLOBAL_LIMIT} sessions today</span>
              {results.length > 0 && <span className="chip">🏆 <strong>{Math.max(...results.map(r => r.score))}</strong> top score</span>}
            </div>
          </div>
        </section>

        {/* Game grid */}
        <section className="su d2">
          <p className="section-label">Games</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {GAMES.map(game => (
              <LobbyCard
                key={game.id}
                game={game}
                rank={(ranks[game.id] ?? 'beginner') as GameRank}
                streak={streaks[game.id] ?? 0}
                playsToday={playsToday[game.id] ?? 0}
                globalCount={globalCount}
                globalLimit={GLOBAL_LIMIT}
                onPlay={() => setActiveGame(game.id)}
              />
            ))}
          </div>
        </section>

        {/* Recent results */}
        <section className="su d3">
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
