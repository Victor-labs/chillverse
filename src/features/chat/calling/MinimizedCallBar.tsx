// src/features/chat/calling/MinimizedCallBar.tsx
import { PhoneOff, ChevronUp } from 'lucide-react'
import { useCall } from './CallContext'
import Avatar from '../../../shared/components/Avatar'

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Rendered by CallProvider (mounted once in AppLayout) whenever a call is
 *  active and minimized, so it floats above every page in the app — the
 *  whole point of minimizing is to keep using the app while staying on the
 *  call, so this must not live inside Chat.tsx or any single page. */
export default function MinimizedCallBar() {
  const { phase, call, otherParticipant, durationSeconds, restoreCall, endCall } = useCall()

  if (!call || !otherParticipant) return null
  const name = otherParticipant.display_name || otherParticipant.username

  const statusLabel =
    phase === 'dialing' ? 'Calling…' :
    phase === 'connecting' ? 'Connecting…' :
    formatCallDuration(durationSeconds)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={restoreCall}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') restoreCall() }}
      title="Return to call"
      style={{
        position:'fixed', top:'calc(68px + max(8px, env(safe-area-inset-top)))', left:12, right:12, zIndex:9998,
        display:'flex', alignItems:'center', gap:10, padding:'8px 10px 8px 8px',
        background:'rgba(20,20,26,0.96)', backdropFilter:'blur(14px)',
        border:'1px solid rgba(255,107,0,0.3)', borderRadius:14,
        boxShadow:'0 8px 24px rgba(0,0,0,0.4)', cursor:'pointer', textAlign:'left',
      }}>
      <Avatar src={otherParticipant.avatar} name={name} size={34} radius={10} disabled />

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
          {statusLabel}
        </div>
      </div>

      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:9, background:'rgba(255,255,255,0.08)', color:'var(--text-muted)', flexShrink:0 }}>
        <ChevronUp size={15} />
      </span>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); endCall() }}
        title="End call"
        style={{
          width:34, height:34, borderRadius:10, flexShrink:0, border:'none', cursor:'pointer',
          background:'#ff4f4f', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        <PhoneOff size={14} />
      </button>
    </div>
  )
}
