// src/pages/Version.tsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Lock, CheckCircle2 } from 'lucide-react'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { useWallet } from '../economy/useWallet'
import { supabase } from '../../shared/lib/supabase'
import PageOnboarding from '../onboarding/PageOnboarding'

interface VersionInfo {
  num: string
  label: string
  tagline: string
  bullets: string[]
  image: string
  cost: number | null   // null = free / current base
  isFinal?: boolean
}

const VERSIONS: VersionInfo[] = [
  {
    num: '1.0',
    label: 'The Basic Chillverse Experience',
    tagline: 'Where it all begins.',
    bullets: ['Core chat & social features', 'Standard game sessions', 'Profile & wallet'],
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/cf1ee0b7271cc21bb51a83ef26531d60.jpg',
    cost: null,
  },
  {
    num: '2.0',
    label: 'Animations',
    tagline: 'The world comes alive.',
    bullets: ['Smooth UI animations', 'Animated transitions', 'Next-level visual polish'],
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/d69c56fd124418cdb03c1ed57511b8fc.jpg',
    cost: 1900,
  },
  {
    num: '3.0',
    label: 'More Games',
    tagline: 'Expand your playground.',
    bullets: ['New multiplayer game modes', 'Exclusive game content', 'Wider exploration maps'],
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/9f47e69b1b236904bf325fc0edf12089.jpg',
    cost: 3900,
  },
  {
    num: '4.0',
    label: 'Higher Sessions',
    tagline: 'Play longer, go further.',
    bullets: ['Session limit: 19 / 19 even without Pro', 'Extended game rounds', 'No interruptions'],
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/79ca78eb072707c7b4931ea7c472b867.jpg',
    cost: 5900,
  },
  {
    num: '5.0',
    label: 'Special Cosmetics & Badges',
    tagline: 'Wear your legacy.',
    bullets: ['Exclusive name cosmetics', 'Rare profile badges', 'Stand out everywhere'],
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/79ca78eb072707c7b4931ea7c472b867.jpg',
    cost: null,
    isFinal: true,
  },
]

// ─── PRO-GATE MODAL ──────────────────────────────────────────────────────────

function ProGateModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => { videoRef.current?.play() }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {/* Big outer box */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(160deg,#1a0f2e,#0d1a2e)',
        border: '1.5px solid rgba(155,109,255,0.35)',
        borderRadius: 28, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(155,109,255,0.1)',
        animation: 'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(155,109,255,0.8)' }}>Premium Required</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Inner video box */}
        <div style={{ margin: '14px 16px', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}>
          <video
            ref={videoRef}
            src="https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/4186b76c2eb9ddc1631a9ad20d0ec88d_720w.mp4"
            style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }}
            loop muted playsInline autoPlay
          />
        </div>

        {/* Text */}
        <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
          <p style={{
            fontSize: 14, lineHeight: 1.65,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 20,
          }}>
            Next upgrade includes <strong style={{ color: '#fff' }}>animations</strong>. But you are required to go <span style={{ color: '#9b6dff', fontWeight: 700 }}>premium</span>.
          </p>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 800, color: '#fff',
              letterSpacing: 0.3,
              boxShadow: '0 8px 24px rgba(155,109,255,0.4)',
            }}
          >
            Go Premium ✦
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── UPGRADE CONFIRM MODAL ───────────────────────────────────────────────────

