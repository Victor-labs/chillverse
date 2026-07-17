// src/shared/components/OfflineOverlay.tsx
//
// Mounted once in App.tsx, above the routed content. Shows a full-screen
// "you're offline" overlay when the app genuinely can't reach the network —
// not just when navigator.onLine says so, since a device can be connected
// to WiFi with no real internet and still report "online". We treat
// navigator.onLine === false as an instant, trustworthy "offline" signal,
// but only trust "online" once a real same-origin request has succeeded.
import { useCallback, useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Same-origin, tiny, always present — avoids any CORS/third-party concerns.
const CHECK_URL = '/favicon.ico'
const CHECK_INTERVAL_MS = 5000
const CHECK_TIMEOUT_MS = 4000

async function isReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Browser is confident there's no network connection at all —
    // no point spending a request/timeout to confirm the obvious.
    return false
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

  try {
    const res = await fetch(`${CHECK_URL}?_=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    return res.ok || (res.status >= 200 && res.status < 400)
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export default function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runCheck = useCallback(async () => {
    const reachable = await isReachable()
    setIsOffline(!reachable)
  }, [])

  useEffect(() => {
    runCheck()

    // Instant signals from the browser — cheap to react to immediately,
    // but 'online' still gets verified by runCheck() rather than trusted blindly.
    const handleOnline = () => runCheck()
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Background polling so recovery is detected without any user action.
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runCheck])

  if (!isOffline) return null

  const handleRetry = async () => {
    setRetrying(true)
    await runCheck()
    setRetrying(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10,10,14,0.92)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 320 }}>
        <div style={{
          marginBottom: 28, fontSize: 34, fontWeight: 800,
          letterSpacing: '-1px', display: 'flex',
          justifyContent: 'center', gap: 2,
        }}>
          {[
            { letter: 'C', color: 'var(--text)' },
            { letter: 'V', color: '#ff6b00' },
          ].map(({ letter, color }) => (
            <span
              key={letter}
              style={{ display: 'inline-block', color, animation: 'cvBounce 1s ease-in-out infinite' }}
            >
              {letter}
            </span>
          ))}
        </div>

        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            margin: '0 auto 20px',
            background: 'var(--surface2)',
            boxShadow: '6px 6px 14px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WifiOff size={30} style={{ color: 'var(--text-dim)' }} />
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Internet connection seems to be offline
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.5 }}>
          We'll keep checking in the background — you can also try again now.
        </p>

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          style={{
            padding: '10px 26px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: retrying ? 'default' : 'pointer',
            opacity: retrying ? 0.7 : 1,
          }}
        >
          {retrying ? 'Checking…' : 'Try Again'}
        </button>
      </div>

      <style>{`
        @keyframes cvBounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
