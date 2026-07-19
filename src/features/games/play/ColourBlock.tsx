// src/pages/games/ColourBlock.tsx
import { useState, useRef, useEffect } from 'react'
import { Blocks, Eye, Zap } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../useGamePresence'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../../shared/lib/supabase'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { ripple } from '../../../shared/lib/ripple'
import { playPraiseSound, playWrongCard } from '../sfx'

const ACCENT = '#ff5fa2'
const GAME_ID = 'colour-block' as const

// ─── Fake opponent — cosmetic only, never actually plays ────────────
// Shown purely so the round feels like a live match. No difficulty
// logic, no simulated moves, nothing that could read as "rigged" —
// it's just a name + a generic default icon sitting there.
const OPPONENT_NAMES = [
  'Michael', 'Jessica', 'David', 'Ashley', 'Christopher', 'Amanda', 'Matthew', 'Sarah',
  'Joshua', 'Emily', 'Daniel', 'Samantha', 'Andrew', 'Brittany', 'Joseph', 'Elizabeth',
  'Ryan', 'Taylor', 'Brandon', 'Megan', 'Justin', 'Lauren', 'William', 'Rachel',
  'Jordan', 'Hannah', 'Tyler', 'Kayla', 'Alexander', 'Victoria', 'Nicholas', 'Jasmine',
  'Ethan', 'Olivia', 'Noah', 'Sophia', 'Jacob', 'Madison', 'Logan', 'Chloe',
  'Mason', 'Ava', 'Aiden', 'Isabella', 'Caleb', 'Mia', 'Dylan', 'Grace',
]
const OPPONENT_INITIALS = ['B.', 'K.', 'M.', 'R.', 'T.', 'J.', 'S.', 'H.', 'W.', 'L.', 'C.', 'D.', 'P.', 'N.', 'G.', 'F.']

function randomOpponent(): string {
  const name = OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)]
  const initial = OPPONENT_INITIALS[Math.floor(Math.random() * OPPONENT_INITIALS.length)]
  return `${name} ${initial}`
}

