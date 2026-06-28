// src/pages/BuyDiamonds.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gem, X } from 'lucide-react'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useWallet } from '../hooks/useWallet'

// ─── Types ────────────────────────────────────────────────────
declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

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
}

const PACKS: Pack[] = [
  {
    id: 'starter',
    emoji: '🌱',
    label: 'Starter',
    priceCents: 150000,
    priceDisplay: '₦1,500',
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
    priceCents: 750000,
    priceDisplay: '₦7,500',
    diamonds: 600,
    accentColor: '#ff6b00',
    borderColor: 'rgba(255,107,0,0.3)',
    badgeBg: 'rgba(255,107,0,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_00000000710071f4807acc7a14ca9b74.png',
  },
  {
    id: 'best_value',
    emoji: '💎',
    label: 'Best Value',
    badge: 'BEST VALUE',
    priceCents: 1500000,
    priceDisplay: '₦15,000',
    diamonds: 1300,
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
    priceCents: 3000000,
    priceDisplay: '₦30,000',
    diamonds: 2800,
    accentColor: '#f5c542',
    borderColor: 'rgba(245,197,66,0.25)',
    badgeBg: 'rgba(245,197,66,0.15)',
    image:
      'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Diamond%20purchase/file_0000000090c0724393707e2243921377.png',
  },
] as unknown as Pack[]

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
          <Gem size={13} color="#4f8ef7" />
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
          ripple(e as Parameters<typeof ripple>[0])
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
          transition: 'all 0.2s',
          marginTop: 2,
        }}
      >
        {pack.priceDisplay}
      </button>
    </div>
  )
}

// ─── Modal (Gift.tsx SendModal big-box pattern) ───────────────
type ModalKind = 'success' | 'cancelled'

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
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
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
                : 'linear-gradient(160deg,rgba(255,107,0,0.12),rgba(245,197,66,0.08))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                filter:
                  kind === 'success'
                    ? 'drop-shadow(0 8px 24px rgba(62,207,142,0.3))'
                    : 'drop-shadow(0 8px 24px rgba(255,107,0,0.3))',
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>
            {kind === 'success' ? '🎉' : '😔'}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            {kind === 'success' ? 'Thank you for your purchase' : 'Payment cancelled'}
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
              <Gem
                size={13}
                color="#4f8ef7"
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
              />
              Diamonds have been added to your wallet.
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
                  ripple(e as Parameters<typeof ripple>[0])
                  onRetry()
                }}
                className="ripple-wrap"
                style={{
                  width: '100%',
                  padding: 13,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,var(--accent),#ff9a3c)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 20px rgba(255,107,0,0.35)',
                }}
              >
                Try Again
              </button>
            )}
            <button
              onClick={(e) => {
                ripple(e as Parameters<typeof ripple>[0])
                onClose()
              }}
              className="ripple-wrap"
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
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
                diamonds: pack.diamonds,
                is_first_purchase: isFirstPurchase,
              },
            })
            if (error) throw error
            setActivePack(pack)
            setModal('success')
          } catch (err) {
            console.error('credit-diamonds error:', err)
            // Still show success since Paystack confirmed payment;
            // webhook will credit as fallback.
            setActivePack(pack)
            setModal('success')
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
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '2px 2px 6px var(--neu-dark)',
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
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '6px 12px',
              boxShadow: '2px 2px 6px var(--neu-dark)',
            }}
          >
            <Gem size={13} color="#4f8ef7" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {(wallet?.gem_balance ?? 0).toLocaleString()} 💎
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
          onRetry={modal === 'cancelled' ? handleRetry : undefined}
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
