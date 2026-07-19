// src/pages/Artifacts.tsx
import { useState, useEffect } from 'react'
import { X, Lock, Fan, Zap, MapPin, Crown } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { getAllArtifacts, getPlayerArtifacts } from './artifacts'
import type { Artifact, PlayerArtifact } from './artifacts'
import PageOnboarding from '../onboarding/PageOnboarding'

// ── Tier config ───────────────────────────────────────────────
const TIER_META: Record<string, { color: string; glow: string; label: string; bg: string }> = {
  common: {
    label: 'Common',
    color: '#888899',
    glow:  'rgba(136,136,153,0.18)',
    bg:    'rgba(136,136,153,0.06)',
  },
  rare: {
    label: 'Rare',
    color: '#4f8ef7',
    glow:  'rgba(79,142,247,0.22)',
    bg:    'rgba(79,142,247,0.07)',
  },
  epic: {
    label: 'Epic',
    color: '#9b6dff',
    glow:  'rgba(155,109,255,0.25)',
    bg:    'rgba(155,109,255,0.08)',
  },
  mythic: {
    label: 'Mythic',
    color: '#f5c542',
    glow:  'rgba(245,197,66,0.28)',
    bg:    'rgba(245,197,66,0.07)',
  },
}

const LOCATION_ORDER = ['Greenfields', 'Crystal Lake', 'Under World', 'The Void']

// Group artifacts by location
function groupByLocation(artifacts: Artifact[]): Record<string, Artifact[]> {
  const groups: Record<string, Artifact[]> = {}
  for (const a of artifacts) {
    if (!groups[a.location]) groups[a.location] = []
    groups[a.location].push(a)
  }
  return groups
}

