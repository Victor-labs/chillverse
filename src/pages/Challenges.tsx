// src/pages/Challenges.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Swords, Clock, X, Crown,
  Grid3X3, CheckCircle, XCircle, Zap, Circle,
  X as XIcon, Flag, Settings2, Copy, Lock, Unlock,
  Users, MessageCircle, ArrowLeft, Home, Send,
  LogOut, ChevronRight, Search, Trophy,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getUserRankTier } from '../lib/ranks'

// ── XP pool ──────────────────────────────────────────────────────
const XP_POOL = [590, 490, 390]
function pickXP(): number { return XP_POOL[Math.floor(Math.random() * XP_POOL.length)] }

// ── Game registry ─────────────────────────────────────────────────
interface GameDef {
  id: string
  label: string
  description: string
  minPlayers: number
  maxPlayers: number
  icon: React.ReactNode
  accent: string
  available: boolean
}

const GAMES: GameDef[] = [
  {
    id: 'tictactoe',
    label: 'Tic Tac Toe',
    description: 'Classic 3-in-a-row',
    minPlayers: 2,
    maxPlayers: 2,
    icon: <Grid3X3 size={22} color="#3ecf8e" />,
    accent: '#3ecf8e',
    available: true,
  },
  {
    id: 'colourblock',
    label: 'Colour Block',
    description: 'Coming soon',
    minPlayers: 2,
    maxPlayers: 4,
    icon: <span style={{ fontSize: 20 }}>🎨</span>,
    accent: '#9b6dff',
    available: false,
  },
]

function getGame(id: string): GameDef | undefined { return GAMES.find(g => g.id === id) }

// ── Stub: deduct Verse Honour on quit ────────────────────────────
async function stubDeductHonour(_userId: string) {
  // TODO: implement when Verse Honour score feature is built
  // e.g. supabase.rpc('deduct_honour', { p_user_id: _userId, p_amount: 10 })
  console.warn('[STUB] Verse Honour deduction not yet implemented')
}

