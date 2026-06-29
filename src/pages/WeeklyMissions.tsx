// src/pages/WeeklyMissions.tsx
import { useEffect, useRef } from 'react'
import { Clock, Sparkles, Star } from 'lucide-react'
import { ripple } from '../lib/ripple'
import { useWeeklyMissions } from '../hooks/useWeeklyMissions'
import type { MissionWithProgress } from '../lib/weeklyMissions'
import PageOnboarding from '../components/PageOnboarding'

// ── CountdownChip ─────────────────────────────────────────────────────────────

function CountdownChip({ days, hours, minutes }: { days: number; hours: number; minutes: number }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid rgba(155,109,255,0.22)',
      borderRadius: 12,
      padding: '7px 12px',
      boxShadow: '4px 4px 12px var(--neu-dark), -2px -2px 8px var(--neu-light)',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      flexShrink: 0,
    }}>
      <Clock size={13} color="#9b6dff" />
      <div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.4, lineHeight: 1 }}>
          Resets in
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#9b6dff', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          {days}d {hours}h {minutes}m
        </div>
      </div>
    </div>
  )
}

// ── HexBadge ──────────────────────────────────────────────────────────────────

function HexBadge({ color, content, size = 30 }: { color: string; content: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size < 26 ? 8 : 10,
      fontWeight: 800,
      color: '#fff',
      flexShrink: 0,
    }}>
      {content}
    </div>
  )
}

// ── RewardBadge — compact for mobile ─────────────────────────────────────────

function RewardBadge({ mission }: { mission: MissionWithProgress }) {
  const base: React.CSSProperties = {
    background: 'var(--surface3)',
    borderRadius: 10,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
    flexShrink: 0,
  }

  if (mission.is_completed) {
    return (
      <div style={base}>
        <HexBadge color="#3ecf8e" content="✓" size={24} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#3ecf8e', whiteSpace: 'nowrap' }}>Done!</span>
      </div>
    )
  }

  if (mission.reward_type === 'xp_and_booster') {
    return (
      <div style={base}>
        <HexBadge color="#f5c542" content="XP" size={26} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#f5c542', lineHeight: 1 }}>
            +{mission.xp_reward.toLocaleString()}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>XP</div>
        </div>
        <HexBadge color="#9b6dff" content="⚡" size={22} />
      </div>
    )
  }

  if (mission.reward_type === 'diamonds') {
    return (
      <div style={base}>
        <HexBadge color="#4f8ef7" content="💎" size={26} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#4f8ef7', lineHeight: 1 }}>
            +{mission.diamond_reward}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Diamonds</div>
        </div>
      </div>
    )
  }

  return (
    <div style={base}>
      <HexBadge color="#f5c542" content="XP" size={26} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#f5c542', lineHeight: 1 }}>
          +{mission.xp_reward.toLocaleString()}
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>XP</div>
      </div>
    </div>
  )
}

// ── MissionCard — two-row mobile-first layout ─────────────────────────────────

