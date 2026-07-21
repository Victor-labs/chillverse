// src/shared/lib/featureFlags.ts
// Client-side enforcement side of the admin feature-flags system
// (migration 0056). Any screen that should respect a kill-switch — a
// game's play screen, an exploration map's entry point — calls
// useFeatureFlags() and checks the relevant key. feature_flags is
// publicly readable (see adminOps.ts), so this works for every signed-in
// user, not just staff.
import { useEffect, useState } from 'react'
import { fetchFeatureFlags, type FeatureFlag } from '../../features/admin/adminOps'

export type FeatureFlagMap = Record<string, boolean>

/** Fetches all flags once per mount and exposes them as a key→enabled map.
 *  Defaults every flag to `true` (enabled) while loading and for any key
 *  that isn't in the table at all, so a fetch hiccup or a not-yet-seeded
 *  flag never accidentally locks players out of something. */
export function useFeatureFlags(): { flags: FeatureFlagMap; loading: boolean; isEnabled: (key: string) => boolean } {
  const [flags, setFlags] = useState<FeatureFlagMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchFeatureFlags().then(({ data }) => {
      if (!active) return
      const map: FeatureFlagMap = {}
      for (const f of data as FeatureFlag[]) map[f.key] = f.enabled
      setFlags(map)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  function isEnabled(key: string): boolean {
    return flags[key] ?? true
  }

  return { flags, loading, isEnabled }
}
