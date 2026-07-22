// src/pages/games/ChillverseChess.tsx
// Chess vs AI — full legal-move engine (castling, en passant, promotion,
// check/checkmate/stalemate) with a hardened minimax + alpha-beta + quiescence
// AI. Restyled to Chillverse's neu-card design system and wired through the
// same GameShell conventions as every other game (PreGameModal / GameHUD /
// QuitModal). One game = one session: no mid-game restart button — the game
// either ends in a win/loss/draw modal with a single "End Session" action,
// or is abandoned early via the quit confirmation in the HUD.
//
// Highlights/share-to-highlights is intentionally left out here — that gets
// wired in separately for the Vs AI / Community sections of Multiplayer.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Crown } from 'lucide-react'
import type { GameRank, GameEndPayload } from './types'
import { PreGameModal, GameHUD, QuitModal, useRankStreak } from './GameShell'
import { useGamePresence } from '../useGamePresence'

const ACCENT = '#c9a24b'   // royal gold — player / white
const AI_COLOR_UI = '#8b7bff' // violet — AI / black
const GAME_ID = 'chess' as const

/* ------------------------------------------------------------------ */
/*  CHESS ENGINE (pure functions, no UI concerns)                      */
/* ------------------------------------------------------------------ */

type PColor = 'w' | 'b'
type PType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
interface Piece { type: PType; color: PColor; hasMoved: boolean }
type Board = (Piece | null)[][]
interface EnPassant { row: number; col: number }
interface MoveTarget { row: number; col: number; special: string }
interface FullMove { from: { row: number; col: number }; to: MoveTarget }

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const sq = (r: number, c: number) => FILES[c] + (8 - r)

function initialBoard(): Board {
  const back: PType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: 'b', hasMoved: false }
    board[1][c] = { type: 'P', color: 'b', hasMoved: false }
    board[6][c] = { type: 'P', color: 'w', hasMoved: false }
    board[7][c] = { type: back[c], color: 'w', hasMoved: false }
  }
  return board
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(p => (p ? { ...p } : null)))
}

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8

const KNIGHT_OFFS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING_OFFS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]

function getPseudoMoves(board: Board, r: number, c: number, enPassant: EnPassant | null, opts: { castling: boolean } = { castling: true }): MoveTarget[] {
  const piece = board[r][c]
  if (!piece) return []
  const moves: MoveTarget[] = []
  const dir = piece.color === 'w' ? -1 : 1
  const enemyColor: PColor = piece.color === 'w' ? 'b' : 'w'

  const addIfValid = (nr: number, nc: number, special = 'normal') => {
    if (!inBounds(nr, nc)) return
    const target = board[nr][nc]
    if (!target) moves.push({ row: nr, col: nc, special })
    else if (target.color === enemyColor) moves.push({ row: nr, col: nc, special: 'capture' })
  }

  if (piece.type === 'P') {
    const oneR = r + dir
    if (inBounds(oneR, c) && !board[oneR][c]) {
      const promo = oneR === 0 || oneR === 7
      moves.push({ row: oneR, col: c, special: promo ? 'promotion' : 'normal' })
      const startRow = piece.color === 'w' ? 6 : 1
      const twoR = r + dir * 2
      if (r === startRow && !board[twoR][c]) moves.push({ row: twoR, col: c, special: 'double' })
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc
      if (!inBounds(nr, nc)) continue
      const target = board[nr][nc]
      if (target && target.color === enemyColor) {
        const promo = nr === 0 || nr === 7
        moves.push({ row: nr, col: nc, special: promo ? 'promotion-capture' : 'capture' })
      } else if (enPassant && enPassant.row === nr && enPassant.col === nc && !target) {
        moves.push({ row: nr, col: nc, special: 'enpassant' })
      }
    }
  } else if (piece.type === 'N') {
    for (const [dr, dc] of KNIGHT_OFFS) addIfValid(r + dr, c + dc)
  } else if (piece.type === 'K') {
    for (const [dr, dc] of KING_OFFS) addIfValid(r + dr, c + dc)
    if (opts.castling && !piece.hasMoved) {
      const rookK = board[r][7]
      if (rookK && rookK.type === 'R' && !rookK.hasMoved && !board[r][5] && !board[r][6] &&
        !isSquareAttacked(board, r, 4, enemyColor) && !isSquareAttacked(board, r, 5, enemyColor) && !isSquareAttacked(board, r, 6, enemyColor)) {
        moves.push({ row: r, col: 6, special: 'castle-king' })
      }
      const rookQ = board[r][0]
      if (rookQ && rookQ.type === 'R' && !rookQ.hasMoved && !board[r][1] && !board[r][2] && !board[r][3] &&
        !isSquareAttacked(board, r, 4, enemyColor) && !isSquareAttacked(board, r, 3, enemyColor) && !isSquareAttacked(board, r, 2, enemyColor)) {
        moves.push({ row: r, col: 2, special: 'castle-queen' })
      }
    }
  } else {
    const dirs = piece.type === 'B' ? BISHOP_DIRS : piece.type === 'R' ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS]
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc
      while (inBounds(nr, nc)) {
        const target = board[nr][nc]
        if (!target) moves.push({ row: nr, col: nc, special: 'normal' })
        else {
          if (target.color === enemyColor) moves.push({ row: nr, col: nc, special: 'capture' })
          break
        }
        nr += dr; nc += dc
      }
    }
  }
  return moves
}

