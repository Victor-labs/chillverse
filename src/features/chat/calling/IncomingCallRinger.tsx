// src/features/chat/calling/IncomingCallRinger.tsx
import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useCall } from './CallContext'
import Avatar from '../../../shared/components/Avatar'

/** Generates a simple two-tone ring pattern with the Web Audio API so the
 *  feature doesn't depend on bundling/hosting an audio asset file. Loops
 *  until stopped. */
function useRingtone(playing: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopFnRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!playing) return

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioContextCtor()
    audioCtxRef.current = ctx
    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function ringOnce() {
      if (cancelled) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 480
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 1)
      timeouts.push(setTimeout(ringOnce, 2000))
    }
    ringOnce()

    stopFnRef.current = () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
      ctx.close().catch(() => {})
    }

    return () => { stopFnRef.current?.() }
  }, [playing])
}

export default function IncomingCallRinger() {
  const { call, otherParticipant, acceptCall, declineCall } = useCall()
  useRingtone(true)

  if (!call || !otherParticipant) return null
  const name = otherParticipant.display_name || otherParticipant.username

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'linear-gradient(160deg, rgba(20,20,26,0.98), rgba(10,10,14,0.99))',
      backdropFilter:'blur(20px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between',
      padding:'64px 24px 48px',
    }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginTop:32 }}>
        <span style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600, letterSpacing:0.5 }}>
          Incoming {call.type === 'video' ? 'video' : 'voice'} call
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
        <div style={{
          width:120, height:120, borderRadius:'50%', overflow:'hidden', flexShrink:0,
          boxShadow:'0 0 0 4px rgba(255,107,0,0.25), 0 20px 60px rgba(0,0,0,0.5)',
          animation:'callPulse 1.6s ease-in-out infinite',
        }}>
          <Avatar src={otherParticipant.avatar} name={name} size={120} radius="50%" disabled />
        </div>
        <div style={{ fontSize:22, fontWeight:700, color:'var(--text)' }}>{name}</div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>@{otherParticipant.username}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:56, width:'100%', maxWidth:320 }}>
        <button type="button" onClick={declineCall} title="Decline"
          style={{
            width:64, height:64, borderRadius:'50%', border:'none', cursor:'pointer',
            background:'#ff4f4f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 24px rgba(255,79,79,0.4)',
          }}>
          <PhoneOff size={26} />
        </button>
        <button type="button" onClick={acceptCall} title="Accept"
          style={{
            width:64, height:64, borderRadius:'50%', border:'none', cursor:'pointer',
            background:'#3ecf8e', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 24px rgba(62,207,142,0.4)', animation:'callBounce 1.2s ease-in-out infinite',
          }}>
          {call.type === 'video' ? <Video size={26} /> : <Phone size={26} />}
        </button>
      </div>

      <style>{`
        @keyframes callPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes callBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  )
}
