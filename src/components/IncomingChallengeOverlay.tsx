// src/components/IncomingChallengeOverlay.tsx
//
// Renders on top of any page when another user sends a challenge invite.
// 10-second countdown auto-dismisses if not responded to.
//
import { useEffect, useState, useRef } from 'react'
import { X, Swords } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { IncomingChallenge } from '../hooks/useChallengeListener'

const BANNER_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/b61a981e40cf286742427351314025cb.jpg'

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic Tac Toe',
  uno:        'UNO',
  arrow_escape: 'Arrow Escape',
}

interface Props {
  challenge: IncomingChallenge
  myId: string
  onAccept: (challenge: IncomingChallenge) => void
  onDismiss: () => void
}

export default function IncomingChallengeOverlay({ challenge, myId, onAccept, onDismiss }: Props) {
  const [timeLeft, setTimeLeft] = useState(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [])

  async function handleTimeout() {
    await supabase.from('challenges').update({ status: 'timeout' }).eq('id', challenge.id)
    onDismiss()
  }

  async function handleDecline() {
    clearInterval(timerRef.current!)
    await supabase.from('challenges').update({ status: 'declined' }).eq('id', challenge.id)
    onDismiss()
  }

  async function handleAccept() {
    clearInterval(timerRef.current!)
    await supabase.from('challenges').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }).eq('id', challenge.id)
    onAccept(challenge)
  }

  const gameName = GAME_LABELS[challenge.game] ?? challenge.game
  const progress = (timeLeft / 10) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(12px)',
      animation: 'challengeIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'var(--surface2)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.75)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Big image banner */}
        <div style={{
          width: '100%', height: 160, position: 'relative', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          <img
            src={BANNER_IMG}
            alt="challenge"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 30%',
              transform: 'scale(1.08)',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.65))',
          }} />
          {/* Game badge */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '5px 11px', borderRadius: 10,
            background: 'rgba(255,107,0,0.9)',
            backdropFilter: 'blur(8px)',
            fontSize: 11, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Swords size={11} /> {gameName}
          </div>
          {/* Dismiss */}
          <button onClick={handleDecline} style={{
            position: 'absolute', top: 12, right: 12,
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,0,0,0.5)', border: 'none',
            cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} />
          </button>
          {/* Timer ring on corner */}
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 36, height: 36,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={timeLeft <= 3 ? '#ff4d4d' : 'var(--accent)'}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 15}`}
                strokeDashoffset={`${2 * Math.PI * 15 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
              />
            </svg>
            <span style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
            }}>{timeLeft}</span>
          </div>
        </div>

        {/* Bottom content */}
        <div style={{ padding: '18px 20px 20px' }}>
          {/* Challenger info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {/* Small avatar box */}
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: 'var(--surface)',
              border: '2px solid var(--accent)',
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {challenge.challenger_avatar ? (
                <img src={challenge.challenger_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20 }}>👤</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
                {challenge.challenger_name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                challenged you to <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{gameName}</span>
              </div>
            </div>
          </div>

          {/* Countdown bar */}
          <div style={{
            height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{
              height: '100%',
              background: timeLeft <= 3 ? '#ff4d4d' : 'var(--accent)',
              width: `${progress}%`,
              transition: 'width 0.9s linear, background 0.3s',
            }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleDecline} style={{
              flex: 1, padding: '12px 0', borderRadius: 13,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'var(--surface)', color: 'var(--text-dim)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              Decline
            </button>
            <button onClick={handleAccept} style={{
              flex: 2, padding: '12px 0', borderRadius: 13,
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Swords size={14} /> Accept
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes challengeIn {
          from { opacity: 0; transform: scale(0.88) translateY(20px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  )
}
