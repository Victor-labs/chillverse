// src/pages/Challenges.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Swords, Trophy, Clock, X, Crown, ArrowLeft,
  Grid3X3, CheckCircle, XCircle, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RANK_TIERS, getUserRankTier } from '../lib/ranks'

// ── XP pool for winners ──────────────────────────────────────────
const XP_POOL = [590, 490, 390]
function pickXP(): number { return XP_POOL[Math.floor(Math.random() * XP_POOL.length)] }

// ── Game label map ───────────────────────────────────────────────
const GAME_LABELS: Record<string, string> = {
  tictactoe:    'Tic Tac Toe',
  uno:          'UNO',
  arrow_escape: 'Arrow Escape',
}

// ── TicTacToe types ──────────────────────────────────────────────
type TacCell = 'X' | 'O' | null
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const

function checkWin(b: TacCell[]): { winner: TacCell; line: number[] | null } {
  for (const [a, bI, c] of WINS) {
    if (b[a] && b[a] === b[bI] && b[a] === b[c]) return { winner: b[a], line: [a, bI, c] }
  }
  return { winner: null, line: null }
}

// ── Inactivity timer (6 sec) ────────────────────────────────────
const INACTIVITY_SEC = 6

// ═══════════════════════════════════════════════════════════════════
// TicTacToe live game — syncs moves via Supabase Realtime
// ═══════════════════════════════════════════════════════════════════
interface TTTProps {
  challengeId: string
  myId: string
  myName: string
  opponentId: string
  opponentName: string
  amChallenger: boolean   // challenger plays X, challenged plays O
  onResult: (won: boolean, xp: number) => void
  onInactivity: (byName: string) => void
}

