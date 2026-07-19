// src/features/economy/Pro.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Crown, Check, X, Zap, Orbit as OrbitIcon, Sparkles } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../profile/useProfile'
import { TIERS, PLAN_CODES, getYearlySavingsPct, type ProTier, type BillingInterval } from '../../shared/lib/proPlans'
import { checkAndAwardAutoBadges } from '../badges/badges'

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

type ModalKind = 'success' | 'cancelled' | 'error' | null

function tierIcon(tier: string, size: number, color: string) {
  if (tier === 'orbit') return <OrbitIcon size={size} color={color} />
  if (tier === 'void') return <Sparkles size={size} color={color} />
  return <Crown size={size} color={color} />
}

export default function Pro() {
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { profile, refetch } = useProfile()

  const [interval, setIntervalVal] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState<ProTier | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [modalTier, setModalTier] = useState<ProTier | null>(null)
  const paystackScriptLoaded = useRef(false)

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

  const currentTier: 'free' | ProTier =
    profile?.is_pro && profile.pro_tier && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date())
      ? (profile.pro_tier as ProTier)
      : 'free'

  function openPaystack(tier: ProTier) {
    if (!session?.user?.email || !user) return
    if (!window.PaystackPop) {
      alert('Payment system loading, please try again in a second.')
      return
    }

    const plan = PLAN_CODES[tier][interval]
    const ref = `cvpro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string,
      email: session.user.email,
      plan: plan.planCode,
      currency: 'NGN',
      ref,
      metadata: {
        user_id: user.id,
        tier,
        interval,
        plan_code: plan.planCode,
      },
      callback: function (response: { reference: string }) {
        // Paystack inline.js v1 rejects async callbacks — keep this
        // synchronous, do the real work in an inner IIFE.
        setLoading(tier)
        ;(async () => {
          try {
            const { error } = await supabase.functions.invoke('activate-premium', {
              body: {
                reference: response.reference,
                user_id: user.id,
              },
            })
            if (error) throw error
            refetch()
            checkAndAwardAutoBadges(user.id)
            setModalTier(tier)
            setModal('success')
          } catch (err) {
            console.error('activate-premium error:', err)
            setModalTier(tier)
            setModal('error')
          } finally {
            setLoading(null)
          }
        })()
      },
      onClose: () => {
        setModalTier(tier)
        setModal('cancelled')
      },
    })

    handler.openIframe()
  }

  function handleRetry() {
    setModal(null)
    if (modalTier) setTimeout(() => openPaystack(modalTier), 100)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      <style>{`
        @keyframes cvproIn   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cvproPop  { 0%{opacity:0;transform:scale(0.92)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Back */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}>
          <ArrowLeft size={15} />
        </button>
      </div>

      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 28,
        animation: 'cvproIn 0.4s ease-out both',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
          background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 40%, transparent)',
        }}>
          <Crown size={26} color="#fff" fill="#fff" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Chillverse Premium</h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 380, margin: '0 auto' }}>
          More sessions, more games, more you. Pick a plan and go further.
        </p>
      </div>

      {/* Billing toggle */}
      <div style={{
        display: 'flex', justifyContent: 'center', marginBottom: 24,
        animation: 'cvproIn 0.4s ease-out 0.05s both',
      }}>
        <div style={{
          display: 'inline-flex', background: 'var(--surface)', borderRadius: 14, padding: 4,
          boxShadow: 'var(--elev-inset)',
        }}>
          {(['monthly', 'yearly'] as BillingInterval[]).map(iv => (
            <button
              key={iv}
              onClick={(e) => { ripple(e); setIntervalVal(iv) }}
              className="ripple-wrap"
              style={{
                padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                background: interval === iv ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'transparent',
                color: interval === iv ? '#fff' : 'var(--text-dim)',
                transition: 'background 0.2s, color 0.2s',
                position: 'relative',
              }}
            >
              {iv === 'monthly' ? 'Monthly' : 'Yearly'}
              {iv === 'yearly' && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                  background: interval === iv ? 'rgba(255,255,255,0.25)' : 'rgba(62,207,142,0.15)',
                  color: interval === iv ? '#fff' : 'var(--green)',
                }}>
                  SAVE {getYearlySavingsPct('orbit')}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {TIERS.map((t, i) => {
          const isFree = t.tier === 'free'
          const isCurrent = currentTier === t.tier
          const plan = !isFree ? PLAN_CODES[t.tier as ProTier][interval] : null
          const priceDisplay = isFree ? '₦0' : (plan?.priceDisplay ?? t.monthlyDisplay)

          return (
            <div key={t.tier} style={{
              background: isFree ? 'var(--surface)' : `linear-gradient(135deg, ${t.color}14, ${t.color}05)`,
              border: `1.5px solid ${isFree ? 'rgba(255,255,255,0.08)' : t.color + '35'}`,
              borderRadius: 22, padding: 22, position: 'relative', overflow: 'hidden',
              boxShadow: isFree ? 'none' : `0 0 32px ${t.glow}, 4px 4px 14px var(--neu-dark), -2px -2px 8px var(--neu-light)`,
              animation: `cvproIn 0.4s ease-out ${0.1 + i * 0.05}s both`,
            }}>
              {t.badge && (
                <div style={{
                  position: 'absolute', top: 0, right: 22,
                  background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                  color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                  padding: '5px 12px', borderRadius: '0 0 10px 10px',
                }}>
                  {t.badge}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: isFree ? 'rgba(255,255,255,0.06)' : `${t.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tierIcon(t.tier, 20, isFree ? 'var(--text-dim)' : t.color)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{t.name}</span>
                    {isCurrent && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', background: 'rgba(62,207,142,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                        CURRENT PLAN
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{t.tagline}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>{priceDisplay}</span>
                {!isFree && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ {interval === 'monthly' ? 'mo' : 'yr'}</span>}
              </div>
              {!isFree && interval === 'yearly' && t.yearlyEquivDisplay && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -12, marginBottom: 16 }}>{t.yearlyEquivDisplay}</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
                {t.features.map((f, fi) => (
                  <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Check size={14} color={isFree ? 'var(--text-dim)' : t.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={isFree || isCurrent || loading === t.tier}
                onClick={(e) => { if (isFree || isCurrent) return; ripple(e); openPaystack(t.tier as ProTier) }}
                className={isFree || isCurrent ? '' : 'ripple-wrap'}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                  fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                  cursor: isFree || isCurrent ? 'default' : 'pointer',
                  background: isFree || isCurrent
                    ? 'var(--surface2)'
                    : `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                  color: isFree || isCurrent ? 'var(--text-dim)' : '#fff',
                  boxShadow: isFree || isCurrent ? 'none' : `0 6px 20px ${t.color}40`,
                  opacity: loading === t.tier ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {isCurrent ? 'Your Current Plan' : isFree ? 'Included' : (
                  <>
                    <Zap size={14} fill="#fff" />
                    {loading === t.tier ? 'Processing…' : `Upgrade to ${t.name}`}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
        Subscriptions renew automatically at the end of each billing period.
        Cancel anytime from Settings. Payments are processed securely by Paystack.
      </p>

      {/* Result modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 340, background: 'var(--surface2)',
            border: '1px solid var(--border-strong)', borderRadius: 22, padding: 24,
            textAlign: 'center', position: 'relative',
            animation: 'cvproPop 0.3s cubic-bezier(0.34,1.3,0.64,1) both',
          }}>
            <button onClick={() => setModal(null)} style={{
              position: 'absolute', top: 12, right: 12,
              width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)',
              border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={13} />
            </button>

            {modal === 'success' && (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', background: 'rgba(62,207,142,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={26} color="var(--green)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>You're in!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
                  {modalTier === 'void' ? 'Void' : 'Orbit'} is active on your account. Enjoy the perks.
                </p>
                <button onClick={() => setModal(null)} style={{ width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 14, fontWeight: 800 }}>
                  Nice
                </button>
              </>
            )}

            {modal === 'cancelled' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Checkout closed</h3>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>No charge was made. You can try again anytime.</p>
                <button onClick={() => setModal(null)} style={{ width: '100%', padding: 13, borderRadius: 14, border: '1px solid var(--border-strong)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 14, fontWeight: 700 }}>
                  Close
                </button>
              </>
            )}

            {modal === 'error' && (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', background: 'rgba(255,79,79,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={26} color="var(--red)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Payment confirmed, activation failed</h3>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
                  Your card was charged but we couldn't activate your plan yet. Try again, or contact support if this persists.
                </p>
                <button onClick={handleRetry} style={{ width: '100%', padding: 13, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', color: '#fff', fontSize: 14, fontWeight: 800 }}>
                  Retry Activation
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