function MissionCard({ mission, index }: { mission: MissionWithProgress; index: number }) {
  const progressRef = useRef<HTMLDivElement>(null)
  const pct = Math.min(100, (mission.current_progress / mission.target_value) * 100)

  useEffect(() => {
    if (!mission.is_completed && progressRef.current) {
      const t = setTimeout(() => {
        if (progressRef.current) progressRef.current.style.width = `${pct}%`
      }, 100)
      return () => clearTimeout(t)
    }
  }, [pct, mission.is_completed])

  const cardInner: React.CSSProperties = {
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  if (mission.is_completed) {
    return (
      <div className="su mission-glow-card" style={{ animationDelay: `${index * 0.07}s` }}>
        <div style={{
          ...cardInner,
          background: 'rgba(62,207,142,0.06)',
          border: '1px solid rgba(62,207,142,0.3)',
          boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light), 0 0 16px rgba(62,207,142,0.1)',
        }}>
          {/* Row 1: icon + title + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: `${mission.icon_color}26`,
              boxShadow: `0 0 12px ${mission.icon_color}40, 2px 2px 6px var(--neu-dark)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {mission.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {mission.title}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                background: 'rgba(62,207,142,0.15)', border: '1px solid rgba(62,207,142,0.3)',
                borderRadius: 20, padding: '2px 8px',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3ecf8e' }}>
                  ✓ Completed!
                </span>
              </div>
            </div>
            <RewardBadge mission={mission} />
          </div>
        </div>
      </div>
    )
  }

  // Active card — two rows
  return (
    <div
      className="su mission-active-card ripple-wrap"
      style={{ animationDelay: `${index * 0.07}s` }}
      onClick={(e) => ripple(e)}
    >
      <div
        style={{
          ...cardInner,
          background: 'var(--surface2)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)',
          transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'rgba(155,109,255,0.28)'
          el.style.transform = 'translateY(-1px)'
          el.style.boxShadow = '8px 8px 20px var(--neu-dark), -4px -4px 14px var(--neu-light)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'rgba(255,255,255,0.06)'
          el.style.transform = 'translateY(0)'
          el.style.boxShadow = '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)'
        }}
      >
        {/* Row 1: icon + title + fraction + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: `${mission.icon_color}1f`,
            boxShadow: `2px 2px 6px var(--neu-dark), -1px -1px 4px var(--neu-light)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {mission.icon}
          </div>

          {/* Title + fraction — takes all remaining space */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {mission.title}
            </div>
            <div style={{ fontSize: 11, color: mission.icon_color, fontWeight: 600, marginTop: 1 }}>
              {mission.current_progress.toLocaleString()} / {mission.target_value.toLocaleString()}
            </div>
          </div>

          {/* Reward badge — right-aligned */}
          <RewardBadge mission={mission} />
        </div>

        {/* Row 2: description + progress bar */}
        <div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 7,
          }}>
            {mission.description}
          </div>
          <div style={{
            width: '100%', height: 4, borderRadius: 4,
            background: 'var(--surface3)',
            boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
            overflow: 'hidden',
          }}>
            <div ref={progressRef} style={{
              height: '100%', width: '0%', borderRadius: 4,
              background: 'linear-gradient(90deg, #9b6dff, #4f8ef7)',
              boxShadow: '0 0 8px rgba(155,109,255,0.5)',
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── WeeklyProgressFooter ──────────────────────────────────────────────────────

function WeeklyProgressFooter({
  missions, totalXp, totalDiamonds, boosters,
}: {
  missions: MissionWithProgress[]
  totalXp: number
  totalDiamonds: number
  boosters: number
}) {
  const completed = missions.filter(m => m.is_completed).length
  const pct = Math.round((completed / 5) * 100)

  return (
    <div className="neu-card" style={{
      background: 'var(--surface2)',
      borderRadius: 16,
      padding: '16px 18px',
      marginTop: 12,
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          Weekly Progress
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {completed} / 5 completed
        </div>

        {/* Stars + % */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              fill={i < completed ? '#f5c542' : 'rgba(255,255,255,0.12)'}
              color={i < completed ? '#f5c542' : 'rgba(255,255,255,0.18)'}
            />
          ))}
          <div style={{
            marginLeft: 4,
            background: 'var(--surface3)',
            borderRadius: 20,
            padding: '2px 9px',
            fontSize: 10,
            fontWeight: 700,
            color: pct > 0 ? '#9b6dff' : 'var(--text-muted)',
            boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
          }}>
            {pct}%
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Total Weekly XP</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#9b6dff', lineHeight: 1.2 }}>
          {totalXp.toLocaleString()} XP
        </div>
        {totalDiamonds > 0 && (
          <div style={{ fontSize: 12, color: '#4f8ef7', marginTop: 3 }}>+{totalDiamonds} 💎</div>
        )}
        {boosters > 0 && (
          <div style={{ fontSize: 12, color: '#9b6dff', marginTop: 2 }}>
            ⚡ {boosters} Booster{boosters > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Crystal gem */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div className="gem-float" style={{
          width: 52, height: 60,
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          background: 'linear-gradient(135deg, #9b6dff 0%, #4f8ef7 60%, #3ecf8e 100%)',
          boxShadow: '0 0 20px rgba(155,109,255,0.5), 0 0 40px rgba(79,142,247,0.2)',
          margin: '0 auto',
        }} />
        {[{ top: -5, right: 2 }, { top: 8, right: -7 }, { bottom: 4, left: -5 }].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute', width: 3, height: 3,
            borderRadius: '50%', background: '#fff', opacity: 0.65, ...pos,
          }} />
        ))}
        <div style={{
          width: 64, height: 7, borderRadius: '50%',
          background: 'rgba(155,109,255,0.3)', filter: 'blur(4px)', margin: '5px auto 0',
        }} />
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      height: 80, borderRadius: 14,
      background: 'var(--surface2)',
      boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)',
      animation: 'pulse 1.6s ease-in-out infinite',
    }} />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeeklyMissions() {
  const {
    missions, loading, weekProgress,
    totalXpEarned, totalDiamondsEarned, boostersEarned, countdown,
  } = useWeeklyMissions()

  const sorted = [...missions].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
    return b.current_progress / b.target_value - a.current_progress / a.target_value
  })

  return (
    <div style={{ padding: '20px 14px 48px', maxWidth: 680, margin: '0 auto' }}>
      <PageOnboarding pageKey="weekly_missions" />

      {/* ── Header ── */}
      <div className="su" style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(155,109,255,0.25), rgba(79,142,247,0.15))',
            boxShadow: '4px 4px 12px var(--neu-dark), -2px -2px 8px var(--neu-light), 0 0 16px rgba(155,109,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={20} color="#9b6dff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: 'var(--text)',
              margin: 0, lineHeight: 1.15,
            }}>
              Weekly Missions
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.3 }}>
              Complete missions, earn XP and level up faster.
            </p>
          </div>
        </div>

        <CountdownChip days={countdown.days} hours={countdown.hours} minutes={countdown.minutes} />
      </div>

      {/* ── Week progress strip ── */}
      {!loading && (
        <div className="su" style={{ animationDelay: '0.05s', marginBottom: 16 }}>
          <div style={{
            height: 3, borderRadius: 3,
            background: 'var(--surface3)',
            boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(weekProgress / 5) * 100}%`,
              background: 'linear-gradient(90deg, #9b6dff, #4f8ef7)',
              boxShadow: '0 0 10px rgba(155,109,255,0.6)',
              transition: 'width 0.8s ease',
              borderRadius: 3,
            }} />
          </div>
        </div>
      )}

      {/* ── Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : sorted.map((m, i) => <MissionCard key={m.id} mission={m} index={i} />)
        }
      </div>

      {/* ── Footer ── */}
      {!loading && (
        <WeeklyProgressFooter
          missions={missions}
          totalXp={totalXpEarned}
          totalDiamonds={totalDiamondsEarned}
          boosters={boostersEarned}
        />
      )}

      <style>{`
        @keyframes missionGlow {
          from { border-color: rgba(62,207,142,0.22); }
          to   { border-color: rgba(62,207,142,0.52); }
        }
        .mission-glow-card > div {
          animation: missionGlow 2s ease-in-out infinite alternate;
        }
        @keyframes gemFloat {
          from { transform: translateY(0px); }
          to   { transform: translateY(-5px); }
        }
        .gem-float { animation: gemFloat 2s ease-in-out infinite alternate; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .mission-active-card { cursor: pointer; }
      `}</style>
    </div>
  )
}