// ─── Mini avatar (letter/icon fallback, image if a URL is equipped) ──
function VersusAvatar({ label, imgUrl, generic }: { label: string; imgUrl?: string | null; generic?: boolean }) {
  const colors = ['#ff6b6b', '#4f8ef7', '#9b6dff', '#3ecf8e', '#f5c542', '#ff4d8b', 'var(--accent2)']
  const color = colors[(label.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12, background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
      fontWeight: 800, fontSize: 15, boxShadow: 'var(--elev-raise-sm)',
    }}>
      {imgUrl && imgUrl.startsWith('http')
        ? <img src={imgUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : generic
          ? <Blocks size={17} />
          : label.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Colour pool — enough distinct colours for the largest grid ──────
const COLOR_POOL = [
  '#ff4f4f', '#4f8ef7', '#3ecf8e', '#f5c542', '#9b6dff', 'var(--accent2)', '#00e5ff', '#ff4d8b',
  '#7CFF6B', 'var(--accent)', '#c084fc', '#38bdf8', '#facc15', '#fb7185', '#34d399', '#a78bfa',
]

interface Tile { id: number; color: string; safe: boolean }

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateRound(tileCount: number): Tile[] {
  const colors = shuffleArr(COLOR_POOL).slice(0, tileCount)
  const safeIdx = Math.floor(Math.random() * tileCount)
  return colors.map((c, i) => ({ id: i, color: c, safe: i === safeIdx }))
}

// ─── Rank-based starting difficulty ───────────────────────────────
interface CBConfig { baseTiles: number; basePickSec: number; streakRequired: number }
const RANK_CONFIG: Record<GameRank, CBConfig> = {
  beginner:     { baseTiles: 6,  basePickSec: 6,   streakRequired: 5 },
  intermediate: { baseTiles: 8,  basePickSec: 5.5, streakRequired: 5 },
  advanced:     { baseTiles: 10, basePickSec: 5,   streakRequired: 5 },
  master:       { baseTiles: 12, basePickSec: 4.5, streakRequired: 0 },
}

const WIN_ROUND_CAP = 12
const PRAISE = ['Safe!', 'Sharp memory!', 'Locked in!', 'Nice eye!', 'Clean pick!']

function tilesForRound(base: number, round: number) {
  return Math.min(16, base + Math.floor((round - 1) / 2))
}
function pickSecForRound(base: number, round: number) {
  return Math.max(1.8, base - (round - 1) * 0.25)
}
function gridCols(count: number) {
  return Math.min(4, Math.max(3, Math.ceil(Math.sqrt(count))))
}
function xpForRounds(roundsCleared: number, won: boolean): number {
  if (won) return 90
  if (roundsCleared >= 9) return 70
  if (roundsCleared >= 6) return 40
  if (roundsCleared >= 3) return 20
  if (roundsCleared >= 1) return 10
  return 0
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function ColourBlock({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 3 }: Props) {
  const [phase, setPhase] = useState<'info' | 'memorize' | 'shuffle' | 'pick' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)
  const { session } = useAuth()

  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [myName, setMyName] = useState<string>('You')
  const [opponent, setOpponent] = useState('')

  const [tiles, setTiles] = useState<Tile[]>([])
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [countdownNum, setCountdownNum] = useState<number | null>(null)
  const [pickSecLeft, setPickSecLeft] = useState(0)
  const [wrongId, setWrongId] = useState<number | null>(null)
  const [banner, setBanner] = useState('')
  const [praise, setPraise] = useState<{ text: string; key: number } | null>(null)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)

  const roundRef = useRef(1)
  const scoreRef = useRef(0)
  const gameOverRef = useRef(false)
  const lockedRef = useRef(false)
  const startRef = useRef(Date.now())
  const pickTotalRef = useRef(6)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getCfg() { return RANK_CONFIG[rankState.rank] }

  function clearTimers() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (pickTimerRef.current) clearInterval(pickTimerRef.current)
    if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current)
    if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current)
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
  }

  // Fetch the player's own equipped avatar / display name for the versus bar
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    supabase.from('profiles').select('username, display_name, equipped_avatar').eq('id', uid).single()
      .then(({ data }) => {
        if (data?.equipped_avatar) setMyAvatar(data.equipped_avatar)
        if (data?.display_name || data?.username) setMyName(data.display_name || data.username)
      }, () => {})
  }, [session?.user?.id])

  function beginRound(r: number) {
    const cfg = getCfg()
    const count = tilesForRound(cfg.baseTiles, r)
    setTiles(generateRound(count))
    setWrongId(null)
    setPraise(null)
    setPhase('memorize')
    setBanner('Memorize the SAFE tile')
    lockedRef.current = true

    let cd = 5
    setCountdownNum(cd)
    countdownRef.current = setInterval(() => {
      cd--
      if (cd <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdownNum(null)
        doShuffle(cfg, r)
      } else {
        setCountdownNum(cd)
      }
    }, 800)
  }

  function doShuffle(cfg: CBConfig, r: number) {
    setPhase('shuffle')
    setBanner('Shuffling…')

    const passes = 3
    let done = 0
    function pass() {
      if (gameOverRef.current) return
      setTiles(prev => shuffleArr(prev))
      done++
      if (done < passes) {
        shuffleTimeoutRef.current = setTimeout(pass, 420)
      } else {
        shuffleTimeoutRef.current = setTimeout(() => startPick(cfg, r), 420)
      }
    }
    // Small delay before the first pass so the "flip to hidden" is visible
    // before anything actually moves.
    shuffleTimeoutRef.current = setTimeout(pass, 350)
  }

  function startPick(cfg: CBConfig, r: number) {
    const pickSec = pickSecForRound(cfg.basePickSec, r)
    pickTotalRef.current = pickSec
    setPickSecLeft(pickSec)
    setPhase('pick')
    setBanner('Tap the safe tile!')
    lockedRef.current = false

    let elapsed = 0
    pickTimerRef.current = setInterval(() => {
      elapsed += 0.1
      const left = Math.max(0, pickSec - elapsed)
      setPickSecLeft(left)
      if (left <= 0) {
        if (pickTimerRef.current) clearInterval(pickTimerRef.current)
        if (!gameOverRef.current) failRound('Too slow!')
      }
    }, 100)
  }

  function start() {
    gameOverRef.current = false
    roundRef.current = 1
    scoreRef.current = 0
    startRef.current = Date.now()
    setRound(1)
    setScore(0)
    setPromoted(null)
    setResult(null)
    setOpponent(randomOpponent())
    beginRound(1)
  }

  function failRound(msg: string) {
    if (gameOverRef.current) return
    gameOverRef.current = true
    lockedRef.current = true
    clearTimers()
    playWrongCard()
    setBanner(msg)
    wrongTimeoutRef.current = setTimeout(() => endGame(false), 900)
  }

  function endGame(win: boolean) {
    clearTimers()
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const roundsCleared = win ? WIN_ROUND_CAP : roundRef.current - 1
    const xp = xpForRounds(roundsCleared, win)

    const finishDelay = win ? 700 : 100
    setTimeout(() => {
      const payload: GameEndPayload = {
        gameId: GAME_ID as any,
        gameName: 'Colour Block',
        rank: rankState.rank,
        score: scoreRef.current,
        xpEarned: xp,
        durationSec: dur,
        streak: rankState.bestStreak,
        correct: roundsCleared,
        total: WIN_ROUND_CAP,
        detail: { 'Rounds Cleared': `${roundsCleared}/${WIN_ROUND_CAP}`, 'Opponent': opponent },
      }
      if (win || roundsCleared >= 1) {
        const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
        if (promo) setPromoted(promo)
      } else {
        onWrong()
      }
      setResult(payload)
      setPhase('result')
      onEnd(payload)
    }, finishDelay)
  }

  function onTileClick(id: number) {
    if (lockedRef.current || gameOverRef.current || phase !== 'pick') return
    const tile = tiles.find(t => t.id === id)
    if (!tile) return

    if (!tile.safe) {
      lockedRef.current = true
      if (pickTimerRef.current) clearInterval(pickTimerRef.current)
      setWrongId(id)
      failRound('Wrong tile!')
      return
    }

    // Correct pick
    lockedRef.current = true
    if (pickTimerRef.current) clearInterval(pickTimerRef.current)
    const timeBonus = Math.round((pickSecLeft / pickTotalRef.current) * 50)
    scoreRef.current += 100 + timeBonus
    setScore(scoreRef.current)

    const praiseText = PRAISE[Math.floor(Math.random() * PRAISE.length)]
    playPraiseSound(praiseText)
    setPraise({ text: praiseText, key: Date.now() })

    const nextRound = roundRef.current + 1
    roundRef.current = nextRound
    setRound(nextRound)

    if (nextRound > WIN_ROUND_CAP) {
      gameOverRef.current = true
      advanceTimeoutRef.current = setTimeout(() => endGame(true), 500)
    } else {
      advanceTimeoutRef.current = setTimeout(() => beginRound(nextRound), 850)
    }
  }

  useEffect(() => () => clearTimers(), [])

  const cfg = getCfg()
  const rankCfg = getRankConfig(rankState.rank)
  const pickPct = pickTotalRef.current > 0 ? (pickSecLeft / pickTotalRef.current) * 100 : 0
  const cols = gridCols(tiles.length || cfg.baseTiles)

  const rules = [
    { icon: '👁', text: 'Memorize which tile is marked SAFE — you get 5 seconds' },
    { icon: '🔀', text: 'The blocks shuffle — you won\'t see where they land' },
    { icon: '🎯', text: 'Tap the tile you believe is still safe' },
    { icon: '❌', text: 'One wrong tile ends the match instantly' },
    { icon: '⚡', text: 'Every round gets bigger and faster' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Colour Block"
      tagline="Memorize the safe tile, survive the shuffle, don't get caught out."
      accent={ACCENT}
      icon={<Blocks size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg.streakRequired}
      onStart={start}
      onClose={onBack}
      extraContent={
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            <VersusAvatar label={myName} imgUrl={myAvatar} /> You
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800 }}>VS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            {opponent || '…'} <VersusAvatar label={opponent || '?'} generic />
          </div>
        </div>
      }
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={promoted} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(90px)', opacity: 0.08, background: ACCENT, top: '2%', right: '-8%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Colour Block"
        accent={ACCENT}
        icon={<Blocks size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Round" value={round} accent={ACCENT} />
            <StatChip label="Score" value={score} />
          </div>
        }
      />

      {/* Versus strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <VersusAvatar label={myName} imgUrl={myAvatar} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>You</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>Round {round}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>VS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{opponent}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>Round {round}</div>
          </div>
          <VersusAvatar label={opponent} generic />
        </div>
      </div>

      {phase === 'pick' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px 0' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {opponent} is choosing<span className="cb-dots" />
          </span>
        </div>
      )}

      {/* Phase banner */}
      <div style={{ padding: '10px 16px 0', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: phase === 'memorize' ? 'var(--gold)' : ACCENT,
          background: phase === 'memorize' ? 'rgba(245,197,66,0.1)' : `${ACCENT}14`,
          border: `1px solid ${phase === 'memorize' ? 'rgba(245,197,66,0.3)' : ACCENT + '30'}`,
          borderRadius: 20, padding: '5px 14px',
        }}>
          {phase === 'memorize' ? <Eye size={12} /> : <Zap size={12} />} {banner}
        </span>
      </div>

      {/* Pick timer */}
      {phase === 'pick' && (
        <div style={{ padding: '10px 16px 4px' }}>
          <TimerBar pct={pickPct} accent={ACCENT} urgent />
        </div>
      )}

      {/* Praise toast */}
      {praise && (
        <div key={praise.key} style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 22, fontWeight: 900, color: ACCENT, textShadow: `0 0 18px ${ACCENT}aa`,
          zIndex: 50, animation: 'popUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both', pointerEvents: 'none',
        }}>
          {praise.text}
        </div>
      )}

      {/* Tile grid */}
      <div style={{
        flex: 1, display: 'grid', gap: 10, padding: '10px 18px 24px',
        gridTemplateColumns: `repeat(${cols}, minmax(64px, 96px))`,
        justifyContent: 'center', alignContent: 'center', perspective: 700,
      }}>
        {tiles.map(tile => {
          const isWrong = wrongId === tile.id
          const showSafeBadge = phase === 'memorize' && tile.safe
          const hidden = phase === 'shuffle'
          return (
            <button
              key={tile.id}
              type="button"
              disabled={phase !== 'pick'}
              onClick={(e) => { if (phase === 'pick') { ripple(e); onTileClick(tile.id) } }}
              style={{
                aspectRatio: '1 / 1', border: 'none', background: 'transparent', padding: 0,
                cursor: phase === 'pick' ? 'pointer' : 'default',
                transformStyle: 'preserve-3d', position: 'relative',
                animation: isWrong ? 'cb-shake 0.4s ease' : undefined,
              }}
            >
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                transform: hidden ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front face — the colour */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14, backfaceVisibility: 'hidden',
                  background: tile.color,
                  boxShadow: isWrong
                    ? '0 0 0 3px var(--red), 0 0 20px rgba(255,79,79,0.55)'
                    : showSafeBadge
                      ? `0 0 0 3px #fff, 0 0 18px ${tile.color}aa`
                      : '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {showSafeBadge && (
                    <span style={{
                      fontSize: 10, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.35)',
                      borderRadius: 8, padding: '3px 7px', letterSpacing: '0.4px',
                    }}>
                      SAFE
                    </span>
                  )}
                </div>
                {/* Back face — hidden during shuffle */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14, backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'var(--surface2)',
                  boxShadow: 'var(--elev-inset)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>✦</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Memorize countdown overlay */}
      {countdownNum !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>Memorize the SAFE tile!</p>
          <span style={{ fontSize: 64, fontWeight: 900, color: ACCENT, textShadow: `0 0 30px ${ACCENT}88` }}>{countdownNum}</span>
        </div>
      )}

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('pick')} />}

      <style>{`
        @keyframes cb-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .cb-dots::after {
          content: '...';
          animation: cb-dots 1.2s ease-in-out infinite;
        }
        @keyframes cb-dots {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
