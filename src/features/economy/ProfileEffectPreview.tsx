// src/features/economy/ProfileEffectPreview.tsx
//
// Discord-style "this is what others see when they view your profile"
// preview, used from the Mall's Profile Card Effect item sheet. It draws
// up your REAL profile (the same ProfilePreviewModal used everywhere else
// in the app — full header, bio, member since, etc.) and layers the
// effect's video on top of it, exactly like the reference screenshots.
//
// Both this component's overlay/video/banner layer AND ProfilePreviewModal
// itself are portaled straight to document.body. That's not optional here:
// AppLayout wraps every page's content in <main className="relative z-10">,
// which — because it combines position with a z-index — is itself a
// stacking context. Anything rendered through the normal page tree,
// however high its own z-index, is capped inside that z-10 context and
// can never paint above something that escaped it. Sliding the Mall item
// sheet out of the way (see Mall.tsx) fixed the *local* trap from that
// sheet's own backdrop-filter, but this outer one is a separate, app-wide
// wrapper that can't be animated away — a portal is the only way out of it,
// which is exactly why ProfilePreviewModal (already portaled) always
// rendered correctly while this layer, sitting in the normal tree, didn't.
//
// The video sits in its own layer with pointer-events: none, and the
// profile card underneath is rendered with isPreview, which makes the
// whole card untappable and hides the owner-only controls (Edit Profile,
// Refer & Earn, Achievements) that have no business being on a "this is
// what others see" preview. Tapping anywhere closes the preview and drops
// back to the item's buy sheet, which is still mounted underneath — it
// just slides itself out of the way while this is open instead of
// competing with this layer for stacking order.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ProfilePreviewModal from '../profile/ProfilePreviewModal'

// Mirrors SHEET_HEIGHT_VH in ProfilePreviewModal.tsx / BUY_SHEET_HEIGHT_VH
// in Mall.tsx, so the video lines up exactly with the real sheet under it.
const SHEET_HEIGHT_VH = 85

// How long the effect plays (looping the clip as needed to fill this
// window — several of these source clips are only a few seconds long)
// before it rests, and how long it rests before playing again.
const EFFECT_PLAY_MS = 19000
const EFFECT_REST_MS = 20000

export default function ProfileEffectPreview({
  userId, videoUrl, onClose,
}: {
  userId: string
  videoUrl: string | null
  onClose: () => void
}) {
  // Mirrors ProfilePreviewModal's own isWide breakpoint exactly, so this
  // layer's width always matches the real sheet's width — full-bleed on
  // phone, capped card-width on tablet+. Without this the effect layer was
  // stuck at the tablet width even on phone, leaving strips of the sheet's
  // left/right edges completely undimmed while the effect played.
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640)
  useEffect(() => {
    function onResize() { setIsWide(window.innerWidth >= 640) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const sheetWidth = isWide ? 'min(92vw, 460px)' : '100%'

  // Play/rest cadence: effect plays (looping) for EFFECT_PLAY_MS, then the
  // card sits perfectly clear for EFFECT_REST_MS, then it plays again —
  // forever, for as long as this preview/profile stays open.
  const [effectPlaying, setEffectPlaying] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoUrl) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    function schedule(playing: boolean) {
      timer = setTimeout(() => {
        if (cancelled) return
        setEffectPlaying(!playing)
        schedule(!playing)
      }, playing ? EFFECT_PLAY_MS : EFFECT_REST_MS)
    }
    schedule(true)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [videoUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (effectPlaying) {
      v.currentTime = 0
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [effectPlaying])
  return (
    <>
      {/* The real profile card — read-only. isPreview strips Edit Profile /
          Refer & Earn / Achievements and makes the whole card untappable,
          so nothing on it can navigate anywhere. Portals itself to
          document.body already. */}
      <ProfilePreviewModal userId={userId} onClose={onClose} isPreview />

      {/* Everything below is portaled to document.body too, for the reason
          explained at the top of this file — otherwise it's stuck behind
          the portaled profile card no matter its z-index. */}
      {createPortal(
        <>
          {/* Banner callout — sits above the sheet, same spot Discord puts
              it. zIndex is above ProfilePreviewModal's own 20000. */}
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
              {/* Dim + soften the profile card itself while the effect
                  plays — a light dark overlay plus a couple px of blur,
                  echoing Discord's "the effect draws attention, the card
                  recedes" feel. This never touches the video, only the
                  card behind it, and fades out on its own after a few
                  seconds so the card settles back to normal while the
                  effect keeps looping. */}
              <div style={{
                position: 'fixed', inset: 0, zIndex: 20005, pointerEvents: 'none',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                opacity: effectPlaying ? 1 : 0, transition: 'opacity 0.6s ease',
              }}>
                <div style={{
                  width: sheetWidth, height: `${SHEET_HEIGHT_VH}vh`,
                  borderRadius: '20px 20px 0 0', overflow: 'hidden',
                  background: 'rgba(0,0,0,0.16)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
                  animation: 'effectDimFade 3.2s ease forwards',
                }} />
              </div>

              {/* Effect video — click-through, screen-blended so a black
                  background in the source clip reads as transparent over
                  the profile card, with a soft glow so bright elements
                  bloom the way Discord's do. */}
              <div style={{
                position: 'fixed', inset: 0, zIndex: 20006, pointerEvents: 'none',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                opacity: effectPlaying ? 1 : 0, transition: 'opacity 0.6s ease',
              }}>
                <div style={{
                  width: sheetWidth, height: `${SHEET_HEIGHT_VH}vh`,
                  borderRadius: '20px 20px 0 0', overflow: 'hidden', position: 'relative',
                }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    autoPlay loop muted playsInline
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      // Capped only on the wide/desktop breakpoint — that's
                      // the one where a tall PC viewport was stretching the
                      // video and forcing `cover` to crop deep into a
                      // fully bright/opaque part of the clip. Phone never
                      // had that problem, so it stays fully uncapped and
                      // fills the whole sheet height, matching how it
                      // looked before this cap was introduced.
                      height: isWide ? 'min(100%, 640px)' : '100%',
                      objectFit: 'cover',
                      // Opacity (not blend mode) is what's actually letting
                      // the card show through here — the source clip's
                      // "black" isn't pure enough for mixBlendMode:'screen'
                      // to zero it out cleanly, so we lean on opacity
                      // instead and use `filter` purely for bloom/glow on
                      // top of that, with no blend-mode transparency trick
                      // involved at all.
                      //
                      // blur(1.4px) here isn't for bloom — it's feathering
                      // the internal boundary wherever the clip jumps from
                      // a bright patch (near-opaque at this opacity) to a
                      // dark one (near-invisible), so it reads as a soft
                      // glow rather than a sharp graphic edge.
                      filter: 'blur(1.4px) brightness(1.3) saturate(1.35) drop-shadow(0 0 26px rgba(255,150,60,0.6)) drop-shadow(0 0 46px rgba(255,90,30,0.35))',
                      opacity: 0.55,
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
        </>,
        document.body,
      )}
    </>
  )
}
