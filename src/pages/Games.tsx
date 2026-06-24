// src/pages/Games.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Move, Brain, Layers, BookOpen, Grid3X3, Flag,
  Eye, Calculator, LayoutGrid, ArrowLeft, Clock, Lock, ChevronRight,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { getPlaysToday, saveGameSession, savePlayerRank, getAllPlayerRanks } from '../lib/gameSession'
import type { GameKey } from '../lib/gameSession'
import { useAuth } from '../hooks/useAuth'
import type { GameRank } from './games/types'
import { getRankConfig, RankProgressBar } from './games/GameShell'
import type { GameEndPayload } from './games/types'

// ── Lazy game imports ────────────────────────────────────────
import ArrowDash from './games/ArrowDash'
import PatternMemory from './games/PatternMemory'
import RapidSort from './games/RapidSort'
import TriviaClash from './games/TriviaClash'
import TacZone from './games/TacZone'
import FlagRush from './games/FlagRush'
import TwoTruthsOneFalse from './games/TwoTruthsOneFalse'
import SpeedMath from './games/SpeedMath'
import LiarsGrid from './games/LiarsGrid'

// ─── Constants ───────────────────────────────────────────────
const GAME_OPEN_HOUR  = 5
const GAME_CLOSE_HOUR = 20
const MAX_PLAYS = 7   // TacZone is unlimited

function isOpen() {
  const h = new Date().getHours()
  return h >= GAME_OPEN_HOUR && h < GAME_CLOSE_HOUR
}
function minsLeft() {
  const close = new Date(); close.setHours(GAME_CLOSE_HOUR, 0, 0, 0)
  return Math.max(0, Math.floor((close.getTime() - Date.now()) / 60000))
}

// ─── Game registry ───────────────────────────────────────────
type GameId =
  | 'arrow-dash' | 'pattern-memory' | 'rapid-sort'
  | 'trivia-clash' | 'tac-zone' | 'flag-rush'
  | 'two-truths' | 'speed-math' | 'liars-grid'

interface GameMeta {
  id: GameId
  dbKey: GameKey
  name: string
  tagline: string
  accent: string
  unlimitedPlays?: boolean
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}

const GAMES: GameMeta[] = [
  { id: 'arrow-dash',      dbKey: 'arrow_dash',      name: 'Arrow Dash',             tagline: 'Tap the arrow direction. Fast.',                   accent: '#4f8ef7', icon: Move         },
  { id: 'pattern-memory',  dbKey: 'pattern_memory',  name: 'Pattern Memory',         tagline: 'Watch the sequence, then repeat it.',              accent: '#9b6dff', icon: Brain        },
  { id: 'rapid-sort',      dbKey: 'rapid_sort',      name: 'Rapid Sort',             tagline: 'Sort items into categories fast!',                 accent: '#ff4d8b', icon: Layers       },
  { id: 'trivia-clash',    dbKey: 'trivia_clash',    name: 'Trivia Clash',           tagline: 'Drop knowledge. Wreck the scoreboard.',            accent: '#ff9a3c', icon: BookOpen     },
  { id: 'tac-zone',        dbKey: 'tac_zone',        name: 'Tac Zone',               tagline: 'Three in a row. No mercy.',                       accent: '#3ecf8e', icon: Grid3X3, unlimitedPlays: true },
  { id: 'flag-rush',       dbKey: 'flag_rush',       name: 'Flag Rush',              tagline: "Flags don't lie. Can you read them?",             accent: '#4f8ef7', icon: Flag         },
  { id: 'two-truths',      dbKey: 'two_truths',      name: 'Two Truths, One False',  tagline: 'Spot the lie among three claims.',                 accent: '#9b6dff', icon: Eye          },
  { id: 'speed-math',      dbKey: 'speed_math',      name: 'Speed Math',             tagline: 'Solve as many equations as you can.',              accent: '#3ecf8e', icon: Calculator   },
  { id: 'liars-grid',      dbKey: 'liars_grid',      name: "Liar's Grid",            tagline: 'Find the one wrong equation. One is lying.',       accent: '#ff4f4f', icon: LayoutGrid   },
]

const DEFAULT_STREAK_STATE = { rank: 'beginner' as GameRank, currentStreak: 0, allTimeStreak: 0 }

