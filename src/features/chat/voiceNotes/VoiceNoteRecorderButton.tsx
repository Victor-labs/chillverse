// src/features/chat/voiceNotes/VoiceNoteRecorderButton.tsx
import { useEffect } from 'react'
import { Mic, Send, Trash2 } from 'lucide-react'
import { useVoiceRecorder, type VoiceRecorderResult } from './useVoiceRecorder'

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface VoiceNoteRecorderButtonProps {
  onSend: (result: VoiceRecorderResult) => void
  onError?: (message: string) => void
  /** Fires whenever recording starts/stops so the parent composer can hide the
   *  text input row while this renders its full-width recording pill instead. */
  onRecordingChange?: (isRecording: boolean) => void
  disabled?: boolean
}

/** Renders just the mic icon when idle (drop-in replacement for the send
 *  button in a composer while the text field is empty). Once recording
 *  starts, it renders a full-width recording pill (timer + cancel + send)
 *  instead — the parent composer should hide its text input row for the
 *  duration via `onRecordingChange`. */
export default function VoiceNoteRecorderButton({ onSend, onError, onRecordingChange, disabled }: VoiceNoteRecorderButtonProps) {
  const { isRecording, elapsedSeconds, error, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()

  useEffect(() => { if (error) onError?.(error) }, [error, onError])
  useEffect(() => { onRecordingChange?.(isRecording) }, [isRecording, onRecordingChange])

  if (isRecording) {
    return (
      <div style={{
        flex:1, display:'flex', alignItems:'center', gap:10, background:'var(--surface)',
        boxShadow:'var(--elev-inset)', border:'1px solid rgba(255,79,79,0.25)',
        borderRadius:14, padding:'9px 12px',
      }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:'#ff4f4f', flexShrink:0, animation:'recPulse 1s ease-in-out infinite' }} />
        <span style={{ fontSize:13, color:'var(--text)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{formatElapsed(elapsedSeconds)}</span>
        <span style={{ fontSize:12, color:'var(--text-muted)', flex:1 }}>Recording voice note…</span>
        <button type="button" onClick={cancelRecording} title="Cancel"
          style={{ width:30, height:30, borderRadius:9, border:'none', background:'rgba(255,79,79,0.12)', color:'#ff4f4f', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Trash2 size={14} />
        </button>
        <button type="button"
          onClick={async () => { const result = await stopRecording(); if (result) onSend(result) }}
          title="Send voice note"
          style={{ width:30, height:30, borderRadius:9, border:'none', background:'linear-gradient(135deg,var(--accent),var(--accent2))', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Send size={13} />
        </button>
        <style>{`@keyframes recPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    )
  }

  return (
    <button type="button" disabled={disabled} onClick={startRecording} title="Record a voice note"
      style={{
        width:36, height:36, borderRadius:10, flexShrink:0, background:'var(--surface)',
        border:'1px solid var(--border)', color: disabled ? 'var(--text-muted)' : 'var(--text-dim)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
      <Mic size={15} />
    </button>
  )
}
