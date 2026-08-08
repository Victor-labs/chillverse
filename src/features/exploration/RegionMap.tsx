// src/features/exploration/RegionMap.tsx
//
// The spatial replacement for the old chamber list. One region image, five
// chamber nodes at their authored coordinates, a route drawn between them,
// and a traveller marker that moves along the active leg as the run elapses.
//
// Progress is deliberately shown *spatially* only — the marker's position on
// the route is the progress bar. No percentage and no ETA are rendered
// anywhere, matching the existing decision to keep run timing opaque.
//
// Node visibility is fog-of-war: a chamber's name is only revealed once it's
// reachable. Anything further out renders as an unnamed survey point.

import { useEffect, useState } from 'react'
import { ChevronLeft, Lock, Zap, Check, MapPin, Battery } from 'lucide-react'
import type { Chamber, ChamberState, ExplorationMap } from './explorationMaps'
import { tierColor, MAX_ENERGY } from './explorationMaps'
import { chamberEntries, visibleCount } from './fieldLog'

type NodeStatus = 'done' | 'active' | 'available' | 'locked'

interface Props {
  map: ExplorationMap
  chamberStates: Record<number, ChamberState>
  energy: number
  loadingRuns: boolean
  onExplore: (c: Chamber) => void
  onBack: () => void
  /** Equipped avatar image, drawn inside the traveller marker. */
  avatarUrl?: string | null
}

/** Elapsed fraction (0–1) of a running chamber, clamped. */
function runFraction(state: ChamberState | undefined, now: number): number {
  if (!state?.startedAt || !state.durationMs) return 0
  return Math.max(0, Math.min(1, (now - state.startedAt) / state.durationMs))
}

/** Vague, non-numeric progress wording. Never exposes time remaining. */
function travelStatus(fraction: number): string {
  if (fraction < 0.25) return 'Departing'
  if (fraction < 0.55) return 'En route'
  if (fraction < 0.85) return 'Deep in the interior'
  return 'Nearing the site'
}

