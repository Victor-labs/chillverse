// src/features/missions/useWeeklyMissions.ts
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/useAuth'
import { getWeeklyMissions, getTimeUntilReset } from './weeklyMissions'
import type { MissionWithProgress } from './weeklyMissions'

interface WeeklyMissionsState {
  missions: MissionWithProgress[]
  loading: boolean
  weekProgress: number
  totalXpEarned: number
  totalDiamondsEarned: number
  boostersEarned: number
  countdown: { days: number; hours: number; minutes: number }
  refresh: () => void
}

export function useWeeklyMissions(): WeeklyMissionsState {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [missions, setMissions] = useState<MissionWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [totalXpEarned, setTotalXpEarned] = useState(0)
  const [totalDiamondsEarned, setTotalDiamondsEarned] = useState(0)
  const [boostersEarned, setBoostersEarned] = useState(0)
  const [countdown, setCountdown] = useState(getTimeUntilReset())

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { missions: result, row } = await getWeeklyMissions()
      setMissions(result)
      // Totals come from the authoritative server-tracked row, not a
      // client-side recomputation from the completed set.
      setTotalXpEarned(row?.total_xp_earned ?? 0)
      setTotalDiamondsEarned(row?.total_diamonds_earned ?? 0)
      setBoostersEarned(row?.boosters_earned ?? 0)
    } catch (err) {
      console.error('[useWeeklyMissions] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  // Countdown ticker — updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilReset())
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const weekProgress = missions.filter(m => m.is_completed).length

  return {
    missions,
    loading,
    weekProgress,
    totalXpEarned,
    totalDiamondsEarned,
    boostersEarned,
    countdown,
    refresh: load,
  }
}
