// src/features/economy/ProfileEffectPreview.tsx
//
// Discord-style "this is what others see when they view your profile"
// preview, used from the Mall's Profile Card Effect item sheet. It draws
// up your REAL profile (the same ProfilePreviewModal used everywhere else
// in the app — full header, bio, member since, etc.) and layers the
// effect's video on top of it, exactly like the reference screenshots.
//
// The video sits in its own layer with pointer-events: none, and the
// profile card underneath is rendered with isPreview, which makes the
// whole card untappable and hides the owner-only controls (Edit Profile,
// Refer & Earn, Achievements) that have no business being on a "this is
// what others see" preview. Tapping anywhere closes the preview and drops
// back to the item's buy sheet, which is still mounted underneath — it
// just slides itself out of the way while this is open (see Mall.tsx)
// instead of competing with this layer for stacking order.
import ProfilePreviewModal from '../profile/ProfilePreviewModal'

// Mirrors SHEET_HEIGHT_VH in ProfilePreviewModal.tsx / BUY_SHEET_HEIGHT_VH
// in Mall.tsx, so the video lines up exactly with the real sheet under it.
const SHEET_HEIGHT_VH = 85

export default function ProfileEffectPreview({
  userId, videoUrl, onClose,
}: {
  userId: string
  videoUrl: string | null
  onClose: () => void
}) {
  return (
    <>
      {/* The real profile card — read-only. isPreview strips Edit Profile /
          Refer & Earn / Achievements and makes the whole card untappable,
          so nothing on it can navigate anywhere. */}
      <ProfilePreviewModal userId={userId} onClose={onClose} isPreview />

      {/* Banner callout — sits above the sheet, same spot Discord puts it.
          zIndex is above ProfilePreviewModal's own 20000 so it's never
          hidden behind the card. */}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20010, background: 'rgba(20,20,24,0.92)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '9px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text)',
        whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}>
        This is what others see when they view your profile.
      </div>

      {videoUrl && (
        <>
          {/* Dim + soften the profile card itself while the effect plays —
              a light dark overlay plus a couple px of blur, echoing
              Discord's "the effect draws attention, the card recedes"
              feel. This never touches the video, only the card behind it,
              and fades out on its own after a few seconds so the card
              settles back to normal while the effect keeps looping. */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 20005, pointerEvents: 'none',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            <div style={{
              width: 'min(92vw, 460px)', height: `${SHEET_HEIGHT_VH}vh`,
              borderRadius: '20px 20px 0 0', overflow: 'hidden',
              background: 'rgba(0,0,0,0.16)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
              animation: 'effectDimFade 3.2s ease forwards',
            }} />
          </div>

          {/* Effect video — click-through, screen-blended so a black
              background in the source clip reads as transparent over the
              profile card, with a soft glow so bright elements bloom the
              way Discord's do. */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 20006, pointerEvents: 'none',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            <div style={{
              width: 'min(92vw, 460px)', height: `${SHEET_HEIGHT_VH}vh`,
              borderRadius: '20px 20px 0 0', overflow: 'hidden', position: 'relative',
            }}>
              <video
                src={videoUrl}
                autoPlay loop muted playsInline
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', mixBlendMode: 'screen',
                  filter: 'drop-shadow(0 0 18px rgba(255,255,255,0.22)) brightness(1.05)',
                }}
              />
            </div>
          </div>

          <style>{`
            @keyframes effectDimFade {
              0% { opacity: 1; }
              65% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </>
      )}
    </>
  )
}
