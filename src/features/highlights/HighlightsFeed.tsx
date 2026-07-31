// src/features/highlights/HighlightsFeed.tsx
//
// The actual highlights list — loading / empty / populated states. Rendered
// inline as the "Highlights" tab of the unified Community page
// (src/features/posts/FeedPage.tsx), alongside the Feed and Announcements
// tabs. Has no page-level header of its own; FeedPage owns that.

import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { fetchHighlights } from './highlights'
import { updateMissionProgress } from '../missions/weeklyMissions'
import HighlightCard from './HighlightCard'
import type { Highlight } from './types'

export default function HighlightsFeed() {
  const { user } = useAuth()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHighlights(user?.id ?? null).then(rows => {
      setHighlights(rows)
      setLoading(false)
      if (user) updateMissionProgress(user.id, 'highlights_viewed', 1).catch(console.error)
    })
  }, [user?.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
  )
}
