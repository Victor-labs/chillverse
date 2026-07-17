// src/pages/Exploration.tsx
import { useState, useEffect, useRef } from 'react'
import { Battery, Lock, Zap, MapPin, ChevronLeft, Crown, Star, Trophy, GamepadIcon } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import StoryCheckpointOverlay from './story/StoryCheckpointOverlay'
import { STORY_CONTENT } from './story/content'
import type { CheckpointStage, StoryChoiceOption } from './story/types'

// ── Types ─────────────────────────────────────────────────────
interface Chamber {
  id: number
  name: string
  baseTimeHours: number
  xpReward: number
  artifact: boolean
}

interface ExplorationMap {
  id: number
  name: string
  tier: string
  xpRequired: number
  image: string
  energyCost: number
  artifactLocation: string   // matches artifacts.location in DB
  chambers: Chamber[]
}

// Which start/mid/claim checkpoints this run has already resolved.
// Absent key == not yet seen. Populated from exploration_chamber_runs.story_state.
type StorySeenMap = Partial<Record<CheckpointStage, boolean>>

interface ChamberState {
  status: 'idle' | 'running' | 'awaiting_story' | 'done'
  startedAt?: number      // ms timestamp
  durationMs?: number     // total ms for this run
  progress?: number       // 0–100
  artifactFound?: boolean // only true if the artifact roll actually hit
  storySeen?: StorySeenMap
}

const MAX_ENERGY = 200

// ── Maps Data ─────────────────────────────────────────────────
const MAPS: ExplorationMap[] = [
  {
    id: 1, name: 'Greenfields', tier: 'I', xpRequired: 0,
    artifactLocation: 'Greenfields',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/2f3de4d78ede24c46d7a8ecf5f67b9c0.webp.jpg',
    energyCost: MAX_ENERGY,
    chambers: [
      { id: 1, name: 'Mossy Gate',      baseTimeHours: 5, xpReward: 70,   artifact: false },
      { id: 2, name: 'Thornwood Pass',  baseTimeHours: 5, xpReward: 110,  artifact: true  },
      { id: 3, name: 'Sunken Altar',    baseTimeHours: 5, xpReward: 180,  artifact: false },
      { id: 4, name: 'Root Labyrinth',  baseTimeHours: 5, xpReward: 260,  artifact: true  },
      { id: 5, name: 'The Deep Hollow', baseTimeHours: 5, xpReward: 550,  artifact: true  },
    ],
  },
  {
    id: 2, name: 'Crystal Lake', tier: 'II', xpRequired: 30000,
    artifactLocation: 'Crystal Lake',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/45a3c9b17775c774156c9c924ed4a89e.webp.jpg',
    energyCost: MAX_ENERGY,
    chambers: [
      { id: 1, name: 'Ember Arch',      baseTimeHours: 5, xpReward: 400,  artifact: false },
      { id: 2, name: 'Cinder Hall',     baseTimeHours: 5, xpReward: 650,  artifact: true  },
      { id: 3, name: 'Obsidian Court',  baseTimeHours: 5, xpReward: 900,  artifact: false },
      { id: 4, name: 'The Ashen Keep',  baseTimeHours: 5, xpReward: 1200, artifact: false },
      { id: 5, name: 'Pyroclast Vault', baseTimeHours: 5, xpReward: 2500, artifact: true  },
    ],
  },
  {
    id: 3, name: 'Under World', tier: 'III', xpRequired: 90000,
    artifactLocation: 'Under World',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/7c15d735d2aeb8fff833fdd949d5c4a3.jpg',
    energyCost: MAX_ENERGY,
    chambers: [
      { id: 1, name: 'Salt Shore',        baseTimeHours: 5, xpReward: 1200, artifact: false },
      { id: 2, name: 'Kelp Maze',         baseTimeHours: 5, xpReward: 2000, artifact: true  },
      { id: 3, name: 'Drowned Citadel',   baseTimeHours: 5, xpReward: 3500, artifact: false },
      { id: 4, name: 'Abyss Gate',        baseTimeHours: 5, xpReward: 6000, artifact: true  },
      { id: 5, name: 'The Sunken Throne', baseTimeHours: 5, xpReward: 9000, artifact: false },
    ],
  },
  {
    id: 4, name: 'The Void', tier: 'IV', xpRequired: 250000,
    artifactLocation: 'The Void',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/ecaf76f4607a37f03cfaac5babbc2826.jpg',
    energyCost: MAX_ENERGY,
    chambers: [
      { id: 1, name: 'Cloud Vestibule', baseTimeHours: 5, xpReward: 3000,  artifact: false },
      { id: 2, name: 'Star Corridor',   baseTimeHours: 5, xpReward: 5000,  artifact: true  },
      { id: 3, name: 'Void Sanctum',    baseTimeHours: 5, xpReward: 8000,  artifact: true  },
      { id: 4, name: 'Ether Pinnacle',  baseTimeHours: 5, xpReward: 11000, artifact: true  },
      { id: 5, name: 'The Apex',        baseTimeHours: 5, xpReward: 15000, artifact: true  },
    ],
  },
]

