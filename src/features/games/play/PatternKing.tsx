// src/pages/games/PatternKing.tsx
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Eye, Zap, Flag } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { ripple } from '../../../shared/lib/ripple'
import { playPraiseSound, playWrongCard } from '../sfx'

const ACCENT = '#00e5ff'
const GAME_ID = 'pattern-king' as const

// ─── Symbol pool ───────────────────────────────────────────────
interface PatternDef { sym: string; label: string; color: string; glow: string }

const PATTERNS: PatternDef[] = [
  { sym: '🔮', label: 'Crystal', color: '#9b6dff', glow: 'rgba(155,109,255,0.55)' },
  { sym: '⚡', label: 'Bolt',    color: '#f5c542', glow: 'rgba(245,197,66,0.55)'  },
  { sym: '🌊', label: 'Wave',    color: '#00e5ff', glow: 'rgba(0,229,255,0.55)'  },
  { sym: '🔥', label: 'Flame',   color: '#ff9a3c', glow: 'rgba(255,154,60,0.55)' },
  { sym: '⭐', label: 'Star',    color: '#ff4ecd', glow: 'rgba(255,78,205,0.55)' },
  { sym: '🍀', label: 'Clover',  color: '#3ecf8e', glow: 'rgba(62,207,142,0.55)' },
  { sym: '💎', label: 'Diamond', color: '#4f8ef7', glow: 'rgba(79,142,247,0.55)' },
  { sym: '🌸', label: 'Blossom', color: '#ff4d8b', glow: 'rgba(255,77,139,0.55)' },
]

const PRAISE = ['Sharp eye!', 'Locked in!', 'Pattern King!', 'Flawless!', 'Unstoppable!', 'Nailed it!']

// ─── Rank-based difficulty (no manual difficulty pick — beginner = easy mode) ───
interface RankPKConfig {
  cols: number
  rows: number
  peekMs: number
  timeSec: number
  requiredTypes: number
  shuffles: number
  shuffleIntervalMs: number
  streakRequired: number
}

const RANK_CONFIG: Record<GameRank, RankPKConfig> = {
  beginner:     { cols: 4, rows: 3, peekMs: 5000, timeSec: 90, requiredTypes: 2, shuffles: 1, shuffleIntervalMs: 20000, streakRequired: 5 },
  intermediate: { cols: 4, rows: 4, peekMs: 4500, timeSec: 80, requiredTypes: 2, shuffles: 2, shuffleIntervalMs: 16000, streakRequired: 5 },
  advanced:     { cols: 5, rows: 4, peekMs: 4000, timeSec: 70, requiredTypes: 3, shuffles: 2, shuffleIntervalMs: 13000, streakRequired: 5 },
  master:       { cols: 6, rows: 4, peekMs: 3000, timeSec: 60, requiredTypes: 3, shuffles: 3, shuffleIntervalMs: 9000,  streakRequired: 0 },
}

// ─── Flat XP tiers per round (session-accumulated, capped like other games) ───
// Win, but used up most of the clock        → wasted time   = 70 XP
// Win, finished with plenty of time to spare → no waste      = 90 XP
// Lost, but found half or more of patterns   → solid attempt = 35 XP
// Lost early / found less than half          → rough attempt = 15 XP
const XP_WIN_EFFICIENT = 90
const XP_WIN_WASTED     = 70
const XP_LOSE_PARTIAL   = 35
const XP_LOSE_WEAK      = 15
const WASTE_THRESHOLD   = 0.65 // used more than 65% of allotted time = "wasted time"
const SESSION_XP_CAP    = 300  // total XP cap per session, same ceiling used across the app

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface PKCard { id: number; pattern: PatternDef; flipped: boolean; matched: boolean; counted: boolean }

