import { useEffect, useRef } from 'react'

interface RingCubeDef {
  color: string
  emoji: string
}

const RING_DATA: RingCubeDef[] = [
  { color: 'rgba(108,80,255,', emoji: '🎯' },
  { color: 'rgba(0,229,255,', emoji: '⚡' },
  { color: 'rgba(255,78,205,', emoji: '🏆' },
  { color: 'rgba(255,184,0,', emoji: '🔥' },
  { color: 'rgba(0,255,135,', emoji: '👾' },
  { color: 'rgba(108,80,255,', emoji: '💎' },
  { color: 'rgba(0,229,255,', emoji: '🎲' },
  { color: 'rgba(255,78,205,', emoji: '⭐' },
]

const RING_R = 260

/**
 * The big rotating "mega cube" + ring of orbiting cubes that sits
 * behind the hero headline. Rotation is driven by scroll position.
 */
export default function CubeScene() {
  const megaCubeRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ curX: 15, curY: -20, tgtX: 15, tgtY: -20, raf: 0 })

  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const tick = () => {
      const s = stateRef.current
      s.curX = lerp(s.curX, s.tgtX, 0.06)
      s.curY = lerp(s.curY, s.tgtY, 0.06)
      if (megaCubeRef.current) {
        megaCubeRef.current.style.transform =
          `translateX(-50%) translateY(-50%) rotateX(${s.curX}deg) rotateY(${s.curY}deg)`
      }
      if (Math.abs(s.curX - s.tgtX) > 0.05 || Math.abs(s.curY - s.tgtY) > 0.05) {
        s.raf = requestAnimationFrame(tick)
      } else {
        s.raf = 0
      }
    }

    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight
      const progress = max > 0 ? window.scrollY / max : 0
      const s = stateRef.current
      s.tgtX = 15 + progress * 360
      s.tgtY = -20 + progress * 540
      if (!s.raf) s.raf = requestAnimationFrame(tick)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(stateRef.current.raf)
    }
  }, [])

  return (
    <div className="hero-3d-bg">
      <div className="glow glow-violet" />
      <div className="glow glow-cyan" />
      <div className="glow glow-pink" />
      <div className="grid-floor" />

      {/* Mega cube — center */}
      <div ref={megaCubeRef} className="mega-cube">
        <div className="mf mfr">🎮</div>
        <div className="mf mbk">🏆</div>
        <div className="mf mrt">🔥</div>
        <div className="mf mlt">💬</div>
        <div className="mf mtp">⚡</div>
        <div className="mf mbt">👾</div>
      </div>

      {/* Orbiting ring of small cubes */}
      <div className="ring-wrap">
        {RING_DATA.map((d, i) => {
          const angle = (i / RING_DATA.length) * Math.PI * 2
          const x = 350 + Math.cos(angle) * RING_R - 35
          const y = 350 + Math.sin(angle) * RING_R - 35
          const spinClass = i % 2 === 0 ? 'spinA' : 'spinB'
          const duration = 8 + i * 1.2

          return (
            <div
              key={i}
              className={`ring-cube ${spinClass}`}
              style={{ left: `${x}px`, top: `${y}px`, animationDuration: `${duration}s` }}
            >
              <div className="rc-face rc-fr" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }}>
                {d.emoji}
              </div>
              <div className="rc-face rc-bk" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }} />
              <div className="rc-face rc-rt" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }} />
              <div className="rc-face rc-lt" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }} />
              <div className="rc-face rc-tp" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }} />
              <div className="rc-face rc-bt" style={{ borderColor: `${d.color}0.4)`, background: `${d.color}0.06)` }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
