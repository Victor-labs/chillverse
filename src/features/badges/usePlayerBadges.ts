// src/features/badges/usePlayerBadges.ts
import { useEffect, useState } from 'react'
import { getAllBadges, getPlayerBadges, type BadgeDef, type PlayerBadge } from './badges'

// Shared loader used by both Profile.tsx (own profile) and
// PlayerProfile.tsx (viewing someone else) — fetches the badge catalog
// once and that player's unlocked badges.
export function usePlayerBadges(userId: string | null | undefined) {
  const [badges, setBadges] = useState<PlayerBadge[]>([])
  const [defs, setDefs] = useState<BadgeDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    Promise.all([getAllBadges(), getPlayerBadges(userId)]).then(([allDefs, playerBadges]) => {
      setDefs(allDefs)
      setBadges(playerBadges)
      setLoading(false)
    })
  }, [userId])

  return { badges, defs, loading }
}
