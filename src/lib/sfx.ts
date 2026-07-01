// src/lib/sfx.ts
// Game SFX. Praise sounds are real audio files (public/sounds/); the wrong-tap
// buzz is a tiny synth tone since it's just a low blip. Everything respects the
// "Game sound" setting (default ON) from soundSettings.ts.

import { isGameSoundEnabled } from './soundSettings'

// ─── Real audio files, one per "flavor" of praise ──────────────────────────
const TREASURE_SRC = '/sounds/praise-treasure.wav'
const BLING_SRC = '/sounds/praise-bling.wav'

// Preload/cache Audio objects so repeated praise doesn't re-fetch.
const audioCache = new Map<string, HTMLAudioElement>()
function getAudio(src: string): HTMLAudioElement {
  let el = audioCache.get(src)
  if (!el) {
    el = new Audio(src)
    el.preload = 'auto'
    audioCache.set(src, el)
  }
  return el
}

function playFile(src: string) {
  if (!isGameSoundEnabled()) return
  const el = getAudio(src)
  // Allow rapid re-triggering: clone so overlapping praise doesn't cut itself off.
  const instance = el.cloneNode(true) as HTMLAudioElement
  instance.volume = 0.7
  instance.play().catch(() => {})
}

// Map each praise line to a sound "flavor" — bigger-feeling praise gets the
// bling/achievement sound, the rest get the lighter treasure blip.
const PRAISE_SOUND_MAP: Record<string, string> = {
  'Sharp eye!': TREASURE_SRC,
  'Locked in!': TREASURE_SRC,
  'Nailed it!': TREASURE_SRC,
  'Pattern King!': BLING_SRC,
  'Flawless!': BLING_SRC,
  'Unstoppable!': BLING_SRC,
}

/** Play the sound that matches a given praise line (e.g. "Nailed it!"). */
export function playPraiseSound(praiseText: string): void {
  const src = PRAISE_SOUND_MAP[praiseText] ?? TREASURE_SRC
  playFile(src)
}

// ─── Synth fallback for the wrong-tap buzz ─────────────────────────────────
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function playWrongCard(): void {
  if (!isGameSoundEnabled()) return
  const ac = getCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = 180
  const t0 = ac.currentTime
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.15, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + 0.27)
}
