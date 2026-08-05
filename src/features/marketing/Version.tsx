// src/pages/Version.tsx
//
// Version History used to list individually-purchasable version tiers
// (2.0–4.0) plus a locked 5.0 teaser card. That whole system is on pause —
// this page is now just a "coming sooner than you think" teaser. Closing it
// fires a one-time notification so the user knows they'll be told the
// moment it's actually live, then sends them back where they came from.
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useProfile } from '../profile/useProfile'
import { supabase } from '../../shared/lib/supabase'
import PageOnboarding from '../onboarding/PageOnboarding'

export default function Version() {
  const navigate = useNavigate()
  const { profile } = useProfile()

  async function handleClose() {
    if (profile?.id) {
      try {
        await supabase.rpc('insert_notification', {
          p_user_id: profile.id,
          p_type:    'version_coming_soon',
          p_title:   `Hey ${profile.username}`,
          p_body:    "You're on the list — we'll notify you the moment the new version drops.",
          p_icon:    'sparkles',
          p_meta:    {},
        })
      } catch (err) {
        console.error('[Version] coming-soon notify failed', err)
      }
    }
    navigate(-1)
  }

  return (
    <>
      <PageOnboarding pageKey="version" />
      <style>{`
        @keyframes popIn { from { opacity:0; transform: scale(0.9) } to { opacity:1; transform: scale(1) } }
      `}</style>

      <div style={{
        minHeight: '70vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'linear-gradient(160deg,#1a0f2e,#0d1a2e)',
          border: '1.5px solid rgba(155,109,255,0.35)',
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(155,109,255,0.1)',
          animation: 'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(155,109,255,0.8)' }}>Version History</span>
            <button onClick={handleClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: '22px 24px 28px', textAlign: 'center' }}>
            <p style={{
              fontSize: 16, lineHeight: 1.65, fontWeight: 700,
              color: '#fff', marginBottom: 24,
            }}>
              This update is coming sooner than you think. Watch out<span style={{ color: '#9b6dff' }}>…</span>
            </p>
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 800, color: '#fff',
                letterSpacing: 0.3,
                boxShadow: '0 8px 24px rgba(155,109,255,0.4)',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
