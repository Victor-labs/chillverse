// src/features/chat/calling/CallScreen.tsx
import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, ChevronDown } from 'lucide-react'
import { useCall } from './CallContext'
import Avatar from '../../../shared/components/Avatar'

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function CallScreen() {
  const { phase, call, otherParticipant, localStream, remoteStream, isMuted, durationSeconds, endCall, toggleMute, minimizeCall } = useCall()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const isVideoCall = call?.type === 'video'

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (isVideoCall && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
    if (!isVideoCall && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
  }, [remoteStream, isVideoCall])

  if (!call || !otherParticipant) return null
  const name = otherParticipant.display_name || otherParticipant.username

  const statusLabel =
    phase === 'dialing' ? 'Calling…' :
    phase === 'connecting' ? 'Connecting…' :
    formatCallDuration(durationSeconds)

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background: isVideoCall ? '#000' : 'linear-gradient(160deg, rgba(20,20,26,0.98), rgba(10,10,14,0.99))',
      backdropFilter:'blur(20px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between',
      padding:'64px 24px 48px',
    }}>
      {/* Remote video fills the screen for a video call; audio-only calls just play sound */}
      {isVideoCall ? (
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0 }} />
      ) : (
        <audio ref={remoteAudioRef} autoPlay />
      )}

      <button type="button" onClick={minimizeCall} title="Minimize"
        style={{
          position:'absolute', top:'max(20px, env(safe-area-inset-top))', left:20, zIndex:3,
          width:40, height:40, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)',
          background:'rgba(255,255,255,0.1)', color:'#fff', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        <ChevronDown size={20} />
      </button>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginTop:32, zIndex:1 }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontWeight:600, letterSpacing:0.5 }}>
          {statusLabel}
        </span>
      </div>

      {(!isVideoCall || phase !== 'connected') && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18, zIndex:1 }}>
          <div style={{
            width:120, height:120, borderRadius:'50%', overflow:'hidden', flexShrink:0,
            boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <Avatar src={otherParticipant.avatar} name={name} size={120} radius="50%" disabled />
          </div>
          <div style={{ fontSize:22, fontWeight:700, color:'#fff' }}>{name}</div>
        </div>
      )}

      {/* Local video preview (video calls only) — small corner tile like every other video calling app */}
      {isVideoCall && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{
            position:'absolute', top:24, right:24, width:96, height:128, borderRadius:12, objectFit:'cover',
            border:'2px solid rgba(255,255,255,0.2)', zIndex:2, background:'#111',
          }} />
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:32, width:'100%', maxWidth:320, zIndex:1 }}>
        <button type="button" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            width:56, height:56, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer',
            background: isMuted ? '#fff' : 'rgba(255,255,255,0.1)', color: isMuted ? '#111' : '#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button type="button" onClick={endCall} title="End call"
          style={{
            width:64, height:64, borderRadius:'50%', border:'none', cursor:'pointer',
            background:'#ff4f4f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 24px rgba(255,79,79,0.4)',
          }}>
          <PhoneOff size={26} />
        </button>
        <div style={{ width:56 }} /> {/* balances the mute button so the end-call button stays centered */}
      </div>
    </div>
  )
}
