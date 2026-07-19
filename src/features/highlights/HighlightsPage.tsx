// src/features/highlights/HighlightsPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchHighlights } from './highlights'
import HighlightCard from './HighlightCard'
import type { Highlight } from './types'

export default function HighlightsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHighlights(user?.id ?? null).then(rows => {
      setHighlights(rows)
      setLoading(false)
    })
  }, [user?.id])

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 56 }}>
      {/* ── Top bar — back button always returns to Feed, never a dead end ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', marginBottom: 16, paddingTop: 4 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/feed') }}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--elev-raise-sm)',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Highlights</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Recent wins from the community · last 5 days</p>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>
        )}

        {!loading && highlights.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Camera size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No highlights yet</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Share a personal best or achievement to see it here
            </p>
          </div>
        )}

        {highlights.map(h => (
          <HighlightCard key={h.id} highlight={h} />
        ))}
      </div>
    </div>
  )
}
