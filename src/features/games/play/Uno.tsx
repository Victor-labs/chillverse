// src/pages/games/Uno.tsx
import { useEffect, useRef, useState } from 'react'
import { Spade, Heart } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { getRankConfig } from './types'
import { PreGameModal, GameHUD, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'
import { ripple } from '../../../shared/lib/ripple'

const ACCENT = '#9b6dff'
const GAME_ID = 'uno' as const

// ─── Card engine (pure, framework-agnostic) ───────────────────
type UColor = 'red' | 'yellow' | 'green' | 'blue'
type UType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
interface UCard { id: number; color: UColor | null; type: UType; value?: number }

const COLORS: UColor[] = ['red', 'yellow', 'green', 'blue']
const COLOR_HEX: Record<UColor, string> = { red: '#d33a3a', yellow: '#e8c12c', green: '#2c9e57', blue: '#2f6fd6' }
const SYMBOLS: Record<string, string> = { skip: '⦸', reverse: '⇄', draw2: '+2', wild: 'WILD', wild4: '+4' }

function buildDeck(): UCard[] {
  const deck: UCard[] = []
  let id = 0
  for (const c of COLORS) {
    deck.push({ id: id++, color: c, type: 'number', value: 0 })
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: id++, color: c, type: 'number', value: n })
      deck.push({ id: id++, color: c, type: 'number', value: n })
    }
    for (let k = 0; k < 2; k++) {
      deck.push({ id: id++, color: c, type: 'skip' })
      deck.push({ id: id++, color: c, type: 'reverse' })
      deck.push({ id: id++, color: c, type: 'draw2' })
    }
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: id++, color: null, type: 'wild' })
    deck.push({ id: id++, color: null, type: 'wild4' })
  }
  return shuffleArr(deck)
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isWild(card: UCard) { return card.type === 'wild' || card.type === 'wild4' }

function cardLabel(card: UCard): string {
  if (card.type === 'number') return String(card.value)
  return SYMBOLS[card.type] ?? '?'
}

function describeCard(card: UCard, activeColor: UColor | null): string {
  if (card.type === 'number') return `${card.color} ${card.value}`
  if (card.type === 'skip') return `${card.color} Skip`
  if (card.type === 'reverse') return `${card.color} Reverse`
  if (card.type === 'draw2') return `${card.color} Draw Two`
  if (card.type === 'wild') return `Wild → ${activeColor}`
  return `Wild Draw Four → ${activeColor}`
}

function canPlay(card: UCard, top: UCard, activeColor: UColor | null): boolean {
  if (isWild(card)) return true
  if (card.color === activeColor) return true
  if (top.type === 'number' && card.type === 'number') return card.value === top.value
  if (card.type === top.type && card.type !== 'number') return true
  return false
}

function legalMoves(hand: UCard[], top: UCard, activeColor: UColor | null, pendingDraw: number, pendingType: 'draw2' | 'wild4' | null): UCard[] {
  return hand.filter(card => {
    if (pendingDraw > 0) {
      return (pendingType === 'draw2' && card.type === 'draw2') || (pendingType === 'wild4' && card.type === 'wild4')
    }
    return canPlay(card, top, activeColor)
  })
}

// ─── Rank → AI difficulty + reward mapping (no manual difficulty pick) ───
type AILevel = 'easy' | 'hard' | 'expert'
interface UnoRankCfg { ai: AILevel; aiLabel: string; winXP: number; loseXPRange: [number, number]; streakRequired: number }
const UNO_RANK_CONFIG: Record<GameRank, UnoRankCfg> = {
  beginner:     { ai: 'easy',   aiLabel: 'Halo (Rookie)',  winXP: 90,   loseXPRange: [12, 24], streakRequired: 5 },
  intermediate: { ai: 'easy',   aiLabel: 'Halo (Sharp)',   winXP: 110,  loseXPRange: [14, 26], streakRequired: 5 },
  advanced:     { ai: 'hard',   aiLabel: 'Halo (Veteran)', winXP: 140,  loseXPRange: [16, 30], streakRequired: 5 },
  master:       { ai: 'expert', aiLabel: 'Halo (Master)',  winXP: 170,  loseXPRange: [20, 38], streakRequired: 0 },
}

