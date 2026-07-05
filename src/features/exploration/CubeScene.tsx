import { useCallback, useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import { useScrollProgress } from '../marketing/useScrollProgress'

/** Ember particle style needs a `--drift` custom property alongside standard CSS props. */
type EmberParticleStyle = CSSProperties & { '--drift': string }

const PARTICLE_COUNT = 14

interface EmberParticleDef {
  left: number
  size: number
  duration: number
  delay: number
  drift: number
}

interface CubeSceneProps {
  /** The tall pinned hero wrapper this scene's scroll progress is measured against. */
  containerRef: RefObject<HTMLDivElement | null>
}

/**
 * The hero scene: two independently-stacked layers around the headline copy.
 *
 * 1. `.hero-3d-bg` (background, z-index 0, renders BEHIND the headline) —
 *    perspective grid floor, layered glow blobs, and ambient rising ember
 *    particles.
 * 2. `.hero-glass-layer` (foreground, z-index 5, renders IN FRONT of the
 *    headline) — a single large refractive "glass" cube, oriented as a
 *    diamond, whose semi-transparent/backdrop-blurred faces visually bend
 *    and blur the headline words behind them as the cube rotates.
 *
 * Rotation, recede (scale-down), and fade on both layers are driven by
 * scroll progress through the pinned hero container (see `useScrollProgress`),
 * giving the cinematic effect of the whole scene pulling back and dissolving
 * as the page scrolls past the hero into the rest of the landing page.
 */
export default function CubeScene({ containerRef }: CubeSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const glassSceneRef = useRef<HTMLDivElement>(null)
  const glassCubeRef = useRef<HTMLDivElement>(null)
  const glowFarRef = useRef<HTMLDivElement>(null)
  const glowMidRef = useRef<HTMLDivElement>(null)
  const glowNearRef = useRef<HTMLDivElement>(null)

  const stateRef = useRef({
    curX: 15, curY: -20, tgtX: 15, tgtY: -20,
    curP: 0, tgtP: 0,
    raf: 0,
  })

  const particles = useMemo<EmberParticleDef[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      left: (i / PARTICLE_COUNT) * 100 + (i % 3) * 2,
      size: 3 + ((i * 7) % 5),
      duration: 9 + ((i * 5) % 11),
      delay: -(i * 1.3),
      drift: ((i % 2 === 0 ? 1 : -1) * (18 + ((i * 11) % 30))),
    }))
  }, [])

  const applyFrame = useCallback(() => {
    const s = stateRef.current
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    s.curX = lerp(s.curX, s.tgtX, 0.06)
    s.curY = lerp(s.curY, s.tgtY, 0.06)
    s.curP = lerp(s.curP, s.tgtP, 0.08)

    if (glassCubeRef.current) {
      glassCubeRef.current.style.transform = `rotateX(${s.curX}deg) rotateY(${s.curY}deg)`
    }

    // Background layer (grid floor, glows, embers) fully dissolves as the
    // hero scrolls past — this is what sells the "pulling back into the
    // page" transition.
    const bgScale = 1 - s.curP * 0.28
    const bgLift = s.curP * -36
    const bgOpacity = String(1 - s.curP * 0.85)

    if (sceneRef.current) {
      sceneRef.current.style.transform = `translateY(${bgLift}px) scale(${bgScale})`
      sceneRef.current.style.opacity = bgOpacity
    }

    // Glass layer stays glass. Only a gentle recede + near-imperceptible
    // fade — the cube should read as a constant, physical object refracting
    // the headline throughout the scroll, not something that dissolves
    // away like the rest of the scene.
    const glassScale = 1 - s.curP * 0.1
    const glassLift = s.curP * -20
    const glassOpacity = String(1 - s.curP * 0.15)

    if (glassSceneRef.current) {
      glassSceneRef.current.style.transform = `translateY(${glassLift}px) scale(${glassScale})`
      glassSceneRef.current.style.opacity = glassOpacity
    }

    if (glowFarRef.current) glowFarRef.current.style.transform = `translate(-50%, calc(-50% + ${s.curP * 30}px))`
    if (glowMidRef.current) glowMidRef.current.style.transform = `translateY(${s.curP * 70}px)`
    if (glowNearRef.current) glowNearRef.current.style.transform = `translateY(${s.curP * -50}px)`

    const stillMoving =
      Math.abs(s.curX - s.tgtX) > 0.05 ||
      Math.abs(s.curY - s.tgtY) > 0.05 ||
      Math.abs(s.curP - s.tgtP) > 0.002

    if (stillMoving) {
      s.raf = requestAnimationFrame(applyFrame)
    } else {
      s.raf = 0
    }
  }, [])

  const handleProgress = useCallback((progress: number) => {
    const s = stateRef.current
    s.tgtX = 15 + progress * 140
    s.tgtY = -20 + progress * 220
    s.tgtP = progress
    if (!s.raf) s.raf = requestAnimationFrame(applyFrame)
  }, [applyFrame])

  useScrollProgress(containerRef, handleProgress)

  return (
    <>
      {/* Hidden filter def — feTurbulence + feDisplacementMap is what actually
         bends/warps the headline glyphs behind each glass face (the visible
         "stretched, malformed-through-glass" look from the reference brief).
         Referenced via `backdrop-filter: url(#glass-refraction)` in CSS.
         Chromium and Firefox apply it; browsers without SVG-filter support in
         backdrop-filter just fall back to the plain blur/saturate/brightness
         already chained alongside it, so the cube still looks like glass. */}
      <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="glass-refraction" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.015" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="46" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Background layer — renders behind the headline text */}
      <div ref={sceneRef} className="hero-3d-bg">
        <div ref={glowFarRef} className="glow glow-violet" />
        <div ref={glowMidRef} className="glow glow-cyan" />
        <div ref={glowNearRef} className="glow glow-pink" />
        <div className="grid-floor" />

        <div className="ember-field">
          {particles.map((p, i) => {
            const style: EmberParticleStyle = {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--drift': `${p.drift}px`,
            }
            return <div key={i} className="ember-particle" style={style} />
          })}
        </div>
      </div>

      {/* Foreground layer — renders in front of the headline text; its
         backdrop-blurred glass faces bend/blur the words behind them. */}
      <div ref={glassSceneRef} className="hero-glass-layer">
        <div className="glass-cube-diamond">
          <div ref={glassCubeRef} className="glass-cube">
            <div className="gf gfr" />
            <div className="gf gbk" />
            <div className="gf grt" />
            <div className="gf glt" />
            <div className="gf gtp" />
            <div className="gf gbt" />
          </div>
        </div>
      </div>
    </>
  )
}