export default function RegionMap({
  map, chamberStates, energy, loadingRuns, onExplore, onBack, avatarUrl,
}: Props) {
  const accent = tierColor(map.tier)

  // Drives both the marker position and the field log reveal. 30s is far
  // coarser than the marker can visibly move over a five-hour leg, and keeps
  // this off the render-every-second path.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(iv)
  }, [])

  // Separate, faster tick purely for the HUD clock.
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  const [selectedId, setSelectedId] = useState<number | null>(null)

  function affordable(chamber: Chamber) {
    return energy >= chamber.energyCost
  }

  function statusOf(chamber: Chamber, index: number): NodeStatus {
    const st = chamberStates[chamber.id]
    if (st?.status === 'done') return 'done'
    if (st?.status === 'running') return 'active'
    const prevDone = index === 0 || chamberStates[map.chambers[index - 1].id]?.status === 'done'
    return prevDone ? 'available' : 'locked'
  }

  // Route vertices: entry point followed by every chamber node, so segment i
  // is always "the approach to chambers[i]".
  const points = [map.entry, ...map.chambers.map(c => ({ x: c.x, y: c.y }))]

  const runningIndex = map.chambers.findIndex(c => chamberStates[c.id]?.status === 'running')
  const runningChamber = runningIndex >= 0 ? map.chambers[runningIndex] : null
  const fraction = runFraction(runningChamber ? chamberStates[runningChamber.id] : undefined, now)

  // Marker: mid-leg while a run is active, otherwise parked at the last
  // cleared node (or the entry point on a fresh region).
  let marker = map.entry
  if (runningChamber) {
    const from = points[runningIndex]
    const to = points[runningIndex + 1]
    marker = {
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
    }
  } else {
    for (let i = map.chambers.length - 1; i >= 0; i--) {
      if (chamberStates[map.chambers[i].id]?.status === 'done') { marker = points[i + 1]; break }
    }
  }

  const doneCount = map.chambers.filter(c => chamberStates[c.id]?.status === 'done').length
  const liberation = Math.round((doneCount / map.chambers.length) * 100)

  const currentLabel = runningChamber
    ? runningChamber.name
    : doneCount > 0
      ? map.chambers[doneCount - 1].name
      : 'Region edge'
  const currentStatus = runningChamber
    ? travelStatus(fraction)
    : doneCount === map.chambers.length
      ? 'Region fully surveyed'
      : 'Holding position'

  const selected = map.chambers.find(c => c.id === selectedId) ?? null
  const selectedIndex = selected ? map.chambers.indexOf(selected) : -1

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── Map canvas ───────────────────────────────────────── */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: '1 / 1', maxHeight: '58vh',
        borderRadius: 22, overflow: 'hidden',
        border: `1.5px solid ${accent}33`,
        boxShadow: `4px 4px 24px var(--neu-dark), 0 0 34px ${accent}1a`,
        background: 'var(--surface)',
      }}>
        <img
          src={map.image} alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'brightness(0.42) saturate(0.75) contrast(1.05)',
          }}
        />

        {/* Grid wash — reads as a surveyed overlay rather than a photo. */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage:
            `linear-gradient(${accent}0f 1px, transparent 1px),` +
            `linear-gradient(90deg, ${accent}0f 1px, transparent 1px)`,
          backgroundSize: '11% 11%',
        }} />

        {/* Scrims so HUD text stays legible over any artwork. */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(6,6,10,0.82) 0%, transparent 26%,' +
            ' transparent 74%, rgba(6,6,10,0.86) 100%)',
        }} />

        {/* ── Route ──────────────────────────────────────────── */}
        <svg
          viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {map.chambers.map((chamber, i) => {
            const from = points[i]
            const to = points[i + 1]
            const st = statusOf(chamber, i)
            const traversed = st === 'done'
            const isActive = st === 'active'
            return (
              <line
                key={chamber.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={traversed ? accent : isActive ? '#9b6dff' : 'rgba(255,255,255,0.22)'}
                strokeWidth={traversed || isActive ? 2 : 1.25}
                strokeDasharray={traversed ? undefined : '4 4'}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={traversed ? 0.9 : isActive ? 0.95 : 0.5}
                className={isActive ? 'cv-route-active' : undefined}
              />
            )
          })}
        </svg>

        {/* ── Chamber nodes ──────────────────────────────────── */}
        {map.chambers.map((chamber, i) => {
          const st = statusOf(chamber, i)
          const known = st !== 'locked'
          const short = st === 'available' && !affordable(chamber)
          const color = st === 'done' ? accent
            : st === 'active' ? '#9b6dff'
            : st === 'available' ? (short ? '#f5c542' : '#ffffff')
            : 'rgba(255,255,255,0.4)'
          const size = st === 'locked' ? 14 : st === 'done' ? 26 : 30

          return (
            <button
              key={chamber.id}
              type="button"
              onClick={() => setSelectedId(chamber.id)}
              aria-label={known ? chamber.name : 'Unsurveyed site'}
              style={{
                position: 'absolute',
                left: `${chamber.x}%`, top: `${chamber.y}%`,
                transform: 'translate(-50%, -50%)',
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                zIndex: selectedId === chamber.id ? 6 : 4,
              }}
            >
              <span style={{
                position: 'relative',
                width: size, height: size, borderRadius: st === 'locked' ? 4 : '50%',
                border: `2px solid ${color}`,
                background: st === 'done' ? `${color}2e` : st === 'active' ? 'rgba(155,109,255,0.22)' : 'rgba(6,6,10,0.55)',
                boxShadow: st === 'locked' ? 'none' : `0 0 12px ${color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: st === 'locked' ? 'rotate(45deg)' : undefined,
                opacity: st === 'locked' ? 0.55 : 1,
                transition: 'width var(--dur-slow) var(--ease-out), height var(--dur-slow) var(--ease-out)',
              }}>
                {st === 'done' && <Check size={13} style={{ color }} strokeWidth={3} />}
                {st === 'available' && (
                  <span style={{ fontSize: 11, fontWeight: 800, color }}>{i + 1}</span>
                )}
                {st === 'active' && (
                  <span className="cv-node-pulse" style={{
                    position: 'absolute', inset: -6, borderRadius: '50%',
                    border: '2px solid #9b6dff',
                  }} />
                )}
                {chamber.artifact && st !== 'locked' && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#f5c542', boxShadow: '0 0 6px #f5c542',
                  }} />
                )}
              </span>

              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                color: known ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)',
                textShadow: '0 1px 6px rgba(0,0,0,0.95)',
              }}>
                {known ? chamber.name : '???'}
              </span>

              {st === 'available' && (
                <span style={{
                  fontSize: 8.5, fontWeight: 800, whiteSpace: 'nowrap',
                  color: short ? '#f5c542' : 'rgba(255,255,255,0.6)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.95)', marginTop: -2,
                }}>
                  {chamber.energyCost} energy
                </span>
              )}
            </button>
          )
        })}

        {/* ── Traveller marker ───────────────────────────────── */}
        <div style={{
          position: 'absolute',
          left: `${marker.x}%`, top: `${marker.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 5, pointerEvents: 'none',
          transition: 'left 1.2s var(--ease-out), top 1.2s var(--ease-out)',
        }}>
          <span className="cv-marker-ring" style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 46, height: 46, marginLeft: -23, marginTop: -23,
            borderRadius: '50%', border: '2px solid #4f8ef7',
          }} />
          <span style={{
            display: 'block', width: 26, height: 26, borderRadius: '50%',
            border: '2px solid #4f8ef7', overflow: 'hidden',
            background: '#0b0b12',
            boxShadow: '0 0 14px rgba(79,142,247,0.85)',
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <MapPin size={13} style={{ color: '#4f8ef7', margin: 4 }} />}
          </span>
        </div>

        {/* ── HUD: top left ──────────────────────────────────── */}
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 10, zIndex: 7 }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to regions"
            style={{
              width: 32, height: 32, flexShrink: 0, borderRadius: 10,
              background: 'rgba(6,6,10,0.6)', border: '1px solid rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(6px)',
            }}
          >
            <ChevronLeft size={17} style={{ color: '#fff' }} />
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.15,
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentLabel}
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: runningChamber ? '#9b6dff' : 'rgba(255,255,255,0.62)',
              textShadow: '0 1px 8px rgba(0,0,0,0.9)', marginTop: 2,
            }}>
              {currentStatus}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 800, color: '#fff',
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            }}>
              {map.name}
            </div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
              color: accent, textTransform: 'uppercase', marginTop: 3,
              textShadow: '0 1px 8px rgba(0,0,0,0.9)',
            }}>
              Tier {map.tier}
            </div>
            <div style={{
              fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 3,
              textShadow: '0 1px 8px rgba(0,0,0,0.9)',
            }}>
              Surveyed {doneCount}/{map.chambers.length} · {liberation}%
            </div>
          </div>
        </div>

        {/* ── HUD: bottom strip ──────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 12, left: 14, right: 14, zIndex: 7,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 800, color: '#fff',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
            textShadow: '0 1px 8px rgba(0,0,0,0.9)', flexShrink: 0,
          }}>
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Battery size={13} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <div style={{
              flex: 1, height: 5, borderRadius: 3,
              background: 'rgba(255,255,255,0.16)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(100, (energy / MAX_ENERGY) * 100)}%`,
                borderRadius: 3, background: `linear-gradient(90deg, ${accent}aa, ${accent})`,
                transition: 'width var(--dur-slow) var(--ease-out)',
              }} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: '#fff', flexShrink: 0,
              fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 8px rgba(0,0,0,0.9)',
            }}>
              {energy}/{MAX_ENERGY}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Tap a site to inspect it
      </div>

      {/* ── Chamber sheet ──────────────────────────────────────── */}
      {selected && (
        <ChamberSheet
          map={map}
          chamber={selected}
          index={selectedIndex}
          status={statusOf(selected, selectedIndex)}
          state={chamberStates[selected.id]}
          fraction={chamberStates[selected.id]?.status === 'running' ? runFraction(chamberStates[selected.id], now) : 1}
          energy={energy}
          loadingRuns={loadingRuns}
          accent={accent}
          onExplore={() => { onExplore(selected); setSelectedId(null) }}
          onClose={() => setSelectedId(null)}
        />
      )}

      <style>{`
        @keyframes cvNodePulse {
          0%   { transform: scale(0.85); opacity: 0.9 }
          70%  { transform: scale(1.5);  opacity: 0 }
          100% { transform: scale(1.5);  opacity: 0 }
        }
        @keyframes cvMarkerRing {
          0%   { transform: scale(0.5); opacity: 0.75 }
          100% { transform: scale(1.25); opacity: 0 }
        }
        @keyframes cvRouteFlow { to { stroke-dashoffset: -16 } }
        .cv-node-pulse  { animation: cvNodePulse 2.4s var(--ease-out) infinite }
        .cv-marker-ring { animation: cvMarkerRing 2.6s var(--ease-out) infinite }
        .cv-route-active {
          stroke-dasharray: 5 5;
          animation: cvRouteFlow 1.1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cv-node-pulse, .cv-marker-ring, .cv-route-active { animation: none }
        }
      `}</style>
    </div>
  )
}