// ─── Mutable game state (kept in a ref; component force-renders on change) ───
interface UnoState {
  deck: UCard[]; discard: UCard[]; player: UCard[]; ai: UCard[]
  activeColor: UColor | null
  turn: 'player' | 'ai'
  direction: 1 | -1
  pendingDraw: number
  pendingDrawType: 'draw2' | 'wild4' | null
  unoCalled: boolean
  gameOver: boolean
  playerWeakness: Record<UColor, number>
  log: string[]
  t0: number
  stat: { colorSwitches: number; special: number; played: number; drawn: number; unoOnTime: boolean }
}

interface Skill { name: string; pct: number; color: string }

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function Uno({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 4 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'colorPick' | 'result' | 'quit'>('info')
  useGamePresence(GAME_ID)
  const { rankState, onCorrect, onWrong } = useRankStreak(GAME_ID, initialRank)

  const s = useRef<UnoState | null>(null)
  const [, setTick] = useState(0)
  const bump = () => setTick(t => t + 1)
  const colorCallback = useRef<((c: UColor) => void) | null>(null)
  const [banner, setBanner] = useState('')
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [promoted, setPromoted] = useState<GameRank | null>(null)
  const [result, setResult] = useState<{ won: boolean; xp: number; skillBonus: number; skills: Skill[]; durationStr: string } | null>(null)

  const cfg = UNO_RANK_CONFIG[rankState.rank]
  const rankCfg = getRankConfig(rankState.rank)

  function freshWeakness(): Record<UColor, number> { return { red: 0, yellow: 0, green: 0, blue: 0 } }

  function newGame() {
    const deck = buildDeck()
    const player = deck.splice(0, 7)
    const ai = deck.splice(0, 7)
    let top = deck.shift()!
    while (isWild(top)) { deck.push(top); deck.splice(0, deck.length, ...shuffleArr(deck)); top = deck.shift()! }

    s.current = {
      deck, discard: [top], player, ai,
      activeColor: top.color,
      turn: 'player',
      direction: 1,
      pendingDraw: 0,
      pendingDrawType: null,
      unoCalled: false,
      gameOver: false,
      playerWeakness: freshWeakness(),
      log: [`New game vs ${cfg.aiLabel}. You go first.`],
      t0: Date.now(),
      stat: { colorSwitches: 0, special: 0, played: 0, drawn: 0, unoOnTime: false },
    }
    setBanner('Your turn — play a card or draw')
    setResult(null)
    setPromoted(null)
    setPhase('play')
    bump()
  }

  function log(msg: string) {
    if (!s.current) return
    s.current.log = [...s.current.log.slice(-5), msg]
  }

  function reshuffleIfNeeded() {
    const st = s.current!
    if (st.deck.length === 0) {
      const top = st.discard.pop()!
      st.deck = shuffleArr(st.discard)
      st.discard = [top]
    }
  }

  function drawCards(who: 'player' | 'ai', n: number): UCard[] {
    const st = s.current!
    const drawn: UCard[] = []
    for (let i = 0; i < n; i++) {
      reshuffleIfNeeded()
      if (st.deck.length === 0) break
      const c = st.deck.shift()!
      drawn.push(c)
      ;(who === 'player' ? st.player : st.ai).push(c)
    }
    return drawn
  }

  function onDrawClick() {
    const st = s.current
    if (!st || st.turn !== 'player' || st.gameOver) return
    if (st.pendingDraw > 0) {
      drawCards('player', st.pendingDraw)
      st.stat.drawn += st.pendingDraw
      log(`You drew ${st.pendingDraw} cards.`)
      st.pendingDraw = 0
      st.pendingDrawType = null
      st.turn = 'ai'
      bump()
      maybeRunAI()
      return
    }
    const top = st.discard[st.discard.length - 1]
    const hadLegalMove = st.player.some(c => canPlay(c, top, st.activeColor))
    if (!hadLegalMove && st.activeColor) {
      st.playerWeakness[st.activeColor] = (st.playerWeakness[st.activeColor] ?? 0) + 1
    }
    const drawn = drawCards('player', 1)
    st.stat.drawn += drawn.length
    log(drawn.length ? 'You drew a card.' : 'Deck is empty.')
    st.turn = 'ai'
    bump()
    maybeRunAI()
  }

  function onPlayerPlay(card: UCard) {
    const st = s.current
    if (!st || st.turn !== 'player' || st.gameOver) return
    const top = st.discard[st.discard.length - 1]
    if (st.pendingDraw > 0) {
      const ok = (st.pendingDrawType === 'draw2' && card.type === 'draw2') || (st.pendingDrawType === 'wild4' && card.type === 'wild4')
      if (!ok) { flashShake(card.id); setBanner(`Must play a ${st.pendingDrawType === 'draw2' ? 'Draw Two' : 'Wild Draw Four'} or draw ${st.pendingDraw}`); return }
    } else if (!canPlay(card, top, st.activeColor)) {
      flashShake(card.id); setBanner("Can't play that card"); return
    }
    st.player = st.player.filter(c => c.id !== card.id)
    playCardEffects('player', card)
  }

  function flashShake(id: number) {
    setShakeId(id)
    setTimeout(() => setShakeId(null), 350)
  }

  function playCardEffects(who: 'player' | 'ai', card: UCard) {
    const st = s.current!
    st.discard.push(card)

    if (who === 'player') {
      st.stat.played++
      if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2' || card.type === 'wild4') st.stat.special++
      if (isWild(card)) st.stat.colorSwitches++
    }

    if (card.type === 'draw2') { st.pendingDraw += 2; st.pendingDrawType = 'draw2' }
    else if (card.type === 'wild4') { st.pendingDraw += 4; st.pendingDrawType = 'wild4' }
    else if (card.type === 'reverse') { st.direction = (st.direction * -1) as 1 | -1; setBanner('Reverse!') }
    else if (card.type === 'skip') { setBanner('Skip!') }

    const hand = who === 'player' ? st.player : st.ai
    if (hand.length === 0) { finishGame(who); return }
    if (hand.length === 1 && who === 'ai') log('Halo calls UNO!')

    if (isWild(card)) {
      if (who === 'player') {
        colorCallback.current = (chosen: UColor) => {
          st.activeColor = chosen
          finishTurnAfterPlay(who, card)
        }
        setPhase('colorPick')
        bump()
        return
      } else {
        const chosen = aiChooseColor(st)
        st.activeColor = chosen
        if (cfg.ai === 'expert' && (st.playerWeakness[chosen] ?? 0) >= 2) setBanner(`Halo targets ${chosen} — your weak spot`)
      }
    } else {
      st.activeColor = card.color
    }
    finishTurnAfterPlay(who, card)
  }

  function finishTurnAfterPlay(who: 'player' | 'ai', card: UCard) {
    const st = s.current!
    log(`${who === 'player' ? 'You' : 'Halo'} played ${describeCard(card, st.activeColor)}.`)
    bump()

    if (card.type === 'skip' || card.type === 'reverse') {
      st.turn = who
      bump()
      if (who === 'ai') maybeRunAI()
      return
    }
    if (card.type === 'draw2' || card.type === 'wild4') {
      st.turn = who === 'player' ? 'ai' : 'player'
      bump()
      maybeRunAI()
      return
    }
    st.turn = who === 'player' ? 'ai' : 'player'
    bump()
    maybeRunAI()
  }

  // ─── AI logic ───────────────────────────────────────────────
  function aiChooseColor(st: UnoState): UColor {
    const counts: Record<UColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 }
    st.ai.forEach(c => { if (c.color) counts[c.color]++ })
    if (cfg.ai === 'easy') {
      const avail = COLORS.filter(c => counts[c] > 0)
      return avail.length ? avail[Math.floor(Math.random() * avail.length)] : COLORS[Math.floor(Math.random() * 4)]
    }
    if (cfg.ai === 'hard') {
      let best: UColor = COLORS[0], bestN = -1
      for (const c of COLORS) { if (counts[c] > bestN) { bestN = counts[c]; best = c } }
      return best
    }
    let best: UColor = COLORS[0], bestScore = -Infinity
    for (const c of COLORS) {
      const score = counts[c] * 1.4 + (st.playerWeakness[c] ?? 0) * 2.2
      if (score > bestScore) { bestScore = score; best = c }
    }
    return best
  }

  function bestWeaknessColor(st: UnoState): UColor {
    const w = st.playerWeakness
    const counts: Record<UColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 }
    st.ai.forEach(c => { if (c.color) counts[c.color]++ })
    let best: UColor = COLORS[0], bestScore = -Infinity
    for (const c of COLORS) {
      const score = (w[c] ?? 0) * 2.2 + counts[c] * 1.2
      if (score > bestScore) { bestScore = score; best = c }
    }
    return best
  }

  function aiPickCard(st: UnoState, moves: UCard[]): UCard {
    const hand = st.ai
    if (cfg.ai === 'easy') return moves[Math.floor(Math.random() * moves.length)]

    if (cfg.ai === 'hard') {
      const priority = (c: UCard) => {
        if (c.type === 'wild4') return 6
        if (c.type === 'draw2') return 5
        if (c.type === 'skip' || c.type === 'reverse') return 4
        if (c.type === 'number') return 1 + (c.value ?? 0) / 10
        if (c.type === 'wild') return 0.5
        return 0
      }
      return moves.slice().sort((a, b) => priority(b) - priority(a))[0]
    }

    const playerCount = st.player.length
    const colorCounts: Record<UColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 }
    hand.forEach(c => { if (c.color) colorCounts[c.color]++ })
    const aggressive = playerCount <= 2
    const weakness = st.playerWeakness

    const scored = moves.map(c => {
      let score = 0
      if (c.type === 'number') score += 1 + (c.value ?? 0) * 0.05 + (c.color ? colorCounts[c.color] * 0.3 : 0)
      if (c.type === 'skip' || c.type === 'reverse') score += aggressive ? 5 : 3
      if (c.type === 'draw2') score += aggressive ? 7 : 4.5
      if (c.type === 'wild4') score += aggressive ? 9 : 3
      if (c.type === 'wild') score += 2
      if (c.color) score += colorCounts[c.color] ? colorCounts[c.color] * 0.2 : 0

      const resultingColor = isWild(c) ? bestWeaknessColor(st) : (c.color as UColor)
      score += (weakness[resultingColor] ?? 0) * 1.6

      const remaining = hand.filter(x => x.id !== c.id)
      const simColor = isWild(c) ? bestWeaknessColor(st) : (c.color as UColor)
      const simTop: UCard = c.type === 'number' ? { id: -1, type: 'number', value: c.value, color: simColor } : { id: -1, type: c.type, color: simColor }
      const followUps = remaining.filter(x => canPlay(x, simTop, simColor)).length
      score += followUps * 0.9

      return { c, score }
    })
    scored.sort((a, b) => b.score - a.score)

    if (!aggressive) {
      const nonWild4 = scored.filter(sc => sc.c.type !== 'wild4')
      if (nonWild4.length) return nonWild4[0].c
    }
    return scored[0].c
  }

  function maybeRunAI() {
    const st = s.current
    if (!st || st.turn !== 'ai' || st.gameOver) return
    setTimeout(runAITurn, 750)
  }

  function runAITurn() {
    const st = s.current
    if (!st || st.gameOver) return
    const top = st.discard[st.discard.length - 1]
    const moves = legalMoves(st.ai, top, st.activeColor, st.pendingDraw, st.pendingDrawType)

    if (moves.length === 0) {
      if (st.pendingDraw > 0) {
        drawCards('ai', st.pendingDraw)
        log(`Halo drew ${st.pendingDraw} cards.`)
        st.pendingDraw = 0; st.pendingDrawType = null
        st.turn = 'player'
        bump()
        return
      }
      const drawn = drawCards('ai', 1)
      log('Halo drew a card.')
      bump()
      if (drawn.length) {
        const c = drawn[0]
        const top2 = st.discard[st.discard.length - 1]
        if (canPlay(c, top2, st.activeColor) && cfg.ai !== 'easy') {
          st.ai = st.ai.filter(x => x.id !== c.id)
          setTimeout(() => playCardEffects('ai', c), 500)
          return
        }
      }
      st.turn = 'player'
      bump()
      return
    }

    const chosen = aiPickCard(st, moves)
    st.ai = st.ai.filter(c => c.id !== chosen.id)
    playCardEffects('ai', chosen)
  }

  // ─── Skills + scoring ───────────────────────────────────────
  function computeSkills(st: UnoState): Skill[] {
    const colorPct = Math.min(100, Math.round((st.stat.colorSwitches / 2) * 100))
    const defPct = Math.min(100, Math.round((st.stat.special / 3) * 100))
    const totalMoves = st.stat.played + st.stat.drawn
    const effPct = totalMoves > 0 ? Math.min(100, Math.round((st.stat.played / totalMoves) * 100)) : 0
    const unoPct = st.stat.unoOnTime ? 100 : 0
    return [
      { name: 'Color Control', pct: colorPct, color: '#9b6dff' },
      { name: 'Defensive Play', pct: defPct, color: '#ff4f4f' },
      { name: 'Hand Efficiency', pct: effPct, color: '#4f8ef7' },
      { name: 'UNO Reflex', pct: unoPct, color: '#f5c542' },
    ]
  }

  function finishGame(winner: 'player' | 'ai') {
    const st = s.current!
    st.gameOver = true
    bump()

    const won = winner === 'player'
    const [loMin, loMax] = cfg.loseXPRange
    let xpEarned = won ? cfg.winXP : Math.floor(loMin + Math.random() * (loMax - loMin))

    const skills = computeSkills(st)
    let skillBonus = 0
    skills.forEach(sk => { if (sk.pct >= 100) skillBonus += 20 })
    xpEarned += skillBonus

    let promo: GameRank | null = null
    if (won) {
      const r = onCorrect(rankCfg.streakRequired)
      promo = r.promoted
    } else {
      onWrong()
    }

    const durationSec = Math.max(1, Math.round((Date.now() - st.t0) / 1000))
    const mins = Math.floor(durationSec / 60), secs = durationSec % 60
    const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

    setTimeout(() => {
      setResult({ won, xp: xpEarned, skillBonus, skills, durationStr })
      setPromoted(promo)
      setPhase('result')

      const payload: GameEndPayload = {
        gameId: GAME_ID,
        gameName: 'Chillverse_Uno',
        rank: rankState.rank,
        score: won ? 1 : 0,
        xpEarned,
        durationSec,
        streak: rankState.bestStreak,
        correct: st.stat.played,
        total: st.stat.played + st.stat.drawn,
        detail: { Result: won ? 'Win' : 'Loss', Opponent: cfg.aiLabel },
      }
      onEnd(payload)
    }, won ? 500 : 300)
  }

  function callUno() {
    const st = s.current
    if (!st) return
    st.unoCalled = true
    if (st.player.length === 2) st.stat.unoOnTime = true
    setBanner('UNO!')
    bump()
  }

  useEffect(() => {
    if (s.current?.turn === 'player' && !s.current?.gameOver) {
      setBanner(s.current.pendingDraw > 0
        ? `Your turn — match it or draw ${s.current.pendingDraw}`
        : s.current.player.length === 1 ? 'Play your last card to win!' : 'Your turn — play a card or draw')
    } else if (s.current?.turn === 'ai' && !s.current?.gameOver) {
      setBanner('Halo is thinking…')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ─── Render: pre-game modal ───────────────────────────────────
  const rules = [
    { icon: '❤️', text: 'Only 1 life — one loss ends the round' },
    { icon: '⚡', text: 'Expert mode pushes your XP ceiling higher' },
    { icon: '🧠', text: 'Smart AI opponent — can you beat Halo?' },
    { icon: '🌐', text: 'Running on the Advanced Uno Server' },
    { icon: '🎟️', text: 'Costs 10 sessions per game' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chillverse_Uno"
      tagline="Classic UNO against Halo — a smart AI that remembers your weaknesses. No difficulty picker: win to climb the ranks yourself."
      accent={ACCENT}
      icon={<Spade size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={rankCfg.streakRequired}
      onStart={newGame}
      onClose={onBack}
    />
  )

  if (phase === 'result' && result) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, background: `${ACCENT}06` }}>
        {promoted && (
          <div style={{
            position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--surface)', border: `1px solid ${getRankConfig(promoted).color}55`,
            borderRadius: 20, padding: '10px 22px', zIndex: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: `0 8px 32px ${getRankConfig(promoted).color}33`,
          }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: getRankConfig(promoted).color }}>
              Rank Up! You are now {getRankConfig(promoted).label}!
            </span>
          </div>
        )}

        <div className="neu-card" style={{ padding: '28px 24px', textAlign: 'center', maxWidth: 380, width: '100%' }}>
          <div style={{ fontSize: 46, marginBottom: 6 }}>{result.won ? '🏆' : '💔'}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '2px 0 4px' }}>
            {result.won ? 'You won Uno!' : 'You failed this round'}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 18 }}>
            vs {cfg.aiLabel} · Chillverse_Uno
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 3 }}>XP Earned</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: result.won ? ACCENT : 'var(--red)' }}>+{result.xp}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 3 }}>Time</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>{result.durationStr}</div>
            </div>
          </div>

          <div style={{ textAlign: 'left', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 10 }}>Skills practiced</div>
            {result.skills.map(sk => (
              <div key={sk.name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{sk.name}</span>
                  <span style={{ color: sk.pct >= 100 ? ACCENT : 'var(--text-dim)', fontFamily: 'monospace', fontWeight: sk.pct >= 100 ? 700 : 400 }}>
                    {sk.pct}%{sk.pct >= 100 ? ' · +20 XP' : ''}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden', boxShadow: 'inset 1px 1px 4px var(--neu-dark)' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${sk.pct}%`, background: sk.color, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20,
              background: `${rankCfg.color}18`, color: rankCfg.color, border: `1px solid ${rankCfg.color}33`,
              fontSize: 12, fontWeight: 700,
            }}>
              🔥 {rankCfg.label} Rank
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: `${ACCENT}14`, border: `1px solid ${ACCENT}33`,
            borderRadius: 12, padding: '10px 16px', marginBottom: 18,
            fontSize: 13, fontWeight: 800, color: ACCENT,
          }}>
            ⚡ +{result.xp} XP added to your profile
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => {
              if (sessionsLeft < sessionCost) {
                // show inline notice — reuse the parent toast pattern
                const el = document.getElementById('uno-session-toast')
                if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0' }, 3000) }
                return
              }
              newGame()
            }} style={{
              flex: 1, padding: 12, borderRadius: 13, border: sessionsLeft >= sessionCost ? 'none' : '1px solid rgba(255,255,255,0.08)',
              cursor: sessionsLeft >= sessionCost ? 'pointer' : 'not-allowed',
              background: sessionsLeft >= sessionCost ? `linear-gradient(135deg, ${ACCENT}, #c4a8ff)` : 'rgba(255,255,255,0.05)',
              color: sessionsLeft >= sessionCost ? '#fff' : 'var(--text-muted)', fontSize: 14, fontWeight: 700,
            }}>
              Play Again
            </button>
            <button type="button" onClick={onBack} style={{
              flex: 1, padding: 12, borderRadius: 13, cursor: 'pointer',
              background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)',
              fontSize: 14, fontWeight: 700, boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
            }}>
              Done
            </button>
          </div>
          <div id="uno-session-toast" style={{
            position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, padding: '10px 18px', borderRadius: 14,
            background: 'rgba(14,14,18,0.97)', border: '1px solid rgba(155,109,255,0.5)',
            fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap',
            opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none',
          }}>
            ⚡ Insufficient sessions — resets in a few hours
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: live table ───────────────────────────────────────
  const st = s.current
  if (!st) return null
  const top = st.discard[st.discard.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <GameHUD
        gameName="Chillverse_Uno"
        accent={ACCENT}
        icon={<Spade size={14} />}
        streak={rankState.currentStreak}
        onQuit={() => setPhase('quit')}
        extraRight={
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>{cfg.aiLabel}</div>
        }
      />

      <div style={{ padding: '10px 16px 0', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: ACCENT, background: `${ACCENT}14`, border: `1px solid ${ACCENT}30`,
          borderRadius: 20, padding: '5px 14px',
        }}>
          {banner}
        </span>
      </div>

      <div className="neu-card" style={{ margin: '14px 16px', padding: '16px 14px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* AI hand */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: st.turn === 'ai' ? ACCENT : 'var(--text-muted)', marginBottom: 8 }}>
            {cfg.aiLabel} {st.turn === 'ai' && !st.gameOver ? '●' : ''}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {st.ai.map((c, i) => (
              <div key={c.id} style={{
                width: 34, height: 50, marginLeft: i === 0 ? 0 : -14, borderRadius: 5,
                background: 'repeating-linear-gradient(45deg, #7a1f1f, #7a1f1f 4px, #5a1414 4px, #5a1414 8px)',
                border: '2px solid #1a0d0d', boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
              }} />
            ))}
          </div>
        </div>

        {/* Pile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '14px 0' }}>
          <div onClick={onDrawClick} style={{ cursor: st.turn === 'player' && !st.gameOver ? 'pointer' : 'default', textAlign: 'center' }}>
            <div style={{
              width: 62, height: 90, borderRadius: 8, border: `2px solid ${ACCENT}`,
              background: `radial-gradient(circle at 50% 50%, ${ACCENT}33, var(--surface2) 70%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: '1px', color: ACCENT,
              boxShadow: '0 6px 14px rgba(0,0,0,0.3)',
            }}>DRAW</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{st.deck.length}</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>{st.direction === 1 ? '→' : '←'}</div>
          <CardFace card={top} activeColor={st.activeColor} size="lg" />
        </div>

        {/* Player hand */}
        <div style={{ textAlign: 'center', margin: '4px 0 2px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: st.turn === 'player' ? ACCENT : 'var(--text-muted)' }}>
          You {st.turn === 'player' && !st.gameOver ? '●' : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4, padding: '10px 0 4px', minHeight: 100 }}>
          {st.player.map(card => {
            const playable = st.turn === 'player' && !st.gameOver && (
              st.pendingDraw > 0
                ? ((st.pendingDrawType === 'draw2' && card.type === 'draw2') || (st.pendingDrawType === 'wild4' && card.type === 'wild4'))
                : canPlay(card, top, st.activeColor)
            )
            return (
              <div key={card.id}
                onClick={(e) => { if (playable) { ripple(e); onPlayerPlay(card) } }}
                style={{
                  cursor: playable ? 'pointer' : 'not-allowed',
                  filter: playable ? 'none' : 'brightness(0.55) saturate(0.6)',
                  animation: shakeId === card.id ? 'unoShake 0.35s ease' : undefined,
                  transition: 'transform 0.15s',
                }}
              >
                <CardFace card={card} activeColor={st.activeColor} size="sm" />
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          <button type="button" onClick={onDrawClick} disabled={st.turn !== 'player' || st.gameOver} style={{
            padding: '8px 18px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
            background: 'var(--surface2)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700,
            cursor: st.turn === 'player' && !st.gameOver ? 'pointer' : 'not-allowed',
            opacity: st.turn === 'player' && !st.gameOver ? 1 : 0.5,
          }}>
            {st.pendingDraw > 0 ? `Draw ${st.pendingDraw}` : 'Draw card'}
          </button>
          <button type="button" onClick={callUno} disabled={!(st.turn === 'player' && st.player.length === 2 && !st.gameOver)} style={{
            padding: '8px 18px', borderRadius: 16, border: '1px solid var(--red)',
            background: 'var(--red)', color: '#fff', fontSize: 12, fontWeight: 800,
            cursor: st.player.length === 2 ? 'pointer' : 'not-allowed',
            opacity: st.player.length === 2 ? 1 : 0.4,
          }}>
            <Heart size={11} style={{ verticalAlign: -1, marginRight: 4 }} />UNO!
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          {st.log.slice(-3).join('  ·  ')}
        </div>
      </div>

      {phase === 'colorPick' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,10,16,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="neu-card" style={{ padding: '26px 30px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, margin: '0 0 18px' }}>Pick a color</h3>
            <div style={{ display: 'flex', gap: 14 }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => {
                  const cb = colorCallback.current
                  colorCallback.current = null
                  setPhase('play')
                  if (cb) cb(c)
                }} style={{
                  width: 50, height: 50, borderRadius: '50%', cursor: 'pointer',
                  border: '3px solid rgba(255,255,255,0.5)', background: COLOR_HEX[c],
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}

      <style>{`
        @keyframes unoShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}

// ─── Card face component ───────────────────────────────────────
function CardFace({ card, activeColor, size }: { card: UCard; activeColor: UColor | null; size: 'sm' | 'lg' }) {
  const w = size === 'lg' ? 64 : 46
  const h = size === 'lg' ? 92 : 66
  const bg = isWild(card) ? '#1b1f29' : COLOR_HEX[card.color as UColor]
  const ring = isWild(card) && activeColor ? `0 0 0 3px ${COLOR_HEX[activeColor]}` : 'none'
  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: bg, border: '3px solid #fff',
      boxShadow: `${ring}, 0 4px 10px rgba(0,0,0,0.45)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', width: '60%', height: '88%', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', transform: 'rotate(-25deg)' }} />
      <span style={{
        position: 'relative', zIndex: 2, fontWeight: 800, fontStyle: card.type === 'number' ? 'italic' : 'normal',
        fontSize: isWild(card) ? (size === 'lg' ? 12 : 10) : (size === 'lg' ? 26 : 18),
        color: isWild(card) ? '#fff' : bg, textAlign: 'center', lineHeight: 1.1,
      }}>
        {cardLabel(card)}
      </span>
    </div>
  )
}
