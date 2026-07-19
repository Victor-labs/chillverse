// src/pages/BuyDiamonds.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useWallet } from './useWallet'
import { checkAndAwardAutoBadges } from '../badges/badges'

// ─── Types ────────────────────────────────────────────────────
declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

type ModalKind = 'success' | 'cancelled' | 'error'

// ─── Constants ───────────────────────────────────────────────
const MODAL_IMG =
  'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Onboarding/e0cda9106501f1ad6c3c37ff5c1cbe98.jpg'

interface Pack {
  id: string
  emoji: string
  label: string
  badge?: string
  priceCents: number          // Paystack kobo (naira × 100)
  priceDisplay: string        // "₦1,500"
  diamonds: number
  accentColor: string
  borderColor: string
  badgeBg: string
  image: string
}

const PACKS: Pack[] = [
  {
    id: 'starter',
    emoji: '🌱',
    label: 'Starter',
    priceCents: 100000,
    priceDisplay: '₦1,000',
    diamonds: 100,
    accentColor: '#3ecf8e',
    borderColor: 'rgba(62,207,142,0.25)',
    badgeBg: 'rgba(62,207,142,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_0000000006b471f4ac931b4afa86d286.png',
  },
  {
    id: 'popular',
    emoji: '⭐',
    label: 'Popular',
    badge: 'POPULAR',
    priceCents: 300000,
    priceDisplay: '₦3,000',
    diamonds: 310,
    accentColor: 'var(--accent)',
    borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
    badgeBg: 'color-mix(in srgb, var(--accent) 15%, transparent)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_00000000710071f4807acc7a14ca9b74.png',
  },
  {
    id: 'best_value',
    emoji: '💎',
    label: 'Best Value',
    badge: 'BEST VALUE',
    priceCents: 480000,
    priceDisplay: '₦4,800',
    diamonds: 520,
    accentColor: '#9b6dff',
    borderColor: 'rgba(155,109,255,0.3)',
    badgeBg: 'rgba(155,109,255,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_0000000054c07243b4c896fb762a7a29.png',
  },
  {
    id: 'mega',
    emoji: '🚀',
    label: 'Mega',
    priceCents: 860000,
    priceDisplay: '₦8,600',
    diamonds: 1040,
    accentColor: '#f5c542',
    borderColor: 'rgba(245,197,66,0.25)',
    badgeBg: 'rgba(245,197,66,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_0000000090c0724393707e2243921377.png',
  },
  {
    id: 'ultimate',
    emoji: '👑',
    label: 'Ultimate',
    badge: 'ULTIMATE',
    priceCents: 1500000,
    priceDisplay: '₦15,000',
    diamonds: 2180,
    accentColor: '#e040fb',
    borderColor: 'rgba(224,64,251,0.3)',
    badgeBg: 'rgba(224,64,251,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_000000009fd071f4838edf08c8b4f12b.png',
  },
]

interface FlashPack {
  id: string
  diamonds: number
  priceCents: number
  priceDisplay: string
  originalPriceCents: number
  originalPriceDisplay: string
}

const FLASH_PACKS: FlashPack[] = [
  { id: 'flash1', diamonds: 250,  priceCents:  80000, priceDisplay: '₦800',   originalPriceCents: 130000, originalPriceDisplay: '₦1,300' },
  { id: 'flash2', diamonds: 450,  priceCents: 150000, priceDisplay: '₦1,500', originalPriceCents: 220000, originalPriceDisplay: '₦2,200' },
  { id: 'flash3', diamonds: 650,  priceCents: 250000, priceDisplay: '₦2,500', originalPriceCents: 340000, originalPriceDisplay: '₦3,400' },
  { id: 'flash4', diamonds: 800,  priceCents: 300000, priceDisplay: '₦3,000', originalPriceCents: 420000, originalPriceDisplay: '₦4,200' },
]

