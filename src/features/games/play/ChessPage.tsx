// src/features/games/play/ChessPage.tsx
// Thin host for ChillverseChess when launched from Multiplayer's "Vs AI"
// section — supplies the rank/onEnd/onBack props the game component
// expects, checks the daily hub-XP cap before letting play start, and
// awards the flat win bonus (capped) on completion.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import ChillverseChess from './ChillverseChess'
import HubXpLockScreen from './HubXpLockScreen'
import { getHubXpStatus, awardHubXp } from './hubXp'
import type { GameEndPayload } from './types'

const WIN_XP = 18

export default function ChessPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!userId) { setChecking(false); return }
    getHubXpStatus(userId).then(status => {
      setLocked(status.capReached)
      setChecking(false)
    })
  }, [userId])

  async function handleEnd(payload: GameEndPayload) {
    if (userId && payload.score > 0) {
      const result = await awardHubXp(userId, WIN_XP)
      if (result.capReached) setLocked(true)
    }
  }

  if (checking) return null
  if (locked) return <HubXpLockScreen gameName="Chess" />

  return (
    <ChillverseChess
      rank="beginner"
      onEnd={handleEnd}
      onBack={() => navigate('/multiplayer')}
    />
  )
}