function UpgradeModal({
  version,
  onClose,
  onConfirm,
  canAfford,
}: {
  version: VersionInfo
  onClose: () => void
  onConfirm: () => void
  canAfford: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <img
          src={version.image}
          alt={version.label}
          style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
        />
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: 22, fontWeight: 900,
              fontFamily: '"Playfair Display", Georgia, serif',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Version {version.num}
            </span>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              <X size={13} />
            </button>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}>{version.label}</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Upgrade to {version.label.toLowerCase()} for <strong style={{ color: '#f5c542' }}>💎 {version.cost?.toLocaleString()}</strong> diamonds. This upgrade is permanent.
          </p>
          {!canAfford && (
            <p style={{ fontSize: 11.5, color: '#ff6b6b', marginBottom: 14, background: 'rgba(255,107,107,0.08)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,0.2)' }}>
              Not enough diamonds. Visit the shop to top up!
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg)', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button
              onClick={onConfirm}
              disabled={!canAfford}
              style={{ flex: 2, padding: '11px 0', borderRadius: 11, border: 'none', background: canAfford ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,0.08)', color: canAfford ? '#fff' : 'var(--text-muted)', cursor: canAfford ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 13, opacity: canAfford ? 1 : 0.6 }}
            >
              💎 Upgrade — {version.cost?.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── VERSION CARD ────────────────────────────────────────────────────────────

function VersionCard({
  v,
  idx,
  owned,
  isNext,
  isFinal,
  onUpgrade,
  progressPct,
}: {
  v: VersionInfo
  idx: number
  owned: boolean
  isNext: boolean
  isFinal: boolean
  onUpgrade: () => void
  progressPct: number
}) {
  const isBase = idx === 0

  return (
    <div style={{
      background: 'var(--surface)',
      border: owned
        ? '1.5px solid rgba(62,207,142,0.35)'
        : isNext
        ? '1.5px solid rgba(155,109,255,0.35)'
        : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 22,
      overflow: 'hidden',
      marginBottom: 16,
      boxShadow: owned
        ? '0 4px 20px rgba(62,207,142,0.08)'
        : '3px 3px 12px var(--neu-dark), -2px -2px 8px var(--neu-light)',
      animation: 'feedIn 0.3s ease-out both',
      animationDelay: `${idx * 0.06}s`,
    }}>
      {/* Image */}
      <div style={{ position: 'relative' }}>
        <img
          src={v.image}
          alt={v.label}
          style={{
            width: '100%', height: 180, objectFit: 'cover', display: 'block',
            filter: owned ? 'none' : 'brightness(0.55) saturate(0.7)',
            transition: 'filter 0.4s',
          }}
        />
        {/* Version badge */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: owned ? 'rgba(62,207,142,0.85)' : 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '4px 12px',
          fontSize: 11, fontWeight: 800, color: '#fff',
          letterSpacing: 1, textTransform: 'uppercase',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          v{v.num}
        </div>
        {/* Owned tick */}
        {owned && (
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <CheckCircle2 size={22} color="#3ecf8e" fill="rgba(62,207,142,0.2)" />
          </div>
        )}
        {/* Lock overlay */}
        {!owned && !isBase && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={32} color="rgba(255,255,255,0.35)" />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '18px 18px 20px' }}>
        {/* Title */}
        <div style={{
          fontSize: 24, fontWeight: 900, lineHeight: 1.15, marginBottom: 4,
          fontFamily: '"Playfair Display", Georgia, serif',
          background: owned
            ? 'linear-gradient(135deg,#3ecf8e,#4f8ef7)'
            : isNext
            ? 'linear-gradient(135deg,#9b6dff,#4f8ef7)'
            : 'linear-gradient(135deg,rgba(255,255,255,0.3),rgba(255,255,255,0.15))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Version {v.num}
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: owned ? 'var(--text)' : 'var(--text-dim)', marginBottom: 4 }}>
          {v.label}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, fontStyle: 'italic' }}>
          {v.tagline}
        </p>

        {/* Bullets */}
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {v.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: owned ? '#3ecf8e' : isNext ? '#9b6dff' : 'rgba(255,255,255,0.2)',
              }} />
              <span style={{ fontSize: 12.5, color: owned ? 'var(--text)' : 'var(--text-dim)' }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Progress bar (only on first owned card that is also the last unlocked — i.e. the latest version) */}
        {owned && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Overall progress
              </span>
              {progressPct >= 100 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: '#3ecf8e', letterSpacing: 0.5 }}>
                  ✦ Best Version
                </span>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg,#9b6dff,#3ecf8e)',
                transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 10px rgba(62,207,142,0.4)',
              }} />
            </div>
          </div>
        )}

        {/* Action */}
        {isBase ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} color="#3ecf8e" />
            <span style={{ fontSize: 12.5, color: '#3ecf8e', fontWeight: 700 }}>Active — your current version</span>
          </div>
        ) : isFinal && owned ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} color="#3ecf8e" />
            <span style={{ fontSize: 12.5, color: '#3ecf8e', fontWeight: 700 }}>✦ Max version reached</span>
          </div>
        ) : isFinal ? (
          <button disabled style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700,
            cursor: 'not-allowed',
          }}>
            <Lock size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Coming Soon
          </button>
        ) : owned ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} color="#3ecf8e" />
            <span style={{ fontSize: 12.5, color: '#3ecf8e', fontWeight: 700 }}>Owned</span>
          </div>
        ) : (
          <button
            onClick={onUpgrade}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
              background: isNext
                ? 'linear-gradient(135deg,#9b6dff,#4f8ef7)'
                : 'rgba(255,255,255,0.05)',
              color: isNext ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 800, cursor: isNext ? 'pointer' : 'not-allowed',
              boxShadow: isNext ? '0 8px 24px rgba(155,109,255,0.35)' : 'none',
              transition: 'all 0.2s',
              letterSpacing: 0.3,
            }}
          >
            {isNext ? `💎 Upgrade — ${v.cost?.toLocaleString()} diamonds` : `🔒 Unlock ${v.num} first`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function Version() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { wallet, refetch: refetchWallet } = useWallet()

  // Derive isPro from the real Premium subscription fields (is_pro / pro_expires_at)
  const isPro = isProActive(profile)

  // Which versions are owned — stored in profile or a dedicated column.
  // We use a local Supabase column `version_level` (int, default 1).
  // If it doesn't exist yet we fall back to 1.
  const versionLevel: number = (profile as any)?.version_level ?? 1

  const diamonds = wallet?.gem_balance ?? 0

  const [modal, setModal] = useState<null | 'pro_gate' | 'upgrade'>(null)
  const [upgradeTarget, setUpgradeTarget] = useState<VersionInfo | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  // Progress: how far through all purchasable upgrades (v2–v4)
  const purchasableCount = VERSIONS.filter(v => v.cost !== null && !v.isFinal).length // 3
  const ownedPurchasable = Math.min(Math.max(versionLevel - 1, 0), purchasableCount)
  const progressPct = purchasableCount > 0 ? Math.round((ownedPurchasable / purchasableCount) * 100) : 0

  function handleUpgradePress(v: VersionInfo) {
    if (!isPro) { setModal('pro_gate'); return }
    setUpgradeTarget(v)
    setModal('upgrade')
  }

  async function confirmUpgrade() {
    if (!upgradeTarget || !profile?.id) return
    const cost = upgradeTarget.cost!
    if (diamonds < cost) return

    setUpgrading(true)
    try {
      // Deduct diamonds
      await supabase
        .from('user_wallets')
        .update({ gem_balance: diamonds - cost })
        .eq('user_id', profile.id)

      // Bump version level
      const nextLevel = versionLevel + 1
      await supabase
        .from('profiles')
        .update({ version_level: nextLevel } as any)
        .eq('id', profile.id)

      refetchWallet()
    } catch (err) {
      console.error('Upgrade failed', err)
    } finally {
      setUpgrading(false)
      setModal(null)
      setUpgradeTarget(null)
    }
  }

  return (
    <>
      <PageOnboarding pageKey="version" />
      <style>{`
        @keyframes popIn { from { opacity:0; transform: scale(0.9) } to { opacity:1; transform: scale(1) } }
        @keyframes feedIn { from { opacity:0; transform: translateY(16px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 60px' }}>

        {/* Back */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}
          >
            <ArrowLeft size={15} />
          </button>
        </div>

        {/* Hero header */}
        <div style={{
          marginBottom: 28, animation: 'feedIn 0.35s ease-out both',
          padding: '4px 2px',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>Chillverse</p>
          <h1 style={{
            fontSize: 34, fontWeight: 900, lineHeight: 1.1,
            fontFamily: '"Playfair Display", Georgia, serif',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2), #9b6dff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 6,
          }}>
            Version History
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Upgrade your experience, one version at a time.
          </p>
        </div>

        {/* Diamond balance pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'var(--surface)', border: '1px solid rgba(245,197,66,0.25)',
          borderRadius: 99, padding: '6px 14px', marginBottom: 24,
          boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)',
        }}>
          <span style={{ fontSize: 15 }}>💎</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f5c542' }}>{diamonds.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>diamonds</span>
        </div>

        {/* Version cards */}
        {VERSIONS.map((v, idx) => {
          const owned = idx < versionLevel || idx === 0
          const isNext = idx === versionLevel && !v.isFinal
          return (
            <VersionCard
              key={v.num}
              v={v}
              idx={idx}
              owned={owned}
              isNext={isNext}
              isFinal={!!v.isFinal}
              onUpgrade={() => handleUpgradePress(v)}
              progressPct={owned ? progressPct : 0}
            />
          )
        })}
      </div>

      {/* PRO GATE MODAL */}
      {modal === 'pro_gate' && <ProGateModal onClose={() => setModal(null)} />}

      {/* UPGRADE CONFIRM MODAL */}
      {modal === 'upgrade' && upgradeTarget && (
        <UpgradeModal
          version={upgradeTarget}
          onClose={() => { setModal(null); setUpgradeTarget(null) }}
          onConfirm={confirmUpgrade}
          canAfford={diamonds >= (upgradeTarget.cost ?? 0)}
        />
      )}

      {/* Upgrading overlay */}
      {upgrading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Upgrading…</div>
          <div style={{ width: 200, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: 'linear-gradient(90deg,#9b6dff,#3ecf8e)',
              animation: 'growBar 1.8s cubic-bezier(0.4,0,0.2,1) forwards',
            }} />
          </div>
          <style>{`
            @keyframes growBar { from { width: 0% } to { width: 100% } }
          `}</style>
        </div>
      )}
    </>
  )
}
