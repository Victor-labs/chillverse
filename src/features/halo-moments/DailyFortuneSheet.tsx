// src/features/halo-moments/DailyFortuneSheet.tsx
//
// "🔮 Your Chillverse Fortune" — plan §4.3. Deliberately lightweight: one
// line, one dismiss action, no reward logic (Halo's voice only). Mount once
// in AppLayout alongside the other once-per-load overlays, driven by
// useDailyFortune(userId).
//
// NOTE: the plan recommends eventually combining this into a single
// DailyCheckInSheet alongside Mystery Box + Daily Challenge (§4.3, §4.6 in
// the build order) — that combination is intentionally deferred until
// those two features exist; this ships standalone for now, same visual
// language so folding it in later is a low-effort merge, not a rewrite.

import { createPortal } from 'react-dom'
import type { DailyFortune } from './haloMoments'
import haloMascot from '../../assets/halo-mascot.png'

export default function DailyFortuneSheet({
  fortune,
  onDismiss,
}: {
  fortune: DailyFortune | null
  onDismiss: () => void
}) {
  if (!fortune) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9997,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onDismiss}
    >
      <div
        className="neu-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 420, padding: '24px 22px 20px',
          borderRadius: '24px 24px 0 0', textAlign: 'center',
          animation: 'haloFortuneSlideUp 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div
          style={{
            width: 72, height: 72, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(0 0 20px rgba(155,109,255,0.4))',
          }}
        >
          <img src={haloMascot} alt="Halo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>
          Your Chillverse Fortune
        </div>

        <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 20, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          {fortune.text}
        </p>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg,#9b6dff,#4f8ef7)', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          Thanks, Halo
        </button>
      </div>

      <style>{`
        @keyframes haloFortuneSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  )
}
