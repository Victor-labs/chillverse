// src/features/games/play/HubXpLockScreen.tsx
// Shown instead of the game when the player has hit HUB_DAILY_XP_CAP for
// the day. Shared by ChessPage / Ludo / WaterTheTree.
import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function HubXpLockScreen({ gameName }: { gameName: string }) {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 420, margin: '80px auto 0', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(155,109,255,0.12)', border: '1px solid rgba(155,109,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Lock size={22} style={{ color: '#9b6dff' }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Daily limit reached</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        You've hit today's XP cap, so {gameName} is locked until it resets tomorrow. Come back then for more.
      </p>
      <button
        type="button"
        onClick={() => navigate('/multiplayer')}
        style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
      >
        Back to Multiplayer
      </button>
    </div>
  )
}
