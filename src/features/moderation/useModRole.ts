// src/features/moderation/useModRole.ts
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getMyModerationStatus, type StaffRole } from './moderation'

interface ModRoleState {
  role: StaffRole
  isStaff: boolean
  isAdmin: boolean
  loading: boolean
}

/** Reads the signed-in user's moderator/admin role. Defaults to 'user' while loading or if no session. */
export function useModRole(): ModRoleState {
  const { user } = useAuth()
  const [role, setRole] = useState<StaffRole>('user')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole('user')
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    getMyModerationStatus(user.id)
      .then(status => { if (active) setRole(status.role) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  return { role, isStaff: role === 'moderator' || role === 'admin', isAdmin: role === 'admin', loading }
}
