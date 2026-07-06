// src/features/exploration/ControllerScene.tsx
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { useScrollProgress } from '../marketing/useScrollProgress'

const MODEL_PATH = '/models/ps5-controller.glb'

const DRAG_SENSITIVITY = 0.0085
const PITCH_LIMIT = 0.55
const HOVER_YAW_MAX = 0.22
const HOVER_PITCH_MAX = 0.12
const IDLE_SPIN_SPEED = 0.18
const SPARK_COUNT = 14
/** Target size (largest bounding-box dimension, in scene units) the loaded
 *  model is normalized to. At camera z≈4.4 / fov 32°, the visible frame
 *  height is ~2.5 units — this was previously set to 2.6, i.e. larger than
 *  the frame itself, which is why the model looked "zoomed in" and clipped
 *  off-screen regardless of whether the .glb contains a controller, a cube,
 *  or anything else. 1.5 leaves comfortable margin on all sides. */
const MODEL_TARGET_SIZE = 1.5

interface ControllerSceneProps {
  /** The tall pinned hero wrapper this scene's scroll progress is measured against. */
  containerRef: RefObject<HTMLDivElement | null>
}

/** Shared, mutation-only interaction state — lives in a ref so pointer input
 *  never triggers a React re-render; only `useFrame` reads it, every frame. */
interface PointerState {
  dragging: boolean
  lastX: number
  lastY: number
  dragYaw: number
  dragPitch: number
  hoverYaw: number
  hoverPitch: number
  idleSpin: number
}

interface SparkDef {
  left: number
  size: number
  duration: number
  delay: number
  drift: number
}

/** The DualSense model itself: centers/normalises the imported mesh, then
 *  drives its rotation every frame from the shared pointer + scroll state. */
