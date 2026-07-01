// src/lib/sfx.ts
// Tiny Web Audio synth SFX — no audio files/assets needed, so nothing to load or fetch.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  // Browsers suspend the context until a user gesture — a card tap counts, so resume it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, startOffset: number, durationSec: number, ac: AudioContext, gainPeak = 0.18) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = ac.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + durationSec + 0.02)
}

/** Short bright blip for tapping a correct card. */
export function playCorrectCard(): void {
  const ac = getCtx()
  if (!ac) return
  tone(880, 0, 0.09, ac)
  tone(1320, 0.06, 0.12, ac)
}

/** Fuller chime for completing an entire pattern set. */
export function playPatternComplete(): void {
  const ac = getCtx()
  if (!ac) return
  tone(660, 0, 0.1, ac, 0.16)
  tone(880, 0.08, 0.1, ac, 0.16)
  tone(1320, 0.16, 0.22, ac, 0.18)
}

/** Low buzz for a wrong tap. */
export function playWrongCard(): void {
  const ac = getCtx()
  if (!ac) return
  tone(180, 0, 0.25, ac, 0.15)
}
