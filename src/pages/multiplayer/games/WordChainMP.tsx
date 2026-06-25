// src/pages/multiplayer/games/WordChainMP.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../../games/types'
import type { GameRank } from '../../games/types'
import { getRoundTimeState } from '../raceEngine'
import { WORD_CHAIN_STARTERS, WORD_CHAIN_VALID_WORDS } from '../../games/gameData'
import MultiplayerResults from '../MultiplayerResults'
import type { PlayerResult } from '../MultiplayerResults'
import type { MPGameProps } from './mpGameTypes'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TURN_SEC   = 10
const REVEAL_MS  = 1500
const BEST_OF    = 3
const WIN_ROUNDS = Math.ceil(BEST_OF / 2)   // 2

type Phase = 'playing' | 'round_end' | 'match_end'

interface WCEvent {
  type:          'wc_start_round' | 'wc_word_submitted' | 'wc_invalid' | 'wc_eliminated' | 'wc_round_end' | 'wc_match_end'
  roundNum?:     number
  serverTs?:     string
  startWord?:    string
  turnOrder?:    string[]   // playerIds in join order
  activeId?:     string
  playerId?:     string
  word?:         string
  reason?:       string
  eliminatedId?: string
  roundWinnerId?:string
  roundWins?:    Record<string, number>
  matchWinnerId?:string
  finalRoundWins?:Record<string, number>
}

function validate(word: string, lastWord: string, usedWords: Set<string>): string | null {
  const w = word.toLowerCase().trim()
  if (w.length < 3)             return 'Word must be 3+ letters'
  const lastChar = lastWord.slice(-1).toLowerCase()
  if (w[0] !== lastChar)        return `Must start with "${lastChar.toUpperCase()}"`
  if (usedWords.has(w))         return 'Already used!'
  if (!WORD_CHAIN_VALID_WORDS.has(w)) return 'Not a valid word'
  return null
}

