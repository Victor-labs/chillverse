// src/features/games/play/Ludo.tsx
// Ludo is a standalone, self-contained HTML/JS game (not a React component
// like Chess) — rendered via an iframe using its raw source as srcDoc, so
// it's fully sandboxed from the app's own styles/scripts and never becomes
// a fetched same-origin resource (avoids the site-wide X-Frame-Options:
// DENY header in vercel.json, which would otherwise block framing it from
// a real URL). It reports back to us via postMessage when the game ends
// (see the `finish()` function in ludo.html) so we can award XP through
// the real, capped server RPC — the HTML page has no Supabase access of
// its own.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import HubXpLockScreen from './HubXpLockScreen'
import { getHubXpStatus, awardHubXp } from './hubXp'
// eslint-disable-next-line import/no-unresolved
import ludoHtml from './ludo.html?raw'

const WIN_XP = 18

export default function Ludo() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!userId) { setChecking(false); return }
    getHubXpStatus(userId).then(status => {
      setLocked(status.capReached)
      setChecking(false)
    })
  }, [userId])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.source !== 'chillverse-ludo' || e.data?.type !== 'game-end') return
      if (e.data.reason === 'win' && userId) {
        awardHubXp(userId, WIN_XP).then(result => {
          if (result.capReached) setLocked(true)
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [userId])

  if (checking) return null
  if (locked) return <HubXpLockScreen gameName="Ludo" />

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#1c130c' }}>
      <button
        type="button"
        onClick={() => navigate('/multiplayer')}
        style={{
          position: 'absolute', top: 14, left: 14, zIndex: 10,
          width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#f1e6d2', cursor: 'pointer',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <iframe
        ref={iframeRef}
        title="Ludo — Vs AI"
        srcDoc={ludoHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
