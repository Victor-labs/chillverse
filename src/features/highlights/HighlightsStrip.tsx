// src/features/highlights/HighlightsStrip.tsx
//
// Sits above the regular Feed. Tapping it navigates to the dedicated
// /feed/highlights page — it does not expand inline, so Feed stays the
// default view and Highlights is one deliberate tap away.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Trophy } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { fetchHighlightsPreview } from './highlights'
import { getGameMeta } from '../games/games'
import { ripple } from '../../shared/lib/ripple'
import type { Highlight } from './types'

export default function HighlightsStrip() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHighlightsPreview(user?.id ?? null).then(rows => {
      setHighlights(rows)
      setLoading(false)
    })
  }, [user?.id])

  if (loading) return null

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate('/feed/highlights') }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 16px', borderRadius: 16, marginBottom: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--elev-raise-sm)',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Camera size={17} style={{ color: 'var(--accent)' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
          Highlights
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {highlights.length === 0
            ? 'No highlights yet — be the first to share a win'
            : highlights.slice(0, 3).map(h => {
                const meta = h.game_key ? getGameMeta(h.game_key) : undefined
                return meta?.name ?? 'Achievement'
              }).join(' · ')}
        </div>
      </div>

      {/* Stacked mini avatars/icons for recent highlighters */}
      {highlights.length > 0 && (
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {highlights.slice(0, 3).map((h, i) => {
            const meta = h.game_key ? getGameMeta(h.game_key) : undefined
            const Icon = meta?.icon ?? Trophy
            return (
              <div key={h.id} style={{
                width: 26, height: 26, borderRadius: 8, marginLeft: i > 0 ? -8 : 0,
                background: `${meta?.accent ?? '#f5c542'}25`, border: '2px solid var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={12} style={{ color: meta?.accent ?? '#f5c542' }} />
              </div>
            )
          })}
        </div>
      )}

      <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  )
}
