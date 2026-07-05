// src/features/chat/voiceNotes/useVoiceRecorder.ts
import { useCallback, useEffect, useRef, useState } from 'react'

/** Picks the first mime type the browser's MediaRecorder actually supports —
 *  Chrome/Firefox/Edge support webm/opus, Safari does not and needs mp4/aac. */
function pickSupportedMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return '' // let the browser choose its own default as a last resort
}

export interface VoiceRecorderResult {
  blob: Blob
  mimeType: string
  durationSeconds: number
}

interface UseVoiceRecorderReturn {
  isRecording: boolean
  elapsedSeconds: number
  /** Non-null only when getUserMedia or MediaRecorder failed to start. */
  error: string | null
  startRecording: () => Promise<void>
  /** Resolves with the recorded clip, or null if nothing was recorded. */
  stopRecording: () => Promise<VoiceRecorderResult | null>
  /** Discards the in-progress recording without producing a result. */
  cancelRecording: () => void
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const stopTicker = useCallback(() => {
    if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickSupportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      mediaRecorderRef.current = recorder
      recorder.start()

      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      tickIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 1000)
      setIsRecording(true)
    } catch {
      setError('Microphone access is required to record a voice note.')
      releaseStream()
    }
  }, [releaseStream])

  const stopRecording = useCallback((): Promise<VoiceRecorderResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') { resolve(null); return }

      recorder.onstop = () => {
        stopTicker()
        releaseStream()
        setIsRecording(false)
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        if (cancelledRef.current || chunksRef.current.length === 0) { resolve(null); return }
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        resolve({ blob, mimeType, durationSeconds })
      }
      recorder.stop()
    })
  }, [stopTicker, releaseStream])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else { stopTicker(); releaseStream(); setIsRecording(false) }
  }, [stopTicker, releaseStream])

  // Safety net: release the microphone if the component unmounts mid-recording
  // (e.g. the user navigates away without tapping stop or cancel).
  useEffect(() => () => {
    stopTicker()
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    releaseStream()
  }, [stopTicker, releaseStream])

  return { isRecording, elapsedSeconds, error, startRecording, stopRecording, cancelRecording }
}