// ─── Lobby Card ───────────────────────────────────────────────
function LobbyCard({
  game, rank, streak, playsToday, zoneOpen, onPlay,
}: {
  game: GameMeta
  rank: GameRank
  streak: number
  playsToday: number
  zoneOpen: boolean
  onPlay: () => void
}) {
  const Icon = game.icon
  const rankCfg = getRankConfig(rank)
  const maxed = !game.unlimitedPlays && playsToday >= MAX_PLAYS
  const locked = !zoneOpen || maxed

  return (
    <button
      type="button"
      className="neu-card ripple-wrap"
      onClick={(e) => { if (!locked) { ripple(e); onPlay() } }}
      style={{
        padding: 18, cursor: locked ? 'not-allowed' : 'pointer',
        textAlign: 'left', display: 'flex', flexDirection: 'column',
        border: 'none', opacity: locked ? 0.55 : 1,
        position: 'relative', overflow: 'hidden',
        transition: 'opacity 0.2s',
      }}
    >
      {maxed && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: 8, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>
          MAX PLAYS
        </div>
      )}

      {/* Icon */}
      <div style={{ width: 44, height: 44, borderRadius: 13, marginBottom: 10, background: `${game.accent}18`, boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 6px var(--neu-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} style={{ color: game.accent }} />
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{game.name}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{game.tagline}</p>

      {/* Rank + streak bar */}
      {!game.unlimitedPlays && (
        <div style={{ marginBottom: 8 }}>
          <RankProgressBar rank={rank} streak={streak} streakRequired={getRankConfig(rank).streakRequired} />
        </div>
      )}

      {game.unlimitedPlays && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: rankCfg.color, fontWeight: 700, background: `${rankCfg.color}18`, padding: '3px 8px', borderRadius: 10 }}>♾️ Unlimited plays</span>
        </div>
      )}

      {/* Plays counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {!game.unlimitedPlays
          ? <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{playsToday}/{MAX_PLAYS} plays today</span>
          : <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>No limit</span>
        }
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: locked ? 'var(--text-muted)' : game.accent }}>
          {locked ? <Lock size={11} /> : <ChevronRight size={12} />}
          {locked ? (maxed ? 'Limit reached' : 'Closed') : 'Play'}
        </div>
      </div>
    </button>
  )
}

// ─── Main Games Page ─────────────────────────────────────────
export default function Games() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [results, setResults] = useState<GameEndPayload[]>([])
  const [playsToday, setPlaysToday] = useState<Partial<Record<GameId, number>>>({})
  const [ranks, setRanks] = useState<Partial<Record<GameId, GameRank>>>({})
  const [streaks, setStreaks] = useState<Partial<Record<GameId, number>>>({})
  const [allTimeStreaks, setAllTimeStreaks] = useState<Partial<Record<GameId, number>>>({})
  const [zoneOpen, setZoneOpen] = useState(isOpen())
  const [minutesLeft, setMinutesLeft] = useState(minsLeft())

  useEffect(() => {
    const iv = setInterval(() => { setZoneOpen(isOpen()); setMinutesLeft(minsLeft()) }, 60000)
    return () => clearInterval(iv)
  }, [])

  // Load plays + persisted ranks from Supabase
  useEffect(() => {
    if (!session?.user) return
    const userId = session.user.id

    Promise.all(GAMES.map(g => getPlaysToday(userId, g.dbKey))).then(counts => {
      const map: Partial<Record<GameId, number>> = {}
      GAMES.forEach((g, i) => { map[g.id] = counts[i] })
      setPlaysToday(map)
    })

    getAllPlayerRanks(userId).then(rows => {
      const rankMap: Partial<Record<GameId, GameRank>> = {}
      const streakMap: Partial<Record<GameId, number>> = {}
      const allTimeMap: Partial<Record<GameId, number>> = {}
      GAMES.forEach(g => {
        const row = rows[g.dbKey]
        rankMap[g.id] = row?.rank ?? DEFAULT_STREAK_STATE.rank
        streakMap[g.id] = row?.current_streak ?? 0
        allTimeMap[g.id] = row?.all_time_streak ?? 0
      })
      setRanks(rankMap)
      setStreaks(streakMap)
      setAllTimeStreaks(allTimeMap)
    })
  }, [session])

  async function handleResult(payload: GameEndPayload) {
    const game = GAMES.find(g => g.id === payload.gameId)
    if (!game) return

    setResults(r => [...r, payload])
    setPlaysToday(p => ({ ...p, [payload.gameId]: (p[payload.gameId as GameId] ?? 0) + 1 }))
    // Optimistic local rank/streak update
    setRanks(r => ({ ...r, [payload.gameId]: payload.rank }))
    setStreaks(s => ({ ...s, [payload.gameId]: payload.streak }))
    setAllTimeStreaks(a => ({
      ...a,
      [payload.gameId]: Math.max(payload.streak, a[payload.gameId as GameId] ?? 0),
    }))

    if (!session?.user) return
    const userId = session.user.id

    await saveGameSession(userId, {
      game: game.dbKey,
      score: payload.score,
      xpEarned: payload.xpEarned,
      durationSec: payload.durationSec,
      rank: payload.rank,
      streak: payload.streak,
      metadata: payload.detail as Record<string, unknown>,
    })

    // Persist rank (no-demotion enforced inside savePlayerRank)
    await savePlayerRank(
      userId,
      game.dbKey,
      payload.rank,
      payload.streak,
      Math.max(payload.streak, allTimeStreaks[payload.gameId as GameId] ?? 0),
    )
  }

  const gameProps = {
    rank: (activeGame ? (ranks[activeGame] ?? 'beginner') : 'beginner') as GameRank,
    onEnd: handleResult,
    onBack: () => setActiveGame(null),
  }

  // Render active game
  if (activeGame === 'arrow-dash')     return <ArrowDash     {...gameProps} />
  if (activeGame === 'pattern-memory') return <PatternMemory {...gameProps} />
  if (activeGame === 'rapid-sort')     return <RapidSort     {...gameProps} />
  if (activeGame === 'trivia-clash')   return <TriviaClash   {...gameProps} />
  if (activeGame === 'tac-zone')       return <TacZone       {...gameProps} />
  if (activeGame === 'flag-rush')      return <FlagRush      {...gameProps} />
  if (activeGame === 'two-truths')     return <TwoTruthsOneFalse {...gameProps} />
  if (activeGame === 'speed-math')     return <SpeedMath     {...gameProps} />
  if (activeGame === 'liars-grid')     return <LiarsGrid     {...gameProps} />

  // Lobby
  const hoursLeft = Math.floor(minutesLeft / 60)
  const minsRemainder = minutesLeft % 60

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>

        {/* Zone closed banner */}
        {!zoneOpen && (
          <div style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>Game Zone is closed</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Opens at {GAME_OPEN_HOUR}:00 AM daily · 5 hours of gameplay available</p>
            </div>
          </div>
        )}

        {/* Closing soon */}
        {zoneOpen && minutesLeft < 60 && (
          <div style={{ background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Game Zone closes in {minutesLeft} minutes!</p>
          </div>
        )}

        {/* Hero card */}
        <section className="su d1">
          <div className="neu-card" style={{ padding: '22px 20px', marginBottom: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Game Zone</h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              Open {GAME_OPEN_HOUR}:00–{GAME_CLOSE_HOUR}:00 daily · {MAX_PLAYS} plays/game · Tac Zone unlimited
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="chip">
                <Clock size={11} />
                {zoneOpen ? `${hoursLeft}h ${minsRemainder}m left` : 'Closed now'}
              </span>
              <span className="chip">🎮 <strong>{results.length}</strong> sessions today</span>
              {results.length > 0 && (
                <span className="chip">🏆 <strong>{Math.max(...results.map(r => r.score))}</strong> top score</span>
              )}
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
                zoneOpen={zoneOpen}
                onPlay={() => setActiveGame(game.id)}
              />
            ))}
          </div>
        </section>

        {/* Recent results */}
        <section className="su d3">
          <p className="section-label">Recent Results</p>
          {results.length === 0 ? (
            <div className="neu-card-sm" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No games played yet. Pick one above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...results].reverse().slice(0, 5).map((r, i) => {
                const g = GAMES.find(gm => gm.id === r.gameId)
                if (!g) return null
                const Icon = g.icon
                return (
                  <div key={i} className="neu-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color: g.accent }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.gameName}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        +{r.xpEarned} XP · {r.correct}/{r.total} correct · {r.durationSec}s
                      </p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: g.accent }}>{r.score}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