function buildDeck(cfg: RankPKConfig): { cards: PKCard[]; required: PatternDef[]; need: Record<string, number> } {
  const totalCards = cfg.cols * cfg.rows
  const patternCount = Math.min(PATTERNS.length, 4)
  const required = shuffleArr(PATTERNS).slice(0, cfg.requiredTypes)
  const extra = shuffleArr(PATTERNS.filter(p => !required.includes(p))).slice(0, patternCount - cfg.requiredTypes)
  const all = [...required, ...extra]

  const deck: PatternDef[] = []
  let remaining = totalCards
  all.forEach((p, i) => {
    let share = i < all.length - 1
      ? Math.max(2, Math.round(remaining / (all.length - i) / 2) * 2)
      : remaining
    share = Math.min(share, remaining)
    if (share % 2 !== 0) share += 1
    share = Math.max(2, Math.min(share, 6))
    for (let j = 0; j < share; j++) deck.push(p)
    remaining -= share
  })
  while (deck.length < totalCards) deck.push(all[0])
  deck.splice(totalCards)

  const cards: PKCard[] = shuffleArr(deck).map((p, i) => ({ id: i, pattern: p, flipped: true, matched: false, counted: false }))
  const need: Record<string, number> = {}
  required.forEach(p => { need[p.sym] = deck.filter(c => c.sym === p.sym).length })

  return { cards, required, need }
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function PatternKing({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 1 }: Props) {
  const [phase, setPhase] = useState<'info' | 'peek' | 'play' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const [cards, setCards] = useState<PKCard[]>([])
  const [required, setRequired] = useState<PatternDef[]>([])
  const [done, setDone] = useState<Set<string>>(new Set())
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [countdownNum, setCountdownNum] = useState<number | null>(null)
  const [peekSecLeft, setPeekSecLeft] = useState(0)
  const [banner, setBanner] = useState('')
  const [wrongId, setWrongId] = useState<number | null>(null)
  const [shuffling, setShuffling] = useState(false)
  const [praise, setPraise] = useState<{ text: string; key: number } | null>(null)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<GameEndPayload | null>(null)
  const [sessionXP, setSessionXP] = useState(0)

  const needRef = useRef<Record<string, number>>({})
  const doneCountRef = useRef<Record<string, number>>({})
  const scoreRef = useRef(0)
  const matchedTypesRef = useRef(0)
  const startRef = useRef(Date.now())
  const totalTimeRef = useRef(60)
  const lockedRef = useRef(false)
  const gameOverRef = useRef(false)

  // ─── Session-level accumulators (persist across rounds until End Session / loss) ───
  const sessionXpRef = useRef(0)
  const sessionStartRef = useRef(Date.now())
  const roundsWonRef = useRef(0)
  const matchedAggRef = useRef(0)   // total patterns matched across all rounds this session
  const requiredAggRef = useRef(0)  // total patterns required across all rounds this session

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const peekTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shuffleCountRef = useRef(0)

  function getCfg(rank?: GameRank) { return RANK_CONFIG[rank ?? rankState.rank] }

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (peekTimerRef.current) clearInterval(peekTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
    if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current)
    if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current)
  }

  function scheduleShuffle(cfg: RankPKConfig) {
    if (shuffleCountRef.current >= cfg.shuffles) return
    shuffleTimeoutRef.current = setTimeout(() => {
      if (gameOverRef.current) return
      doShuffle()
      shuffleCountRef.current++
      scheduleShuffle(cfg)
    }, cfg.shuffleIntervalMs)
  }

  function doShuffle() {
    if (lockedRef.current || gameOverRef.current) return
    lockedRef.current = true
    setShuffling(true)
    setBanner('Cards are shuffling…')

    setCards(prev => prev.map(c => c.matched ? c : { ...c, flipped: true }))

    setTimeout(() => {
      setCards(prev => {
        const unmatched = shuffleArr(prev.filter(c => !c.matched))
        let ui = 0
        return prev.map(c => c.matched ? c : unmatched[ui++])
      })

      setTimeout(() => {
        setShuffling(false)
        setCards(prev => prev.map(c => (c.matched || c.counted) ? c : { ...c, flipped: false }))
        setBanner('Find the required patterns!')
        lockedRef.current = false
      }, 650)
    }, 750)
  }

  // Called once, when a fresh session starts (from the pre-game modal, or "Play Again" after the result screen)
  function beginSession() {
    sessionXpRef.current = 0
    sessionStartRef.current = Date.now()
    roundsWonRef.current = 0
    matchedAggRef.current = 0
    requiredAggRef.current = 0
    scoreRef.current = 0
    setScore(0)
    setSessionXP(0)
    startRound()
  }

  // Called for every round within the session (round 1, and every round after a win) —
  // deliberately does NOT touch score/XP session totals so they keep accumulating.
  function startRound(rankOverride?: GameRank) {
    const cfg = getCfg(rankOverride)
    const { cards: deck, required: req, need } = buildDeck(cfg)
    needRef.current = need
    doneCountRef.current = {}
    req.forEach(p => { doneCountRef.current[p.sym] = 0 })
    matchedTypesRef.current = 0
    shuffleCountRef.current = 0
    gameOverRef.current = false
    lockedRef.current = true
    startRef.current = Date.now()
    totalTimeRef.current = cfg.timeSec

    setCards(deck)
    setRequired(req)
    setDone(new Set())
    setTimeLeft(cfg.timeSec)
    setWrongId(null)
    setPromoted(null)
    setResult(null)
    setPraise(null)
    setPhase('peek')
    setBanner('Memorize the cards!')

    let cd = 3
    setCountdownNum(cd)
    countdownRef.current = setInterval(() => {
      cd--
      if (cd <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdownNum(null)
        startPeekTimer(cfg)
      } else {
        setCountdownNum(cd)
      }
    }, 800)
  }

  function startPeekTimer(cfg: RankPKConfig) {
    let left = Math.ceil(cfg.peekMs / 1000)
    setPeekSecLeft(left)
    peekTimerRef.current = setInterval(() => {
      left--
      setPeekSecLeft(left)
      if (left <= 0) {
        if (peekTimerRef.current) clearInterval(peekTimerRef.current)
        startPlay(cfg)
      }
    }, 1000)
  }

  function startPlay(cfg: RankPKConfig) {
    setPhase('play')
    setBanner('Find the required patterns!')
    setCards(prev => prev.map(c => c.matched ? c : { ...c, flipped: false }))
    lockedRef.current = false

    timerRef.current = setInterval(() => {
      if (gameOverRef.current) return
      setTimeLeft(t => {
        if (t <= 1) { finishRound(false); return 0 }
        return t - 1
      })
    }, 1000)

    if (cfg.shuffles > 0) scheduleShuffle(cfg)
  }

  // Called whenever a round concludes — a win keeps the session going (straight into a
  // fresh, harder round, no modal); a loss ends the whole session and shows the result screen.
  function finishRound(win: boolean) {
    if (gameOverRef.current) return
    gameOverRef.current = true
    lockedRef.current = true
    clearTimers()

    const requiredCount = required.length
    const matchedCount = matchedTypesRef.current
    const timeUsedRatio = 1 - (timeLeft / totalTimeRef.current)

    let roundXp: number
    if (win) {
      roundXp = timeUsedRatio <= WASTE_THRESHOLD ? XP_WIN_EFFICIENT : XP_WIN_WASTED
    } else {
      roundXp = requiredCount > 0 && matchedCount / requiredCount >= 0.5 ? XP_LOSE_PARTIAL : XP_LOSE_WEAK
    }

    sessionXpRef.current = Math.min(sessionXpRef.current + roundXp, SESSION_XP_CAP)
    setSessionXP(sessionXpRef.current)
    matchedAggRef.current += matchedCount
    requiredAggRef.current += requiredCount

    const finishDelay = win ? 700 : 350
    setTimeout(() => {
      if (win) {
        roundsWonRef.current += 1
        const { promoted: promo } = onCorrect(getRankConfig(rankState.rank).streakRequired)
        if (promo) setPromoted(promo)
        startRound(promo ?? undefined) // straight into the next round — harder immediately if just promoted
      } else {
        onWrong()
        finalizeSession()
      }
    }, finishDelay)
  }

  // Ends the session — either from a loss, or the player tapping "End Session" —
  // submits everything accumulated across every round played this session.
  function finalizeSession() {
    clearTimers()
    gameOverRef.current = true
    lockedRef.current = true
    const dur = Math.floor((Date.now() - sessionStartRef.current) / 1000)
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Pattern King',
      rank: rankState.rank,
      score: scoreRef.current,
      xpEarned: sessionXpRef.current,
      durationSec: dur,
      streak: rankState.bestStreak,
      correct: matchedAggRef.current,
      total: requiredAggRef.current,
      detail: { 'Rounds Won': roundsWonRef.current },
    }
    setResult(payload)
    setPhase('result')
    onEnd(payload)
  }

  function handleEndSession() {
    if (phase !== 'play' && phase !== 'peek') return
    if (scoreRef.current <= 0 && roundsWonRef.current <= 0) return
    finalizeSession()
  }

  function onCardClick(id: number) {
    if (lockedRef.current || gameOverRef.current || phase !== 'play') return
    const card = cards.find(c => c.id === id)
    if (!card || card.matched || card.flipped || card.counted) return

    setCards(prev => prev.map(c => c.id === id ? { ...c, flipped: true } : c))

    const sym = card.pattern.sym
    const isRequired = required.some(p => p.sym === sym)
    const alreadyDone = done.has(sym)

    if (!isRequired || alreadyDone) {
      // Wrong tap — instant round end
      playWrongCard()
      lockedRef.current = true
      setWrongId(id)
      setBanner('Wrong card!')
      wrongTimeoutRef.current = setTimeout(() => {
        setWrongId(null)
        finishRound(false)
      }, 900)
      return
    }

    // Correct card — lock it in immediately so it can never be re-tapped or re-counted
    setCards(prev => prev.map(c => c.id === id ? { ...c, counted: true } : c))
    doneCountRef.current[sym] = (doneCountRef.current[sym] ?? 0) + 1
    scoreRef.current += 50
    setScore(scoreRef.current)

    if (doneCountRef.current[sym] >= (needRef.current[sym] ?? 0)) {
      // Pattern type complete
      setCards(prev => prev.map(c => c.pattern.sym === sym ? { ...c, matched: true, flipped: true, counted: true } : c))
      setDone(prev => new Set(prev).add(sym))
      scoreRef.current += 300
      matchedTypesRef.current += 1
      setScore(scoreRef.current)
      const roundWon = matchedTypesRef.current >= required.length
      const praiseText = roundWon ? 'Level Up! ⚡' : PRAISE[Math.floor(Math.random() * PRAISE.length)]
      playPraiseSound(praiseText)
      setPraise({ text: praiseText, key: Date.now() })
      setTimeout(() => setPraise(null), 1300)

      if (roundWon) {
        setTimeout(() => finishRound(true), 600)
      }
    }
    // Card stays flipped face-up and locked (counted) until its pattern is fully found —
    // no more auto flip-back, so a single correct card can never be tapped twice.
  }

  useEffect(() => () => clearTimers(), [])

  const cfg = getCfg()
  const rankCfg = getRankConfig(rankState.rank)
  const timePct = (timeLeft / cfg.timeSec) * 100

  const rules = [
    { icon: '👁', text: `Memorize the grid — cards show face up for ${Math.ceil(cfg.peekMs / 1000)}s` },
    { icon: '🎯', text: `Find all ${cfg.requiredTypes} required patterns hidden in the grid` },
    { icon: '⚡', text: `Cards reshuffle ${cfg.shuffles}× mid-round — stay sharp` },
    { icon: '❌', text: 'One wrong tap ends the round instantly' },
    { icon: '⏱', text: `Clear the board before the ${cfg.timeSec}s timer runs out` },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Pattern King"
      tagline="Memorize the grid, then clear every required pattern before time runs out."
      accent={ACCENT}
      icon={<Sparkles size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg.streakRequired}
      onStart={beginSession}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); beginSession() }} onBack={onBack} promoted={promoted} sessionsLeft={sessionsLeft} sessionCost={sessionCost} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(90px)', opacity: 0.08, background: ACCENT, top: '2%', right: '-8%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Pattern King"
        accent={ACCENT}
        icon={<Sparkles size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraLeft={
          (scoreRef.current > 0 || roundsWonRef.current > 0) ? (
            <button
              type="button"
              onClick={handleEndSession}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 32, borderRadius: 9, padding: '0 10px',
                background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Flag size={12} /> End
            </button>
          ) : undefined
        }
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
            <StatChip label="XP" value={sessionXP} accent="var(--gold)" />
            <StatChip label="Time" value={`${phase === 'peek' ? peekSecLeft : timeLeft}s`} />
          </div>
        }
      />

      {/* Phase banner */}
      <div style={{ padding: '10px 16px 0', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: phase === 'peek' ? 'var(--gold)' : ACCENT,
          background: phase === 'peek' ? 'rgba(245,197,66,0.1)' : `${ACCENT}14`,
          border: `1px solid ${phase === 'peek' ? 'rgba(245,197,66,0.3)' : ACCENT + '30'}`,
          borderRadius: 20, padding: '5px 14px',
        }}>
          {phase === 'peek' ? <Eye size={12} /> : <Zap size={12} />} {banner}
        </span>
      </div>

      {/* Required pattern chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: '12px 16px 4px' }}>
        {required.map(p => {
          const isDone = done.has(p.sym)
          const matchedSoFar = doneCountRef.current[p.sym] ?? 0
          const need = needRef.current[p.sym] ?? 0
          return (
            <div key={p.sym} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: isDone ? `${p.color}18` : 'var(--surface2)',
              border: `1px solid ${isDone ? p.color + '55' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 20, padding: '5px 11px',
              fontSize: 12, fontWeight: 700, color: isDone ? p.color : 'var(--text-dim)',
              boxShadow: isDone ? `0 0 12px ${p.color}33` : '2px 2px 6px var(--neu-dark)',
              transition: 'all 0.25s',
            }}>
              <span style={{ fontSize: 15 }}>{p.sym}</span>
              <span>{isDone ? '✓' : `${matchedSoFar}/${need}`}</span>
            </div>
          )
        })}
      </div>

      {/* Timer bar (play phase only) */}
      {phase === 'play' && (
        <div style={{ padding: '6px 16px 8px' }}>
          <TimerBar pct={timePct} accent={ACCENT} urgent />
        </div>
      )}

      {/* Praise toast */}
      {praise && (
        <div key={praise.key} style={{
          position: 'absolute', top: '34%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 22, fontWeight: 900, color: ACCENT, textShadow: `0 0 18px ${ACCENT}aa`,
          zIndex: 50, animation: 'popUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both', pointerEvents: 'none',
        }}>
          {praise.text}
        </div>
      )}

      {/* Card grid */}
      <div style={{
        flex: 1, display: 'grid', gap: 8, padding: '8px 14px 18px',
        gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
        alignContent: 'center', perspective: 700,
      }}>
        {cards.map(card => {
          const isWrong = wrongId === card.id
          return (
            <button
              key={card.id}
              type="button"
              disabled={card.matched}
              onClick={(e) => { if (!card.matched) { ripple(e); onCardClick(card.id) } }}
              style={{
                aspectRatio: '1 / 1', border: 'none', background: 'transparent',
                cursor: card.matched ? 'default' : 'pointer', padding: 0,
                transformStyle: 'preserve-3d', position: 'relative',
                animation: isWrong ? 'pk-shake 0.4s ease' : undefined,
              }}
            >
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 12,
                transformStyle: 'preserve-3d',
                transition: shuffling ? 'opacity 0.25s' : 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                transform: card.flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                opacity: shuffling ? 0.4 : 1,
              }}>
                {/* Back face */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 12,
                  backfaceVisibility: 'hidden',
                  background: 'var(--surface)',
                  boxShadow: isWrong
                    ? '0 0 0 2px var(--red), 0 0 16px rgba(255,79,79,0.5)'
                    : '4px 4px 10px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>✦</span>
                </div>
                {/* Front face */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 12,
                  backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                  background: card.matched ? `${card.pattern.color}1c` : 'var(--surface2)',
                  border: `1.5px solid ${card.matched ? card.pattern.color + '70' : card.pattern.color + '35'}`,
                  boxShadow: card.matched ? `0 0 16px ${card.pattern.glow}` : 'inset 1px 1px 4px var(--neu-dark)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 20 }}>{card.pattern.sym}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom depleting bar */}
      {phase === 'play' && (
        <div style={{ height: 6, background: 'var(--surface2)', margin: '0 0 8px' }}>
          <div style={{ height: '100%', background: ACCENT, width: `${timePct}%`, transition: 'width 1s linear' }} />
        </div>
      )}

      {/* Peek countdown overlay */}
      {countdownNum !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>Memorize the cards!</p>
          <span style={{ fontSize: 64, fontWeight: 900, color: ACCENT, textShadow: `0 0 30px ${ACCENT}88` }}>{countdownNum}</span>
        </div>
      )}

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}

      <style>{`
        @keyframes pk-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
