// src/features/chat/voiceNotes/VoiceNotePlayer.tsx
import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { getVoiceNoteSignedUrl } from './voiceNoteStorage'

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface VoiceNotePlayerProps {
  audioPath: string
  durationSeconds: number
  /** Matches the bubble's accent color so the player reads correctly on both
   *  "mine" (accent-colored) and "theirs" (neutral) bubble backgrounds. */
  tint: 'light' | 'dark'
}

export default function VoiceNotePlayer({ audioPath, durationSeconds, tint }: VoiceNotePlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { audioRef.current?.pause() }, [])

  async function ensureLoaded(): Promise<string | null> {
    if (signedUrl) return signedUrl
    setLoadState('loading')
    const url = await getVoiceNoteSignedUrl(audioPath)
    if (!url) { setLoadState('error'); return null }
    setSignedUrl(url)
    setLoadState('ready')
    return url
  }

  async function togglePlay() {
    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }
    const url = await ensureLoaded()
    if (!url) return
    if (!audioRef.current) {
      const audio = new Audio(url)
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
      audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0) })
      audioRef.current = audio
    }
    audioRef.current.play().catch(() => setLoadState('error'))
    setIsPlaying(true)
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value)
    setCurrentTime(value)
    if (audioRef.current) audioRef.current.currentTime = value
  }

  const progressColor = tint === 'light' ? 'rgba(255,255,255,0.9)' : 'var(--accent)'
  const trackColor = tint === 'light' ? 'rgba(255,255,255,0.3)' : 'var(--surface3)'
  const textColor = tint === 'light' ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:180, padding:'2px 0' }}>
      <button type="button" onClick={togglePlay} disabled={loadState === 'loading'}
        style={{
          width:30, height:30, borderRadius:'50%', border:'none', flexShrink:0,
          background: tint === 'light' ? 'rgba(255,255,255,0.2)' : 'var(--surface3)',
          color: tint === 'light' ? '#fff' : 'var(--text)',
          cursor: loadState === 'loading' ? 'wait' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        {loadState === 'loading' ? (
          <span style={{ width:12, height:12, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
        ) : isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft:1 }} />}
      </button>

      <input
        type="range"
        min={0}
        max={durationSeconds || 1}
        step={0.1}
        value={Math.min(currentTime, durationSeconds || 1)}
        onChange={seek}
        disabled={loadState === 'error'}
        style={{ flex:1, accentColor: progressColor, height:4, background: trackColor }}
      />

      <span style={{ fontSize:10.5, color: textColor, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>
        {loadState === 'error' ? '—' : formatDuration(isPlaying || currentTime > 0 ? currentTime : durationSeconds)}
      </span>
    </div>
  )
}
