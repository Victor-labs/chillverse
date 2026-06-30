// src/pages/games/PatternKing.tsx
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Eye, Zap } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { useGamePresence } from '../../hooks/useGamePresence'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, StatChip, ResultScreen, QuitModal, TimerBar, useRankStreak } from './GameShell'
import { ripple } from '../../lib/ripple'

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

// ─── Flat XP tiers (per design spec — not the usual per-correct formula) ───
// Win, but used up most of the clock        → wasted time   = 780 XP
// Win, finished with plenty of time to spare → no waste      = 900 XP
// Lost, but found half or more of patterns   → solid attempt = 350 XP
// Lost early / found less than half          → rough attempt = 150 XP
const XP_WIN_EFFICIENT = 900
const XP_WIN_WASTED     = 780
const XP_LOSE_PARTIAL   = 350
const XP_LOSE_WEAK      = 150
const WASTE_THRESHOLD   = 0.65 // used more than 65% of allotted time = "wasted time"

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface PKCard { id: number; pattern: PatternDef; flipped: boolean; matched: boolean }

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

  const cards: PKCard[] = shuffleArr(deck).map((p, i) => ({ id: i, pattern: p, flipped: true, matched: false }))
  const need: Record<string, number> = {}
  required.forEach(p => { need[p.sym] = deck.filter(c => c.sym === p.sym).length })

  return { cards, required, need }
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
}

export default function PatternKing({ rank: initialRank, onEnd, onBack }: Props) {
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

  const needRef = useRef<Record<string, number>>({})
  const doneCountRef = useRef<Record<string, number>>({})
  const scoreRef = useRef(0)
  const matchedTypesRef = useRef(0)
  const startRef = useRef(Date.now())
  const totalTimeRef = useRef(60)
  const lockedRef = useRef(false)
  const gameOverRef = useRef(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const peekTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shuffleCountRef = useRef(0)

  function getCfg() { return RANK_CONFIG[rankState.rank] }

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
        const matched = prev.filter(c => c.matched)
        const unmatched = shuffleArr(prev.filter(c => !c.matched))
        let ui = 0
        return prev.map(c => c.matched ? c : unmatched[ui++])
      })

      setTimeout(() => {
        setShuffling(false)
        setCards(prev => prev.map(c => c.matched ? c : { ...c, flipped: false }))
        setBanner('Find the required patterns!')
        lockedRef.current = false
      }, 650)
    }, 750)
  }

  function start() {
    const cfg = getCfg()
    const { cards: deck, required: req, need } = buildDeck(cfg)
    needRef.current = need
    doneCountRef.current = {}
    req.forEach(p => { doneCountRef.current[p.sym] = 0 })
    scoreRef.current = 0
    matchedTypesRef.current = 0
    shuffleCountRef.current = 0
    gameOverRef.current = false
    lockedRef.current = true
    startRef.current = Date.now()
    totalTimeRef.current = cfg.timeSec

    setCards(deck)
    setRequired(req)
    setDone(new Set())
    setScore(0)
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
        if (t <= 1) { endGame(false); return 0 }
        return t - 1
      })
    }, 1000)

    if (cfg.shuffles > 0) scheduleShuffle(cfg)
  }

  function endGame(win: boolean) {
    if (gameOverRef.current) return
    gameOverRef.current = true
    lockedRef.current = true
    clearTimers()

    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const requiredCount = required.length
    const matchedCount = matchedTypesRef.current
    const timeUsedRatio = 1 - (timeLeft / totalTimeRef.current)

    let xp: number
    if (win) {
      xp = timeUsedRatio <= WASTE_THRESHOLD ? XP_WIN_EFFICIENT : XP_WIN_WASTED
    } else {
      xp = requiredCount > 0 && matchedCount / requiredCount >= 0.5 ? XP_LOSE_PARTIAL : XP_LOSE_WEAK
    }

    const finishDelay = win ? 700 : 350
    setTimeout(() => {
      const payload: GameEndPayload = {
        gameId: GAME_ID,
        gameName: 'Pattern King',
        rank: rankState.rank,
        score: scoreRef.current,
        xpEarned: xp,
        durationSec: dur,
        streak: rankState.bestStreak,
        correct: matchedCount,
        total: requiredCount,
        detail: { 'Patterns Found': `${matchedCount}/${requiredCount}` },
      }
      if (win) {
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

  function onCardClick(id: number) {
    if (lockedRef.current || gameOverRef.current || phase !== 'play') return
    const card = cards.find(c => c.id === id)
    if (!card || card.matched || card.flipped) return

    setCards(prev => prev.map(c => c.id === id ? { ...c, flipped: true } : c))

    const sym = card.pattern.sym
    const isRequired = required.some(p => p.sym === sym)
    const alreadyDone = done.has(sym)

    if (!isRequired || alreadyDone) {
      // Wrong tap — instant round end
      lockedRef.current = true
      setWrongId(id)
      setBanner('Wrong card!')
      wrongTimeoutRef.current = setTimeout(() => {
        setWrongId(null)
        endGame(false)
      }, 900)
      return
    }

    doneCountRef.current[sym] = (doneCountRef.current[sym] ?? 0) + 1
    scoreRef.current += 50
    setScore(scoreRef.current)

    if (doneCountRef.current[sym] >= (needRef.current[sym] ?? 0)) {
      // Pattern type complete
      setCards(prev => prev.map(c => c.pattern.sym === sym ? { ...c, matched: true, flipped: true } : c))
      setDone(prev => new Set(prev).add(sym))
      scoreRef.current += 300
      matchedTypesRef.current += 1
      setScore(scoreRef.current)
      setPraise({ text: PRAISE[Math.floor(Math.random() * PRAISE.length)], key: Date.now() })
      setTimeout(() => setPraise(null), 1300)

      if (matchedTypesRef.current >= required.length) {
        setTimeout(() => endGame(true), 600)
      }
    } else {
      advanceRef.current = setTimeout(() => {
        if (gameOverRef.current) return
        setCards(prev => prev.map(c => (c.id === id && !c.matched) ? { ...c, flipped: false } : c))
      }, 800)
    }
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
      onStart={start}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ResultScreen payload={result} accent={ACCENT} onReplay={() => { setResult(null); start() }} onBack={onBack} promoted={promoted} />
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
        extraRight={
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="Score" value={score} accent={ACCENT} />
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
