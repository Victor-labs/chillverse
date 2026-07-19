// src/features/exploration/story/StoryCheckpointOverlay.tsx
//
// Shown at a chamber's start/mid/claim checkpoint when that stage has
// unread story content. Sequence: intro (typewriter) -> pick one of 3
// choices -> reveal (typewriter) -> transition (typewriter) -> onComplete.
//
// Visual language matches the existing NoAvatarModal in Exploration.tsx
// (dark glass card, same border/shadow values) so it doesn't look bolted on.

import { useState } from 'react'
import { useTypewriter } from './useTypewriter'
import type { StoryCheckpoint, StoryChoiceOption } from './types'

interface Props {
  checkpoint: StoryCheckpoint
  onComplete: (option: StoryChoiceOption) => void
}

type Phase = 'intro' | 'choice' | 'reveal' | 'transition'

export default function StoryCheckpointOverlay({ checkpoint, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [picked, setPicked] = useState<StoryChoiceOption | null>(null)

  const intro = useTypewriter(checkpoint.intro)
  const reveal = useTypewriter(picked ? picked.reveal : [])
  const outro = useTypewriter(checkpoint.transition)

  const active = phase === 'intro' ? intro : phase === 'reveal' ? reveal : phase === 'transition' ? outro : null

  function handleAdvance() {
    if (!active) return
    if (!active.lineDone) {
      active.skipLine()
      return
    }
    if (!active.isFinished) {
      active.next()
      return
    }
    if (phase === 'intro') setPhase('choice')
    else if (phase === 'reveal') setPhase('transition')
    else if (phase === 'transition' && picked) onComplete(picked)
  }

  function choose(opt: StoryChoiceOption) {
    setPicked(opt)
    setPhase('reveal')
  }

  return (
    <div
      onClick={phase !== 'choice' ? handleAdvance : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(6,6,10,0.94)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 20,
        cursor: phase !== 'choice' ? 'pointer' : 'default',
        animation: 'fadeIn 0.25s ease both',
      }}
    >
      <div
        onClick={e => phase === 'choice' && e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'linear-gradient(160deg, #1a1a1f, #111113)',
          border: '1.5px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '22px 20px',
          boxShadow: 'var(--elev-popover)',
          animation: 'modalUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {phase === 'choice' ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 14 }}>
              What do you do?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checkpoint.options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt)}
                  style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 14,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            minHeight: 96, fontSize: 14, lineHeight: 1.7,
            color: 'var(--text-dim)', fontFamily: 'ui-monospace, "SF Mono", monospace',
          }}>
            {active?.displayed}
            <span style={{ opacity: active?.lineDone ? 0 : 1 }}>▍</span>
            {active?.lineDone && !active.isFinished && (
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>tap to continue</div>
            )}
            {active?.isFinished && (
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                {phase === 'transition' ? 'tap to close' : 'tap to continue'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