function getAttackSquares(board: Board, r: number, c: number): { row: number; col: number }[] {
  const piece = board[r][c]
  if (!piece) return []
  if (piece.type === 'P') {
    const dir = piece.color === 'w' ? -1 : 1
    return [[r + dir, c - 1], [r + dir, c + 1]]
      .filter(([nr, nc]) => inBounds(nr, nc))
      .map(([nr, nc]) => ({ row: nr, col: nc }))
  }
  return getPseudoMoves(board, r, c, null, { castling: false })
}

function isSquareAttacked(board: Board, row: number, col: number, byColor: PColor): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === byColor) {
        const moves = getAttackSquares(board, r, c)
        if (moves.some(m => m.row === row && m.col === col)) return true
      }
    }
  return false
}

function findKing(board: Board, color: PColor) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'K' && p.color === color) return { row: r, col: c }
    }
  return null
}

function isInCheck(board: Board, color: PColor): boolean {
  const k = findKing(board, color)
  if (!k) return false
  const enemy: PColor = color === 'w' ? 'b' : 'w'
  return isSquareAttacked(board, k.row, k.col, enemy)
}

function applyMove(board: Board, from: { row: number; col: number }, to: { row: number; col: number }, special: string, promotionType?: PType) {
  const b = cloneBoard(board)
  const piece = b[from.row][from.col]!
  let captured = b[to.row][to.col] || null
  let newEnPassant: EnPassant | null = null

  if (special === 'enpassant') {
    captured = b[from.row][to.col]
    b[from.row][to.col] = null
  }
  if (special === 'double') newEnPassant = { row: (from.row + to.row) / 2, col: from.col }

  b[to.row][to.col] = { ...piece, hasMoved: true }
  b[from.row][from.col] = null

  if (special === 'promotion' || special === 'promotion-capture') {
    b[to.row][to.col] = { type: promotionType || 'Q', color: piece.color, hasMoved: true }
  }
  if (special === 'castle-king') {
    const rook = b[from.row][7]!
    b[from.row][5] = { ...rook, hasMoved: true }
    b[from.row][7] = null
  }
  if (special === 'castle-queen') {
    const rook = b[from.row][0]!
    b[from.row][3] = { ...rook, hasMoved: true }
    b[from.row][0] = null
  }
  return { board: b, captured, enPassant: newEnPassant }
}

function getLegalMoves(board: Board, r: number, c: number, enPassant: EnPassant | null): MoveTarget[] {
  const piece = board[r][c]
  if (!piece) return []
  const pseudo = getPseudoMoves(board, r, c, enPassant)
  return pseudo.filter(m => {
    const { board: after } = applyMove(board, { row: r, col: c }, { row: m.row, col: m.col }, m.special, 'Q')
    return !isInCheck(after, piece.color)
  })
}

function getAllLegalMoves(board: Board, color: PColor, enPassant: EnPassant | null): FullMove[] {
  const all: FullMove[] = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        const moves = getLegalMoves(board, r, c, enPassant)
        moves.forEach(m => all.push({ from: { row: r, col: c }, to: m }))
      }
    }
  return all
}