// ─── Pack Card ────────────────────────────────────────────────
function PackCard({
  pack,
  isFirstPurchase,
  onBuy,
  loading,
}: {
  pack: Pack & { image: string }
  isFirstPurchase: boolean
  onBuy: (pack: Pack & { image: string }) => void
  loading: boolean
}) {
  const bonus = isFirstPurchase ? pack.diamonds : 0
  const total = pack.diamonds + bonus

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${pack.borderColor}`,
        borderRadius: 18,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `4px 4px 12px var(--neu-dark),-2px -2px 8px var(--neu-light), 0 0 0 0 ${pack.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Subtle glow behind */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 70% 0%,${pack.borderColor.replace('0.3', '0.08').replace('0.25', '0.06')},transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Badge */}
      {pack.badge && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: pack.badgeBg,
            color: pack.accentColor,
            fontSize: 9,
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: 8,
            letterSpacing: '0.6px',
            border: `1px solid ${pack.borderColor}`,
          }}
        >
          {pack.badge}
        </div>
      )}

      {/* Image */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--surface2)',
          flexShrink: 0,
        }}
      >
        <img
          src={(pack as unknown as { image: string }).image}
          alt={pack.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>

      {/* Label */}
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
        {pack.emoji} {pack.label}
      </div>

      {/* Diamonds */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          {isFirstPurchase ? (
            <span>
              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontWeight: 600 }}>
                {pack.diamonds.toLocaleString()}
              </span>{' '}
              <span style={{ color: pack.accentColor }}>{total.toLocaleString()} 💎</span>
            </span>
          ) : (
            <span>{pack.diamonds.toLocaleString()} 💎</span>
          )}
        </div>
        {isFirstPurchase && (
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: pack.accentColor,
              background: pack.badgeBg,
              borderRadius: 7,
              padding: '2px 7px',
              display: 'inline-block',
              width: 'fit-content',
            }}
          >
            +{pack.diamonds.toLocaleString()} first purchase bonus!
          </div>
        )}
      </div>

      {/* Buy button */}
      <button
        onClick={(e) => {
          ripple(e)
          onBuy(pack as unknown as Pack & { image: string })
        }}
        disabled={loading}
        className="ripple-wrap"
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 13,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading
            ? 'var(--surface3)'
            : `linear-gradient(135deg,${pack.accentColor},${pack.accentColor}cc)`,
          color: loading ? 'var(--text-muted)' : '#fff',
          fontSize: 14,
          fontWeight: 800,
          fontFamily: 'inherit',
          boxShadow: loading ? 'none' : `0 4px 16px ${pack.borderColor}`,
          transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
          marginTop: 2,
        }}
      >
        {pack.priceDisplay}
      </button>
    </div>
  )
}

// ─── Modal (Gift.tsx SendModal big-box pattern) ───────────────

function PurchaseModal({
  kind,
  pack,
  onClose,
  onRetry,
}: {
  kind: ModalKind
  pack: (Pack & { image: string }) | null
  onClose: () => void
  onRetry?: () => void
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--surface2)',
          borderRadius: 24,
          border: '1px solid var(--border)',
          boxShadow: 'var(--elev-popover)',
          overflow: 'visible',
          position: 'relative',
          animation: 'popIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <X size={13} />
        </button>

        {/* Big box — blurred bg + cutout */}
        <div
          style={{
            position: 'relative',
            height: 200,
            borderRadius: '24px 24px 0 0',
            overflow: 'visible',
            background:
              kind === 'success'
                ? 'linear-gradient(160deg,rgba(62,207,142,0.12),rgba(79,142,247,0.08))'
                : 'linear-gradient(160deg,color-mix(in srgb, var(--accent) 12%, transparent),rgba(245,197,66,0.08))',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* blurred bg */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '24px 24px 0 0',
              overflow: 'hidden',
            }}
          >
            <img
              src={MODAL_IMG}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.18,
                filter: 'blur(4px)',
                transform: 'scale(1.1)',
              }}
            />
          </div>
          {/* character cutout overflowing box */}
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 160,
              height: 220,
              zIndex: 5,
            }}
          >
            <img
              src={MODAL_IMG}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
                borderRadius: 16,
                boxShadow: 'var(--elev-popover)',
                filter:
                  kind === 'success'
                    ? 'drop-shadow(0 8px 24px rgba(62,207,142,0.3))'
                    : 'drop-shadow(0 8px 24px color-mix(in srgb, var(--accent) 30%, transparent))',
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>
            {kind === 'success' ? '🎉' : kind === 'error' ? '⚠️' : '😔'}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            {kind === 'success' ? 'Thank you for your purchase' : kind === 'error' ? 'Payment received, crediting failed' : 'Payment cancelled'}
          </div>
          {kind === 'success' && pack && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              💎 Diamonds have been added to your wallet.
            </div>
          )}
          {kind === 'error' && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Your payment went through but we couldn't credit your diamonds automatically. Please contact support — your purchase is recorded and will be resolved.
            </div>
          )}
          {kind === 'cancelled' && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-dim)',
                marginBottom: 20,
              }}
            >
              No charge was made. You can try again anytime.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kind === 'cancelled' && onRetry && (
              <button
                onClick={(e) => {
                  ripple(e)
                  onRetry()
                }}
                className="ripple-wrap"
                style={{
                  width: '100%',
                  padding: 13,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent)',
                }}
              >
                Try Again
              </button>
            )}
            <button
              onClick={(e) => {
                ripple(e)
                onClose()
              }}
              className="ripple-wrap"
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 14,
                border: '1px solid var(--border-strong)',
                cursor: 'pointer',
                background: 'var(--surface)',
                color: 'var(--text-dim)',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
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

