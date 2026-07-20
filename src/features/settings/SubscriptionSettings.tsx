// src/features/settings/SubscriptionSettings.tsx — Settings › Manage Orbit/Void
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, X, AlertTriangle } from 'lucide-react'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'
import { supabase } from '../../shared/lib/supabase'
import { SettingsShell, InfoLine } from './settingsShared'

export default function SubscriptionSettings() {
  const navigate = useNavigate()
  const { profile, refetch } = useProfile()
  const isPro = isProActive(profile)

  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tierLabel = profile?.pro_tier === 'void' ? 'Void' : 'Orbit'
  const expiryLabel = profile?.pro_expires_at
    ? new Date(profile.pro_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  async function handleCancel() {
    setCancelling(true)
    setError('')
    try {
      const { data, error: err } = await supabase.functions.invoke('cancel-premium')
      if (err) {
        const ctx = (err as { context?: { json?: () => Promise<{ error?: string }> } }).context
        const body = await ctx?.json?.().catch(() => null)
        setError(body?.error || 'Failed to cancel your subscription. Please try again.')
        setCancelling(false)
        return
      }
      if (data?.error) { setError(data.error); setCancelling(false); return }
      setCancelling(false)
      setDone(true)
      refetch()
    } catch {
      setError('Failed to cancel your subscription. Please try again.')
      setCancelling(false)
    }
  }

  if (!isPro) {
    // Direct visits without an active plan land on the upgrade page.
    navigate('/pro', { replace: true })
    return null
  }

  return (
    <SettingsShell title={`Manage ${tierLabel}`}>
      <div style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 20, padding: '22px 18px', marginBottom: 20, boxShadow: 'var(--elev-raise), 0 0 24px -10px var(--glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Crown size={19} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{tierLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              {profile?.pro_billing_interval === 'yearly' ? 'Yearly plan' : 'Monthly plan'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          {profile?.pro_cancel_at_period_end
            ? <>Cancelled — your perks stay active until <strong style={{ color: 'var(--text)' }}>{expiryLabel ?? 'your plan expires'}</strong>, then your plan won't renew.</>
            : <>Renews {expiryLabel ? <>on <strong style={{ color: 'var(--text)' }}>{expiryLabel}</strong></> : 'automatically'}.</>}
        </div>
      </div>

      {!profile?.pro_cancel_at_period_end && (
        <>
          <button onClick={() => setShowCancel(true)} className="btn-secondary" style={{ width: '100%', padding: '12px 0', fontSize: 13, color: 'var(--red)' }}>
            Cancel subscription
          </button>
          <InfoLine>You'll keep your perks until the end of the billing period. No further charges after cancelling.</InfoLine>
        </>
      )}

      {showCancel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--overlay-scrim)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--popover)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {done ? 'Subscription cancelled' : 'Cancel subscription?'}
              </span>
              <button onClick={() => { if (!cancelling) setShowCancel(false) }} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                <X size={13} />
              </button>
            </div>
            {done ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
                  You won't be charged again. You'll keep your {tierLabel} perks until {expiryLabel ?? 'your plan expires'}.
                </p>
                <button onClick={() => setShowCancel(false)} className="btn-primary" style={{ width: '100%', padding: '10px 0', fontSize: 13 }}>Done</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14, padding: '12px 14px', background: 'rgba(255,79,79,0.08)', borderRadius: 12, border: '1px solid rgba(255,79,79,0.2)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    You'll keep your {tierLabel} perks until {expiryLabel ?? 'your plan expires'}, then it won't renew and you won't be charged again.
                  </p>
                </div>
                {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowCancel(false)} disabled={cancelling} className="btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>
                    Keep subscription
                  </button>
                  <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: cancelling ? 0.6 : 1 }}>
                    {cancelling ? 'Cancelling…' : 'Cancel it'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SettingsShell>
  )
}