function TicTacToeArena({
  challengeId, myId, myName, opponentId, opponentName,
  amChallenger, onResult, onInactivity,
}: TTTProps) {
  const [board, setBoard]         = useState<TacCell[]>(Array(9).fill(null))
  const [xIsNext, setXIsNext]     = useState(true)  // X always goes first = challenger
  const [localDone, setLocalDone] = useState(false)
  const inactivityRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inactTimer, setInactTimer] = useState(INACTIVITY_SEC)

  const mySymbol: TacCell = amChallenger ? 'X' : 'O'
  const isMyTurn = (xIsNext && mySymbol === 'X') || (!xIsNext && mySymbol === 'O')
  const { winner, line } = checkWin(board)
  const isDraw = !winner && board.every(c => c !== null)
  const gameOver = !!winner || isDraw

  // ── Subscribe to opponent moves ──
  useEffect(() => {
    const ch = supabase
      .channel(`ttt:${challengeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'challenge_moves',
        filter: `challenge_id=eq.${challengeId}`,
      }, (payload) => {
        const mv = payload.new as { player_id: string; move_index: number; turn_number: number }
        if (mv.player_id === myId) return   // skip own echoes
        setBoard(prev => {
          const next = [...prev] as TacCell[]
          next[mv.move_index] = amChallenger ? 'O' : 'X'  // opponent's symbol
          return next
        })
        setXIsNext(prev => !prev)
        resetInactivity()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [challengeId, myId, amChallenger])

  // ── Inactivity countdown (my turn only) ──
  function resetInactivity() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    setInactTimer(INACTIVITY_SEC)
  }

  useEffect(() => {
    if (gameOver || localDone) return
    let count = INACTIVITY_SEC
    const tick = setInterval(() => {
      count -= 1
      setInactTimer(count)
      if (count <= 0) {
        clearInterval(tick)
        // Whoever was due to play has gone inactive
        const inactiveName = isMyTurn ? myName : opponentName
        onInactivity(inactiveName)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [xIsNext, gameOver, localDone])

  // ── Resolve when game over ──
  useEffect(() => {
    if (!gameOver || localDone) return
    setLocalDone(true)
    const xp = pickXP()
    const iWon = winner === mySymbol
    // Only the winner triggers the RPC to avoid double-writes
    if (iWon) {
      supabase.rpc('resolve_challenge', {
        p_challenge_id: challengeId,
        p_winner_id:    myId,
        p_loser_id:     opponentId,
        p_xp:           xp,
      }).then(() => {
        // Notify both via notifications table
        supabase.from('notifications').insert([
          {
            user_id: myId,
            type: 'challenge',
            title: '🏆 Challenge Won!',
            body: `You beat ${opponentName} in ${GAME_LABELS['tictactoe']}. +${xp} XP`,
            icon: 'swords',
          },
          {
            user_id: opponentId,
            type: 'challenge',
            title: '⚔️ Challenge Lost',
            body: `${myName} beat you in ${GAME_LABELS['tictactoe']}.`,
            icon: 'swords',
          },
        ])
      })
    }
    setTimeout(() => onResult(iWon, iWon ? xp : 0), 400)
  }, [gameOver])

  async function handleCell(i: number) {
    if (board[i] || gameOver || !isMyTurn) return
    const next = [...board] as TacCell[]
    next[i] = mySymbol
    setBoard(next)
    setXIsNext(t => !t)
    resetInactivity()
    const turnNum = board.filter(Boolean).length
    await supabase.from('challenge_moves').insert({
      challenge_id: challengeId,
      player_id:    myId,
      move_index:   i,
      turn_number:  turnNum,
    })
  }

  const CELL = 92

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* Turn header */}
      <div style={{
        width: '100%', padding: '10px 16px', marginBottom: 16,
        borderRadius: 14,
        background: isMyTurn && !gameOver
          ? 'rgba(255,107,0,0.12)'
          : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isMyTurn && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isMyTurn && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
            boxShadow: isMyTurn && !gameOver ? '0 0 8px var(--accent)' : 'none',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: isMyTurn && !gameOver ? 'var(--accent)' : 'var(--text-dim)',
          }}>
            {gameOver ? (winner === mySymbol ? '🎉 You won!' : isDraw ? "It's a draw!" : 'You lost') : isMyTurn ? 'Your turn' : `${opponentName.split(' ')[0]}'s turn`}
          </span>
        </div>
        {!gameOver && (
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: inactTimer <= 2 ? '#ff4d4d' : 'var(--text-muted)',
            padding: '3px 10px', borderRadius: 8,
            background: inactTimer <= 2 ? 'rgba(255,77,77,0.12)' : 'var(--surface)',
            transition: 'all 0.3s',
          }}>
            ⏱ {inactTimer}s
          </div>
        )}
      </div>

      {/* Players row */}
      <div style={{ display: 'flex', width: '100%', gap: 8, marginBottom: 16 }}>
        <div style={{
          flex: 1, padding: '10px 12px', borderRadius: 13,
          background: mySymbol === 'X' && xIsNext && !gameOver ? 'rgba(255,107,0,0.15)' : 'var(--surface)',
          border: `1.5px solid ${mySymbol === 'X' && xIsNext && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`,
          textAlign: 'center', transition: 'all 0.2s',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>YOU  ✕</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: mySymbol === 'X' ? 'var(--accent)' : 'var(--text-dim)', marginTop: 2 }}>
            {mySymbol}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Swords size={14} color="var(--text-muted)" />
        </div>
        <div style={{
          flex: 1, padding: '10px 12px', borderRadius: 13,
          background: mySymbol === 'O' && xIsNext && !gameOver ? 'rgba(155,109,255,0.15)'
                    : mySymbol === 'X' && !xIsNext && !gameOver ? 'rgba(155,109,255,0.15)' : 'var(--surface)',
          border: `1.5px solid ${(!isMyTurn && !gameOver) ? '#9b6dff' : 'rgba(255,255,255,0.07)'}`,
          textAlign: 'center', transition: 'all 0.2s',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
            {opponentName.split(' ')[0].toUpperCase()}  ○
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#9b6dff', marginTop: 2 }}>
            {mySymbol === 'X' ? 'O' : 'X'}
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CELL}px)`, gap: 8, marginBottom: 20 }}>
        {board.map((cell, i) => {
          const inLine = line?.includes(i)
          return (
            <button key={i} onClick={() => handleCell(i)}
              style={{
                width: CELL, height: CELL, borderRadius: 16,
                border: `1.5px solid ${inLine ? (winner === 'X' ? 'var(--accent)' : '#9b6dff') : 'rgba(255,255,255,0.09)'}`,
                background: inLine
                  ? (winner === 'X' ? 'rgba(255,107,0,0.15)' : 'rgba(155,109,255,0.15)')
                  : (isMyTurn && !cell && !gameOver ? 'rgba(255,255,255,0.03)' : 'var(--surface)'),
                cursor: (cell || gameOver || !isMyTurn) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 900,
                color: cell === 'X' ? 'var(--accent)' : '#9b6dff',
                transition: 'all 0.15s',
                transform: inLine ? 'scale(1.05)' : 'scale(1)',
              }}>
              {cell === 'X' ? '✕' : cell === 'O' ? '○' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Result modals
// ═══════════════════════════════════════════════════════════════════
function WinModal({ xp, opponentName, onPlayAgain, onClose }: {
  xp: number; opponentName: string;
  onPlayAgain: () => void; onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'var(--surface2)', borderRadius: 24,
        border: '1px solid rgba(255,107,0,0.3)',
        boxShadow: '0 0 60px rgba(255,107,0,0.2), 0 28px 80px rgba(0,0,0,0.8)',
        padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)', marginBottom: 6 }}>You Won!</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>
          You beat <strong style={{ color: 'var(--text)' }}>{opponentName}</strong>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 0', marginBottom: 24,
          borderRadius: 14, background: 'rgba(255,107,0,0.1)',
          border: '1px solid rgba(255,107,0,0.25)',
        }}>
          <Zap size={18} color="var(--accent)" />
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>+{xp} XP</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 13,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--surface)', color: 'var(--text-dim)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Close</button>
          <button onClick={onPlayAgain} style={{
            flex: 2, padding: '12px 0', borderRadius: 13, border: 'none',
            background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>Play Again</button>
        </div>
      </div>
    </div>
  )
}

function LoseModal({ opponentName, onRematch, onClose }: {
  opponentName: string; onRematch: () => void; onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'var(--surface2)', borderRadius: 24,
        border: '1px solid rgba(255,77,77,0.25)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.8)',
        padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>😔</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#ff6b6b', marginBottom: 6 }}>Challenge Lost</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>
          <strong style={{ color: 'var(--text)' }}>{opponentName}</strong> beat you this time
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 0', marginBottom: 24,
          borderRadius: 14, background: 'rgba(255,77,77,0.08)',
          border: '1px solid rgba(255,77,77,0.2)',
        }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>+0 XP</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 13,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--surface)', color: 'var(--text-dim)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Close</button>
          <button onClick={onRematch} style={{
            flex: 2, padding: '12px 0', borderRadius: 13, border: 'none',
            background: 'linear-gradient(135deg,#9b6dff,#6a3dff)',
            color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>Rematch</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Waiting / full modal — shown after challenger picks a game
// ═══════════════════════════════════════════════════════════════════
const PLACEHOLDER_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_0000000071e471f4abb27ed6b9870126.png'

type Phase =
  | 'picker'       // game selection grid
  | 'waiting'      // invite sent, pending response
  | 'timeout'      // no response in 10s
  | 'accepted'     // opponent accepted — play game
  | 'result_win'
  | 'result_lose'
  | 'inactivity'   // someone went afk mid-game

interface WaitingModalProps {
  opponentId: string
  opponentName: string
  myId: string
  myName: string
  onClose: () => void
  // If coming here after opponent already accepted (they accepted invite overlay)
  prefillChallengeId?: string
  prefillGame?: string
}

function ChallengeFullModal({
  opponentId, opponentName, myId, myName, onClose,
  prefillChallengeId, prefillGame,
}: WaitingModalProps) {
  const [phase, setPhase]           = useState<Phase>(prefillChallengeId ? 'accepted' : 'picker')
  const [selectedGame, setGame]     = useState<string>(prefillGame ?? '')
  const [challengeId, setChallengeId] = useState<string>(prefillChallengeId ?? '')
  const [resultXP, setResultXP]     = useState(0)
  const [inactName, setInactName]   = useState('')
  const [toast, setToast]           = useState<string | null>(null)
  const timeoutRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Show toast ──
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ── After picking a game, insert challenge row ──
  async function handlePickGame(game: string) {
    setGame(game)
    // Check if opponent is currently in a game
    const { data: presData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', opponentId)
      .single()
    // Also check active challenge
    const { data: activeChallenge } = await supabase
      .from('challenges')
      .select('id')
      .or(`challenger_id.eq.${opponentId},challenged_id.eq.${opponentId}`)
      .eq('status', 'accepted')
      .maybeSingle()

    if (activeChallenge) {
      showToast(`${opponentName} is already in a challenge. Try again later.`)
      return
    }

    const { data, error } = await supabase.from('challenges').insert({
      challenger_id: myId,
      challenged_id: opponentId,
      game,
    }).select('id').single()

    if (error || !data) { showToast('Could not send challenge. Try again.'); return }

    setChallengeId(data.id)
    setPhase('waiting')

    // 10-second timeout
    timeoutRef.current = setTimeout(async () => {
      await supabase.from('challenges').update({ status: 'timeout' }).eq('id', data.id).eq('status', 'pending')
      setPhase('timeout')
    }, 10000)
  }

  // ── Listen for status changes on this specific challenge ──
  useEffect(() => {
    if (!challengeId) return
    const ch = supabase
      .channel(`challenge-modal:${challengeId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'challenges',
        filter: `id=eq.${challengeId}`,
      }, (payload) => {
        const row = payload.new as { status: string }
        if (row.status === 'accepted') {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setPhase('accepted')
        }
        if (row.status === 'declined') {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          showToast(`${opponentName} declined your challenge.`)
          setPhase('picker')
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch); if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [challengeId])

  async function handleResult(won: boolean, xp: number) {
    setResultXP(xp)
    setPhase(won ? 'result_win' : 'result_lose')
  }

  async function handlePlayAgain() {
    // Check if opponent already closed
    const { data } = await supabase
      .from('challenges')
      .select('status')
      .eq('id', challengeId)
      .single()
    if (data?.status === 'completed') {
      // Start a new challenge to the same person
      await handlePickGame(selectedGame)
    }
  }

  async function handleRematch() {
    await handlePickGame(selectedGame)
  }

  const gameName = GAME_LABELS[selectedGame] ?? selectedGame

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--surface2)', borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.8)',
        padding: '22px 20px',
        position: 'relative',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(255,77,77,0.4)',
            borderRadius: 14, padding: '11px 18px',
            fontSize: 12, fontWeight: 600, color: 'var(--text)',
            zIndex: 9999, whiteSpace: 'nowrap',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          }}>{toast}</div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {phase !== 'picker' && (
            <button onClick={() => { setPhase('picker'); setChallengeId(''); if (timeoutRef.current) clearTimeout(timeoutRef.current) }}
              style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ‹
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {phase === 'picker' ? `Challenge ${opponentName}` : gameName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {phase === 'picker' && 'Pick a game'}
              {phase === 'waiting' && 'Waiting for response…'}
              {phase === 'accepted' && 'Live match'}
              {phase === 'timeout' && 'Invite expired'}
              {phase === 'inactivity' && 'Session ended'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} />
          </button>
        </div>

        {/* ── PICKER ── */}
        {phase === 'picker' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              Quick Challenges
            </div>
            {/* Active game */}
            <button onClick={() => handlePickGame('tictactoe')} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid rgba(62,207,142,0.3)',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 13,
                background: 'rgba(62,207,142,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                <Grid3X3 size={22} color="#3ecf8e" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Tic Tac Toe</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Classic 3-in-a-row</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text-muted)' }}>›</div>
            </button>

            {/* Coming soon games */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px' }}>
              More Games
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: 'UNO', emoji: '🃏' }, { label: 'Arrow Escape', emoji: '🏹' }].map(g => (
                <div key={g.label} style={{
                  flex: 1, padding: '14px 10px', borderRadius: 16,
                  background: 'var(--surface)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  textAlign: 'center', opacity: 0.5,
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{g.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Coming soon</div>
                </div>
              ))}
            </div>

            {/* Placeholder banner */}
            <div style={{ marginTop: 8, borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
              <img
                src={PLACEHOLDER_IMG}
                alt=""
                style={{ width: '100%', height: 110, objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.08)' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.7))',
                display: 'flex', alignItems: 'flex-end', padding: '0 14px 14px',
              }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  Use the Challenge button on a player's profile, then come back here to see changes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── WAITING ── */}
        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
              Invite sent to {opponentName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Waiting for them to accept. If they don't respond within <strong style={{ color: 'var(--accent)' }}>10 seconds</strong>, the invite will expire.
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ height: '100%', background: 'var(--accent)', animation: 'waitProgress 10s linear forwards' }} />
            </div>
            <button onClick={() => { setPhase('picker'); if (timeoutRef.current) clearTimeout(timeoutRef.current) }}
              style={{ width: '100%', padding: 12, borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
            <style>{`@keyframes waitProgress { from { width: 100% } to { width: 0% } }`}</style>
          </div>
        )}

        {/* ── TIMEOUT ── */}
        {phase === 'timeout' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⌛</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Challenge Timed Out</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              {opponentName} didn't respond in time. Try sending another invite from their profile.
            </div>
            <button onClick={() => setPhase('picker')} style={{
              width: '100%', padding: 12, borderRadius: 13, border: 'none',
              background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>Try Again</button>
          </div>
        )}

        {/* ── INACTIVITY ── */}
        {phase === 'inactivity' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>😴</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Session Ended</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Inactivity from <strong style={{ color: 'var(--text)' }}>{inactName}</strong> has ended the session.
            </div>
            <button onClick={() => setPhase('picker')} style={{
              width: '100%', padding: 12, borderRadius: 13, border: 'none',
              background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>Start New Challenge</button>
          </div>
        )}

        {/* ── LIVE GAME ── */}
        {phase === 'accepted' && challengeId && selectedGame === 'tictactoe' && (
          <TicTacToeArena
            challengeId={challengeId}
            myId={myId}
            myName={myName}
            opponentId={opponentId}
            opponentName={opponentName}
            amChallenger={true}
            onResult={handleResult}
            onInactivity={(name) => { setInactName(name); setPhase('inactivity') }}
          />
        )}
      </div>

      {/* Result modals (outside the scrollable card so they cover everything) */}
      {phase === 'result_win' && (
        <WinModal
          xp={resultXP}
          opponentName={opponentName}
          onClose={onClose}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {phase === 'result_lose' && (
        <LoseModal
          opponentName={opponentName}
          onClose={onClose}
          onRematch={handleRematch}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════════════════
interface LeaderRow {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
  xp: number
  wins: number
  losses: number
  total_played: number
  challenge_xp: number
}

function Leaderboard() {
  const [rows, setRows]   = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('challenge_stats')
      .select('id,username,display_name,avatar,xp,wins,losses,total_played,challenge_xp')
      .order('challenge_xp', { ascending: false })
      .limit(20)
      .then(({ data }) => { setRows((data ?? []) as LeaderRow[]); setLoading(false) })
  }, [])

  if (loading) return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
  if (rows.length === 0) return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No challenge data yet. Be the first!</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, idx) => {
        const rank = getUserRankTier(r.xp)
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
        return (
          <div key={r.id} onClick={() => navigate(`/profile/${r.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 16,
              background: idx < 3 ? `${rank.color}0a` : 'var(--surface)',
              border: `1px solid ${idx < 3 ? rank.color + '30' : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {/* Rank # */}
            <div style={{ width: 28, textAlign: 'center', fontSize: medal ? 18 : 13, fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>
              {medal ?? `#${idx + 1}`}
            </div>
            {/* Avatar */}
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', border: `1.5px solid ${rank.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r.avatar ? <img src={r.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>👤</span>}
            </div>
            {/* Name + rank */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.display_name ?? r.username}
              </div>
              <div style={{ fontSize: 10, color: rank.color, fontWeight: 700 }}>{rank.emoji} {rank.name}</div>
            </div>
            {/* Stats */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent)' }}>{r.challenge_xp.toLocaleString()} XP</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.wins}W · {r.losses}L</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Recent Activity
// ═══════════════════════════════════════════════════════════════════
interface HistoryRow {
  id: string
  status: string
  game: string
  winner_id: string | null
  loser_id: string | null
  xp_awarded: number
  completed_at: string | null
  created_at: string
  challenger: { username: string; display_name: string | null; avatar: string | null } | null
  challenged: { username: string; display_name: string | null; avatar: string | null } | null
}

function RecentActivity({ myId }: { myId: string }) {
  const [rows, setRows]   = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('challenges')
      .select(`
        id, status, game, winner_id, loser_id, xp_awarded, completed_at, created_at,
        challenger:challenger_id(username, display_name, avatar),
        challenged:challenged_id(username, display_name, avatar)
      `)
      .or(`challenger_id.eq.${myId},challenged_id.eq.${myId}`)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(15)
      .then(({ data }) => { setRows((data ?? []) as HistoryRow[]); setLoading(false) })
  }, [myId])

  if (loading) return <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
  if (rows.length === 0) return (
    <div style={{ padding: '20px', textAlign: 'center', borderRadius: 14, background: 'var(--surface)', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <Swords size={24} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} />
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No matches played yet</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => {
        const won    = r.winner_id === myId
        const opName = r.challenger?.username === myId
          ? (r.challenged?.display_name ?? r.challenged?.username ?? 'Unknown')
          : (r.challenger?.display_name ?? r.challenger?.username ?? 'Unknown')
        const opAvatar = r.challenger?.username === myId
          ? r.challenged?.avatar
          : r.challenger?.avatar

        return (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 14,
            background: 'var(--surface)',
            border: `1px solid ${won ? 'rgba(62,207,142,0.2)' : 'rgba(255,77,77,0.15)'}`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', border: `1.5px solid ${won ? '#3ecf8e44' : '#ff6b6b44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {opAvatar ? <img src={opAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {won ? <CheckCircle size={11} style={{ color: '#3ecf8e', marginRight: 5, display: 'inline' }} /> : <XCircle size={11} style={{ color: '#ff6b6b', marginRight: 5, display: 'inline' }} />}
                {won ? 'Beat' : 'Lost to'} {opName}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {GAME_LABELS[r.game] ?? r.game} · {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: won ? '#3ecf8e' : 'var(--text-muted)' }}>
                {won ? `+${r.xp_awarded}` : '+0'} XP
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Challenges Page
// ═══════════════════════════════════════════════════════════════════
type PageTab = 'leaderboard' | 'history'

export default function Challenges() {
  const { session } = useAuth()
  const myId = session?.user?.id ?? ''
  const [myName, setMyName] = useState('You')
  const [tab, setTab] = useState<PageTab>('leaderboard')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // If coming from accept flow via URL params
  const urlChallengeId  = searchParams.get('cid') ?? ''
  const urlOpponentId   = searchParams.get('oid') ?? ''
  const urlOpponentName = searchParams.get('oname') ?? 'Opponent'
  const urlGame         = searchParams.get('game') ?? 'tictactoe'

  const [modalOpen, setModalOpen]       = useState(!!urlChallengeId)
  const [modalOpponentId, setModalOpp]  = useState(urlOpponentId)
  const [modalOpponentName, setModalOppName] = useState(urlOpponentName)
  const [modalChallengeId, setModalCid] = useState(urlChallengeId)
  const [modalGame, setModalGame]       = useState(urlGame)

  useEffect(() => {
    if (!myId) return
    supabase.from('profiles').select('display_name,username').eq('id', myId).single()
      .then(({ data }) => { if (data) setMyName(data.display_name ?? data.username) })
  }, [myId])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Swords size={22} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Challenges</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Head-to-head matches</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface)', borderRadius: 14, padding: 4 }}>
        {(['leaderboard', 'history'] as PageTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 11, border: 'none',
            background: tab === t ? 'var(--surface2)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {t === 'leaderboard' ? <><Crown size={13} /> Leaderboard</> : <><Clock size={13} /> My History</>}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'history'     && <RecentActivity myId={myId} />}

      {/* Full modal (if opened from profile or URL) */}
      {modalOpen && (
        <ChallengeFullModal
          opponentId={modalOpponentId}
          opponentName={modalOpponentName}
          myId={myId}
          myName={myName}
          onClose={() => { setModalOpen(false); navigate('/challenges', { replace: true }) }}
          prefillChallengeId={modalChallengeId || undefined}
          prefillGame={modalGame || undefined}
        />
      )}
    </div>
  )
}

// ── Also export the modal so PlayerProfile can use it directly ────
export { ChallengeFullModal }
