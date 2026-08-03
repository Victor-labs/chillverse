// src/features/careers/WorkerCarousel.tsx
// Plain photo strip pulled live from the Adverts/Workers storage folder
// (see fetchWorkerCarouselImages). Auto-scrolls slowly and loops; pauses
// on hover/touch so it doesn't fight a user trying to look at a photo.
import { useRef } from 'react'

export default function WorkerCarousel({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  if (images.length === 0) return null

  // Duplicate the list once so the CSS scroll-loop animation can hand off
  // from the end of the first copy back to the start of the second
  // seamlessly, instead of snapping.
  const looped = [...images, ...images]

  return (
    <div
      style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}
      onMouseEnter={() => trackRef.current?.style.setProperty('animation-play-state', 'paused')}
      onMouseLeave={() => trackRef.current?.style.setProperty('animation-play-state', 'running')}
    >
      <div
        ref={trackRef}
        className="worker-carousel-track"
        style={{ display: 'flex', gap: 14, width: 'max-content' }}
      >
        {looped.map((src, i) => (
          <div
            key={`${src}-${i}`}
            style={{
              width: 168, height: 168, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes worker-carousel-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .worker-carousel-track {
          animation: worker-carousel-scroll 34s linear infinite;
        }
      `}</style>
    </div>
  )
}