const MAP5_IMAGE = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/edbe74644bf60a82c20ad2e3b69cb5ff.jpg'
const AVATAR_PLACEHOLDER = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/ac50a770bef6d3a9b94eac44e946924f.jpg'

// Refill rate is computed server-side in the get_exploration_energy /
// spend_exploration_energy RPCs (kept out of the client on purpose so the
// exact refill time isn't exposed), so it stays correct regardless of how
// long the client was closed.

// ── Helpers ───────────────────────────────────────────────────
function fmtXP(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`
}

// ── No Avatar Modal ───────────────────────────────────────────
function NoAvatarModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: 'linear-gradient(160deg, #1a1a1f, #111113)',
          border: '1.5px solid rgba(255,255,255,0.08)',
          borderRadius: 28,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          animation: 'modalUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Big image box */}
        <div style={{
          width: '100%', aspectRatio: '16/9',
          position: 'relative', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          <img
            src={AVATAR_PLACEHOLDER}
            alt="Avatar required"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Small inner box overlay */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            background: 'rgba(10,10,14,0.82)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GamepadIcon size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>Explorer Required</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>You need an avatar to explore</div>
            </div>
          </div>
        </div>

        {/* Text + buttons */}
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
            Sorry, we noticed you do not own an avatar yet. You cannot explore without them.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.href = '/mall'}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 14,
                background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
                border: 'none',
                color: '#fff',
                fontSize: 13, fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(155,109,255,0.4)',
              }}
            >
              Buy Avatar
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 18px',
                borderRadius: 14,
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '4px 4px 10px var(--neu-dark), -2px -2px 6px var(--neu-light)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Energy Bar ────────────────────────────────────────────────
function EnergyBar({ current, max, onTap }: { current: number; max: number; onTap: () => void }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 60 ? '#3ecf8e' : pct > 25 ? '#f5c542' : '#ef4444'

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        width: '100%', background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Battery size={16} style={{ color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'var(--surface2)',
            overflow: 'hidden',
            boxShadow: 'inset 2px 2px 4px var(--neu-dark)',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 4,
              background: `linear-gradient(90deg, ${color}bb, ${color})`,
              transition: 'width 0.6s ease',
              boxShadow: `0 0 8px ${color}66`,
            }} />
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 52, textAlign: 'right' }}>
          {current}/{max}
        </span>
      </div>
    </button>
  )
}

// ── Energy Tooltip ────────────────────────────────────────────
function EnergyTooltip({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 160,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1.5px solid rgba(155,109,255,0.25)',
          borderRadius: 16,
          padding: '14px 16px',
          maxWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 4px 4px 12px var(--neu-dark)',
          position: 'relative',
          animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Speech bubble triangle */}
        <div style={{
          position: 'absolute', top: -8, left: 28,
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid rgba(155,109,255,0.25)',
        }} />
        <div style={{
          position: 'absolute', top: -6, left: 29,
          width: 0, height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: '7px solid #1a1a1f',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Crown size={14} style={{ color: '#f5c542', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f5c542' }}>Pro Tip</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Upgrade to Pro to enjoy higher energy refill rate — spend less time waiting, more time exploring.
        </div>
      </div>
    </div>
  )
}

// ── Map Card ──────────────────────────────────────────────────
function MapCard({ map, playerXP, onClick }: { map: ExplorationMap; playerXP: number; onClick: (m: ExplorationMap) => void }) {
  const locked = playerXP < map.xpRequired
  const xpNeeded = map.xpRequired - playerXP

  const tierColors: Record<string, string> = {
    'I': '#3ecf8e', 'II': '#4f8ef7', 'III': '#9b6dff', 'IV': '#f5c542',
  }
  const tierColor = tierColors[map.tier] ?? '#888899'

  return (
    <button
      type="button"
      onClick={() => !locked && onClick(map)}
      style={{
        position: 'relative', width: '100%',
        background: locked ? 'rgba(255,255,255,0.01)' : 'var(--surface)',
        border: locked ? '1.5px solid rgba(255,255,255,0.04)' : `1.5px solid ${tierColor}33`,
        borderRadius: 20,
        overflow: 'hidden',
        cursor: locked ? 'not-allowed' : 'pointer',
        padding: 0, textAlign: 'left',
        boxShadow: locked
          ? '4px 4px 12px var(--neu-dark)'
          : `4px 4px 16px var(--neu-dark), -2px -2px 8px var(--neu-light), 0 0 24px ${tierColor}18`,
        transition: 'transform 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      {/* Map image */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        <img
          src={map.image} alt={map.name}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: locked ? 'grayscale(1) brightness(0.3)' : 'brightness(0.7)',
            transition: 'filter 0.3s',
          }}
        />
        {/* Tier badge */}
        <div style={{
          position: 'absolute', top: 10, left: 12,
          background: locked ? 'rgba(255,255,255,0.06)' : `${tierColor}22`,
          border: `1px solid ${locked ? 'rgba(255,255,255,0.08)' : tierColor + '55'}`,
          borderRadius: 8, padding: '3px 10px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          color: locked ? 'rgba(255,255,255,0.2)' : tierColor,
          textTransform: 'uppercase',
        }}>
          TIER {map.tier}
        </div>

        {locked && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Lock size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
              {fmtXP(xpNeeded)} XP needed
            </span>
          </div>
        )}

        {/* Gradient fade bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
          background: 'linear-gradient(to top, var(--surface), transparent)',
        }} />
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{
            fontSize: 15, fontWeight: 800,
            color: locked ? 'rgba(255,255,255,0.18)' : 'var(--text)',
          }}>
            {map.name}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={11} style={{ color: locked ? 'rgba(255,255,255,0.12)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 11, color: locked ? 'rgba(255,255,255,0.12)' : 'var(--text-muted)', fontWeight: 600 }}>
              {map.chambers.length} chambers
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Battery size={11} style={{ color: locked ? 'rgba(255,255,255,0.12)' : tierColor }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: locked ? 'rgba(255,255,255,0.12)' : tierColor }}>
              Full energy per chamber
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Chamber Row ───────────────────────────────────────────────
function ChamberRow({
  chamber, index, state, onExplore, disabled, lockedReason,
}: {
  chamber: Chamber
  index: number
  state: ChamberState | null
  onExplore: (c: Chamber) => void
  disabled: boolean
  lockedReason?: string
}) {
  const isRunning = state?.status === 'running'
  const isDone = state?.status === 'done'

  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isRunning || !state?.startedAt || !state?.durationMs) return
    const tick = () => {
      const elapsed = Date.now() - state.startedAt!
      setProgress(Math.min(100, (elapsed / state.durationMs!) * 100))
    }
    tick()
    const iv = setInterval(tick, 10000) // update every 10s — no countdown shown
    return () => clearInterval(iv)
  }, [isRunning, state?.startedAt, state?.durationMs])

  useEffect(() => { if (isDone) setProgress(100) }, [isDone])

  return (
    <div style={{
      background: isDone ? 'rgba(62,207,142,0.04)' : 'var(--surface)',
      border: isDone
        ? '1.5px solid rgba(62,207,142,0.2)'
        : isRunning
          ? '1.5px solid rgba(155,109,255,0.25)'
          : '1.5px solid rgba(255,255,255,0.05)',
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: '4px 4px 10px var(--neu-dark), -2px -2px 6px var(--neu-light)',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Index / check */}
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: isDone ? 'rgba(62,207,142,0.15)' : isRunning ? 'rgba(155,109,255,0.15)' : 'var(--surface2)',
          border: isDone ? '1.5px solid rgba(62,207,142,0.4)' : isRunning ? '1.5px solid rgba(155,109,255,0.4)' : '1.5px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isDone ? '0 0 10px rgba(62,207,142,0.2)' : 'none',
        }}>
          {isDone
            ? <span style={{ fontSize: 14 }}>✓</span>
            : <span style={{ fontSize: 12, fontWeight: 800, color: isRunning ? '#9b6dff' : 'var(--text-muted)' }}>{index + 1}</span>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: isDone ? '#3ecf8e' : 'var(--text)',
            marginBottom: 3,
          }}>
            {chamber.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isDone ? (
              <>
                <span style={{ color: '#f5c542', fontWeight: 700 }}>+{chamber.xpReward} XP</span>
                {chamber.artifact && (
                  state?.artifactFound
                    ? <span style={{ color: '#9b6dff' }}>🏺 Artifact found</span>
                    : <span style={{ color: 'rgba(255,255,255,0.35)' }}>Oops, you didn't successfully claim an artifact</span>
                )}
              </>
            ) : (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Zap size={10} style={{ color: '#f5c542' }} />+{fmtXP(chamber.xpReward)} XP
                </span>
                {chamber.artifact && <span style={{ color: 'rgba(155,109,255,0.6)' }}>may contain artifact</span>}
              </>
            )}
          </div>
        </div>

        {/* Action */}
        {!isDone && !isRunning && (
          <button
            type="button"
            onClick={() => onExplore(chamber)}
            disabled={disabled}
            style={{
              padding: '8px 16px', borderRadius: 12, flexShrink: 0,
              background: disabled ? 'var(--surface2)' : 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
              border: 'none',
              color: disabled ? 'var(--text-muted)' : '#fff',
              fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : '0 4px 14px rgba(155,109,255,0.4)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Explore
          </button>
        )}
        {isDone && <Trophy size={16} style={{ color: '#3ecf8e', flexShrink: 0 }} />}
        {isRunning && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#9b6dff', flexShrink: 0,
            boxShadow: '0 0 8px #9b6dff',
            animation: 'pulse 1.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Locked reason */}
      {!isDone && !isRunning && lockedReason && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Lock size={10} /> {lockedReason}
        </div>
      )}

      {/* Progress bar */}
      {(isRunning || isDone) && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            height: 5, borderRadius: 4,
            background: 'var(--surface2)',
            overflow: 'hidden',
            boxShadow: 'inset 2px 2px 4px var(--neu-dark)',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: isDone ? 'linear-gradient(90deg,#3ecf8e,#4f8ef7)' : 'linear-gradient(90deg,#9b6dff,#4f8ef7)',
              borderRadius: 4,
              transition: isDone ? 'none' : 'width 1s linear',
              boxShadow: isDone ? '0 0 8px rgba(62,207,142,0.5)' : '0 0 8px rgba(155,109,255,0.5)',
            }} />
          </div>
          {isRunning && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#9b6dff', fontWeight: 700 }}>
                {Math.floor(progress)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Map View ──────────────────────────────────────────────────
function MapView({
  map, energy, refreshEnergy, spendEnergy, onBack, userId,
}: {
  map: ExplorationMap
  energy: number
  refreshEnergy: () => Promise<void>
  spendEnergy: (amount: number) => Promise<boolean>
  onBack: () => void
  userId: string | null
}) {
  const [chamberStates, setChamberStates] = useState<Record<number, ChamberState>>({})
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [totalXP, setTotalXP] = useState(0)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const claimingRef = useRef<Set<number>>(new Set())

  // Story checkpoint currently on screen (at most one at a time). Only
  // chambers with content in STORY_CONTENT[map.id] ever set this.
  const [activeCheckpoint, setActiveCheckpoint] = useState<{
    chamber: Chamber
    stage: CheckpointStage
    onResolved: (oddsDelta: number) => void | Promise<void>
  } | null>(null)

  const tierColors: Record<string, string> = {
    'I': '#3ecf8e', 'II': '#4f8ef7', 'III': '#9b6dff', 'IV': '#f5c542',
  }
  const tierColor = tierColors[map.tier] ?? '#9b6dff'

  function showToast(msg: string, color = '#9b6dff') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 4000)
  }

  // Base 15% drop, adjusted by any claim-checkpoint story choice for this run
  // (oddsDelta, 0 if the chamber has no story content or the player never
  // saw a claim checkpoint). Story-exclusive artifacts are never part of
  // this random pool — those are only ever granted directly by
  // apply_story_checkpoint's grant_artifact effect.
  // Returns true only if an artifact was actually granted, so the UI never claims
  // "Artifact found" unless something was really added to the player's inventory.
  async function tryArtifactDrop(oddsDelta = 0): Promise<boolean> {
    if (!userId) return false
    const chance = Math.min(0.6, Math.max(0.05, 0.15 + oddsDelta))
    if (Math.random() > chance) return false

    // Fetch all artifacts in this location that the player doesn't own yet
    const { data: owned } = await supabase
      .from('player_artifacts')
      .select('artifact_id')
      .eq('user_id', userId)

    const ownedIds = new Set((owned ?? []).map((r: { artifact_id: string }) => r.artifact_id))

    const { data: available } = await supabase
      .from('artifacts')
      .select('id, name')
      .eq('location', map.artifactLocation)
      .eq('story_exclusive', false)

    const eligible = (available ?? []).filter((a: { id: string; name: string }) => !ownedIds.has(a.id))
    if (!eligible.length) return false  // player owns them all from this location

    // Pick one at random
    const pick = eligible[Math.floor(Math.random() * eligible.length)]

    const { error } = await supabase
      .from('player_artifacts')
      .insert({ user_id: userId, artifact_id: pick.id })

    if (!error) {
      showToast(`🏺 Artifact found — ${pick.name}!`, '#f5c542')
      return true
    }
    return false
  }

  // Looks up this chamber's checkpoint content for the given stage, if any.
  // Maps/chambers with no authored story (everything but Greenfields today)
  // simply return undefined and every story trigger below no-ops.
  function getCheckpoint(chamberId: number, stage: CheckpointStage) {
    return STORY_CONTENT[map.id]?.[chamberId]?.[stage]
  }

  // Calls apply_story_checkpoint for the picked option, applies the flag/
  // XP/artifact-grant effects server-side, marks the stage seen locally so
  // it can't retrigger, and resolves with the odds_delta the RPC computed
  // (0 for anything but a claim-stage pick with artifact_odds_delta effects).
  async function resolveCheckpoint(chamber: Chamber, stage: CheckpointStage, option: StoryChoiceOption): Promise<number> {
    setChamberStates(s => ({
      ...s,
      [chamber.id]: { ...s[chamber.id], storySeen: { ...s[chamber.id]?.storySeen, [stage]: true } },
    }))

    if (!userId) return 0
    const { data, error } = await supabase.rpc('apply_story_checkpoint', {
      p_user_id: userId,
      p_map_id: map.id,
      p_chamber_id: chamber.id,
      p_stage: stage,
      p_choice_id: option.id,
      p_effects: option.effects,
    })
    if (error) return 0
    return typeof data?.odds_delta === 'number' ? data.odds_delta : 0
  }

  // Load this map's chamber runs from the DB — this is what makes the
  // timer survive navigation/refresh/closing the tab, since started_at
  // and ends_at are server timestamps, not a JS setTimeout.
  async function loadRuns() {
    if (!userId) { setLoadingRuns(false); return }
    const { data, error } = await supabase
      .from('exploration_chamber_runs')
      .select('chamber_id, started_at, ends_at, claimed, artifact_awarded, story_state')
      .eq('user_id', userId)
      .eq('map_id', map.id)

    if (error) { setLoadingRuns(false); return }

    const next: Record<number, ChamberState> = {}
    for (const row of data ?? []) {
      const startedAt = new Date(row.started_at).getTime()
      const endsAt = new Date(row.ends_at).getTime()
      const storyState = (row.story_state ?? {}) as Record<string, { seen?: boolean }>
      next[row.chamber_id] = {
        status: row.claimed ? 'done' : 'running',
        startedAt,
        durationMs: endsAt - startedAt,
        artifactFound: !!row.artifact_awarded,
        storySeen: {
          start: !!storyState.start?.seen,
          mid: !!storyState.mid?.seen,
          claim: !!storyState.claim?.seen,
        },
      }
    }
    setChamberStates(next)
    setLoadingRuns(false)
  }

  useEffect(() => { loadRuns() }, [userId, map.id])

  // Shared by checkCompletions (no story, or claim checkpoint already
  // resolved) and by the claim-checkpoint overlay's onResolved callback
  // (story checkpoint just resolved, oddsDelta comes from its effects).
  // claimingRef guards against double-claims if this fires twice before
  // the DB update lands.
  async function finalizeClaim(chamber: Chamber, oddsDelta: number) {
    if (!userId) return
    if (claimingRef.current.has(chamber.id)) return
    claimingRef.current.add(chamber.id)

    // Flip claimed=true only if it's still false — the WHERE clause
    // makes this safe even if two tabs race each other.
    const { data: claimedRow, error } = await supabase
      .from('exploration_chamber_runs')
      .update({ claimed: true })
      .eq('user_id', userId)
      .eq('map_id', map.id)
      .eq('chamber_id', chamber.id)
      .eq('claimed', false)
      .select('chamber_id')
      .maybeSingle()

    if (!error && claimedRow) {
      await supabase.rpc('award_xp', { p_user_id: userId, p_xp: chamber.xpReward })
      setTotalXP(x => x + chamber.xpReward)
      showToast(`+${chamber.xpReward} XP earned from ${chamber.name}!`, '#3ecf8e')

      let artifactFound = false
      if (chamber.artifact) {
        artifactFound = await tryArtifactDrop(oddsDelta)
        // Persist the real outcome so the "Artifact found" label survives
        // navigation/refresh and never shows unless something was granted.
        await supabase
          .from('exploration_chamber_runs')
          .update({ artifact_awarded: artifactFound })
          .eq('user_id', userId)
          .eq('map_id', map.id)
          .eq('chamber_id', chamber.id)
      }

      setChamberStates(s => ({ ...s, [chamber.id]: { ...s[chamber.id], status: 'done', artifactFound } }))
    }

    claimingRef.current.delete(chamber.id)
  }

  // Every 15s, check for any running chamber that has crossed a story
  // checkpoint (mid at 50% elapsed, claim at completion) or whose ends_at
  // has passed with no story content, and handle it exactly once.
  useEffect(() => {
    async function checkCompletions() {
      if (!userId || activeCheckpoint) return
      const now = Date.now()

      for (const chamber of map.chambers) {
        const st = chamberStates[chamber.id]
        if (!st || st.status !== 'running' || !st.startedAt || !st.durationMs) continue

        // Mid checkpoint — fires once, at 50% elapsed. Checked before the
        // completion guard below so it still surfaces even if the chamber
        // finished entirely while nobody had the map open.
        const midCheckpoint = getCheckpoint(chamber.id, 'mid')
        if (midCheckpoint && !st.storySeen?.mid && now >= st.startedAt + st.durationMs * 0.5) {
          setActiveCheckpoint({ chamber, stage: 'mid', onResolved: () => {} })
          return
        }

        if (now < st.startedAt + st.durationMs) continue
        if (claimingRef.current.has(chamber.id)) continue

        const claimCheckpoint = getCheckpoint(chamber.id, 'claim')
        if (claimCheckpoint && !st.storySeen?.claim) {
          setChamberStates(s => ({ ...s, [chamber.id]: { ...s[chamber.id], status: 'awaiting_story' } }))
          setActiveCheckpoint({
            chamber, stage: 'claim',
            onResolved: oddsDelta => finalizeClaim(chamber, oddsDelta),
          })
          return
        }

        await finalizeClaim(chamber, 0)
      }
    }

    const iv = setInterval(checkCompletions, 15000)
    checkCompletions()
    return () => clearInterval(iv)
  }, [chamberStates, userId, map.id, activeCheckpoint])

  async function handleCheckpointComplete(option: StoryChoiceOption) {
    if (!activeCheckpoint) return
    const { chamber, stage, onResolved } = activeCheckpoint
    const oddsDelta = await resolveCheckpoint(chamber, stage, option)
    setActiveCheckpoint(null)
    await onResolved(oddsDelta)
  }

  async function handleExplore(chamber: Chamber) {
    const ok = await spendEnergy(map.energyCost)
    if (!ok) {
      showToast('Not enough energy!', '#ef4444')
      return
    }

    const startedAt = new Date()
    const durationMs = chamber.baseTimeHours * 60 * 60 * 1000
    const endsAt = new Date(startedAt.getTime() + durationMs)

    const { error } = await supabase
      .from('exploration_chamber_runs')
      .insert({
        user_id: userId,
        map_id: map.id,
        chamber_id: chamber.id,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })

    if (error) {
      showToast('Could not start exploration — try again.', '#ef4444')
      refreshEnergy() // give back the optimistic deduction on failure
      return
    }

    setChamberStates(s => ({
      ...s,
      [chamber.id]: { status: 'running', startedAt: startedAt.getTime(), durationMs, progress: 0 },
    }))

    const startCheckpoint = getCheckpoint(chamber.id, 'start')
    if (startCheckpoint) {
      setActiveCheckpoint({ chamber, stage: 'start', onResolved: () => {} })
    }
  }

  const doneCount = Object.values(chamberStates).filter(s => s.status === 'done').length
  const progressPct = (doneCount / map.chambers.length) * 100

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
          background: 'var(--surface)',
          border: '1.5px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '8px 16px',
          color: 'var(--text-muted)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '4px 4px 10px var(--neu-dark), -2px -2px 6px var(--neu-light)',
        }}
      >
        <ChevronLeft size={16} /> Back
      </button>

      {/* Map image banner */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/7',
        borderRadius: 20, overflow: 'hidden',
        border: `1.5px solid ${tierColor}33`,
        marginBottom: 16,
        boxShadow: `4px 4px 20px var(--neu-dark), 0 0 30px ${tierColor}18`,
      }}>
        <img src={map.image} alt={map.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,10,14,0.9) 0%, transparent 50%)',
        }} />

        {/* Tier badge */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: `${tierColor}22`, border: `1px solid ${tierColor}55`,
          borderRadius: 8, padding: '4px 12px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          color: tierColor, textTransform: 'uppercase',
        }}>
          TIER {map.tier}
        </div>

        {/* Chamber progress dots */}
        <div style={{
          position: 'absolute', bottom: 14, left: 16, right: 16,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {map.chambers.map((c, i) => {
            const st = chamberStates[c.id]
            const done = st?.status === 'done'
            const running = st?.status === 'running'
            return (
              <div key={c.id} style={{
                width: done ? 24 : running ? 20 : 16,
                height: done ? 24 : running ? 20 : 16,
                borderRadius: '50%',
                background: done ? '#3ecf8e' : running ? '#9b6dff' : 'rgba(255,255,255,0.12)',
                border: `2px solid ${done ? '#3ecf8e' : running ? '#9b6dff' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#fff', fontWeight: 800,
                transition: 'all 0.3s',
                boxShadow: done ? '0 0 10px rgba(62,207,142,0.5)' : running ? '0 0 10px rgba(155,109,255,0.5)' : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
            )
          })}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
            {doneCount}/{map.chambers.length}
          </span>
        </div>

        {/* Title */}
        <div style={{
          position: 'absolute', bottom: 48, left: 16,
          fontSize: 20, fontWeight: 800, color: '#fff',
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}>
          {map.name}
        </div>
      </div>

      {/* Map progress bar */}
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '14px 16px',
        marginBottom: 14,
        boxShadow: '4px 4px 10px var(--neu-dark), -2px -2px 6px var(--neu-light)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Map Progress</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: tierColor }}>{Math.floor(progressPct)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', boxShadow: 'inset 2px 2px 4px var(--neu-dark)' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${tierColor}bb, ${tierColor})`,
            borderRadius: 4, transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${tierColor}66`,
          }} />
        </div>
      </div>

      {/* XP earned */}
      {totalXP > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(245,197,66,0.05)',
          border: '1.5px solid rgba(245,197,66,0.2)',
          borderRadius: 14, padding: '12px 16px',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={14} style={{ color: '#f5c542' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>XP earned this run</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f5c542' }}>+{totalXP.toLocaleString()}</span>
        </div>
      )}

      {/* Chambers */}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
        Chambers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {map.chambers.map((chamber, i) => {
          const prevDone = i === 0 || chamberStates[map.chambers[i - 1].id]?.status === 'done'
          const notEnoughEnergy = energy < map.energyCost
          const lockedReason = loadingRuns
            ? undefined
            : !prevDone
            ? 'Explore the previous chamber first'
            : notEnoughEnergy
            ? 'Not enough energy'
            : undefined

          return (
            <ChamberRow
              key={chamber.id}
              chamber={chamber}
              index={i}
              state={chamberStates[chamber.id] ?? null}
              onExplore={handleExplore}
              disabled={loadingRuns || !prevDone || notEnoughEnergy}
              lockedReason={lockedReason}
            />
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)',
          border: `1.5px solid ${toast.color}44`,
          borderRadius: 14, padding: '12px 20px',
          color: toast.color, fontSize: 13, fontWeight: 700,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${toast.color}33`,
          zIndex: 200,
          whiteSpace: 'nowrap',
          animation: 'fadeInUp 0.3s ease both',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Story checkpoint */}
      {activeCheckpoint && (() => {
        const checkpoint = getCheckpoint(activeCheckpoint.chamber.id, activeCheckpoint.stage)
        return checkpoint ? (
          <StoryCheckpointOverlay checkpoint={checkpoint} onComplete={handleCheckpointComplete} />
        ) : null
      })()}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Exploration() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { profile } = useProfile()
  const playerXP = profile?.xp ?? 0

  const [energy, setEnergy] = useState(MAX_ENERGY)

  // ── Broadcast "exploring" presence for the live ticker on profiles.
  //    Mirrors Watch.tsx's movie presence — instant, automatic cleanup
  //    on unmount, zero DB writes.
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`user-activity:${userId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ activity: 'exploring', since: Date.now() })
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [userId])

  const refreshEnergy = async () => {
    if (!userId) return
    const { data, error } = await supabase.rpc('get_exploration_energy', { p_user_id: userId })
    if (!error && typeof data === 'number') setEnergy(data)
  }

  // Atomically spend energy server-side (refill-aware). Returns false if
  // there wasn't enough — the caller shows the "not enough energy" toast.
  const spendEnergy = async (amount: number): Promise<boolean> => {
    if (!userId) return false
    const { data, error } = await supabase.rpc('spend_exploration_energy', {
      p_user_id: userId,
      p_amount: amount,
    })
    if (error) return false
    setEnergy(data as number)
    return true
  }

  // Fetch real (refill-aware) energy on mount, then refresh periodically
  // so the display stays current even if the user never spends anything.
  useEffect(() => {
    refreshEnergy()
    const iv = setInterval(refreshEnergy, 60000)
    return () => clearInterval(iv)
  }, [userId])
  const [activeMap, setActiveMap] = useState<ExplorationMap | null>(null)
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(null)  // null = loading
  const [showNoAvatar, setShowNoAvatar] = useState(false)
  const [showEnergyTip, setShowEnergyTip] = useState(false)

  // Check equipped avatar
  useEffect(() => {
    if (!userId) return
    async function checkAvatar() {
      const { data, error } = await supabase
        .from('user_inventory')
        .select('id, item_id, mall_items!inner(category)')
        .eq('user_id', userId)
        .eq('is_equipped', true)
        .eq('mall_items.category', 'avatar_skin')
        .limit(1)
        .maybeSingle()

      if (error) { setHasAvatar(false); return }
      const equipped = !!data
      setHasAvatar(equipped)
      if (!equipped) setShowNoAvatar(true)
    }
    checkAvatar()
  }, [userId])

  const pageGrey = hasAvatar === false

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100, position: 'relative' }}>

      {/* Grey overlay when no avatar */}
      {pageGrey && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8500,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'grayscale(1) brightness(0.4)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ padding: '20px 20px 0', filter: pageGrey ? 'grayscale(1) brightness(0.4)' : 'none', transition: 'filter 0.3s' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(155,109,255,0.35)',
          }}>
            <GamepadIcon size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Exploration</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Discover chambers & earn artifacts</div>
          </div>
        </div>

        {/* Energy row */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '12px 16px',
            marginBottom: 18,
            boxShadow: '4px 4px 12px var(--neu-dark), -2px -2px 6px var(--neu-light)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Energy</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Refills over time</span>
          </div>
          <EnergyBar current={energy} max={MAX_ENERGY} onTap={() => setShowEnergyTip(t => !t)} />
        </div>

        {/* Energy tooltip */}
        {showEnergyTip && <EnergyTooltip onClose={() => setShowEnergyTip(false)} />}

        {/* Content */}
        {activeMap ? (
          <MapView
            map={activeMap}
            energy={energy}
            refreshEnergy={refreshEnergy}
            spendEnergy={spendEnergy}
            onBack={() => setActiveMap(null)}
            userId={userId}
          />
        ) : (
          <>
            {/* World banner */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              marginBottom: 20, position: 'relative', height: 90,
              border: '1.5px solid rgba(255,255,255,0.06)',
              boxShadow: '4px 4px 14px var(--neu-dark)',
            }}>
              <img src={MAP5_IMAGE} alt="World" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: 'brightness(0.35) saturate(0.7)',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, rgba(10,10,14,0.9) 0%, transparent 70%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '0 18px',
              }}>
                <div style={{ fontSize: 10, color: '#9b6dff', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Regions Available
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                  4 maps · Many secrets await
                </div>
              </div>
            </div>

            {/* Map grid */}
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              Select a Map
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {MAPS.map(map => (
                <MapCard
                  key={map.id}
                  map={map}
                  playerXP={playerXP}
                  onClick={m => {
                    if (!hasAvatar) { setShowNoAvatar(true); return }
                    setActiveMap(m)
                  }}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24 }}>
              Earn XP by exploring chambers to unlock higher-tier maps
            </div>
          </>
        )}
      </div>

      {/* No avatar modal */}
      {showNoAvatar && <NoAvatarModal onClose={() => setShowNoAvatar(false)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(8px) scale(0.92) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px) }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) }
        }
      `}</style>
    </div>
  )
}