function notate(from: { row: number; col: number }, to: { row: number; col: number }, special: string, piece: Piece, capturedFlag: boolean, checkFlag: boolean, mateFlag: boolean) {
  if (special === 'castle-king') return mateFlag ? 'O-O#' : checkFlag ? 'O-O+' : 'O-O'
  if (special === 'castle-queen') return mateFlag ? 'O-O-O#' : checkFlag ? 'O-O-O+' : 'O-O-O'
  const letter = piece.type === 'P' ? '' : piece.type
  const capture = capturedFlag ? 'x' : ''
  const fromFile = piece.type === 'P' && capturedFlag ? FILES[from.col] : ''
  let s = `${letter}${fromFile}${capture}${sq(to.row, to.col)}`
  if (special === 'promotion' || special === 'promotion-capture') s += '=Q'
  if (mateFlag) s += '#'
  else if (checkFlag) s += '+'
  return s
}

/* ------------------------------------------------------------------ */
/*  AI ENGINE — minimax + alpha-beta + quiescence search               */
/*  Depth 4 full-width plies + a 6-ply tactical quiescence tail.       */
/*  This is deliberately strong — expect it to punish blunders hard.  */
/* ------------------------------------------------------------------ */

const AI_DEPTH = 4
const QUIESCE_DEPTH = 6
const MATE_SCORE = 1_000_000

const PIECE_VALUES: Record<PType, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 }

const PST: Record<PType, number[][]> = {
  P: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  N: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  B: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  R: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  Q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  K: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
}

function evaluateBoard(board: Board): number {
  let score = 0
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (!piece) continue
      const material = PIECE_VALUES[piece.type]
      const pstVal = piece.color === 'w' ? PST[piece.type][r][c] : PST[piece.type][7 - r][c]
      score += (material + pstVal) * (piece.color === 'w' ? 1 : -1)
    }
  return score
}

function moveHeuristic(board: Board, mv: FullMove): number {
  const target = board[mv.to.row][mv.to.col]
  const attacker = board[mv.from.row][mv.from.col]!
  let s = 0
  if (target) s += PIECE_VALUES[target.type] * 10 - PIECE_VALUES[attacker.type]
  if (mv.to.special === 'enpassant') s += PIECE_VALUES.P * 10 - PIECE_VALUES.P
  if (mv.to.special === 'promotion' || mv.to.special === 'promotion-capture') s += 800
  return s
}

function orderMoves(board: Board, moves: FullMove[]): FullMove[] {
  return moves.slice().sort((a, b) => moveHeuristic(board, b) - moveHeuristic(board, a))
}

function quiesce(board: Board, alpha: number, beta: number, isWhite: boolean, enPassant: EnPassant | null, qdepth: number): number {
  const standPat = evaluateBoard(board)
  if (qdepth === 0) return standPat
  if (isWhite) {
    if (standPat >= beta) return beta
    if (standPat > alpha) alpha = standPat
  } else {
    if (standPat <= alpha) return alpha
    if (standPat < beta) beta = standPat
  }
  const color: PColor = isWhite ? 'w' : 'b'
  const captures = getAllLegalMoves(board, color, enPassant).filter(
    mv => board[mv.to.row][mv.to.col] || mv.to.special === 'enpassant'
  )
  const ordered = orderMoves(board, captures)
  for (const mv of ordered) {
    const { board: child, enPassant: childEP } = applyMove(board, mv.from, { row: mv.to.row, col: mv.to.col }, mv.to.special, 'Q')
    const val = quiesce(child, alpha, beta, !isWhite, childEP, qdepth - 1)
    if (isWhite) {
      if (val >= beta) return beta
      if (val > alpha) alpha = val
    } else {
      if (val <= alpha) return alpha
      if (val < beta) beta = val
    }
  }
  return isWhite ? alpha : beta
}

function minimax(board: Board, depth: number, alpha: number, beta: number, isWhite: boolean, enPassant: EnPassant | null): number {
  const color: PColor = isWhite ? 'w' : 'b'
  if (depth === 0) return quiesce(board, alpha, beta, isWhite, enPassant, QUIESCE_DEPTH)

  const legal = getAllLegalMoves(board, color, enPassant)
  if (legal.length === 0) {
    if (isInCheck(board, color)) return isWhite ? -MATE_SCORE - depth : MATE_SCORE + depth
    return 0
  }
  const ordered = orderMoves(board, legal)
  if (isWhite) {
    let best = -Infinity
    for (const mv of ordered) {
      const { board: child, enPassant: childEP } = applyMove(board, mv.from, { row: mv.to.row, col: mv.to.col }, mv.to.special, 'Q')
      const val = minimax(child, depth - 1, alpha, beta, false, childEP)
      if (val > best) best = val
      if (val > alpha) alpha = val
      if (alpha >= beta) break
    }
    return best
  } else {
    let best = Infinity
    for (const mv of ordered) {
      const { board: child, enPassant: childEP } = applyMove(board, mv.from, { row: mv.to.row, col: mv.to.col }, mv.to.special, 'Q')
      const val = minimax(child, depth - 1, alpha, beta, true, childEP)
      if (val < best) best = val
      if (val < beta) beta = val
      if (alpha >= beta) break
    }
    return best
  }
}