export default function WordChainMP({ roomId, myId, players, onGameOver }: MPGameProps) {
  const isOrchestrator = players[0]?.player_id === myId

  const [roundNum,    setRoundNum]    = useState(1)
  const [phase,       setPhase]       = useState<Phase>('playing')
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [lastWord,    setLastWord]    = useState('')
  const [chainWords,  setChainWords]  = useState<{ word: string; playerId: string }[]>([])
  const [eliminated,  setEliminated]  = useState<Set<string>>(new Set())
  const [roundWins,   setRoundWins]   = useState<Record<string, number>>({})
  const [inputVal,    setInputVal]    = useState('')
  const [inputError,  setInputError]  = useState<string | null>(null)
  const [submitted,   setSubmitted]   = useState(false)
  const [timeLeft,    setTimeLeft]    = useState(TURN_SEC)
  const [results,     setResults]     = useState<PlayerResult[] | null>(null)
  const [roundMsg,    setRoundMsg]    = useState<string | null>(null)

  const channelRef  = useRef<RealtimeChannel | null>(null)
  const usedWords   = useRef<Set<string>>(new Set())
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const turnTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elim        = useRef<Set<string>>(new Set())
  const orderRef    = useRef<string[]>([])
  const lastWordRef = useRef('')
  const roundWinsRef= useRef<Record<string, number>>({})

  function runTurnTimer(ts: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const { remainingMs } = getRoundTimeState(ts, TURN_SEC)
      setTimeLeft(Math.ceil(remainingMs / 1000))
      if (remainingMs <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 100)
  }

  // Next active player (skip eliminated)
  function nextActive(currentId: string, order: string[], eliminated: Set<string>): string | null {
    const idx   = order.indexOf(currentId)
    const total = order.length
    for (let i = 1; i < total; i++) {
      const next = order[(idx + i) % total]
      if (!eliminated.has(next)) return next
    }
    return null
  }

  function alivePlayers(order: string[], eliminated: Set<string>) {
    return order.filter(id => !eliminated.has(id))
  }

  const broadcastEliminate = useCallback((eliminatedId: string, currentRound: number, order: string[]) => {
    if (!channelRef.current) return
    const alive = alivePlayers(order, new Set([...elim.current, eliminatedId]))
    if (alive.length === 1) {
      channelRef.current.send({
        type: 'broadcast', event: 'wc_event',
        payload: { type: 'wc_round_end', roundNum: currentRound, roundWinnerId: alive[0], roundWins: roundWinsRef.current } as WCEvent,
      })
    } else {
      const nextId = nextActive(eliminatedId, order, new Set([...elim.current, eliminatedId]))
      const ts = new Date().toISOString()
      channelRef.current.send({
        type: 'broadcast', event: 'wc_event',
        payload: { type: 'wc_eliminated', eliminatedId, activeId: nextId, serverTs: ts } as WCEvent,
      })
    }
  }, [])

  const startTurn = useCallback((activePlayerId: string, ts: string) => {
    setActiveId(activePlayerId)
    setSubmitted(false)
    setInputVal('')
    setInputError(null)
    runTurnTimer(ts)

    if (isOrchestrator) {
      if (turnTimeout.current) clearTimeout(turnTimeout.current)
      turnTimeout.current = setTimeout(() => {
        broadcastEliminate(activePlayerId, roundNum, orderRef.current)
      }, (TURN_SEC + 0.5) * 1000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrchestrator, roundNum])

  const startRound = useCallback((num: number, order: string[]) => {
    if (!channelRef.current) return
    elim.current  = new Set()
    usedWords.current = new Set()
    const startWord = WORD_CHAIN_STARTERS[Math.floor(Math.random() * WORD_CHAIN_STARTERS.length)]
    const ts        = new Date().toISOString()
    channelRef.current.send({
      type: 'broadcast', event: 'wc_event',
      payload: { type: 'wc_start_round', roundNum: num, serverTs: ts, startWord, turnOrder: order, activeId: order[0] } as WCEvent,
    })
  }, [])

  useEffect(() => {
    const order = players.map(p => p.player_id)
    orderRef.current = order

    const channel = supabase.channel(`wc:${roomId}`, { config: { broadcast: { self: true } } })
    channelRef.current = channel

    channel.on('broadcast', { event: 'wc_event' }, ({ payload }) => {
      const ev = payload as WCEvent

      if (ev.type === 'wc_start_round' && ev.startWord && ev.turnOrder && ev.serverTs && ev.activeId) {
        setRoundNum(ev.roundNum ?? 1)
        setChainWords([{ word: ev.startWord, playerId: 'system' }])
        setLastWord(ev.startWord)
        lastWordRef.current = ev.startWord
        usedWords.current   = new Set([ev.startWord.toLowerCase()])
        elim.current        = new Set()
        setEliminated(new Set())
        setPhase('playing')
        setRoundMsg(null)
        startTurn(ev.activeId, ev.serverTs)
      }

      if (ev.type === 'wc_word_submitted' && ev.word && ev.playerId && ev.activeId && ev.serverTs) {
        if (turnTimeout.current) clearTimeout(turnTimeout.current)
        usedWords.current.add(ev.word.toLowerCase())
        setLastWord(ev.word)
        lastWordRef.current = ev.word
        setChainWords(prev => [...prev, { word: ev.word!, playerId: ev.playerId! }])
        startTurn(ev.activeId, ev.serverTs)
      }

      if (ev.type === 'wc_eliminated' && ev.eliminatedId) {
        elim.current = new Set([...elim.current, ev.eliminatedId])
        setEliminated(new Set(elim.current))
        setRoundMsg(`${players.find(p => p.player_id === ev.eliminatedId)?.display_name ?? 'Player'} was eliminated!`)
        setTimeout(() => setRoundMsg(null), REVEAL_MS)
        if (ev.activeId && ev.serverTs) startTurn(ev.activeId, ev.serverTs)
      }

      if (ev.type === 'wc_round_end' && ev.roundWinnerId) {
        if (timerRef.current) clearInterval(timerRef.current)
        if (turnTimeout.current) clearTimeout(turnTimeout.current)
        setPhase('round_end')

        const newWins = { ...(ev.roundWins ?? {}), [ev.roundWinnerId]: ((ev.roundWins ?? {})[ev.roundWinnerId] ?? 0) + 1 }
        roundWinsRef.current = newWins
        setRoundWins(newWins)
        setRoundMsg(`🏆 ${players.find(p => p.player_id === ev.roundWinnerId)?.display_name ?? 'Player'} wins the round!`)

        const winner = Object.entries(newWins).find(([, w]) => w >= WIN_ROUNDS)
        setTimeout(() => {
          if (winner) {
            if (isOrchestrator) {
              channelRef.current?.send({
                type: 'broadcast', event: 'wc_event',
                payload: { type: 'wc_match_end', matchWinnerId: winner[0], finalRoundWins: newWins } as WCEvent,
              })
            }
          } else if (isOrchestrator) {
            startRound((ev.roundNum ?? 1) + 1, orderRef.current)
          }
        }, 2000)
      }

      if (ev.type === 'wc_match_end' && ev.matchWinnerId && ev.finalRoundWins) {
        setPhase('match_end')
        const rank: GameRank = 'beginner'
        const rankCfg = getRankConfig(rank)
        const totalRounds = Object.values(ev.finalRoundWins).reduce((s, v) => s + v, 0)
        const playerResults: PlayerResult[] = players.map(p => {
          const wins    = ev.finalRoundWins![p.player_id] ?? 0
          const score   = wins * 100 + (p.player_id === ev.matchWinnerId ? 50 : 0)
          const mult    = p.player_id === ev.matchWinnerId ? 1.0 : wins > 0 ? wins / WIN_ROUNDS * 0.75 : 0.25
          const xp      = Math.round(calcSessionXP(wins, totalRounds, 0, rankCfg.xpBase) * mult)
          return { playerId: p.player_id, displayName: p.display_name || p.username, score, correct: wins, total: totalRounds, streak: 0, rank, xpEarned: xp }
        })
        setResults(playerResults)
        onGameOver()
      }
    })

    channel.subscribe(() => { if (isOrchestrator) startRound(1, order) })

    return () => {
      channel.unsubscribe()
      if (timerRef.current) clearInterval(timerRef.current)
      if (turnTimeout.current) clearTimeout(turnTimeout.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function handleSubmit() {
    if (activeId !== myId || submitted || phase !== 'playing') return
    const word = inputVal.trim().toLowerCase()
    const err  = validate(word, lastWordRef.current, usedWords.current)
    if (err) { setInputError(err); return }

    setSubmitted(true)
    if (turnTimeout.current) clearTimeout(turnTimeout.current)

    const aliveOrder = orderRef.current.filter(id => !elim.current.has(id))
    const nextId     = nextActive(myId, aliveOrder, elim.current) ?? aliveOrder[0]
    const ts         = new Date().toISOString()

    channelRef.current?.send({
      type: 'broadcast', event: 'wc_event',
      payload: { type: 'wc_word_submitted', word, playerId: myId, activeId: nextId, serverTs: ts } as WCEvent,
    })
  }

  if (results) {
    return <MultiplayerResults gameName="Word Chain" gameEmoji="🔤" myId={myId} players={results} teamMode="ffa" onPlayAgain={() => window.location.reload()} />
  }

  const isMyTurn   = activeId === myId && phase === 'playing'
  const lastLetter = lastWord.slice(-1).toUpperCase()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>🔤 Word Chain</span>
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--surface2)', color: '#00e5ff' }}>
          Round {roundNum}/{BEST_OF}
        </span>
        <div className="flex gap-1.5">
          {players.map(p => (
            <div
              key={p.player_id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              title={p.display_name || p.username}
              style={{
                background: eliminated.has(p.player_id) ? 'var(--surface2)' : activeId === p.player_id ? '#00e5ff' : '#6c50ff',
                opacity: eliminated.has(p.player_id) ? 0.35 : 1,
                border: `1.5px solid ${p.player_id === myId ? '#fff' : 'transparent'}`,
              }}
            >
              {(p.display_name || p.username).charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div className="h-1" style={{ background: 'var(--surface2)' }}>
        <div className="h-full" style={{ width: `${(timeLeft / TURN_SEC) * 100}%`, background: timeLeft <= 3 ? '#ff4f4f' : '#00e5ff', transition: 'width 0.1s linear' }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-4 gap-4">

        {/* Round wins */}
        <div className="flex gap-3 justify-center">
          {players.filter(p => !eliminated.has(p.player_id) || (roundWins[p.player_id] ?? 0) > 0).map(p => (
            <div key={p.player_id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
              {(p.display_name || p.username).split(' ')[0]}
              <div className="flex gap-0.5">
                {Array.from({ length: roundWins[p.player_id] ?? 0 }).map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full" style={{ background: '#f5c542' }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Chain scroll */}
        <div
          className="flex-1 overflow-y-auto rounded-2xl p-3 space-y-1.5"
          style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 280, minHeight: 120 }}
        >
          {chainWords.map((cw, i) => {
            const p    = players.find(pl => pl.player_id === cw.playerId)
            const name = cw.playerId === 'system' ? '🎲 Start' : (p?.display_name || p?.username || 'Player')
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] w-16 truncate flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{name}</span>
                <span className="font-bold text-sm font-mono" style={{ color: i === chainWords.length - 1 ? '#00e5ff' : 'var(--text)' }}>
                  {cw.word}
                  {i === chainWords.length - 1 && (
                    <span className="ml-1 text-xs font-semibold" style={{ color: '#f5c542' }}>→ {lastLetter}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Active turn indicator */}
        <div
          className="rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
          style={{
            background: isMyTurn ? 'rgba(0,229,255,0.1)' : 'var(--surface2)',
            color: isMyTurn ? '#00e5ff' : 'var(--text-muted)',
            border: `1px solid ${isMyTurn ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          {phase !== 'playing'
            ? roundMsg ?? 'Round over'
            : isMyTurn
            ? `Your turn! — ${timeLeft}s — starts with "${lastLetter}"`
            : `${players.find(p => p.player_id === activeId)?.display_name ?? 'Player'}'s turn — ${timeLeft}s`}
        </div>

        {roundMsg && phase === 'playing' && (
          <p className="text-center text-sm font-semibold" style={{ color: '#ff4f4f' }}>{roundMsg}</p>
        )}

        {/* Input */}
        {isMyTurn && (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setInputError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder={`Word starting with "${lastLetter}"…`}
              autoFocus
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none font-mono"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${inputError ? '#ff4f4f' : 'rgba(0,229,255,0.35)'}`,
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputVal.trim()}
              className="px-5 py-3 rounded-xl font-bold text-sm"
              style={{
                background: inputVal.trim() ? 'linear-gradient(135deg, #00e5ff, #6c50ff)' : 'var(--surface2)',
                color: inputVal.trim() ? '#000' : 'var(--text-muted)',
                border: 'none',
                cursor: inputVal.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Send
            </button>
          </div>
        )}
        {inputError && <p className="text-xs" style={{ color: '#ff4f4f' }}>{inputError}</p>}

        {/* Eliminated players */}
        {eliminated.size > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {[...eliminated].map(id => {
              const p = players.find(pl => pl.player_id === id)
              return (
                <span key={id} className="text-xs px-2.5 py-1 rounded-full line-through"
                  style={{ background: 'rgba(255,79,79,0.08)', color: '#ff4f4f', border: '1px solid rgba(255,79,79,0.2)' }}>
                  {p?.display_name || p?.username}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
