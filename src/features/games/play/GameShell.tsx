// src/pages/games/GameShell.tsx
import { useState, useEffect } from 'react'
import { X, Zap, Flame, Trophy, ChevronRight, Camera, Check } from 'lucide-react'
import type { GameRank, GameEndPayload, PlayerRankState } from './types'
import { getRankConfig, getNextRank, RANK_CONFIGS } from './types'
import { useAuth } from '../../auth/useAuth'
import { createHighlight } from '../../highlights/highlights'
import { GAMES } from '../games'

// ─── Pre-game Info Modal ─────────────────────────────────────
interface InfoRule {
  icon: string
  text: string
}

interface PreGameModalProps {
  gameName: string
  tagline: string
  accent: string
  icon: React.ReactNode
  rules: InfoRule[]
  rankState: PlayerRankState
  streakRequired: number
  onStart: () => void
  onClose: () => void
  extraContent?: React.ReactNode
}

export function PreGameModal({
  gameName, tagline, accent, icon, rules,
  rankState, streakRequired, onStart, onClose, extraContent,
}: PreGameModalProps) {
  const rank = getRankConfig(rankState.rank)
  const next = getNextRank(rankState.rank)
  const nextRank = next ? getRankConfig(next) : null
  const streakPct = streakRequired > 0
    ? Math.min(100, Math.round((rankState.currentStreak / streakRequired) * 100))
    : 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: `radial-gradient(ellipse at center, ${accent}10 0%, rgba(0,0,0,0.85) 80%)`,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 28,
        border: `1px solid ${accent}30`,
        boxShadow: `0 0 60px ${accent}18, 6px 6px 20px var(--neu-dark), -4px -4px 14px var(--neu-light)`,
        padding: '32px 28px', maxWidth: 400, width: '100%',
        animation: 'popUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '6px 12px',
          }}>
            <span style={{ color: accent }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {gameName}
            </span>
          </div>
          <button type="button" onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--text-dim)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 24,
            background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
            border: `2px solid ${accent}30`,
            boxShadow: `0 0 32px ${accent}20, 4px 4px 12px var(--neu-dark), -3px -3px 8px var(--neu-light)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: accent, display: 'flex' }}>{icon}</span>
          </div>
        </div>

        {/* Title & tagline */}
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', textAlign: 'center', marginBottom: 6, letterSpacing: '-0.5px' }}>
          {gameName}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
          {tagline}
        </p>

        {/* Rules */}
        <div style={{
          background: 'var(--surface2)', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 16px', marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {rules.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-dim)' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>

        {extraContent}

        {/* Rank badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: `${rank.color}18`, color: rank.color,
            border: `1px solid ${rank.color}33`, fontSize: 12, fontWeight: 700,
          }}>
            <Flame size={12} /> {rank.label}
          </div>
          {nextRank && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Next: {nextRank.label} ({rankState.currentStreak}/{streakRequired} streak)
            </span>
          )}
          {!nextRank && (
            <span style={{ fontSize: 11, color: 'var(--gold)' }}>Max Rank 👑</span>
          )}
        </div>

        {/* Streak progress to next rank */}
        {nextRank && streakRequired > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden', boxShadow: 'inset 1px 1px 4px var(--neu-dark)' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
                width: `${streakPct}%`, transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          type="button"
          onClick={onStart}
          style={{
            width: '100%', padding: '14px', borderRadius: 16,
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
            boxShadow: `0 6px 24px ${accent}40`,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${accent}55` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 6px 24px ${accent}40` }}
        >
          Start Game <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── In-Game HUD ─────────────────────────────────────────────
interface GameHUDProps {
  gameName: string
  accent: string
  icon: React.ReactNode
  streak: number
  onQuit: () => void
  extraLeft?: React.ReactNode
  extraRight?: React.ReactNode
}

export function GameHUD({ gameName, accent, icon, streak, onQuit, extraLeft, extraRight }: GameHUDProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', height: 52, flexShrink: 0,
      background: 'rgba(17,17,19,0.92)', backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onQuit} style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '2px 2px 6px var(--neu-dark)', color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <X size={14} />
        </button>
        {extraLeft}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20, padding: '5px 14px',
      }}>
        <span style={{ color: accent, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{gameName}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {extraRight}
        {streak >= 2 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: `rgba(245,197,66,0.12)`, border: '1px solid rgba(245,197,66,0.3)',
            borderRadius: 16, padding: '4px 10px',
            fontSize: 12, fontWeight: 700, color: 'var(--gold)',
          }}>
            <Flame size={12} /> {streak}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Chip ────────────────────────────────────────────────
export function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface2)', borderRadius: 12, padding: '7px 13px',
      boxShadow: '2px 2px 6px var(--neu-dark)', minWidth: 52,
    }}>
      <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: accent ?? 'var(--text)' }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginTop: 1 }}>{label}</span>
    </div>
  )
}

// ─── Result Screen ────────────────────────────────────────────
interface ResultScreenProps {
  payload: GameEndPayload
  accent: string
  onReplay: () => void
  onBack: () => void
  promoted?: GameRank | null
  sessionCost?: number
  sessionsLeft?: number
}

export function ResultScreen({ payload, accent, onReplay, onBack, promoted, sessionCost = 1, sessionsLeft = 99 }: ResultScreenProps) {
  const { user } = useAuth()
  const [showPromo, setShowPromo] = useState(!!promoted)
  const [displayScore, setDisplayScore] = useState(0)
  const [displayXP, setDisplayXP] = useState(0)
  const [xpBannerVisible, setXpBannerVisible] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(false)
  const [sessionToast, setSessionToast] = useState(false)
  const [shared, setShared] = useState(false)
  const [sharing, setSharing] = useState(false)
  const canPlayAgain = sessionsLeft >= sessionCost
  const mins = Math.floor(payload.durationSec / 60)
  const secs = payload.durationSec % 60
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  const betterThan = Math.min(97, Math.floor(35 + (payload.score / 10) + Math.random() * 20))
  const accuracy = payload.total > 0 ? Math.round((payload.correct / payload.total) * 100) : 0

  // Animate score counting up
  useEffect(() => {
    const target = payload.score
    const duration = 1200
    const steps = 40
    const increment = target / steps
    let current = 0
    let step = 0
    const t = setInterval(() => {
      step++
      current = Math.min(Math.round(increment * step), target)
      setDisplayScore(current)
      if (current >= target) {
        clearInterval(t)
        // After score done, animate XP
        let xpStep = 0
        const xpTarget = payload.xpEarned
        const xpInc = xpTarget / 30
        const xpTimer = setInterval(() => {
          xpStep++
          const xpVal = Math.min(Math.round(xpInc * xpStep), xpTarget)
          setDisplayXP(xpVal)
          if (xpVal >= xpTarget) {
            clearInterval(xpTimer)
            setTimeout(() => setXpBannerVisible(true), 200)
            setTimeout(() => setButtonsVisible(true), 600)
          }
        }, 25)
      }
    }, duration / steps)
    return () => clearInterval(t)
  }, [payload.score, payload.xpEarned])

  useEffect(() => {
    if (promoted) {
      const t = setTimeout(() => setShowPromo(false), 3500)
      return () => clearTimeout(t)
    }
  }, [promoted])

  const rankCfg = getRankConfig(payload.rank)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, gap: 16, background: `${accent}06`,
    }}>
      {/* Rank-up banner */}
      {showPromo && promoted && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)', border: `1px solid ${getRankConfig(promoted).color}55`,
          borderRadius: 20, padding: '10px 22px', zIndex: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: `0 8px 32px ${getRankConfig(promoted).color}33`,
          animation: 'slideUp 0.4s ease-out both',
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: getRankConfig(promoted).color }}>
            Rank Up! You are now {getRankConfig(promoted).label}!
          </span>
        </div>
      )}

      <div className="neu-card" style={{ padding: '28px 24px', textAlign: 'center', maxWidth: 360, width: '100%' }}>
        {/* Trophy */}
        <div style={{ marginBottom: 12 }}>
          <Trophy size={48} style={{ color: accent }} />
        </div>

        {/* Score */}
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)', marginBottom: 4, lineHeight: 1, transition: 'color 0.1s' }}>
          {displayScore}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
          {payload.correct}/{payload.total} correct · {payload.gameName}
        </p>

        {/* Stats 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'XP EARNED',   value: `+${displayXP}`, color: 'var(--accent)' },
            { label: 'TIME',        value: durationStr,             color: 'var(--text)' },
            { label: 'STREAK',      value: payload.streak,          color: 'var(--gold)' },
            { label: 'BETTER THAN', value: `${betterThan}%`,        color: 'var(--green)' },
            { label: 'ACCURACY',    value: `${accuracy}%`,          color: accent },
            ...Object.entries(payload.detail).slice(0, 1).map(([k, v]) => ({ label: k.toUpperCase(), value: String(v), color: 'var(--text-dim)' })),
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', textAlign: 'left',
            }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Rank badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: `${rankCfg.color}18`, color: rankCfg.color,
            border: `1px solid ${rankCfg.color}33`, fontSize: 12, fontWeight: 700,
          }}>
            <Flame size={12} /> {rankCfg.label} Rank
          </div>
        </div>

        {/* XP banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)',
          borderRadius: 12, padding: '10px 16px', marginBottom: 18,
          fontSize: 13, fontWeight: 800, color: 'var(--accent)',
          opacity: xpBannerVisible ? 1 : 0,
          transform: xpBannerVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          <Zap size={15} /> +{payload.xpEarned} XP added to your profile
        </div>

        {/* Share your win — posts a lightweight Highlight (text + game icon only) */}
        {user && payload.score > 0 && (
          <button
            type="button"
            disabled={sharing || shared}
            onClick={async () => {
              setSharing(true)
              const game = GAMES.find(g => g.id === payload.gameId)
              const body = `Scored ${payload.score} in ${payload.gameName}! 🔥`
              const { error } = await createHighlight({
                authorId: user.id,
                kind: 'game_result',
                gameKey: game?.dbKey ?? null,
                body,
              })
              setSharing(false)
              if (!error) setShared(true)
            }}
            style={{
              width: '100%', padding: '10px', borderRadius: 13, marginBottom: 10,
              background: shared ? 'rgba(62,207,142,0.12)' : 'var(--surface2)',
              border: `1px solid ${shared ? 'rgba(62,207,142,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: shared ? 'var(--green, #3ecf8e)' : 'var(--text)',
              fontSize: 13, fontWeight: 700, cursor: shared ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: buttonsVisible ? 1 : 0,
              transform: buttonsVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {shared ? <Check size={14} /> : <Camera size={14} />}
            {shared ? 'Shared to Highlights' : sharing ? 'Sharing…' : 'Share your win'}
          </button>
        )}

        {/* Buttons */}
        <div style={{
          display: 'flex', gap: 10,
          opacity: buttonsVisible ? 1 : 0,
          transform: buttonsVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          <button type="button" onClick={() => {
            if (!canPlayAgain) {
              setSessionToast(true)
              setTimeout(() => setSessionToast(false), 3000)
              return
            }
            onReplay()
          }} style={{
            flex: 1, padding: '12px', borderRadius: 13,
            background: canPlayAgain
              ? `linear-gradient(135deg, ${accent}, ${accent}bb)`
              : 'rgba(255,255,255,0.05)',
            border: canPlayAgain ? 'none' : '1px solid rgba(255,255,255,0.08)',
            color: canPlayAgain ? '#fff' : 'var(--text-muted)',
            fontSize: 14, fontWeight: 700,
            cursor: canPlayAgain ? 'pointer' : 'not-allowed',
          }}>
            Play Again
          </button>
          <button type="button" onClick={onBack} style={{
            flex: 1, padding: '12px', borderRadius: 13,
            background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
          }}>
            Done
          </button>
        </div>

        {/* Insufficient sessions toast */}
        {sessionToast && (
          <div style={{
            position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 14,
            background: 'rgba(14,14,18,0.97)',
            border: '1px solid rgba(155,109,255,0.5)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(14px)',
            fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
            whiteSpace: 'nowrap',
            animation: 'achSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            ⚡ Insufficient sessions — resets in a few hours
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Quit Modal ───────────────────────────────────────────────
export function QuitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div className="neu-card" style={{
          padding: '28px 24px', maxWidth: 300, width: '100%',
          textAlign: 'center', animation: 'popUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Quit game?</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 22 }}>Your current progress won't be saved.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: '11px', borderRadius: 12,
              background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '3px 3px 8px var(--neu-dark), -2px -2px 6px var(--neu-light)',
            }}>Cancel</button>
            <button type="button" onClick={onConfirm} style={{
              flex: 1, padding: '11px', borderRadius: 12,
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Quit</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── useRankState hook ────────────────────────────────────────
export function useRankStreak(_gameId: string, initial: GameRank = 'beginner') {
  const [rankState, setRankState] = useState<PlayerRankState>({
    rank: initial,
    currentStreak: 0,
    bestStreak: 0,
  })

  function onCorrect(streakRequired: number): { promoted: GameRank | null } {
    let promoted: GameRank | null = null
    setRankState(prev => {
      const newStreak = prev.currentStreak + 1
      const next = getNextRank(prev.rank)
      if (next && newStreak >= streakRequired) {
        promoted = next
        return { rank: next, currentStreak: 0, bestStreak: Math.max(prev.bestStreak, newStreak) }
      }
      return { ...prev, currentStreak: newStreak, bestStreak: Math.max(prev.bestStreak, newStreak) }
    })
    return { promoted }
  }

  function onWrong() {
    setRankState(prev => ({ ...prev, currentStreak: 0 }))
  }

  return { rankState, onCorrect, onWrong }
}

// ─── Timer bar ────────────────────────────────────────────────
export function TimerBar({ pct, accent, urgent = false }: { pct: number; accent: string; urgent?: boolean }) {
  return (
    <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 1px 1px 4px var(--neu-dark)' }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: urgent && pct < 25 ? 'var(--red)' : accent,
        width: `${pct}%`, transition: 'width 1s linear, background 0.3s',
      }} />
    </div>
  )
}

// ─── Rank progression display (used in lobby cards) ──────────
export function RankProgressBar({ rank, streak, streakRequired }: { rank: GameRank; streak: number; streakRequired: number }) {
  const cfg = getRankConfig(rank)
  const next = getNextRank(rank)
  const nextCfg = next ? getRankConfig(next) : null
  const pct = streakRequired > 0 ? Math.min(100, Math.round((streak / streakRequired) * 100)) : 100

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
        {nextCfg && <span style={{ color: 'var(--text-muted)' }}>{streak}/{streakRequired} → {nextCfg.label}</span>}
        {!nextCfg && <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Max Rank 👑</span>}
      </div>
      <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: nextCfg ? `linear-gradient(90deg, ${cfg.color}, ${nextCfg.color})` : cfg.color,
          width: `${pct}%`, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ─── All rank configs export for lobby use ────────────────────
export { RANK_CONFIGS, getRankConfig, getNextRank }
