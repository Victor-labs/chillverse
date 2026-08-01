// src/features/games/ActivityGoals.tsx
// The "Activity Goals" milestone track — reached via the Games Zone
// landing screen (GamesZone.tsx). Tapping a milestone node does NOT open
// a popup: it swaps what the center display shows in place, the same way
// the reference mission-page UI works. XP nodes show a lightning-bolt +
// amount with a slow wiggle; the final node shows the Mall item image,
// same treatment.
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Clock, Zap, Gift, Check, Lock } from 'lucide-react'
import { fetchActiveGameGoal, type ActiveGameGoal } from './gameGoals'

function timeLeft(endsAt: string | null): string {
  if (!endsAt) return '—'
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

type Node =
  | { kind: 'xp'; index: number; threshold: number; xp: number; completed: boolean }
  | { kind: 'item'; index: number; threshold: number; itemName: string; itemImage: string | null; completed: boolean }

export default function ActivityGoals({ onBack }: { onBack: () => void }) {
  const [goal, setGoal] = useState<ActiveGameGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const [, forceTick] = useState(0)

  useEffect(() => {
    fetchActiveGameGoal().then(({ data, error }) => {
      if (error) { setError(error); setLoading(false); return }
      setGoal(data)
      setLoading(false)
    })
  }, [])

  // Re-render every minute so the countdown stays accurate without a full refetch.
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const nodes: Node[] = useMemo(() => {
    if (!goal?.cycle) return []
    const { thresholds, xp_rewards } = goal.cycle
    const completedSet = new Set(goal.progress?.completed_milestones ?? [])
    const out: Node[] = []
    for (let i = 0; i < 3; i++) {
      out.push({ kind: 'xp', index: i, threshold: thresholds[i], xp: xp_rewards[i], completed: completedSet.has(i) })
    }
    out.push({
      kind: 'item', index: 3, threshold: thresholds[3],
      itemName: goal.final_item?.name ?? 'Mystery reward',
      itemImage: goal.final_item?.image_url ?? null,
      completed: completedSet.has(3),
    })
    return out
  }, [goal])

  // Default selection: first node not yet reached, or the last one once everything's done.
  useEffect(() => {
    if (nodes.length === 0) return
    const firstIncomplete = nodes.findIndex(n => !n.completed)
    setSelected(firstIncomplete === -1 ? nodes.length - 1 : firstIncomplete)
  }, [nodes.length, goal?.progress?.completed_milestones?.join(',')])

  const gamesPlayed = goal?.progress?.games_played ?? 0
  const maxThreshold = goal?.cycle?.thresholds[3] ?? 1
  const barFillPct = Math.min(100, (gamesPlayed / maxThreshold) * 100)
  const active = nodes[selected]

  return (
    <div>
      <style>{`
        @keyframes cvGoalWiggle {
          0%, 100% { transform: rotate(-3deg) scale(1); }
          50%      { transform: rotate(3deg) scale(1.04); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={15} />
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Activity Goals</h1>
        {goal?.cycle ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)', padding: '5px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Clock size={11} /> {timeLeft(goal.cycle.ends_at)}
          </span>
        ) : <div style={{ width: 34 }} />}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>
        {loading ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: 12.5, color: 'var(--red)', textAlign: 'center', padding: '60px 0' }}>{error}</p>
        ) : !goal?.cycle ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Lock size={22} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Activity Goals is being reset</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Come back soon for the next cycle.</p>
          </div>
        ) : (
          <>
            {/* Center display — updates in place based on the selected node, no popup */}
            <div className="neu-card" style={{ padding: '28px 20px', marginBottom: 22, textAlign: 'center' }}>
              {active && (
                <div key={active.index} style={{ animation: 'cvGoalWiggle 2.6s ease-in-out infinite', display: 'inline-block', marginBottom: 14 }}>
                  {active.kind === 'xp' ? (
                    <div style={{ width: 84, height: 84, borderRadius: 22, background: 'linear-gradient(135deg,#f5c542,var(--accent2))', boxShadow: '0 8px 24px rgba(245,197,66,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={38} style={{ color: '#fff' }} fill="#fff" />
                    </div>
                  ) : active.itemImage ? (
                    <div style={{ width: 84, height: 84, borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 24px rgba(155,109,255,0.35)', border: '1px solid var(--border)' }}>
                      <img src={active.itemImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 84, height: 84, borderRadius: 22, background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', boxShadow: '0 8px 24px rgba(155,109,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Gift size={38} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                {active?.kind === 'xp' ? `+${active.xp} XP` : active?.itemName}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0' }}>
                {active?.completed ? 'Earned' : `Reach ${active?.threshold} games played this cycle`}
              </p>
            </div>

            {/* Progress bar + node track */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barFillPct}%`, background: 'linear-gradient(90deg,#f5c542,var(--accent2))', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {nodes.map(n => {
                const isSelected = n.index === selected
                return (
                  <button
                    key={n.index}
                    type="button"
                    onClick={() => setSelected(n.index)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: n.completed ? 'linear-gradient(135deg,#f5c542,var(--accent2))' : 'var(--surface2)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
                      overflow: 'hidden',
                    }}>
                      {n.completed ? (
                        <Check size={16} style={{ color: '#fff' }} />
                      ) : n.kind === 'xp' ? (
                        <Zap size={16} style={{ color: 'var(--text-dim)' }} />
                      ) : n.itemImage ? (
                        <img src={n.itemImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Gift size={16} style={{ color: 'var(--text-dim)' }} />
                      )}
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: isSelected ? 'var(--text)' : 'var(--text-muted)' }}>{n.threshold}</span>
                  </button>
                )
              })}
            </div>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{gamesPlayed}</strong> games played this cycle
            </p>
          </>
        )}
      </div>
    </div>
  )
}