// ── Toast ─────────────────────────────────────────────────────────
interface ToastItem { id: number; msg: string; icon?: React.ReactNode; color?: string }
let _toastSeq = 0

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const show = useCallback((msg: string, icon?: React.ReactNode, color?: string) => {
    const id = ++_toastSeq
    setToasts(q => [...q, { id, msg, icon, color }])
    setTimeout(() => setToasts(q => q.filter(t => t.id !== id)), 3400)
  }, [])
  return { toasts, show }
}

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 14,
          background: 'rgba(14,14,18,0.97)',
          border: `1px solid ${t.color ?? 'rgba(255,107,0,0.4)'}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(14px)',
          fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
          whiteSpace: 'nowrap',
          animation: 'achSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {t.icon && <span style={{ display: 'flex' }}>{t.icon}</span>}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TicTacToe Arena (live multiplayer — unchanged from original)
// ═══════════════════════════════════════════════════════════════════
type TacCell = 'X' | 'O' | null
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] as const
function checkWin(b: TacCell[]): { winner: TacCell; line: number[] | null } {
  for (const [a, bI, c] of WINS) {
    if (b[a] && b[a] === b[bI] && b[a] === b[c]) return { winner: b[a], line: [a, bI, c] }
  }
  return { winner: null, line: null }
}
const INACTIVITY_SEC = 6
const GAME_LABELS: Record<string, string> = { tictactoe: 'Tic Tac Toe', colourblock: 'Colour Block' }

interface TTTProps {
  challengeId: string; myId: string; myName: string
  opponentId: string; opponentName: string; amChallenger: boolean
  onResult: (won: boolean, xp: number) => void
  onInactivity: (byName: string) => void
  onExit: () => void
}

function TicTacToeArena({ challengeId, myId, myName, opponentId, opponentName, amChallenger, onResult, onInactivity, onExit }: TTTProps) {
  const [board, setBoard]           = useState<TacCell[]>(Array(9).fill(null))
  const [xIsNext, setXIsNext]       = useState(true)
  const [localDone, setLocalDone]   = useState(false)
  const [inactTimer, setInactTimer] = useState(INACTIVITY_SEC)
  const [showQuit, setShowQuit]     = useState(false)
  const inactivityRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mySymbol: TacCell = amChallenger ? 'X' : 'O'
  const isMyTurn = (xIsNext && mySymbol === 'X') || (!xIsNext && mySymbol === 'O')
  const { winner, line } = checkWin(board)
  const isDraw = !winner && board.every(c => c !== null)
  const gameOver = !!winner || isDraw

  useEffect(() => {
    const ch = supabase.channel(`ttt:${challengeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'challenge_moves', filter: `challenge_id=eq.${challengeId}` }, (payload) => {
        const mv = payload.new as { player_id: string; move_index: number }
        if (mv.player_id === myId) return
        setBoard(prev => { const next = [...prev] as TacCell[]; next[mv.move_index] = amChallenger ? 'O' : 'X'; return next })
        setXIsNext(p => !p); resetInactivity()
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [challengeId, myId, amChallenger])

  function resetInactivity() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    setInactTimer(INACTIVITY_SEC)
  }

  useEffect(() => {
    if (gameOver || localDone) return
    let count = INACTIVITY_SEC
    const tick = setInterval(() => {
      count -= 1; setInactTimer(count)
      if (count <= 0) {
        clearInterval(tick)
        supabase.from('challenges').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', challengeId).eq('status', 'accepted').then(() => {})
        onInactivity(isMyTurn ? myName : opponentName)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [xIsNext, gameOver, localDone])

  useEffect(() => {
    if (!gameOver || localDone) return
    setLocalDone(true)
    const xp = pickXP(); const iWon = winner === mySymbol
    if (iWon) {
      supabase.rpc('resolve_challenge', { p_challenge_id: challengeId, p_winner_id: myId, p_loser_id: opponentId, p_xp: xp }).then(() => {
        supabase.from('notifications').insert([
          { user_id: myId, type: 'challenge', title: '🏆 Challenge Won!', body: `You beat ${opponentName} in Tic Tac Toe. +${xp} XP`, icon: 'swords' },
          { user_id: opponentId, type: 'challenge', title: '⚔️ Challenge Lost', body: `${myName} beat you in Tic Tac Toe.`, icon: 'swords' },
        ])
      })
    }
    setTimeout(() => onResult(iWon, iWon ? xp : 0), 400)
  }, [gameOver])

  async function handleCell(i: number) {
    if (board[i] || gameOver || !isMyTurn) return
    const next = [...board] as TacCell[]; next[i] = mySymbol
    setBoard(next); setXIsNext(t => !t); resetInactivity()
    await supabase.from('challenge_moves').insert({ challenge_id: challengeId, player_id: myId, move_index: i, turn_number: board.filter(Boolean).length })
  }

  const CELL = 92
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, position: 'relative' }}>
      {/* Exit button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setShowQuit(true)} style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.25)', color: '#ff6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <LogOut size={11} /> Exit
        </button>
      </div>

      {/* Turn header */}
      <div style={{ width: '100%', padding: '10px 16px', marginBottom: 16, borderRadius: 14, background: isMyTurn && !gameOver ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${isMyTurn && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isMyTurn && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.3)', boxShadow: isMyTurn && !gameOver ? '0 0 8px var(--accent)' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: isMyTurn && !gameOver ? 'var(--accent)' : 'var(--text-dim)' }}>
            {gameOver ? (winner === mySymbol ? '🎉 You won!' : isDraw ? "It's a draw!" : 'You lost') : isMyTurn ? 'Your turn' : `${opponentName.split(' ')[0]}'s turn`}
          </span>
        </div>
        {!gameOver && <div style={{ fontSize: 11, fontWeight: 800, color: inactTimer <= 2 ? '#ff4d4d' : 'var(--text-muted)', padding: '3px 10px', borderRadius: 8, background: inactTimer <= 2 ? 'rgba(255,77,77,0.12)' : 'var(--surface)', transition: 'all 0.3s' }}>⏱ {inactTimer}s</div>}
      </div>

      {/* Players row */}
      <div style={{ display: 'flex', width: '100%', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 13, background: mySymbol === 'X' && xIsNext && !gameOver ? 'rgba(255,107,0,0.15)' : 'var(--surface)', border: `1.5px solid ${mySymbol === 'X' && xIsNext && !gameOver ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`, textAlign: 'center', transition: 'all 0.2s' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>YOU  ✕</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: mySymbol === 'X' ? 'var(--accent)' : 'var(--text-dim)', marginTop: 2 }}>{mySymbol}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Swords size={14} color="var(--text-muted)" /></div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 13, background: (!isMyTurn && !gameOver) ? 'rgba(155,109,255,0.15)' : 'var(--surface)', border: `1.5px solid ${(!isMyTurn && !gameOver) ? '#9b6dff' : 'rgba(255,255,255,0.07)'}`, textAlign: 'center', transition: 'all 0.2s' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{opponentName.split(' ')[0].toUpperCase()}  ○</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#9b6dff', marginTop: 2 }}>{mySymbol === 'X' ? 'O' : 'X'}</div>
        </div>
      </div>

      {/* Board */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CELL}px)`, gridTemplateRows: `repeat(3, ${CELL}px)`, gap: 10, marginBottom: 20 }}>
        {board.map((cell, i) => {
          const inLine = line?.includes(i)
          return (
            <button key={i} onClick={() => handleCell(i)} aria-label={`Cell ${i + 1}`} style={{ width: CELL, height: CELL, borderRadius: 20, cursor: (cell || gameOver || !isMyTurn) ? 'default' : 'pointer', background: inLine ? (winner === 'X' ? 'rgba(62,207,142,0.18)' : 'rgba(255,77,139,0.18)') : 'var(--surface)', boxShadow: inLine ? `0 0 28px ${winner === 'X' ? 'rgba(62,207,142,0.5)' : 'rgba(255,77,139,0.5)'}` : '4px 4px 12px var(--neu-dark), -3px -3px 8px var(--neu-light)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
              {cell === 'X' && <XIcon size={40} style={{ color: '#3ecf8e' }} />}
              {cell === 'O' && <Circle size={38} style={{ color: 'var(--pink)' }} />}
            </button>
          )
        })}
      </div>

      {/* Quit confirm modal */}
      {showQuit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 24, border: '1px solid rgba(255,77,77,0.25)', padding: '0 0 24px', overflow: 'hidden' }}>
            <img src="https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/cef15292ede33c33aaf06f9bdb71610e.jpg" alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Exit game?</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                Quitting matches frequently can affect your <strong style={{ color: 'var(--accent)' }}>Verse Honour</strong> score and may lead to a ban.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowQuit(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Got it, Stay</button>
                <button onClick={() => { setShowQuit(false); stubDeductHonour(myId); onExit() }} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(255,77,77,0.3)', background: 'rgba(255,77,77,0.1)', color: '#ff6b6b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Exit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Result modals
// ═══════════════════════════════════════════════════════════════════
function WinModal({ xp, opponentName, onPlayAgain, onClose }: { xp: number; opponentName: string; onPlayAgain: () => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 24, border: '1px solid rgba(255,107,0,0.3)', boxShadow: '0 0 60px rgba(255,107,0,0.2), 0 28px 80px rgba(0,0,0,0.8)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)', marginBottom: 6 }}>You Won!</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>You beat <strong style={{ color: 'var(--text)' }}>{opponentName}</strong></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', marginBottom: 24, borderRadius: 14, background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.25)' }}>
          <Zap size={18} color="var(--accent)" />
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>+{xp} XP</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={onPlayAgain} style={{ flex: 2, padding: '12px 0', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Play Again</button>
        </div>
      </div>
    </div>
  )
}

function LoseModal({ opponentName, onRematch, onClose }: { opponentName: string; onRematch: () => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 24, border: '1px solid rgba(255,77,77,0.25)', boxShadow: '0 28px 80px rgba(0,0,0,0.8)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>😔</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#ff6b6b', marginBottom: 6 }}>Challenge Lost</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}><strong style={{ color: 'var(--text)' }}>{opponentName}</strong> beat you this time</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', marginBottom: 24, borderRadius: 14, background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)' }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>+0 XP</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={onRematch} style={{ flex: 2, padding: '12px 0', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#9b6dff,#6a3dff)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Rematch</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════════════════
interface LeaderRow { id: string; username: string; display_name: string | null; avatar: string | null; xp: number; wins: number; losses: number; challenge_xp: number }

function Leaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('challenge_stats').select('id,username,display_name,avatar,xp,wins,losses,challenge_xp').order('challenge_xp', { ascending: false }).limit(20)
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
          <div key={r.id} onClick={() => navigate(`/profile/${r.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: idx < 3 ? `${rank.color}0a` : 'var(--surface)', border: `1px solid ${idx < 3 ? rank.color + '30' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
            <div style={{ width: 28, textAlign: 'center', fontSize: medal ? 18 : 13, fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>{medal ?? `#${idx + 1}`}</div>
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', border: `1.5px solid ${rank.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r.avatar ? <img src={r.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>👤</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name ?? r.username}</div>
              <div style={{ fontSize: 10, color: rank.color, fontWeight: 700 }}>{rank.emoji} {rank.name}</div>
            </div>
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
// My History
// ═══════════════════════════════════════════════════════════════════
interface HistoryRow { id: string; status: string; game: string; winner_id: string | null; xp_awarded: number; completed_at: string | null; challenger: { username: string; display_name: string | null; avatar: string | null } | null; challenged: { username: string; display_name: string | null; avatar: string | null } | null }

function RecentActivity({ myId }: { myId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('challenges').select(`id, status, game, winner_id, xp_awarded, completed_at, challenger:challenger_id(username, display_name, avatar), challenged:challenged_id(username, display_name, avatar)`)
      .or(`challenger_id.eq.${myId},challenged_id.eq.${myId}`).eq('status', 'completed').order('completed_at', { ascending: false }).limit(15)
      .then(({ data }) => { setRows((data ?? []) as unknown as HistoryRow[]); setLoading(false) })
  }, [myId])

  if (loading) return <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
  if (rows.length === 0) return <div style={{ padding: '20px', textAlign: 'center', borderRadius: 14, background: 'var(--surface)', border: '1px dashed rgba(255,255,255,0.08)' }}><Swords size={24} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} /><p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No matches played yet</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => {
        const won = r.winner_id === myId
        const opName = r.challenger?.username === myId ? (r.challenged?.display_name ?? r.challenged?.username ?? 'Unknown') : (r.challenger?.display_name ?? r.challenger?.username ?? 'Unknown')
        const opAvatar = r.challenger?.username === myId ? r.challenged?.avatar : r.challenger?.avatar
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: `1px solid ${won ? 'rgba(62,207,142,0.2)' : 'rgba(255,77,77,0.15)'}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', border: `1.5px solid ${won ? '#3ecf8e44' : '#ff6b6b44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {opAvatar ? <img src={opAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {won ? <CheckCircle size={11} style={{ color: '#3ecf8e', marginRight: 5, display: 'inline' }} /> : <XCircle size={11} style={{ color: '#ff6b6b', marginRight: 5, display: 'inline' }} />}
                {won ? 'Beat' : 'Lost to'} {opName}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{GAME_LABELS[r.game] ?? r.game} · {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ''}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: won ? '#3ecf8e' : 'var(--text-muted)' }}>{won ? `+${r.xp_awarded}` : '+0'} XP</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Games Tab — pick a game → choose Public/Private → create room
// ═══════════════════════════════════════════════════════════════════
interface GamesTabProps { myId: string; onRoomCreated: (roomId: string) => void }

function GamesTab({ myId, onRoomCreated }: GamesTabProps) {
  const [selected, setSelected] = useState<GameDef | null>(null)
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null)
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const { toasts, show: showToast } = useToast()

  async function createRoom() {
    if (!selected) return
    setCreating(true)
    try {
      // Generate 5-digit team code
      const teamCode = Math.floor(10000 + Math.random() * 90000).toString()
      const isPrivate = visibility === 'private'

      const { data: room, error } = await supabase.from('game_rooms').insert({
        game_id: selected.id,
        room_name: `${selected.label} Room`,
        host_id: myId,
        is_private: isPrivate,
        password_hash: isPrivate && password ? password : null, // raw; real hashing via edge fn
        status: 'waiting',
        max_player_count: selected.maxPlayers,
        min_player_count: selected.minPlayers,
        team_code: teamCode,
      }).select('id').single()

      if (error || !room) { showToast('Could not create room. Try again.', <XIcon size={13} />, 'rgba(255,77,77,0.5)'); setCreating(false); return }

      // Add host as first player
      await supabase.from('room_players').insert({ room_id: room.id, player_id: myId, is_host: true })
      onRoomCreated(room.id)
    } catch {
      showToast('Something went wrong.', <XIcon size={13} />, 'rgba(255,77,77,0.5)')
    }
    setCreating(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ToastStack toasts={toasts} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Select a Game</div>

      {GAMES.map(g => (
        <button key={g.id} disabled={!g.available} onClick={() => { if (g.available) setSelected(selected?.id === g.id ? null : g) }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: selected?.id === g.id ? `${g.accent}10` : 'var(--surface)', border: `1.5px solid ${selected?.id === g.id ? g.accent + '60' : g.available ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`, cursor: g.available ? 'pointer' : 'default', textAlign: 'left', opacity: g.available ? 1 : 0.5, transition: 'all 0.15s' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: `${g.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{g.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{g.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{g.description}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: g.available ? g.accent : 'var(--text-muted)', background: `${g.accent}15`, padding: '3px 8px', borderRadius: 8 }}>{g.minPlayers === g.maxPlayers ? `${g.minPlayers} players` : `${g.minPlayers}–${g.maxPlayers} players`}</div>
          </div>
          {selected?.id === g.id && <ChevronRight size={14} color={g.accent} style={{ flexShrink: 0 }} />}
        </button>
      ))}

      {/* Visibility picker */}
      {selected && (
        <div style={{ animation: 'achSlideIn 0.25s ease both' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, marginTop: 4 }}>Room Type</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: visibility === 'private' ? 12 : 0 }}>
            {(['public', 'private'] as const).map(v => (
              <button key={v} onClick={() => { setVisibility(v); setPassword('') }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: `1.5px solid ${visibility === v ? (v === 'private' ? '#9b6dff60' : 'rgba(255,107,0,0.5)') : 'rgba(255,255,255,0.08)'}`, background: visibility === v ? (v === 'private' ? 'rgba(155,109,255,0.1)' : 'rgba(255,107,0,0.08)') : 'var(--surface)', color: visibility === v ? 'var(--text)' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s' }}>
                {v === 'public' ? <Unlock size={13} /> : <Lock size={13} />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {visibility === 'private' && (
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Set a room password…" type="password"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 13, background: 'var(--surface)', border: '1.5px solid rgba(155,109,255,0.3)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          )}

          {visibility && (
            <button onClick={createRoom} disabled={creating || (visibility === 'private' && !password.trim())} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: creating || (visibility === 'private' && !password.trim()) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: creating || (visibility === 'private' && !password.trim()) ? 'var(--text-muted)' : '#fff', fontSize: 14, fontWeight: 800, cursor: creating || (visibility === 'private' && !password.trim()) ? 'default' : 'pointer', transition: 'all 0.15s', marginTop: 4 }}>
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Rooms Tab — browse public rooms + join by team code
// ═══════════════════════════════════════════════════════════════════
interface RoomRow { id: string; game_id: string; room_name: string; host_id: string; is_private: boolean; status: string; current_player_count: number; max_player_count: number; min_player_count: number; team_code: string; created_at: string }

interface RoomsTabProps { myId: string; onJoinRoom: (roomId: string) => void }

function RoomsTab({ myId, onJoinRoom }: RoomsTabProps) {
  const [rooms, setRooms]       = useState<RoomRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundRoom, setFoundRoom] = useState<RoomRow | null>(null)
  const [pwInput, setPwInput]   = useState('')
  const [showPwFor, setShowPwFor] = useState<string | null>(null)
  const [joining, setJoining]   = useState(false)
  const { toasts, show: showToast } = useToast()

  useEffect(() => {
    loadRooms()
    const ch = supabase.channel('public-rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, loadRooms)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadRooms() {
    const { data } = await supabase.from('game_rooms').select('*').eq('is_private', false).eq('status', 'waiting').order('created_at', { ascending: false }).limit(20)
    setRooms((data ?? []) as RoomRow[]); setLoading(false)
  }

  async function searchByCode() {
    const code = codeInput.trim()
    if (code.length !== 5) { showToast('Enter a 5-digit code', <Search size={13} />); return }
    setSearching(true); setFoundRoom(null)
    const { data } = await supabase.from('game_rooms').select('*').eq('team_code', code).eq('status', 'waiting').maybeSingle()
    setSearching(false)
    if (!data) { showToast('Room not found or already started', <XIcon size={13} />, 'rgba(255,77,77,0.5)'); return }
    setFoundRoom(data as RoomRow)
  }

  async function attemptJoin(room: RoomRow, password?: string) {
    setJoining(true)
    // Check already in room
    const { data: existing } = await supabase.from('room_players').select('room_id').eq('room_id', room.id).eq('player_id', myId).maybeSingle()
    if (existing) { onJoinRoom(room.id); return }

    if (room.is_private) {
      const { data: result } = await supabase.rpc('join_private_room', { p_room_id: room.id, p_password: password ?? '' })
      const res = result as { ok: boolean; error?: string; already_member?: boolean }
      if (!res?.ok) { showToast(res?.error ?? 'Wrong password', <Lock size={13} />, 'rgba(255,77,77,0.5)'); setJoining(false); return }
    } else {
      if (room.current_player_count >= room.max_player_count) { showToast('Room is full', <Users size={13} />, 'rgba(255,77,77,0.5)'); setJoining(false); return }
      await supabase.from('room_players').insert({ room_id: room.id, player_id: myId, is_host: false })
    }
    setJoining(false); setShowPwFor(null); setPwInput(''); onJoinRoom(room.id)
  }

  function handleJoinTap(room: RoomRow) {
    if (room.is_private) { setShowPwFor(room.id); setPwInput('') }
    else attemptJoin(room)
  }

  const RoomCard = ({ room }: { room: RoomRow }) => {
    const game = getGame(room.game_id)
    const isFull = room.current_player_count >= room.max_player_count
    return (
      <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${game?.accent ?? '#ff6b00'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{game?.icon ?? <Swords size={18} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.room_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{room.current_player_count}/{room.max_player_count} players · {game?.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: isFull ? 'rgba(255,77,77,0.12)' : 'rgba(62,207,142,0.12)', color: isFull ? '#ff6b6b' : '#3ecf8e', border: `1px solid ${isFull ? 'rgba(255,77,77,0.25)' : 'rgba(62,207,142,0.25)'}` }}>{isFull ? 'Full' : 'Open'}</span>
          {!isFull && <button onClick={() => handleJoinTap(room)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Join</button>}
        </div>
        {room.is_private && <Lock size={11} color="rgba(255,255,255,0.3)" />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ToastStack toasts={toasts} />

      {/* Code search */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Join by Team Code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="5-digit code…" maxLength={5}
            style={{ flex: 1, padding: '11px 14px', borderRadius: 13, background: 'var(--surface)', border: '1.5px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontSize: 14, outline: 'none', letterSpacing: 4, fontWeight: 800 }} />
          <button onClick={searchByCode} disabled={searching} style={{ padding: '11px 16px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {searching ? '…' : <Search size={16} />}
          </button>
        </div>

        {/* Found room result */}
        {foundRoom && (
          <div style={{ marginTop: 10, animation: 'achSlideIn 0.25s ease both' }}>
            <RoomCard room={foundRoom} />
          </div>
        )}
      </div>

      {/* Public rooms */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Public Rooms</div>
        {loading ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>Loading…</div>
          : rooms.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', borderRadius: 14, background: 'var(--surface)', border: '1px dashed rgba(255,255,255,0.08)' }}><p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No open rooms right now. Create one from Games!</p></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rooms.map((r, i) => <RoomCard key={r.id ?? i} room={r as RoomRow} />)}</div>}
      </div>

      {/* Password modal */}
      {showPwFor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: '24px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Private Room</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Enter the room password to join.</div>
            <input value={pwInput} onChange={e => setPwInput(e.target.value)} placeholder="Room password…" type="password"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 13, background: 'var(--surface)', border: '1.5px solid rgba(155,109,255,0.3)', color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowPwFor(null); setPwInput('') }} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button disabled={!pwInput.trim() || joining} onClick={() => { const r = rooms.find(x => x.id === showPwFor) ?? foundRoom; if (r) attemptJoin(r, pwInput) }}
                style={{ flex: 2, padding: '12px 0', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#9b6dff,#6a3dff)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {joining ? 'Joining…' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Lobby — realtime room with chat, positions, team code, invite
// ═══════════════════════════════════════════════════════════════════
interface RoomPlayer { player_id: string; is_host: boolean; username?: string; display_name?: string | null; avatar?: string | null; position?: number }
interface ChatMsg { id: string; player_id: string; message: string; created_at: string; username?: string; avatar?: string | null }

interface LobbyProps {
  roomId: string
  myId: string
  myName: string
  onGameStart: (roomId: string, gameId: string) => void
  onLeave: () => void
}

function Lobby({ roomId, myId, myName, onGameStart, onLeave }: LobbyProps) {
  const [room, setRoom]           = useState<RoomRow | null>(null)
  const [players, setPlayers]     = useState<RoomPlayer[]>([])
  const [messages, setMessages]   = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [showCode, setShowCode]   = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [follows, setFollows]     = useState<{ id: string; display_name: string | null; username: string; avatar: string | null }[]>([])
  const [inviteSending, setInviteSending] = useState<string | null>(null)
  const chatBottomRef             = useRef<HTMLDivElement>(null)
  const { toasts, show: showToast } = useToast()

  const isHost = players.find(p => p.player_id === myId)?.is_host ?? false
  const maxPlayers = room?.max_player_count ?? 2
  const minPlayers = room?.min_player_count ?? 2

  // ── Load room info ──
  useEffect(() => {
    supabase.from('game_rooms').select('*').eq('id', roomId).single().then(({ data }) => setRoom(data as RoomRow))
  }, [roomId])

  // ── Load follows for invite ──
  useEffect(() => {
    supabase.from('follows').select('following_id').eq('follower_id', myId).then(async ({ data }) => {
      if (!data?.length) return
      const ids = data.map((r: { following_id: string }) => r.following_id)
      const { data: profiles } = await supabase.from('profiles').select('id,display_name,username,avatar').in('id', ids)
      setFollows((profiles ?? []) as typeof follows)
    })
  }, [myId])

  // ── Load players with profiles ──
  async function loadPlayers() {
    const { data } = await supabase.from('room_players').select('player_id, is_host, joined_at').eq('room_id', roomId).order('joined_at', { ascending: true })
    if (!data) return
    const ids = data.map((r: { player_id: string }) => r.player_id)
    const { data: profiles } = await supabase.from('profiles').select('id,username,display_name,avatar').in('id', ids)
    const profileMap: Record<string, { id: string; username: string; display_name: string | null; avatar: string | null }> = {}
    ;(profiles ?? []).forEach((p: { id: string; username: string; display_name: string | null; avatar: string | null }) => { profileMap[p.id] = p })
    setPlayers(data.map((r: { player_id: string; is_host: boolean }, i: number) => ({ ...r, ...profileMap[r.player_id], position: i + 1 })))
  }

  // ── Load messages ──
  async function loadMessages() {
    const { data } = await supabase.from('room_messages').select('id, player_id, message, created_at').eq('room_id', roomId).order('created_at', { ascending: true }).limit(50)
    if (!data) return
    const ids = [...new Set(data.map((m: { player_id: string }) => m.player_id))]
    const { data: profiles } = await supabase.from('profiles').select('id,username,avatar').in('id', ids)
    const pm: Record<string, { id: string; username: string; avatar: string | null }> = {}
    ;(profiles ?? []).forEach((p: { id: string; username: string; avatar: string | null }) => { pm[p.id] = p })
    setMessages(data.map((m: ChatMsg) => ({ ...m, username: pm[m.player_id]?.username, avatar: pm[m.player_id]?.avatar })))
  }

  useEffect(() => { loadPlayers(); loadMessages() }, [roomId])

  // ── Realtime subscriptions ──
  useEffect(() => {
    const ch = supabase.channel(`lobby:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, loadPlayers)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
        const m = payload.new as ChatMsg
        const { data: p } = await supabase.from('profiles').select('username,avatar').eq('id', m.player_id).single()
        setMessages(prev => [...prev, { ...m, username: p?.username, avatar: p?.avatar }])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new as RoomRow
        setRoom(updated)
        if (updated.status === 'countdown') {
          // Start 5-second countdown for all players
          let c = 5
          setCountdown(c)
          const t = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(t); setCountdown(null); onGameStart(roomId, updated.game_id) } }, 1000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId])

  // ── Auto scroll chat ──
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendChat() {
    const msg = chatInput.trim(); if (!msg) return
    setChatInput('')
    await supabase.from('room_messages').insert({ room_id: roomId, player_id: myId, message: msg })
  }

  async function switchPosition(toPosition: number) {
    const targetPlayer = players.find(p => p.position === toPosition)
    if (targetPlayer || toPosition > maxPlayers) return
    // Re-insert at end = update joined_at isn't possible simply, just notify
    showToast(`Switched to slot ${toPosition}`, <Users size={13} />, 'rgba(255,107,0,0.5)')
  }

  async function startGame() {
    if (players.length < minPlayers) {
      showToast(`Need ${minPlayers} players to start`, <Trophy size={13} />, 'rgba(155,109,255,0.5)')
      return
    }
    await supabase.from('game_rooms').update({ status: 'countdown', countdown_start_at: new Date().toISOString() }).eq('id', roomId)
    // Countdown fires via realtime for all players
    let c = 5; setCountdown(c)
    const t = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(t); setCountdown(null); onGameStart(roomId, room!.game_id) } }, 1000)
  }

  async function leaveRoom() {
    await supabase.from('room_players').delete().eq('room_id', roomId).eq('player_id', myId)
    onLeave()
  }

  async function sendInvite(targetId: string) {
    setInviteSending(targetId)
    await supabase.from('room_invites').insert({ room_id: roomId, sender_id: myId, receiver_id: targetId }).then(() => {}, () => {})
    // Notify via notifications table
    await supabase.from('notifications').insert({ user_id: targetId, type: 'room_invite', title: '🎮 Room Invite', body: `${myName} invited you to join a game room!`, icon: 'swords', meta: { room_id: roomId } })
    showToast('Invite sent!', <Send size={13} />, 'rgba(62,207,142,0.5)')
    setInviteSending(null)
  }

  const game = room ? getGame(room.game_id) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', position: 'relative' }}>
      <ToastStack toasts={toasts} />

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>GAME STARTING</div>
          <div style={{ fontSize: 96, fontWeight: 900, color: 'var(--accent)', lineHeight: 1, animation: 'pulse 0.9s ease infinite' }}>{countdown || '🔥'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{game?.label}</div>
        </div>
      )}

      {/* Lobby header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={leaveRoom} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{room?.room_name ?? 'Lobby'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{players.length}/{maxPlayers} players · {game?.label}</div>
        </div>

        {/* Flag (team code) */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowCode(s => !s); setShowSettings(false) }} style={{ width: 34, height: 34, borderRadius: 10, background: showCode ? 'rgba(255,107,0,0.15)' : 'var(--surface)', border: `1px solid ${showCode ? 'rgba(255,107,0,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', color: showCode ? 'var(--accent)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flag size={14} />
          </button>
          {showCode && room && (
            <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 200, background: 'var(--surface2)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: 14, padding: '12px 14px', minWidth: 180, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', animation: 'achSlideIn 0.2s ease both' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Team Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', letterSpacing: 4 }}>{room.team_code}</span>
                <button onClick={() => { navigator.clipboard.writeText(room.team_code); showToast('Code copied!', <Copy size={13} />, 'rgba(62,207,142,0.5)') }} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Copy size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowSettings(s => !s); setShowCode(false) }} style={{ width: 34, height: 34, borderRadius: 10, background: showSettings ? 'rgba(155,109,255,0.15)' : 'var(--surface)', border: `1px solid ${showSettings ? 'rgba(155,109,255,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', color: showSettings ? '#9b6dff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings2 size={14} />
            </button>
            {showSettings && (
              <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 200, background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '8px', minWidth: 160, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', animation: 'achSlideIn 0.2s ease both' }}>
                {room?.is_private && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Password: <strong style={{ color: 'var(--text)' }}>set</strong></div>}
                <button onClick={async () => { await supabase.from('game_rooms').update({ status: 'completed' }).eq('id', roomId); leaveRoom() }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'rgba(255,77,77,0.1)', color: '#ff6b6b', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>Close Room</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player slots */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Players {players.length}/{maxPlayers}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: maxPlayers }).map((_, idx) => {
            const pos = idx + 1
            const player = players.find(p => p.position === pos)
            const isEmpty = !player
            return (
              <div key={pos} onClick={() => isEmpty && switchPosition(pos)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: player?.player_id === myId ? 'rgba(255,107,0,0.08)' : 'var(--surface)', border: `1px solid ${player?.player_id === myId ? 'rgba(255,107,0,0.3)' : isEmpty ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`, cursor: isEmpty ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                <div style={{ width: 24, fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>#{pos}</div>
                {player ? (
                  <>
                    <div style={{ width: 32, height: 32, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {player.avatar ? <img src={player.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14 }}>👤</span>}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{player.display_name ?? player.username ?? 'Player'}{player.player_id === myId ? ' (You)' : ''}</div>
                    {player.is_host && <Crown size={13} color="var(--accent)" />}
                  </>
                ) : (
                  <>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>Empty slot — tap to switch here</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14, overflow: 'hidden', flex: 1 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <MessageCircle size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lobby Chat</span>
        </div>
        <div style={{ height: 140, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>No messages yet. Say hi! 👋</div>}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 }}>
                {m.avatar ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>👤</div>}
              </div>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: m.player_id === myId ? 'var(--accent)' : '#9b6dff', marginRight: 5 }}>{m.username ?? 'User'}</span>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.message}</span>
              </div>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
        <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Message…"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
          <button onClick={sendChat} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={13} />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setShowInvite(true)} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Send size={13} /> Invite
        </button>
        {isHost ? (
          <button onClick={startGame} style={{ flex: 2, padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Swords size={14} /> Start Game
          </button>
        ) : (
          <div style={{ flex: 2, padding: '13px 0', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Clock size={13} /> Waiting for host
          </div>
        )}
      </div>

      {/* Invite modal — follows only */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface2)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)', padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Invite to Room</div>
              <button onClick={() => setShowInvite(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>People you follow</div>
            {follows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>You're not following anyone yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {follows.map(f => {
                  const alreadyIn = players.some(p => p.player_id === f.id)
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {f.avatar ? <img src={f.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{f.display_name ?? f.username}</div>
                      {alreadyIn ? (
                        <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 700 }}>In room</span>
                      ) : (
                        <button onClick={() => sendInvite(f.id)} disabled={inviteSending === f.id} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: inviteSending === f.id ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: inviteSending === f.id ? 'var(--text-muted)' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {inviteSending === f.id ? '…' : 'Invite'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Old 1v1 ChallengeFullModal — preserved for PlayerProfile usage
// ═══════════════════════════════════════════════════════════════════
const PLACEHOLDER_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_0000000071e471f4abb27ed6b9870126.png'
type Phase = 'picker' | 'waiting' | 'timeout' | 'accepted' | 'result_win' | 'result_lose' | 'inactivity'

interface WaitingModalProps { opponentId: string; opponentName: string; myId: string; myName: string; onClose: () => void; prefillChallengeId?: string; prefillGame?: string }

export function ChallengeFullModal({ opponentId, opponentName, myId, myName, onClose, prefillChallengeId, prefillGame }: WaitingModalProps) {
  const [phase, setPhase]           = useState<Phase>(prefillChallengeId ? 'accepted' : 'picker')
  const [selectedGame, setGame]     = useState<string>(prefillGame ?? '')
  const [challengeId, setChallengeId] = useState<string>(prefillChallengeId ?? '')
  const [resultXP, setResultXP]     = useState(0)
  const [inactName, setInactName]   = useState('')
  const [toast, setToast]           = useState<string | null>(null)
  const timeoutRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  async function handlePickGame(game: string) {
    setGame(game)
    const { data: activeChallenge } = await supabase.from('challenges').select('id').or(`challenger_id.eq.${opponentId},challenged_id.eq.${opponentId}`).eq('status', 'accepted').maybeSingle()
    if (activeChallenge) { showToast(`${opponentName} is already in a challenge.`); return }
    const { data, error } = await supabase.from('challenges').insert({ challenger_id: myId, challenged_id: opponentId, game }).select('id').single()
    if (error || !data) { showToast('Could not send challenge.'); return }
    setChallengeId(data.id); setPhase('waiting')
    timeoutRef.current = setTimeout(async () => { await supabase.from('challenges').update({ status: 'timeout' }).eq('id', data.id).eq('status', 'pending'); setPhase('timeout') }, 10000)
  }

  useEffect(() => {
    if (!challengeId) return
    const ch = supabase.channel(`challenge-modal:${challengeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `id=eq.${challengeId}` }, (payload) => {
        const row = payload.new as { status: string }
        if (row.status === 'accepted') { if (timeoutRef.current) clearTimeout(timeoutRef.current); setPhase('accepted') }
        if (row.status === 'declined') { if (timeoutRef.current) clearTimeout(timeoutRef.current); showToast(`${opponentName} declined.`); setPhase('picker') }
      }).subscribe()
    return () => { supabase.removeChannel(ch); if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [challengeId])

  async function handleResult(won: boolean, xp: number) { setResultXP(xp); setPhase(won ? 'result_win' : 'result_lose') }
  async function handlePlayAgain() { await handlePickGame(selectedGame) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface2)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 80px rgba(0,0,0,0.8)', padding: '22px 20px', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
        {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,24,0.96)', border: '1px solid rgba(255,77,77,0.4)', borderRadius: 14, padding: '11px 18px', fontSize: 12, fontWeight: 600, color: 'var(--text)', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}>{toast}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {phase !== 'picker' && <button onClick={() => { setPhase('picker'); setChallengeId(''); if (timeoutRef.current) clearTimeout(timeoutRef.current) }} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{phase === 'picker' ? `Challenge ${opponentName}` : GAME_LABELS[selectedGame] ?? selectedGame}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{phase === 'picker' ? 'Pick a game' : phase === 'waiting' ? 'Waiting…' : phase === 'accepted' ? 'Live match' : phase === 'timeout' ? 'Invite expired' : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
        </div>

        {phase === 'picker' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Quick Start</div>
            <button onClick={() => handlePickGame('tictactoe')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(62,207,142,0.3)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(62,207,142,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Grid3X3 size={22} color="#3ecf8e" /></div>
              <div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Tic Tac Toe</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Classic 3-in-a-row · Challenge now</div></div>
              <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text-muted)' }}>›</div>
            </button>
            <div style={{ marginTop: 8, borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
              <img src={PLACEHOLDER_IMG} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.08)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.7))', display: 'flex', alignItems: 'flex-end', padding: '0 14px 14px' }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>Open full challenge page to see rooms and create lobbies.</p>
              </div>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Invite sent to {opponentName}</div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 20 }}><div style={{ height: '100%', background: 'var(--accent)', animation: 'waitProgress 10s linear forwards' }} /></div>
            <button onClick={() => { setPhase('picker'); if (timeoutRef.current) clearTimeout(timeoutRef.current) }} style={{ width: '100%', padding: 12, borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <style>{`@keyframes waitProgress { from { width: 100% } to { width: 0% } }`}</style>
          </div>
        )}

        {phase === 'timeout' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⌛</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Challenge Timed Out</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{opponentName} didn't respond in time.</div>
            <button onClick={() => setPhase('picker')} style={{ width: '100%', padding: 12, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Try Again</button>
          </div>
        )}

        {phase === 'inactivity' && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>😴</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Session Ended</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>Inactivity from <strong style={{ color: 'var(--text)' }}>{inactName}</strong> ended the session.</div>
            <button onClick={() => setPhase('picker')} style={{ width: '100%', padding: 12, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Start New Challenge</button>
          </div>
        )}

        {phase === 'accepted' && challengeId && selectedGame === 'tictactoe' && (
          <TicTacToeArena challengeId={challengeId} myId={myId} myName={myName} opponentId={opponentId} opponentName={opponentName} amChallenger onResult={handleResult} onInactivity={(name) => { setInactName(name); setPhase('inactivity') }} onExit={onClose} />
        )}
      </div>

      {phase === 'result_win' && <WinModal xp={resultXP} opponentName={opponentName} onClose={onClose} onPlayAgain={handlePlayAgain} />}
      {phase === 'result_lose' && <LoseModal opponentName={opponentName} onClose={onClose} onRematch={handlePlayAgain} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Return-to-Lobby floating bar (exported for AppLayout)
// ═══════════════════════════════════════════════════════════════════
export function ReturnToLobbyBar({ onReturn }: { roomId: string; onReturn: () => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 400, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(14,14,18,0.96)', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 40, boxShadow: '0 8px 28px rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)', animation: 'achSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both', whiteSpace: 'nowrap' }}>
      <Home size={14} color="var(--accent)" />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>You're in a lobby</span>
      <button onClick={onReturn} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Return</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Challenges Page
// ═══════════════════════════════════════════════════════════════════
type PageTab = 'leaderboard' | 'history' | 'games' | 'rooms'

export default function Challenges() {
  const { session } = useAuth()
  const myId = session?.user?.id ?? ''
  const [myName, setMyName] = useState('You')
  const [tab, setTab] = useState<PageTab>('leaderboard')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Legacy 1v1 flow (from URL params)
  const urlChallengeId  = searchParams.get('cid') ?? ''
  const urlOpponentId   = searchParams.get('oid') ?? ''
  const urlOpponentName = searchParams.get('oname') ?? 'Opponent'
  const urlGame         = searchParams.get('game') ?? 'tictactoe'
  const [legacyModalOpen, setLegacyModalOpen] = useState(!!urlChallengeId || !!urlOpponentId)

  // Lobby state
  const [activeRoomId, setActiveRoomId]         = useState<string | null>(null)
  const [inLobby, setInLobby]                   = useState(false)

  useEffect(() => {
    if (!myId) return
    supabase.from('profiles').select('display_name,username').eq('id', myId).single()
      .then(({ data }) => { if (data) setMyName(data.display_name ?? data.username) })
  }, [myId])

  function handleRoomCreated(roomId: string) {
    setActiveRoomId(roomId); setInLobby(true); setTab('games')
    // @ts-ignore
    window.__cvSetActiveLobby?.(roomId)
    // @ts-ignore
    window.__cvSetInLobbyPage?.(true)
  }

  function handleJoinRoom(roomId: string) {
    setActiveRoomId(roomId); setInLobby(true); setTab('rooms')
    // @ts-ignore
    window.__cvSetActiveLobby?.(roomId)
    // @ts-ignore
    window.__cvSetInLobbyPage?.(true)
  }

  function handleGameStart(_roomId: string, _gameId: string) {
    // countdown is handled globally via AppLayout realtime listener
    // navigation fires automatically when countdown ends
  }

  function handleLobbyLeave() {
    setActiveRoomId(null); setInLobby(false)
    // @ts-ignore
    window.__cvSetActiveLobby?.(null)
    // @ts-ignore
    window.__cvSetInLobbyPage?.(false)
  }

  // When user navigates back to challenges with a lobby param
  useEffect(() => {
    const lobbyParam = searchParams.get('lobby') ?? searchParams.get('joinroom')
    if (lobbyParam && !inLobby) {
      setActiveRoomId(lobbyParam); setInLobby(true)
      // @ts-ignore
      window.__cvSetActiveLobby?.(lobbyParam)
      // @ts-ignore
      window.__cvSetInLobbyPage?.(true)
    }
  }, [searchParams])

  // Track when user leaves challenges page
  useEffect(() => {
    // @ts-ignore
    window.__cvSetInLobbyPage?.(inLobby)
  }, [inLobby])

  const TABS: { id: PageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'leaderboard', label: 'Leaderboard', icon: <Crown size={12} /> },
    { id: 'history',     label: 'History',     icon: <Clock size={12} /> },
    { id: 'games',       label: 'Games',        icon: <Grid3X3 size={12} /> },
    { id: 'rooms',       label: 'Rooms',        icon: <Users size={12} /> },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 100px' }}>
      {/* Header with back arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/dashboard')} style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Swords size={22} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Challenges</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Head-to-head matches</div>
        </div>
      </div>

      {/* Lobby view (replaces tabs when in a room) */}
      {inLobby && activeRoomId ? (
        <Lobby
          roomId={activeRoomId}
          myId={myId}
          myName={myName}
          onGameStart={handleGameStart}
          onLeave={handleLobbyLeave}
        />
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface)', borderRadius: 14, padding: 4 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '9px 0', borderRadius: 11, border: 'none', background: tab === t.id ? 'var(--surface2)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'leaderboard' && <Leaderboard />}
          {tab === 'history'     && <RecentActivity myId={myId} />}
          {tab === 'games'       && <GamesTab myId={myId} onRoomCreated={handleRoomCreated} />}
          {tab === 'rooms'       && <RoomsTab myId={myId} onJoinRoom={handleJoinRoom} />}
        </>
      )}

      {/* Legacy 1v1 modal */}
      {legacyModalOpen && urlOpponentId && (
        <ChallengeFullModal
          opponentId={urlOpponentId}
          opponentName={urlOpponentName}
          myId={myId}
          myName={myName}
          onClose={() => { setLegacyModalOpen(false); navigate('/challenges', { replace: true }) }}
          prefillChallengeId={urlChallengeId || undefined}
          prefillGame={urlGame || undefined}
        />
      )}

      {/* Return to lobby bar — shown if user navigated away from lobby */}
      {activeRoomId && !inLobby && (
        <ReturnToLobbyBar roomId={activeRoomId} onReturn={() => setInLobby(true)} />
      )}

      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.08); opacity: 0.85 } }
      `}</style>
    </div>
  )
}