function ControllerModel({
  pointerState,
  scrollProgress,
}: {
  pointerState: RefObject<PointerState>
  scrollProgress: RefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const curYaw = useRef(0)
  const curPitch = useRef(0)
  const { scene } = useGLTF(MODEL_PATH)

  const { model, baseScale } = useMemo(() => {
    const cloned = scene.clone(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const maxDim = Math.max(size.x, size.y, size.z) || 1
    cloned.position.set(-center.x, -center.y, -center.z)

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    return { model: cloned, baseScale: MODEL_TARGET_SIZE / maxDim }
  }, [scene])

  useFrame((_, delta) => {
    const p = pointerState.current
    const g = group.current
    if (!p || !g) return

    if (!p.dragging) {
      p.idleSpin += delta * IDLE_SPIN_SPEED
    }

    const targetYaw = p.dragging ? p.dragYaw : p.idleSpin + p.hoverYaw
    const targetPitch = p.dragging ? p.dragPitch : p.hoverPitch
    const followSpeed = p.dragging ? 0.35 : 0.055

    curYaw.current = THREE.MathUtils.lerp(curYaw.current, targetYaw, followSpeed)
    curPitch.current = THREE.MathUtils.lerp(curPitch.current, targetPitch, followSpeed)

    g.rotation.y = curYaw.current
    g.rotation.x = curPitch.current

    const recede = scrollProgress.current ?? 0
    g.scale.setScalar(baseScale * (1 - recede * 0.22))
    g.position.y = -recede * 0.6
  })

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)

/**
 * Interactive hero scene: a real WebGL PS5 controller replacing the old CSS
 * glass cube.
 *
 * Two layers, same pattern as the previous cube scene:
 * 1. `.hero-controller-bg` — ambient glows, perspective floor grid, drifting
 *    sparks. Dissolves/recedes on scroll via direct style mutation.
 * 2. `.hero-controller-canvas-wrap` — the R3F `<Canvas>` itself. Fully
 *    `pointer-events: none` so it never blocks clicks; all pointer input is
 *    captured by a dedicated invisible hit-zone sized to the model.
 *
 * Interaction model:
 * - Idle: the controller auto-rotates slowly and adds a subtle parallax tilt
 *   toward the cursor/touch position anywhere on the page.
 * - Active: pressing and dragging inside the hit-zone takes over completely,
 *   letting the person spin the controller freely; releasing hands control
 *   back to idle auto-rotate from wherever the drag left off.
 */
export default function ControllerScene({ containerRef }: ControllerSceneProps) {
  const bgRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { active: isLoading, progress } = useProgress()

  const pointerState = useRef<PointerState>({
    dragging: false,
    lastX: 0,
    lastY: 0,
    dragYaw: 0,
    dragPitch: 0,
    hoverYaw: 0,
    hoverPitch: 0,
    idleSpin: 0,
  })
  const scrollProgressRef = useRef(0)
  const recedeState = useRef({ cur: 0, tgt: 0, raf: 0 })

  const sparks = useMemo<SparkDef[]>(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => ({
        left: (i / SPARK_COUNT) * 100 + (i % 3) * 2,
        size: 3 + ((i * 7) % 5),
        duration: 9 + ((i * 5) % 11),
        delay: -(i * 1.3),
        drift: (i % 2 === 0 ? 1 : -1) * (18 + ((i * 11) % 30)),
      })),
    []
  )

  const applyRecedeFrame = useCallback(() => {
    const s = recedeState.current
    s.cur += (s.tgt - s.cur) * 0.08

    if (bgRef.current) {
      const scale = 1 - s.cur * 0.28
      const lift = s.cur * -36
      bgRef.current.style.transform = `translateY(${lift}px) scale(${scale})`
      bgRef.current.style.opacity = String(1 - s.cur * 0.85)
    }

    if (Math.abs(s.cur - s.tgt) > 0.001) {
      s.raf = requestAnimationFrame(applyRecedeFrame)
    } else {
      s.raf = 0
    }
  }, [])

  const handleScrollProgress = useCallback(
    (progressValue: number) => {
      scrollProgressRef.current = progressValue
      const s = recedeState.current
      s.tgt = progressValue
      if (!s.raf) s.raf = requestAnimationFrame(applyRecedeFrame)
    },
    [applyRecedeFrame]
  )

  useScrollProgress(containerRef, handleScrollProgress)

  // Global, passive parallax: the controller subtly leans toward the
  // pointer/touch position anywhere on the page while idle (not dragging).
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (pointerState.current.dragging) return
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      pointerState.current.hoverYaw = nx * HOVER_YAW_MAX
      pointerState.current.hoverPitch = -ny * HOVER_PITCH_MAX
    }
    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handleWindowPointerMove)
  }, [])

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointerState.current
    p.dragging = true
    p.lastX = e.clientX
    p.lastY = e.clientY
    // Pick up exactly where the idle animation currently is, so grabbing
    // the controller never causes a visible jump.
    p.dragYaw = p.idleSpin + p.hoverYaw
    p.dragPitch = p.hoverPitch
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointerState.current
    if (!p.dragging) return
    const dx = e.clientX - p.lastX
    const dy = e.clientY - p.lastY
    p.lastX = e.clientX
    p.lastY = e.clientY
    p.dragYaw += dx * DRAG_SENSITIVITY
    p.dragPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.dragPitch + dy * DRAG_SENSITIVITY))
  }, [])

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointerState.current
    if (!p.dragging) return
    p.dragging = false
    // Resume idle auto-rotation from wherever the drag left off.
    p.idleSpin = p.dragYaw
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // A stray mouseleave shouldn't leave the drag "stuck" if pointerup was
  // somehow missed (e.g. cursor released outside the browser window).
  const handleMouseLeave = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        pointerState.current.dragging = false
        pointerState.current.idleSpin = pointerState.current.dragYaw
        setIsDragging(false)
      }
      e.preventDefault()
    },
    [isDragging]
  )

  return (
    <>
      {/* Background layer — ambient glows, floor grid, drifting sparks */}
      <div ref={bgRef} className="hero-controller-bg">
        <div className="hc-glow hc-glow-violet" />
        <div className="hc-glow hc-glow-cyan" />
        <div className="hc-glow hc-glow-pink" />
        <div className="hc-grid-floor" />
        <div className="hc-spark-field">
          {sparks.map((s, i) => (
            <div
              key={i}
              className="hc-spark"
              style={
                {
                  left: `${s.left}%`,
                  width: s.size,
                  height: s.size,
                  animationDuration: `${s.duration}s`,
                  animationDelay: `${s.delay}s`,
                  '--hc-drift': `${s.drift}px`,
                } as CSSProperties & { '--hc-drift': string }
              }
            />
          ))}
        </div>
      </div>

      {/* WebGL layer — the real 3D controller */}
      <div className="hero-controller-canvas-wrap" aria-hidden="true">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0.15, 5.2], fov: 32 }}
          gl={{ alpha: true, antialias: true }}
          style={{ pointerEvents: 'none' }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[3, 4, 5]}
            intensity={1.5}
            color="#f2f0fb"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-3, -0.6, -1.5]} intensity={7} color="#6c50ff" />
          <pointLight position={[3, 1, -2.5]} intensity={5} color="#00e5ff" />
          <Suspense fallback={null}>
            <ControllerModel pointerState={pointerState} scrollProgress={scrollProgressRef} />
            <Environment preset="city" />
          </Suspense>
          <ContactShadows position={[0, -1.15, 0]} opacity={0.5} scale={6} blur={2.6} far={2.2} color="#000000" />
        </Canvas>
      </div>

      {/* Interaction capture zone — sized to the model, not the full hero,
         so page scroll on mobile keeps working everywhere else. */}
      <div
        className={`hero-controller-hitzone ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseLeave={handleMouseLeave}
        role="presentation"
        aria-hidden="true"
      />

      {isLoading && (
        <div className="hero-controller-loader" role="status" aria-live="polite">
          <div className="hero-controller-loader-track">
            <div className="hero-controller-loader-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>Loading controller · {Math.round(progress)}%</span>
        </div>
      )}
    </>
  )
}
