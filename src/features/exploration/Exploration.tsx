// src/pages/Exploration.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Battery, Lock, MapPin, Crown, Star, GamepadIcon, Newspaper } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { ripple } from '../../shared/lib/ripple'
import RegionMap from './RegionMap'
import { MAPS, MAX_ENERGY, tierColor, energyRange } from './explorationMaps'
import type { Chamber, ChamberState, ExplorationMap } from './explorationMaps'
import { useFeatureFlags } from '../../shared/lib/featureFlags'
import { updateMissionProgress, trackWeeklyUniqueValue, trackWeeklyActiveDay } from '../missions/weeklyMissions'

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
          boxShadow: 'var(--elev-popover)',
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
            border: '1px solid var(--border-strong)',
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
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--elev-raise)',
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
            boxShadow: 'var(--elev-inset)',
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
function MapCard({
  map, playerXP, previousMap, previousMapComplete, onClick, disabledByFlag,
}: {
  map: ExplorationMap
  playerXP: number
  previousMap: ExplorationMap | null   // null for the first map — nothing to gate on
  previousMapComplete: boolean         // ignored when previousMap is null
  onClick: (m: ExplorationMap) => void
  /** True when an admin has flipped this map's kill-switch off (Admin
   *  Dashboard → Ops console → Feature flags). */
  disabledByFlag?: boolean
}) {
  const xpLocked = playerXP < map.xpRequired
  const chainLocked = previousMap !== null && !previousMapComplete
  const locked = xpLocked || chainLocked || !!disabledByFlag
  const xpNeeded = map.xpRequired - playerXP

  const accent = tierColor(map.tier)
  const [minCost, maxCost] = energyRange(map)

  return (
    <button
      type="button"
      onClick={() => !locked && onClick(map)}
      style={{
        position: 'relative', width: '100%',
        background: locked ? 'rgba(255,255,255,0.01)' : 'var(--surface)',
        border: locked ? '1.5px solid rgba(255,255,255,0.04)' : `1.5px solid ${accent}33`,
        borderRadius: 20,
        overflow: 'hidden',
        cursor: locked ? 'not-allowed' : 'pointer',
        padding: 0, textAlign: 'left',
        boxShadow: locked
          ? '4px 4px 12px var(--neu-dark)'
          : `4px 4px 16px var(--neu-dark), -2px -2px 8px var(--neu-light), 0 0 24px ${accent}18`,
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
          background: locked ? 'rgba(255,255,255,0.06)' : `${accent}22`,
          border: `1px solid ${locked ? 'rgba(255,255,255,0.08)' : accent + '55'}`,
          borderRadius: 8, padding: '3px 10px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          color: locked ? 'rgba(255,255,255,0.2)' : accent,
          textTransform: 'uppercase',
        }}>
          TIER {map.tier}
        </div>

        {locked && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '0 16px', textAlign: 'center',
          }}>
            <Lock size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
            {/* Priority: an admin kill-switch beats the chain gate, which
                beats the XP gate — each is the actionable-or-not reason,
                in order of "can the player do anything about this". */}
            {disabledByFlag ? (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                Temporarily unavailable
              </span>
            ) : chainLocked ? (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 700, lineHeight: 1.4 }}>
                Fully explore {previousMap!.name} first
              </span>
            ) : (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                {fmtXP(xpNeeded)} XP needed
              </span>
            )}
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
            <Battery size={11} style={{ color: locked ? 'rgba(255,255,255,0.12)' : accent }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: locked ? 'rgba(255,255,255,0.12)' : accent }}>
              {minCost}–{maxCost} energy per site
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Map View ──────────────────────────────────────────────────
function MapView({
  map, energy, refreshEnergy, spendEnergy, onBack, userId, avatarUrl,
}: {
  map: ExplorationMap
  energy: number
  refreshEnergy: () => Promise<void>
  spendEnergy: (amount: number) => Promise<boolean>
  onBack: () => void
  userId: string | null
  avatarUrl?: string | null
}) {
  const [chamberStates, setChamberStates] = useState<Record<number, ChamberState>>({})
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [totalXP, setTotalXP] = useState(0)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const claimingRef = useRef<Set<number>>(new Set())

  const accent = tierColor(map.tier)

  function showToast(msg: string, color = '#9b6dff') {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 4000)
  }

  // Flat 15% drop. This used to be modulated by claim-checkpoint story
  // choices; with the narrator removed there's no per-run modifier left, so
  // the rate is constant. Story-exclusive artifacts stay out of this pool.
  // Returns true only if an artifact was actually granted, so the UI never claims
  // "Artifact found" unless something was really added to the player's inventory.
  const ARTIFACT_DROP_CHANCE = 0.15

  async function tryArtifactDrop(): Promise<boolean> {
    if (!userId) return false
    if (Math.random() > ARTIFACT_DROP_CHANCE) return false

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

  // Load this map's chamber runs from the DB — this is what makes the
  // timer survive navigation/refresh/closing the tab, since started_at
  // and ends_at are server timestamps, not a JS setTimeout.
  async function loadRuns() {
    if (!userId) { setLoadingRuns(false); return }
    const { data, error } = await supabase
      .from('exploration_chamber_runs')
      .select('chamber_id, started_at, ends_at, claimed, artifact_awarded')
      .eq('user_id', userId)
      .eq('map_id', map.id)

    if (error) { setLoadingRuns(false); return }

    const next: Record<number, ChamberState> = {}
    for (const row of data ?? []) {
      const startedAt = new Date(row.started_at).getTime()
      const endsAt = new Date(row.ends_at).getTime()
      next[row.chamber_id] = {
        status: row.claimed ? 'done' : 'running',
        startedAt,
        durationMs: endsAt - startedAt,
        artifactFound: !!row.artifact_awarded,
      }
    }
    setChamberStates(next)
    setLoadingRuns(false)
  }

  useEffect(() => { loadRuns() }, [userId, map.id])

  // claimingRef guards against double-claims if this fires twice before
  // the DB update lands.
  async function finalizeClaim(chamber: Chamber) {
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
        artifactFound = await tryArtifactDrop()
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

      // Weekly missions
      updateMissionProgress(userId, 'chambers_completed', 1).catch(console.error)
      trackWeeklyUniqueValue(userId, 'unique_maps_explored', String(map.id)).catch(console.error)
      trackWeeklyActiveDay(userId, 'exploration_days').catch(console.error)
      if (artifactFound) updateMissionProgress(userId, 'artifacts_found', 1).catch(console.error)
    }

    claimingRef.current.delete(chamber.id)
  }

  // Every 15s, claim any running chamber whose ends_at has passed. With the
  // story checkpoints gone this is the only completion path left.
  useEffect(() => {
    async function checkCompletions() {
      if (!userId) return
      const now = Date.now()

      for (const chamber of map.chambers) {
        const st = chamberStates[chamber.id]
        if (!st || st.status !== 'running' || !st.startedAt || !st.durationMs) continue
        if (now < st.startedAt + st.durationMs) continue
        if (claimingRef.current.has(chamber.id)) continue

        await finalizeClaim(chamber)
      }
    }

    const iv = setInterval(checkCompletions, 15000)
    checkCompletions()
    return () => clearInterval(iv)
  }, [chamberStates, userId, map.id])

  async function handleExplore(chamber: Chamber) {
    const ok = await spendEnergy(chamber.energyCost)
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
      [chamber.id]: { status: 'running', startedAt: startedAt.getTime(), durationMs },
    }))
  }

  const doneCount = Object.values(chamberStates).filter(s => s.status === 'done').length
  const progressPct = (doneCount / map.chambers.length) * 100

  // Fires the "fully explored a map" highlight — this is the whole map (all
  // chambers), not a single chamber. checkMapCompleteHighlight is itself
  // deduped (dedup_key `map:{id}`, unique per author), so it's safe even if
  // this effect re-runs on every chamberStates change.
  useEffect(() => {
    if (loadingRuns || doneCount === 0 || doneCount < map.chambers.length || !userId) return
    import('../highlights/highlightTriggers').then(({ checkMapCompleteHighlight }) => {
      checkMapCompleteHighlight(userId, map.id, map.name).catch(console.error)
    })
  }, [doneCount, loadingRuns, map.chambers.length, map.id, map.name, userId])

  return (
    <div style={{ paddingBottom: 100 }}>
      <RegionMap
        map={map}
        chamberStates={chamberStates}
        energy={energy}
        loadingRuns={loadingRuns}
        onExplore={handleExplore}
        onBack={onBack}
        avatarUrl={avatarUrl}
      />

      {/* Map progress */}
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '14px 16px',
        margin: '16px 0 14px',
        boxShadow: 'var(--elev-raise)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Region surveyed</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: accent }}>{Math.floor(progressPct)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', boxShadow: 'var(--elev-inset)' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${accent}bb, ${accent})`,
            borderRadius: 4, transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${accent}66`,
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

    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Exploration() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { profile } = useProfile()
  const playerXP = profile?.xp ?? 0
  const { isEnabled: isFlagEnabled } = useFeatureFlags()

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

  // Which maps this user has fully explored (every chamber claimed) —
  // drives the sequential map-unlock chain below, independent of the XP
  // gate. Keyed by map id; a missing/false entry means "not complete."
  const [mapCompletion, setMapCompletion] = useState<Record<number, boolean>>({})

  async function loadMapCompletion() {
    if (!userId) return
    const { data, error } = await supabase
      .from('exploration_chamber_runs')
      .select('map_id, chamber_id')
      .eq('user_id', userId)
      .eq('claimed', true)
    if (error) return

    const claimedByMap: Record<number, Set<number>> = {}
    for (const row of data ?? []) {
      ;(claimedByMap[row.map_id] ??= new Set()).add(row.chamber_id)
    }
    const next: Record<number, boolean> = {}
    for (const map of MAPS) {
      next[map.id] = (claimedByMap[map.id]?.size ?? 0) >= map.chambers.length
    }
    setMapCompletion(next)
  }

  useEffect(() => { loadMapCompletion() }, [userId])

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

          <button
            type="button"
            onClick={(e) => { ripple(e); navigate('/blog') }}
            className="ripple-wrap"
            title="Chillverse Blog"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0,
              background: 'var(--surface)', border: '1.5px solid rgba(255,255,255,0.06)', borderRadius: 12,
              padding: '9px 12px', boxShadow: 'var(--elev-raise-sm)',
            }}
          >
            <Newspaper size={15} color="var(--accent)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Blog</span>
          </button>
        </div>

        {/* Energy row */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '12px 16px',
            marginBottom: 18,
            boxShadow: 'var(--elev-raise)',
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
            onBack={() => { setActiveMap(null); loadMapCompletion() }}
            userId={userId}
            avatarUrl={profile?.avatar ?? null}
          />
        ) : (
          <>
            {/* World banner */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              marginBottom: 20, position: 'relative', height: 90,
              border: '1.5px solid rgba(255,255,255,0.06)',
              boxShadow: 'var(--elev-raise-sm)',
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
              {MAPS.map((map, i) => (
                <MapCard
                  key={map.id}
                  map={map}
                  playerXP={playerXP}
                  previousMap={i === 0 ? null : MAPS[i - 1]}
                  previousMapComplete={i === 0 ? true : !!mapCompletion[MAPS[i - 1].id]}
                  disabledByFlag={!isFlagEnabled(`map:${map.id}`)}
                  onClick={m => {
                    if (!isFlagEnabled(`map:${m.id}`)) return
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
