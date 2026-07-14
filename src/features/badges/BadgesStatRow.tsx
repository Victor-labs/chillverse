// src/features/badges/BadgesStatRow.tsx
import { Award } from 'lucide-react'

// Matches the Wishlist row's exact visual style — a locked stat row that
// opens BadgesModal when tapped.
export default function BadgesStatRow({ collected, total, onClick }: { collected: number; total: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: '2px 2px 8px var(--neu-dark),-1px -1px 5px var(--neu-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={15} style={{ color: '#f5c542' }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Badges</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dim)' }}>{collected}/{total}</span>
    </button>
  )
}
