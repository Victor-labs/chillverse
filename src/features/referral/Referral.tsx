// src/features/referral/Referral.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Check, Users, Gem } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchReferralInfo, buildReferralLink, markReferralPageVisited } from './referral'
import { REFERRAL_MILESTONES, REFERRAL_MAX_TOTAL } from './types'
import type { ReferralInfo } from './types'

export default function ReferralPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchReferralInfo(user.id).then(data => {
      setInfo(data)
      setLoading(false)
    })
    markReferralPageVisited(user.id).catch(e => console.error('markReferralPageVisited error:', e))
  }, [user])

  async function handleShare() {
    if (!info) return
    const url = buildReferralLink(info.referralCode)
    const text = `Join me on Chillverse — we both get diamonds when you play your first game! ${url}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Chillverse', text, url })
      } catch {
        // user cancelled — no action needed
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('copy referral link error:', e)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', marginBottom: 16, paddingTop: 4 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/profile') }}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Refer & Earn</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>You and your friend both get diamonds</p>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>}

        {!loading && info && (
          <>
            {/* Code + share */}
            <div className="neu-card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Your referral code
              </p>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: 2, marginBottom: 16 }}>
                {info.referralCode}
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', borderRadius: 13, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {copied ? <Check size={15} /> : <Share2 size={15} />}
                {copied ? 'Link copied!' : 'Share invite link'}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, padding: '14px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Users size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Referred</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{info.referralCount}</div>
              </div>
              <div style={{ flex: 1, padding: '14px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Gem size={13} style={{ color: '#f5c542' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Max reward</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{REFERRAL_MAX_TOTAL} 💎</div>
              </div>
            </div>

            {/* Milestones */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Milestones
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REFERRAL_MILESTONES.map(m => {
                  const reached = info.referralCount >= m.tier
                  return (
                    <div key={m.tier} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 14,
                      background: reached ? 'rgba(62,207,142,0.08)' : 'var(--surface)',
                      border: `1px solid ${reached ? 'rgba(62,207,142,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {reached ? <Check size={15} style={{ color: 'var(--green, #3ecf8e)' }} /> : <Users size={15} style={{ color: 'var(--text-muted)' }} />}
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{m.tier} friends</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: reached ? 'var(--green, #3ecf8e)' : 'var(--text-dim)' }}>+{m.reward} 💎</span>
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                Reward unlocks once your friend signs up and plays their first game.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