// ── Modal ─────────────────────────────────────────────────────
function ArtifactModal({
  artifact,
  isUnlocked,
  isPro,
  onClose,
}: {
  artifact: Artifact
  isUnlocked: boolean
  isPro: boolean
  onClose: () => void
}) {
  const tier = TIER_META[artifact.tier] ?? TIER_META.common
  const isProGated = artifact.requires_pro && !isUnlocked && !isPro
  const isClaimable = artifact.requires_pro && !isUnlocked && isPro

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'linear-gradient(160deg, #1a1a1f, #111113)',
          border: `1.5px solid ${isUnlocked ? tier.color + '55' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 28,
          boxShadow: isUnlocked
            ? `0 0 60px ${tier.glow}, 0 24px 60px rgba(0,0,0,0.7)`
            : '0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'modalUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Image / Video box */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: isUnlocked ? tier.bg : 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Inner box */}
          <div
            style={{
              width: '75%', height: '75%',
              borderRadius: 20,
              border: `1.5px solid ${isUnlocked ? tier.color + '44' : 'rgba(255,255,255,0.06)'}`,
              background: isUnlocked ? tier.bg : 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: isUnlocked ? `0 0 30px ${tier.glow}` : 'none',
            }}
          >
            {!isUnlocked ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Blurred media teaser */}
                {artifact.media_type === 'video' ? (
                  <video
                    src={artifact.media_url}
                    autoPlay loop muted playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18, filter: 'grayscale(1)', opacity: 0.4 }}
                  />
                ) : (
                  <img
                    src={artifact.media_url}
                    alt={artifact.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18, filter: 'grayscale(1)', opacity: 0.4 }}
                  />
                )}
                {/* Lock overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isClaimable ? <Crown size={40} style={{ color: '#f5c542' }} /> : <Lock size={40} style={{ color: 'rgba(255,255,255,0.75)' }} />}
                  <div style={{ fontSize: 11, color: isClaimable ? '#f5c542' : 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>
                    {isClaimable ? 'CLAIMABLE' : isProGated ? 'PRO REQUIRED' : 'LOCKED'}
                  </div>
                </div>
              </div>
            ) : artifact.media_type === 'video' ? (
              <video
                src={artifact.media_url}
                autoPlay loop muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }}
              />
            ) : (
              <img
                src={artifact.media_url}
                alt={artifact.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }}
              />
            )}
          </div>

          {/* Tier badge */}
          <div
            style={{
              position: 'absolute', top: 14, left: 14,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 20,
              background: `${tier.color}22`,
              border: `1px solid ${tier.color}44`,
              fontSize: 10, fontWeight: 800,
              color: tier.color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <Fan size={10} />
            {tier.label}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border-strong)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 20, fontWeight: 800,
                color: isUnlocked ? 'var(--text)' : 'var(--text-dim)',
                marginBottom: 6,
              }}
            >
              {artifact.name}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <MapPin size={12} style={{ color: tier.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                {artifact.location}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={12} style={{ color: '#f5c542', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#f5c542', fontWeight: 700 }}>
                +{artifact.reward_xp.toLocaleString()} XP reward
              </span>
            </div>
          </div>

          {/* Pro gated notice */}
          {isProGated && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(245,197,66,0.07)',
                border: '1px solid rgba(245,197,66,0.2)',
                marginBottom: 14,
              }}
            >
              <Crown size={14} style={{ color: '#f5c542', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f5c542', marginBottom: 1 }}>
                  Pro Required
                </div>
                <div style={{ fontSize: 10, color: 'rgba(245,197,66,0.6)', lineHeight: 1.4 }}>
                  Available in Exploration — upgrade to Pro to claim this artifact.
                </div>
              </div>
            </div>
          )}

          {/* Claimable notice — Pro user, just needs to explore for it */}
          {isClaimable && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(245,197,66,0.1)',
                border: '1px solid rgba(245,197,66,0.3)',
                marginBottom: 14,
              }}
            >
              <Crown size={14} style={{ color: '#f5c542', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f5c542', marginBottom: 1 }}>
                  Claimable with your Pro plan
                </div>
                <div style={{ fontSize: 10, color: 'rgba(245,197,66,0.75)', lineHeight: 1.4 }}>
                  Head to Exploration and finish the related action to collect it.
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          {isUnlocked ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 14,
                background: `${tier.color}15`,
                border: `1px solid ${tier.color}33`,
              }}
            >
              <Fan size={15} style={{ color: tier.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>
                Artifact Collected
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
              }}
            >
              <Lock size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                Find this in Exploration to collect
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Artifact Card ─────────────────────────────────────────────
function ArtifactCard({
  artifact,
  isUnlocked,
  isPro,
  onClick,
}: {
  artifact: Artifact
  isUnlocked: boolean
  isPro: boolean
  onClick: () => void
}) {
  const tier = TIER_META[artifact.tier] ?? TIER_META.common
  const isClaimable = artifact.requires_pro && !isUnlocked && isPro

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%', aspectRatio: '1 / 1',
        borderRadius: 18,
        border: isUnlocked
          ? `1.5px solid ${tier.color}44`
          : isClaimable
          ? '1.5px solid rgba(245,197,66,0.4)'
          : '1.5px solid rgba(255,255,255,0.05)',
        background: isUnlocked ? tier.bg : isClaimable ? 'rgba(245,197,66,0.06)' : 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 0,
        boxShadow: isUnlocked
          ? `0 4px 20px ${tier.glow}, 4px 4px 12px var(--neu-dark)`
          : isClaimable
          ? '0 4px 16px rgba(245,197,66,0.15), 4px 4px 12px var(--neu-dark)'
          : '4px 4px 12px var(--neu-dark), -2px -2px 6px var(--neu-light)',
        transition: 'transform 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Media or lock */}
      {isUnlocked ? (
        artifact.media_type === 'video' ? (
          <video
            src={artifact.media_url}
            muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <img
            src={artifact.media_url}
            alt={artifact.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
      ) : (
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6,
          }}
        >
          {isClaimable
            ? <Crown size={22} style={{ color: 'rgba(245,197,66,0.65)' }} />
            : <Lock size={22} style={{ color: 'rgba(255,255,255,0.12)' }} />}
        </div>
      )}

      {/* Overlay tint for locked */}
      {!isUnlocked && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: isClaimable ? 'rgba(245,197,66,0.08)' : 'rgba(10,10,14,0.45)',
            borderRadius: 16,
          }}
        />
      )}

      {/* Tier dot */}
      <div
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: isUnlocked ? tier.color : 'rgba(255,255,255,0.12)',
          boxShadow: isUnlocked ? `0 0 8px ${tier.color}` : 'none',
        }}
      />

      {/* Name label */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '20px 8px 8px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
          borderRadius: '0 0 16px 16px',
        }}
      >
        <div
          style={{
            fontSize: 11, fontWeight: 700,
            color: isUnlocked ? '#fff' : isClaimable ? 'rgba(245,197,66,0.75)' : 'rgba(255,255,255,0.3)',
            textAlign: 'center',
            lineHeight: 1.2,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {artifact.name}
        </div>
      </div>

      {/* Glow pulse for unlocked */}
      {isUnlocked && (
        <div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: 16,
            boxShadow: `inset 0 0 20px ${tier.glow}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function Artifacts() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { profile } = useProfile()
  const isPro = isProActive(profile)

  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [playerArtifacts, setPlayerArtifacts] = useState<PlayerArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Artifact | null>(null)

  useEffect(() => {
    if (!userId) return
    Promise.all([getAllArtifacts(), getPlayerArtifacts(userId)]).then(([arts, player]) => {
      setArtifacts(arts)
      setPlayerArtifacts(player)
      setLoading(false)
    })
  }, [userId])

  // Live unlock updates via realtime
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`artifacts:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'player_artifacts',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newArt = payload.new as PlayerArtifact
        setPlayerArtifacts(prev => [...prev, newArt])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  const unlockedSet = new Set(playerArtifacts.map(p => p.artifact_id))
  const groups = groupByLocation(artifacts)
  const totalCount = artifacts.length
  const unlockedCount = playerArtifacts.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      <PageOnboarding pageKey="artifacts" />

      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(155,109,255,0.35)',
            }}
          >
            <Fan size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Artifacts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {unlockedCount} / {totalCount} collected
            </div>
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            height: 4, borderRadius: 4,
            background: 'var(--surface2)',
            overflow: 'hidden',
            marginBottom: 6,
            boxShadow: 'var(--elev-inset)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${totalCount ? (unlockedCount / totalCount) * 100 : 0}%`,
              background: 'linear-gradient(90deg,#9b6dff,#4f8ef7)',
              borderRadius: 4,
              transition: 'width 1s ease',
              boxShadow: '0 0 8px rgba(155,109,255,0.5)',
            }}
          />
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14, marginBottom: 4 }}>
          {[
            { label: 'Collected', value: unlockedCount, color: '#9b6dff' },
            { label: 'Remaining', value: totalCount - unlockedCount, color: '#4f8ef7' },
            { label: 'Locations', value: LOCATION_ORDER.length, color: '#3ecf8e' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                background: 'var(--surface)',
                borderRadius: 14, padding: '11px 10px',
                textAlign: 'center',
                boxShadow: 'var(--elev-raise)',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <span
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid var(--surface3)',
              borderTopColor: '#9b6dff',
              display: 'block',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : (
        LOCATION_ORDER.map(location => {
          const arts = groups[location]
          if (!arts?.length) return null

          const locTier = TIER_META[arts[0].tier] ?? TIER_META.common
          const locUnlocked = arts.filter(a => unlockedSet.has(a.id)).length

          return (
            <div key={location} style={{ padding: '20px 18px 0' }}>
              {/* Location header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 6, height: 24, borderRadius: 3,
                      background: locTier.color,
                      boxShadow: `0 0 10px ${locTier.color}`,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                      {location}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 9, fontWeight: 800,
                          color: locTier.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          background: `${locTier.color}18`,
                          padding: '2px 7px',
                          borderRadius: 6,
                          border: `1px solid ${locTier.color}33`,
                        }}
                      >
                        {locTier.label}
                      </span>
                      {arts[0].requires_pro && (
                        <span
                          style={{
                            fontSize: 9, fontWeight: 800,
                            color: '#f5c542',
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            background: 'rgba(245,197,66,0.12)',
                            padding: '2px 7px',
                            borderRadius: 6,
                            border: '1px solid rgba(245,197,66,0.25)',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}
                        >
                          <Crown size={8} /> {isPro ? 'Claimable' : 'Pro'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {locUnlocked}/{arts.length}
                </span>
              </div>

              {/* Cards grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                {arts.map(art => (
                  <ArtifactCard
                    key={art.id}
                    artifact={art}
                    isUnlocked={unlockedSet.has(art.id)}
                    isPro={isPro}
                    onClick={() => setSelected(art)}
                  />
                ))}
              </div>

              {/* Pro note for Under World */}
              {arts[0].requires_pro && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 12,
                    background: isPro ? 'rgba(245,197,66,0.08)' : 'rgba(245,197,66,0.05)',
                    border: isPro ? '1px solid rgba(245,197,66,0.25)' : '1px solid rgba(245,197,66,0.15)',
                    marginTop: 10,
                  }}
                >
                  <Crown size={13} style={{ color: '#f5c542', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: isPro ? 'rgba(245,197,66,0.85)' : 'rgba(245,197,66,0.7)', lineHeight: 1.4 }}>
                    {isPro
                      ? 'Unlocked with your Pro plan — head into Exploration to claim these artifacts.'
                      : 'Open in Exploration — Pro membership required to claim these artifacts.'}
                  </span>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Modal */}
      {selected && (
        <ArtifactModal
          artifact={selected}
          isUnlocked={unlockedSet.has(selected.id)}
          isPro={isPro}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  )
}