// ─── Main Page ────────────────────────────────────────────────
export default function BuyDiamonds() {
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { wallet } = useWallet()

  const [isFirstPurchase, setIsFirstPurchase] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [activePack, setActivePack] = useState<(Pack & { image: string }) | null>(null)
  const paystackScriptLoaded = useRef(false)

  // Load Paystack inline script once
  useEffect(() => {
    if (paystackScriptLoaded.current || document.querySelector('script[src*="paystack"]')) {
      paystackScriptLoaded.current = true
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    script.onload = () => { paystackScriptLoaded.current = true }
    document.head.appendChild(script)
  }, [])

  // Check first_purchase_claimed
  useEffect(() => {
    if (!user) return
    supabase
      .from('user_wallets')
      .select('first_purchase_claimed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsFirstPurchase(!data.first_purchase_claimed)
      })
  }, [user])

  function openPaystack(pack: Pack & { image: string }) {
    if (!session?.user?.email || !user) return
    if (!window.PaystackPop) {
      alert('Payment system loading, please try again in a second.')
      return
    }

    const ref = `cv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string,
      email: session.user.email,
      amount: pack.priceCents,
      currency: 'NGN',
      ref,
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        diamonds: pack.diamonds,
        is_first_purchase: isFirstPurchase,
      },
      callback: function (response: { reference: string }) {
        // Paystack's inline.js (v1) rejects async functions for `callback`
        // (its validator checks the function's shape, and async functions
        // don't pass). Keep this wrapper synchronous and run the actual
        // async work in an inner IIFE.
        setLoading(true)
        ;(async () => {
          try {
            const { error } = await supabase.functions.invoke('credit-diamonds', {
              body: {
                reference: response.reference,
                user_id: user.id,
              },
            })
            if (error) throw error
            setActivePack(pack)
            checkAndAwardAutoBadges(user.id)
            setModal('success')
          } catch (err) {
            console.error('credit-diamonds error:', err)
            // Payment confirmed by Paystack but crediting failed.
            // Show error so user knows to contact support — do NOT silently
            // show success, as that leaves them with missing diamonds.
            setActivePack(pack)
            setModal('error')
          } finally {
            setLoading(false)
          }
        })()
      },
      onClose: () => {
        setActivePack(pack)
        setModal('cancelled')
      },
    })

    handler.openIframe()
  }

  function handleBuy(pack: Pack & { image: string }) {
    setActivePack(pack)
    openPaystack(pack)
  }

  function handleRetry() {
    setModal(null)
    if (activePack) {
      setTimeout(() => openPaystack(activePack), 100)
    }
  }

  return (
    <>
      <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 48 }}>
        {/* Topbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/mall')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--elev-raise-sm)',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--text)',
              flex: 1,
            }}
          >
            Buy Diamonds
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 12px',
              boxShadow: 'var(--elev-raise-sm)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              💎 {(wallet?.gem_balance ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Hero / first purchase banner */}
        {isFirstPurchase && (
          <div
            className="neu-card"
            style={{
              padding: '16px 18px',
              marginBottom: 20,
              background:
                'linear-gradient(135deg,rgba(62,207,142,0.08),rgba(79,142,247,0.06))',
              border: '1px solid rgba(62,207,142,0.2)',
              borderRadius: 16,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: -16,
                top: -16,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle,rgba(62,207,142,0.15),transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎁</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--text)',
                marginBottom: 3,
              }}
            >
              First Purchase Bonus — Double Diamonds!
            </div>
            <div
              style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}
            >
              Your very first pack gets 2× the diamonds automatically. No code
              needed.
            </div>
          </div>
        )}

        {/* Pack grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          {(PACKS as unknown as (Pack & { image: string })[]).map((pack, i) => (
            <div
              key={pack.id}
              style={{
                animation: 'feedIn 0.35s ease-out both',
                animationDelay: `${i * 0.07}s`,
              }}
            >
              <PackCard
                pack={pack}
                isFirstPurchase={isFirstPurchase}
                onBuy={handleBuy}
                loading={loading}
              />
            </div>
          ))}
        </div>

        {/* ── Flash Sales ───────────────────────────────────── */}
        <div style={{ marginTop: 36 }}>
          {/* Header */}
          <div style={{ marginBottom: 14, textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-block',
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: 22,
                fontWeight: 700,
                fontStyle: 'italic',
                letterSpacing: '0.5px',
                background: 'linear-gradient(135deg, var(--accent), #f5c542)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ⚡ Flash Sales
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Limited-time deals — grab them while they last
            </div>
          </div>

          {/* Flash pack rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FLASH_PACKS.map((fp, i) => (
              <div
                key={fp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--surface)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  gap: 12,
                  animation: 'feedIn 0.35s ease-out both',
                  animationDelay: `${i * 0.06}s`,
                  boxShadow: '0 0 0 0 transparent',
                }}
              >
                {/* Left — diamond amount */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    ⚡
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                      {fp.diamonds.toLocaleString()} 💎
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      <span style={{ textDecoration: 'line-through' }}>{fp.originalPriceDisplay}</span>
                    </div>
                  </div>
                </div>

                {/* Right — price button */}
                <button
                  onClick={(e) => {
                    ripple(e)
                    if (!session?.user?.email || !user || !window.PaystackPop) return
                    const ref = `cv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                    window.PaystackPop.setup({
                      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string,
                      email: session.user.email,
                      amount: fp.priceCents,
                      currency: 'NGN',
                      ref,
                      metadata: { user_id: user.id, pack_id: fp.id, diamonds: fp.diamonds, is_first_purchase: false },
                      callback: function (response: { reference: string }) {
                        setLoading(true);
                        (async () => {
                          try {
                            const { error } = await supabase.functions.invoke('credit-diamonds', {
                              body: { reference: response.reference, user_id: user.id },
                            })
                            if (error) throw error
                            checkAndAwardAutoBadges(user.id)
                            setModal('success')
                          } catch (err) {
                            console.error('flash credit error:', err)
                            setModal('error')
                          } finally {
                            setLoading(false)
                          }
                        })()
                      },
                      onClose: () => setModal('cancelled'),
                    }).openIframe()
                  }}
                  disabled={loading}
                  className="ripple-wrap"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 11,
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'var(--surface3)' : 'linear-gradient(135deg,var(--accent),#f5c542)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    boxShadow: loading ? 'none' : '0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)',
                    transition: 'background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
                  }}
                >
                  {fp.priceDisplay}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          Payments are processed securely by Paystack. Diamonds are non-refundable.
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <PurchaseModal
          kind={modal}
          pack={activePack}
          onClose={() => {
            setModal(null)
            if (modal === 'success') navigate('/wallet')
          }}
          onRetry={modal === 'cancelled' || modal === 'error' ? handleRetry : undefined}
        />
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{opacity:0;transform:scale(0.82) translateY(30px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes feedIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  )
}