function chooseAIMove(board: Board, aiColor: PColor, enPassant: EnPassant | null, depth = AI_DEPTH): FullMove | null {
  const isWhite = aiColor === 'w'
  const legal = getAllLegalMoves(board, aiColor, enPassant)
  if (legal.length === 0) return null
  const ordered = orderMoves(board, legal)
  let bestMoves: FullMove[] = []
  let bestScore = isWhite ? -Infinity : Infinity
  for (const mv of ordered) {
    const { board: child, enPassant: childEP } = applyMove(board, mv.from, { row: mv.to.row, col: mv.to.col }, mv.to.special, 'Q')
    const val = minimax(child, depth - 1, -Infinity, Infinity, !isWhite, childEP)
    if (isWhite ? val > bestScore : val < bestScore) {
      bestScore = val
      bestMoves = [mv]
    } else if (val === bestScore) {
      bestMoves.push(mv)
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

/* ------------------------------------------------------------------ */
/*  XP rules                                                            */
/* ------------------------------------------------------------------ */
const WIN_XP = 250
const DRAW_XP = 40
const LOSS_XP = 0

/* ------------------------------------------------------------------ */
/*  UI                                                                  */
/* ------------------------------------------------------------------ */

const GLYPHS: Record<PColor, Record<PType, string>> = {
  w: { K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659' },
  b: { K: '\u265A', Q: '\u265B', R: '\u265C', B: '\u265D', N: '\u265E', P: '\u265F' },
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface Props {
  rank: GameRank
  onEnd: (payload: GameEndPayload) => void
  onBack: () => void
  sessionsLeft?: number
  sessionCost?: number
}

export default function ChillverseChess({ rank: initialRank, onEnd, onBack, sessionsLeft = 99, sessionCost = 2 }: Props) {
  const [phase, setPhase] = useState<'info' | 'play' | 'quit'>('info')
  const [playerColor, setPlayerColor] = useState<PColor>('w')
  useGamePresence(GAME_ID)
  const { rankState } = useRankStreak(GAME_ID, initialRank)

  const [board, setBoard] = useState<Board>(initialBoard)
  const [turn, setTurn] = useState<PColor>('w')
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const [enPassant, setEnPassant] = useState<EnPassant | null>(null)
  const [history, setHistory] = useState<{ text: string; num: number; color: PColor }[]>([])
  const [captured, setCaptured] = useState<{ w: PType[]; b: PType[] }>({ w: [], b: [] })
  const [lastMove, setLastMove] = useState<{ from: { row: number; col: number }; to: { row: number; col: number } } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: { row: number; col: number }; to: { row: number; col: number }; special: string } | null>(null)
  const [status, setStatus] = useState<'playing' | 'check' | 'checkmate' | 'stalemate'>('playing')
  const [winner, setWinner] = useState<PColor | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [ended, setEnded] = useState(false)
  const aiColor: PColor = playerColor === 'w' ? 'b' : 'w'

  const startRef = useRef(Date.now())

  const legalMoves = useMemo(() => {
    if (!selected || pendingPromotion) return []
    return getLegalMoves(board, selected.row, selected.col, enPassant)
  }, [selected, board, enPassant, pendingPromotion])

  const inCheckColor = useMemo(() => {
    if (isInCheck(board, 'w')) return 'w' as PColor
    if (isInCheck(board, 'b')) return 'b' as PColor
    return null
  }, [board])

  function start() {
    setBoard(initialBoard())
    setTurn('w')
    setSelected(null)
    setEnPassant(null)
    setHistory([])
    setCaptured({ w: [], b: [] })
    setLastMove(null)
    setPendingPromotion(null)
    setStatus('playing')
    setWinner(null)
    setAiThinking(false)
    setEnded(false)
    startRef.current = Date.now()
    setPhase('play')
  }

  const finishMove = useCallback((from: { row: number; col: number }, to: { row: number; col: number }, special: string, promotionType?: PType) => {
    const piece = board[from.row][from.col]!
    const { board: newBoard, captured: cap, enPassant: newEP } = applyMove(board, from, to, special, promotionType)
    const nextTurn: PColor = turn === 'w' ? 'b' : 'w'
    const nextInCheck = isInCheck(newBoard, nextTurn)
    const nextMoves = getAllLegalMoves(newBoard, nextTurn, newEP)
    const isMate = nextInCheck && nextMoves.length === 0
    const isStale = !nextInCheck && nextMoves.length === 0

    const moveText = notate(from, to, special, piece, !!cap, nextInCheck, isMate)
    const moveNum = Math.floor(history.length / 2) + 1

    setBoard(newBoard)
    setTurn(nextTurn)
    setEnPassant(newEP)
    setSelected(null)
    setLastMove({ from, to })
    setHistory(h => [...h, { text: moveText, num: moveNum, color: turn }])
    if (cap) setCaptured(c => ({ ...c, [piece.color]: [...c[piece.color], cap!.type] }))

    if (isMate) {
      setStatus('checkmate')
      setWinner(turn)
    } else if (isStale) {
      setStatus('stalemate')
    } else if (nextInCheck) {
      setStatus('check')
    } else {
      setStatus('playing')
    }
  }, [board, turn, history])

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (status === 'checkmate' || status === 'stalemate' || pendingPromotion) return
    if (turn !== playerColor || aiThinking) return
    const piece = board[r][c]

    if (selected) {
      const move = legalMoves.find(m => m.row === r && m.col === c)
      if (move) {
        if (move.special === 'promotion' || move.special === 'promotion-capture') {
          setPendingPromotion({ from: selected, to: { row: r, col: c }, special: move.special })
        } else {
          finishMove(selected, { row: r, col: c }, move.special)
        }
        return
      }
      if (piece && piece.color === turn) { setSelected({ row: r, col: c }); return }
      setSelected(null)
      return
    }
    if (piece && piece.color === turn) setSelected({ row: r, col: c })
  }, [selected, legalMoves, board, turn, status, pendingPromotion, finishMove, playerColor, aiThinking])

  // Drive the AI
  useEffect(() => {
    if (status === 'checkmate' || status === 'stalemate') return
    if (pendingPromotion) return
    if (turn !== aiColor) return

    setAiThinking(true)
    const timer = setTimeout(() => {
      const mv = chooseAIMove(board, aiColor, enPassant, AI_DEPTH)
      if (mv) finishMove(mv.from, { row: mv.to.row, col: mv.to.col }, mv.to.special, 'Q')
      setAiThinking(false)
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, status, pendingPromotion, aiColor, enPassant])

  const choosePromotion = (type: PType) => {
    if (!pendingPromotion) return
    finishMove(pendingPromotion.from, pendingPromotion.to, pendingPromotion.special, type)
    setPendingPromotion(null)
  }

  function endSession() {
    if (ended) return
    setEnded(true)
    const dur = Math.floor((Date.now() - startRef.current) / 1000)
    const outcome = status === 'checkmate' ? (winner === playerColor ? 'win' : 'loss') : status === 'stalemate' ? 'draw' : 'abandoned'
    const xpEarned = outcome === 'win' ? WIN_XP : outcome === 'draw' ? DRAW_XP : LOSS_XP
    const payload: GameEndPayload = {
      gameId: GAME_ID,
      gameName: 'Chillverse Chess',
      rank: 'beginner', // exempt from the streak-rank system, like Tac Zone
      score: outcome === 'win' ? 1000 : outcome === 'draw' ? 300 : 0,
      xpEarned,
      durationSec: dur,
      streak: 0,
      correct: outcome === 'win' ? 1 : 0,
      total: 1,
      detail: { Result: outcome === 'win' ? 'Win' : outcome === 'draw' ? 'Draw' : 'Loss', Moves: history.length },
    }
    onEnd(payload)
    onBack()
  }

  const kingPos = inCheckColor ? findKing(board, inCheckColor) : null
  const gameOver = status === 'checkmate' || status === 'stalemate'
  const playerWon = status === 'checkmate' && winner === playerColor

  const rules = [
    { icon: '👑', text: `You play ${playerColor === 'w' ? 'White' : 'Black'} — checkmate the AI to win` },
    { icon: '🏆', text: `Win: +${WIN_XP} XP · Draw: +${DRAW_XP} XP` },
    { icon: '🧠', text: 'Full legal rules — castling, en passant, promotion' },
    { icon: '🔥', text: 'AI plays at max strength — no mercy' },
  ]

  if (phase === 'info') return (
    <PreGameModal
      gameName="Chillverse Chess"
      tagline="Outsmart a ruthless AI. One board, no mercy."
      accent={ACCENT}
      icon={<Crown size={40} />}
      rules={rules}
      rankState={rankState}
      streakRequired={0}
      onStart={start}
      onClose={onBack}
      extraContent={
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          {(['w', 'b'] as PColor[]).map(c => (
            <button key={c} type="button" onClick={() => setPlayerColor(c)}
              style={{
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: playerColor === c ? 'rgba(255,255,255,0.12)' : 'var(--surface2)',
                color: playerColor === c ? '#fff' : 'var(--text-dim)',
                border: playerColor === c ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: playerColor === c ? `0 0 12px ${ACCENT}30` : '2px 2px 6px var(--neu-dark)',
              }}>
              Play as {c === 'w' ? 'White' : 'Black'}
            </button>
          ))}
        </div>
      }
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.07, background: ACCENT, bottom: '15%', left: '-5%', pointerEvents: 'none' }} />

      <GameHUD
        gameName="Chillverse Chess"
        accent={ACCENT}
        icon={<Crown size={14} />}
        streak={0}
        onQuit={() => setPhase('quit')}
        extraRight={
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
            color: status === 'check' ? 'var(--red)' : aiThinking ? AI_COLOR_UI : ACCENT,
            background: status === 'check' ? 'rgba(255,79,79,0.12)' : `${aiThinking ? AI_COLOR_UI : ACCENT}18`,
            border: `1px solid ${status === 'check' ? 'rgba(255,79,79,0.3)' : `${aiThinking ? AI_COLOR_UI : ACCENT}33`}`,
          }}>
            {aiThinking ? 'AI thinking…' : status === 'check' ? 'Check!' : turn === playerColor ? 'Your move' : 'AI to move'}
          </span>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', padding: 16, gap: 16, overflowY: 'auto' }}>
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full justify-center" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', width: '100%' }}>
          {/* Board */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
              borderRadius: 14, overflow: 'hidden',
              border: `1px solid rgba(255,255,255,0.08)`,
              boxShadow: `4px 4px 14px var(--neu-dark), -3px -3px 10px var(--neu-light)`,
              width: 'min(92vw, 440px)', height: 'min(92vw, 440px)', flexShrink: 0,
            }}
          >
            {board.map((rowArr, r) =>
              rowArr.map((piece, c) => {
                const isLight = (r + c) % 2 === 0
                const isSelected = selected && selected.row === r && selected.col === c
                const moveHere = legalMoves.find(m => m.row === r && m.col === c)
                const isLast = lastMove && ((lastMove.from.row === r && lastMove.from.col === c) || (lastMove.to.row === r && lastMove.to.col === c))
                const isCheckedKing = kingPos && kingPos.row === r && kingPos.col === c

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleSquareClick(r, c)}
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', userSelect: 'none',
                      background: isLight ? 'var(--surface2)' : 'var(--surface3, #1c1c22)',
                      boxShadow: isLast ? `inset 0 0 0 999px ${ACCENT}14` : undefined,
                    }}
                  >
                    {isCheckedKing && (
                      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px 4px #ff4f4f', background: 'rgba(255,79,79,0.13)' }} />
                    )}
                    {isSelected && (
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 6, boxShadow: `0 0 10px ${ACCENT}, inset 0 0 6px ${ACCENT}`, border: `1px solid ${ACCENT}` }} />
                    )}
                    {moveHere && !piece && (
                      <div style={{ width: '24%', height: '24%', borderRadius: '50%', background: ACCENT, opacity: 0.7 }} />
                    )}
                    {moveHere && piece && (
                      <div style={{ position: 'absolute', inset: 3, borderRadius: 6, border: `2px solid ${ACCENT}` }} />
                    )}
                    {piece && (
                      <span style={{ fontSize: 'min(8vw, 34px)', lineHeight: 1, color: piece.color === 'w' ? '#f5eddc' : '#2b2440', filter: piece.color === 'w' ? `drop-shadow(0 0 3px ${ACCENT}aa)` : `drop-shadow(0 0 3px ${AI_COLOR_UI}aa)` }}>
                        {GLYPHS[piece.color][piece.type]}
                      </span>
                    )}
                    {c === 0 && <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, opacity: 0.45, color: 'var(--text-muted)' }}>{8 - r}</span>}
                    {r === 7 && <span style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 8, opacity: 0.45, color: 'var(--text-muted)' }}>{FILES[c]}</span>}
                  </div>
                )
              })
            )}
          </div>

          {/* Side panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 260 }} className="neu-card">
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Captured</div>
              <CapturedRow label="By you" color={ACCENT} pieces={captured[playerColor]} opponentColor={aiColor} />
              <CapturedRow label="By AI" color={AI_COLOR_UI} pieces={captured[aiColor]} opponentColor={playerColor} />

              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '14px 0 8px' }}>Move log</div>
              <div style={{ height: 180, overflowY: 'auto', borderRadius: 10, padding: 8, background: 'var(--surface2)', fontFamily: 'monospace' }}>
                {history.length === 0 && <div style={{ opacity: 0.4, fontSize: 11 }}>No moves yet — white to open.</div>}
                {chunk(history, 2).map((pair, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 4, color: 'var(--text-dim)' }}>
                    <span style={{ opacity: 0.4, width: 18 }}>{i + 1}.</span>
                    <span style={{ color: ACCENT }}>{pair[0]?.text}</span>
                    <span style={{ color: AI_COLOR_UI }}>{pair[1]?.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingPromotion && <PromotionModal color={turn} accent={ACCENT} onChoose={choosePromotion} />}
      {gameOver && (
        <GameEndModal
          outcome={status === 'stalemate' ? 'draw' : playerWon ? 'win' : 'loss'}
          accent={ACCENT}
          xpEarned={status === 'stalemate' ? DRAW_XP : playerWon ? WIN_XP : LOSS_XP}
          moves={history.length}
          onEndSession={endSession}
        />
      )}
      {phase === 'quit' && <QuitModal onConfirm={onBack} onCancel={() => setPhase('play')} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CapturedRow({ label, color, pieces, opponentColor }: { label: string; color: string; pieces: PType[]; opponentColor: PColor }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4, color }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 20 }}>
        {pieces.length === 0 && <span style={{ fontSize: 10, opacity: 0.3 }}>—</span>}
        {pieces.map((t, i) => (
          <span key={i} style={{ fontSize: 16, color }}>{GLYPHS[opponentColor][t]}</span>
        ))}
      </div>
    </div>
  )
}

function PromotionModal({ color, accent, onChoose }: { color: PColor; accent: string; onChoose: (t: PType) => void }) {
  const options: PType[] = ['Q', 'R', 'B', 'N']
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 550, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="neu-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent }}>Promote pawn</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {options.map(t => (
            <button key={t} type="button" onClick={() => onChoose(t)}
              style={{
                width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, background: 'var(--surface2)', border: `1px solid ${accent}55`, cursor: 'pointer',
                color: color === 'w' ? '#f5eddc' : '#2b2440',
              }}>
              {GLYPHS[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function GameEndModal({ outcome, accent, xpEarned, moves, onEndSession }: { outcome: 'win' | 'loss' | 'draw'; accent: string; xpEarned: number; moves: number; onEndSession: () => void }) {
  const icon = outcome === 'win' ? '🏆' : outcome === 'draw' ? '🤝' : '💔'
  const title = outcome === 'win' ? 'Checkmate — you win!' : outcome === 'draw' ? 'Stalemate — draw' : 'Checkmate — AI wins'
  const color = outcome === 'win' ? accent : outcome === 'draw' ? 'var(--text-dim)' : 'var(--red)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="neu-card" style={{ padding: '28px 24px', textAlign: 'center', maxWidth: 340, width: '100%' }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>{icon}</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color, margin: '0 0 4px' }}>{title}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 18 }}>Chillverse Chess · {moves} moves played</p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: `${accent}14`, border: `1px solid ${accent}33`,
          borderRadius: 12, padding: '10px 16px', marginBottom: 20,
          fontSize: 13, fontWeight: 800, color: accent,
        }}>
          {xpEarned > 0 ? `⚡ +${xpEarned} XP added to your profile` : 'No XP this round — better luck next time'}
        </div>

        <button type="button" onClick={onEndSession} style={{
          width: '100%', padding: 12, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>
          End Session
        </button>
      </div>
    </div>
  )
}
