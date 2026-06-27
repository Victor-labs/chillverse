// src/pages/WeeklyMissions.tsx
import { useEffect, useRef } from 'react'
import { Clock, ChevronRight, Sparkles, Star } from 'lucide-react'
import { ripple } from '../lib/ripple'
import { useWeeklyMissions } from '../hooks/useWeeklyMissions'
import type { MissionWithProgress } from '../lib/weeklyMissions'

// ── CountdownChip ─────────────────────────────────────────────────────────────

function CountdownChip({ days, hours, minutes }: { days: number; hours: number; minutes: number }) {
  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid rgba(155,109,255,0.22)',
        borderRadius: 14,
        padding: '10px 16px',
        boxShadow: '4px 4px 12px var(--neu-dark), -2px -2px 8px var(--neu-light)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <Clock size={16} color="#9b6dff" />
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5 }}>
          Resets in
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#9b6dff', lineHeight: 1.1 }}>
          {days}d {hours}h {minutes}m
        </div>
      </div>
    </div>
  )
}

// ── RewardBadge ───────────────────────────────────────────────────────────────

function HexBadge({
  color,
  content,
  size = 36,
}: {
  color: string
  content: string
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size < 30 ? 9 : 11,
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {content}
    </div>
  )
}

function RewardBadge({ mission }: { mission: MissionWithProgress }) {
  const containerStyle: React.CSSProperties = {
    background: 'var(--surface3)',
    borderRadius: 12,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
    flexShrink: 0,
    minWidth: 100,
  }

  if (mission.is_completed) {
    return (
      <div style={containerStyle}>
        <HexBadge color="#3ecf8e" content="✓" />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#3ecf8e' }}>Claimed!</div>
      </div>
    )
  }

  if (mission.reward_type === 'xp_and_booster') {
    return (
      <div style={containerStyle}>
        <HexBadge color="#f5c542" content="XP" size={28} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f5c542' }}>
            +{mission.xp_reward.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>XP</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <HexBadge color="#9b6dff" content="⚡" size={28} />
          <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
            Booster
          </div>
        </div>
      </div>
    )
  }

  if (mission.reward_type === 'diamonds') {
    return (
      <div style={containerStyle}>
        <HexBadge color="#4f8ef7" content="💎" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#4f8ef7' }}>
            +{mission.diamond_reward}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Diamonds</div>
        </div>
      </div>
    )
  }

  // default: xp
  return (
    <div style={containerStyle}>
      <HexBadge color="#f5c542" content="XP" />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f5c542' }}>
          +{mission.xp_reward.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>XP</div>
      </div>
    </div>
  )
}

// ── MissionCard ───────────────────────────────────────────────────────────────

function MissionCard({ mission, index }: { mission: MissionWithProgress; index: number }) {
  const progressRef = useRef<HTMLDivElement>(null)
  const pct = Math.min(100, (mission.current_progress / mission.target_value) * 100)

  useEffect(() => {
    if (!mission.is_completed && progressRef.current) {
      const timer = setTimeout(() => {
        if (progressRef.current) progressRef.current.style.width = `${pct}%`
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [pct, mission.is_completed])

  if (mission.is_completed) {
    return (
      <div
        className="su mission-glow-card"
        style={{ animationDelay: `${index * 0.07}s` }}
      >
        <div
          style={{
            background: 'rgba(62,207,142,0.06)',
            border: '1px solid rgba(62,207,142,0.3)',
            borderRadius: 16,
            padding: 16,
            boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light), 0 0 20px rgba(62,207,142,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Icon box */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `${mission.icon_color}26`,
              boxShadow: `0 0 16px ${mission.icon_color}40, 3px 3px 8px var(--neu-dark)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {mission.icon}
          </div>

          {/* Middle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
              {mission.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
              {mission.description}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(62,207,142,0.15)',
                border: '1px solid rgba(62,207,142,0.3)',
                borderRadius: 20,
                padding: '4px 10px',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3ecf8e' }}>
                {mission.target_value}/{mission.target_value} ✓ Completed!
              </span>
            </div>
          </div>

          {/* Right */}
          <RewardBadge mission={mission} />
        </div>
      </div>
    )
  }

  // Active card
  return (
    <div
      className="su mission-active-card ripple-wrap"
      style={{ animationDelay: `${index * 0.07}s` }}
      onClick={(e) => ripple(e)}
    >
      <div
        style={{
          background: 'var(--surface2)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)',
          transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'rgba(155,109,255,0.3)'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Icon box */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${mission.icon_color}1f`,
              boxShadow: `3px 3px 8px var(--neu-dark), -2px -2px 5px var(--neu-light)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {mission.icon}
          </div>

          {/* Middle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mission.title}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: mission.icon_color, flexShrink: 0 }}>
                {mission.current_progress} / {mission.target_value}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
              {mission.description}
            </div>
            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 4,
                background: 'var(--surface3)',
                boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
                overflow: 'hidden',
              }}
            >
              <div
                ref={progressRef}
                style={{
                  height: '100%',
                  width: '0%',
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #9b6dff, #4f8ef7)',
                  boxShadow: '0 0 8px rgba(155,109,255,0.5)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <RewardBadge mission={mission} />
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── WeeklyProgressFooter ──────────────────────────────────────────────────────

function WeeklyProgressFooter({
  missions,
  totalXp,
  totalDiamonds,
  boosters,
}: {
  missions: MissionWithProgress[]
  totalXp: number
  totalDiamonds: number
  boosters: number
}) {
  const completed = missions.filter(m => m.is_completed).length
  const pct = Math.round((completed / 5) * 100)

  return (
    <div
      className="neu-card"
      style={{
        background: 'var(--surface2)',
        borderRadius: 16,
        padding: 20,
        marginTop: 12,
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      {/* Left */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Weekly Progress
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          {completed} / 5 completed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={16}
              fill={i < completed ? '#f5c542' : 'rgba(255,255,255,0.12)'}
              color={i < completed ? '#f5c542' : 'rgba(255,255,255,0.18)'}
            />
          ))}
          <div
            style={{
              marginLeft: 6,
              background: 'var(--surface3)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: pct > 0 ? '#9b6dff' : 'var(--text-muted)',
              boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
            }}
          >
            {pct}%
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Total Weekly XP
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#9b6dff', lineHeight: 1.2 }}>
          {totalXp.toLocaleString()} XP
        </div>
        {totalDiamonds > 0 && (
          <div style={{ fontSize: 13, color: '#4f8ef7', marginTop: 4 }}>
            +{totalDiamonds} 💎
          </div>
        )}
        {boosters > 0 && (
          <div style={{ fontSize: 13, color: '#9b6dff', marginTop: 2 }}>
            ⚡ {boosters} Booster{boosters > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Right — crystal gem */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          className="gem-float"
          style={{
            width: 56,
            height: 64,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: 'linear-gradient(135deg, #9b6dff 0%, #4f8ef7 60%, #3ecf8e 100%)',
            boxShadow: '0 0 24px rgba(155,109,255,0.5), 0 0 48px rgba(79,142,247,0.25)',
            margin: '0 auto',
          }}
        />
        {/* Sparkle dots */}
        {[
          { top: -6, right: 2 },
          { top: 10, right: -8 },
          { bottom: 4, left: -6 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.65,
              ...pos,
            }}
          />
        ))}
        <div
          style={{
            width: 72,
            height: 8,
            borderRadius: '50%',
            background: 'rgba(155,109,255,0.3)',
            filter: 'blur(4px)',
            margin: '6px auto 0',
          }}
        />
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        height: 88,
        borderRadius: 16,
        background: 'var(--surface2)',
        boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)',
        animation: 'pulse 1.6s ease-in-out infinite',
      }}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeeklyMissions() {
  const {
    missions,
    loading,
    weekProgress,
    totalXpEarned,
    totalDiamondsEarned,
    boostersEarned,
    countdown,
  } = useWeeklyMissions()

  // Sort: active first (by progress desc), completed last
  const sorted = [...missions].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
    return b.current_progress / b.target_value - a.current_progress / a.target_value
  })

  return (
    <div style={{ padding: '24px 16px 40px', maxWidth: 680, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div
        className="su"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(155,109,255,0.25), rgba(79,142,247,0.15))',
              boxShadow: '4px 4px 12px var(--neu-dark), -2px -2px 8px var(--neu-light), 0 0 20px rgba(155,109,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={22} color="#9b6dff" />
          </div>
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text)',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Weekly Missions
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.4 }}>
              Complete missions, earn XP and level up faster.
            </p>
          </div>
        </div>

        <CountdownChip
          days={countdown.days}
          hours={countdown.hours}
          minutes={countdown.minutes}
        />
      </div>

      {/* ── Progress bar strip ── */}
      {!loading && (
        <div className="su" style={{ animationDelay: '0.05s', marginBottom: 20 }}>
          <div
            style={{
              height: 3,
              borderRadius: 3,
              background: 'var(--surface3)',
              boxShadow: 'inset 1px 1px 4px var(--neu-dark)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(weekProgress / 5) * 100}%`,
                background: 'linear-gradient(90deg, #9b6dff, #4f8ef7)',
                boxShadow: '0 0 10px rgba(155,109,255,0.6)',
                transition: 'width 0.8s ease',
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Mission cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : sorted.map((mission, i) => (
              <MissionCard key={mission.id} mission={mission} index={i} />
            ))}
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

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes missionGlow {
          from { border-color: rgba(62,207,142,0.25); }
          to   { border-color: rgba(62,207,142,0.55); }
        }
        .mission-glow-card > div {
          animation: missionGlow 2s ease-in-out infinite alternate;
        }
        @keyframes gemFloat {
          from { transform: translateY(0px); }
          to   { transform: translateY(-5px); }
        }
        .gem-float {
          animation: gemFloat 2s ease-in-out infinite alternate;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .mission-active-card { cursor: pointer; }
      `}</style>
    </div>
  )
}