// ── Chamber detail sheet ────────────────────────────────────────
function ChamberSheet({
  map, chamber, index, status, state, fraction, energy, loadingRuns, accent, onExplore, onClose,
}: {
  map: ExplorationMap
  chamber: Chamber
  index: number
  status: NodeStatus
  state: ChamberState | undefined
  fraction: number
  energy: number
  loadingRuns: boolean
  accent: string
  onExplore: () => void
  onClose: () => void
}) {
  const known = status !== 'locked'
  const notEnoughEnergy = energy < chamber.energyCost
  const canExplore = status === 'available' && !notEnoughEnergy && !loadingRuns

  const entries = chamberEntries(map.id, chamber.id)
  const shown = status === 'done' ? entries.length : status === 'active' ? visibleCount(fraction) : 0

  const statusLabel =
    status === 'done' ? 'Surveyed' :
    status === 'active' ? 'Expedition in progress' :
    status === 'available' ? 'Ready to survey' : 'Not yet reachable'
  const statusColor =
    status === 'done' ? accent :
    status === 'active' ? '#9b6dff' :
    status === 'available' ? 'var(--text-dim)' : 'var(--text-muted)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9200,
        background: 'rgba(4,4,8,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '76vh', overflowY: 'auto',
          background: 'linear-gradient(160deg, #1a1a1f, #111113)',
          border: '1.5px solid rgba(255,255,255,0.08)',
          borderRadius: '24px 24px 0 0',
          padding: '18px 20px 28px',
          boxShadow: 'var(--elev-popover)',
          animation: 'modalUp 0.28s var(--ease-spring) both',
        }}
      >
        <div style={{
          width: 38, height: 4, borderRadius: 2, margin: '0 auto 16px',
          background: 'rgba(255,255,255,0.16)',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4,
            }}>
              Site {index + 1} of {map.chambers.length}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: known ? 'var(--text)' : 'var(--text-muted)' }}>
              {known ? chamber.name : 'Unsurveyed site'}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, marginTop: 4 }}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Rewards */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 16 }}>
          <Stat icon={<Zap size={12} style={{ color: '#f5c542' }} />} label="Reward" value={`${chamber.xpReward.toLocaleString()} XP`} />
          <Stat icon={<Battery size={12} style={{ color: accent }} />} label="Energy" value={`${chamber.energyCost}`} />
          <Stat
            icon={<MapPin size={12} style={{ color: chamber.artifact ? '#9b6dff' : 'var(--text-muted)' }} />}
            label="Artifact"
            value={chamber.artifact ? 'Possible' : 'None'}
          />
        </div>

        {/* Field log */}
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Field log
        </div>
        {shown === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
            {status === 'available'
              ? 'No observations yet. Entries are logged as the expedition advances.'
              : 'Reach this site to begin logging observations.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
            {entries.slice(0, shown).map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, marginTop: 5,
                  width: 5, height: 5, borderRadius: '50%', background: accent,
                }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {entry}
                </span>
              </div>
            ))}
            {status === 'active' && shown < entries.length && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14, fontStyle: 'italic' }}>
                Awaiting further observations…
              </div>
            )}
          </div>
        )}

        {/* Outcome / action */}
        {status === 'done' && chamber.artifact && (
          <div style={{
            fontSize: 12, color: state?.artifactFound ? '#9b6dff' : 'var(--text-muted)',
            marginBottom: 14, fontWeight: 600,
          }}>
            {state?.artifactFound ? 'Artifact recovered from this site.' : 'No artifact recovered here.'}
          </div>
        )}

        {status === 'available' && (
          <button
            type="button"
            onClick={onExplore}
            disabled={!canExplore}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: canExplore ? 'linear-gradient(135deg,#9b6dff,#4f8ef7)' : 'var(--surface2)',
              color: canExplore ? '#fff' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 800,
              cursor: canExplore ? 'pointer' : 'not-allowed',
              boxShadow: canExplore ? '0 4px 18px rgba(155,109,255,0.4)' : 'none',
            }}
          >
            {notEnoughEnergy
              ? `Need ${chamber.energyCost - energy} more energy`
              : 'Send expedition'}
          </button>
        )}

        {status === 'locked' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            <Lock size={12} /> Survey {map.chambers[index - 1].name} first
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface2)', borderRadius: 13,
      border: '1px solid rgba(255,255,255,0.05)', padding: '10px 11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {icon}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: 'var(--text-muted)', textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}
