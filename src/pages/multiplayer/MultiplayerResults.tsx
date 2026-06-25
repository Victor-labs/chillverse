// src/pages/multiplayer/MultiplayerResults.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Zap, Crown, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { calcSessionXP, getRankConfig } from '../games/types'
import type { GameEndPayload, GameRank } from '../games/types'

const AVATAR_COLORS = [
  '#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e',
  '#f5c542','#ff4d8b','#ff9a3c','#00e5ff',
]
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

const PLACEMENT_LABELS = ['🥇','🥈','🥉','4th','5th','6th']

export interface PlayerResult {
  playerId: string
  displayName: string
  score: number
  correct: number
  total: number
  streak: number
  rank: GameRank
  team?: 'A' | 'B' | null
}

interface MultiplayerResultsProps {
  gameName: string
  gameEmoji: string
  myId: string
  players: PlayerResult[]
  teamMode: 'ffa' | '2v2'
  onPlayAgain: () => void
}

export default function MultiplayerResults({
  gameName,
  gameEmoji,
  myId,
  players,
  teamMode,
  onPlayAgain,
}: MultiplayerResultsProps) {
  const navigate = useNavigate()
  const [xpSaved, setXpSaved] = useState(false)

  // Sort players by score descending
  const ranked = [...players].sort((a, b) => b.score - a.score)

  // Determine winning team (2v2)
  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')
  const teamAScore = teamA.reduce((s, p) => s + p.score, 0)
  const teamBScore = teamB.reduce((s, p) => s + p.score, 0)
  const winningTeam: 'A' | 'B' | 'draw' | null =
    teamMode === '2v2'
      ? teamAScore > teamBScore ? 'A'
      : teamBScore > teamAScore ? 'B'
      : 'draw'
      : null

  // Build GameEndPayload per player and write XP once
  useEffect(() => {
    if (xpSaved) return
    setXpSaved(true)

    players.forEach(async (p) => {
      const rankCfg = getRankConfig(p.rank)

      // XP multiplier for team games
      let multiplier = 1.0
      if (teamMode === '2v2' && winningTeam) {
        if (winningTeam === 'draw') multiplier = 0.6
        else multiplier = p.team === winningTeam ? 1.0 : 0.25
      }

      const baseXp  = calcSessionXP(p.correct, p.total, p.streak, rankCfg.xpBase)
      const xpEarned = Math.round(baseXp * multiplier)

      const payload: GameEndPayload = {
        gameId: 'trivia-clash',   // placeholder; real gameId passed via players prop
        gameName,
        rank: p.rank,
        score: p.score,
        xpEarned,
        durationSec: 0,
        streak: p.streak,
        correct: p.correct,
        total: p.total,
        detail: { mode: teamMode, team: p.team ?? 'ffa' },
      }

      // Write XP to profile — same path as single-player
      await supabase.rpc('add_xp', {
        p_user_id: p.playerId,
        p_xp: payload.xpEarned,
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const myResult = ranked.find(p => p.playerId === myId)
  const myPlacement = ranked.findIndex(p => p.playerId === myId)
  const myRankCfg = myResult ? getRankConfig(myResult.rank) : null

  return (
    <div
      className="min-h-screen flex flex-col items-center py-8 px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-lg space-y-5">

        {/* ── Header ── */}
        <div className="text-center space-y-1">
          <p className="text-4xl">{gameEmoji}</p>
          <h1 className="font-extrabold text-2xl" style={{ color: 'var(--text)' }}>
            Match Over
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{gameName}</p>
        </div>

        {/* ── Team result banner (2v2 only) ── */}
        {teamMode === '2v2' && winningTeam && (
          <div
            className="rounded-2xl p-4 text-center font-bold text-sm"
            style={{
              background: winningTeam === 'draw'
                ? 'rgba(255,255,255,0.06)'
                : winningTeam === 'A'
                ? 'rgba(79,142,247,0.15)'
                : 'rgba(155,109,255,0.15)',
              color: winningTeam === 'draw' ? 'var(--text-dim)'
                : winningTeam === 'A' ? '#4f8ef7' : '#9b6dff',
              border: `1px solid ${winningTeam === 'draw' ? 'rgba(255,255,255,0.08)' : winningTeam === 'A' ? 'rgba(79,142,247,0.3)' : 'rgba(155,109,255,0.3)'}`,
            }}
          >
            {winningTeam === 'draw'
              ? "It's a draw! 🤝"
              : `Team ${winningTeam} wins! ${winningTeam === 'A' ? '🔵' : '🟣'} (${winningTeam === 'A' ? teamAScore : teamBScore} pts)`}
          </div>
        )}

        {/* ── My result card ── */}
        {myResult && myRankCfg && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: 'linear-gradient(135deg, rgba(108,80,255,0.15), rgba(108,80,255,0.06))',
              border: '1.5px solid rgba(108,80,255,0.35)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Your Result
                </p>
                <p className="text-3xl font-extrabold font-mono mt-0.5" style={{ color: 'var(--text)' }}>
                  {myResult.score} <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>pts</span>
                </p>
              </div>
              <div className="text-4xl">{PLACEMENT_LABELS[myPlacement] ?? `${myPlacement + 1}th`}</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Correct', value: `${myResult.correct}/${myResult.total}` },
                { label: 'Streak',  value: myResult.streak },
                { label: 'Rank',    value: myRankCfg.label,  color: myRankCfg.color },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--surface2)' }}
                >
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="font-bold text-sm font-mono" style={{ color: color ?? 'var(--text)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* XP earned */}
            {(() => {
              const rankCfg = getRankConfig(myResult.rank)
              let multiplier = 1.0
              if (teamMode === '2v2' && winningTeam) {
                if (winningTeam === 'draw') multiplier = 0.6
                else multiplier = myResult.team === winningTeam ? 1.0 : 0.25
              }
              const xp = Math.round(
                calcSessionXP(myResult.correct, myResult.total, myResult.streak, rankCfg.xpBase) * multiplier
              )
              return (
                <div
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm"
                  style={{
                    background: 'rgba(255,107,0,0.08)',
                    border: '1px solid rgba(255,107,0,0.2)',
                    color: 'var(--accent)',
                  }}
                >
                  <Zap size={14} /> +{xp} XP added to your profile
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Full leaderboard ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ background: 'var(--surface)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <Trophy size={14} style={{ color: '#f5c542' }} />
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              Leaderboard
            </p>
            <div className="flex items-center gap-1 ml-auto">
              <Users size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ranked.length} players</span>
            </div>
          </div>

          {ranked.map((p, i) => {
            const isMe = p.playerId === myId
            const color = avatarColor(p.displayName)
            const initial = p.displayName.charAt(0).toUpperCase()
            const rankCfg = getRankConfig(p.rank)

            return (
              <div
                key={p.playerId}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                style={{
                  background: isMe ? 'rgba(108,80,255,0.08)' : 'var(--surface)',
                  borderColor: 'rgba(255,255,255,0.04)',
                }}
              >
                {/* Placement */}
                <span className="text-lg w-6 text-center flex-shrink-0">
                  {PLACEMENT_LABELS[i] ?? `${i+1}.`}
                </span>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: color }}
                >
                  {initial}
                </div>

                {/* Name + rank */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {p.displayName}
                    </p>
                    {i === 0 && <Crown size={12} style={{ color: '#f5c542', flexShrink: 0 }} />}
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(108,80,255,0.2)', color: '#a78bfa' }}>
                        you
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: rankCfg.color }}>
                    {rankCfg.label}
                    {teamMode === '2v2' && p.team && (
                      <span style={{ color: p.team === 'A' ? '#4f8ef7' : '#9b6dff' }}>
                        {' · '}Team {p.team}
                      </span>
                    )}
                  </p>
                </div>

                {/* Score */}
                <p className="font-extrabold text-base font-mono flex-shrink-0" style={{ color: 'var(--text)' }}>
                  {p.score}
                </p>
              </div>
            )
          })}
        </div>

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <button
            type="button"
            onClick={onPlayAgain}
            className="py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #6c50ff, #a78bfa)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={() => navigate('/multiplayer/browse')}
            className="py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'var(--surface2)',
              color: 'var(--text-dim)',
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer',
            }}
          >
            Browse Rooms
          </button>
        </div>
      </div>
    </div>
  )
}
