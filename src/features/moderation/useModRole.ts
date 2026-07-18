// src/features/moderation/useModRole.ts
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getMyModerationStatus, type StaffRole } from './moderation'

interface ModRoleState {
  role: StaffRole
  isStaff: boolean
  isAdmin: boolean
  isModOrAdmin: boolean
  isVerified: boolean
  /** Staff/Moderator/Admin or Verified — the only roles allowed to create a poll. */
  canCreatePoll: boolean
  loading: boolean
}

/** Reads the signed-in user's moderator/admin role. Defaults to 'user' while loading or if no session. */
export function useModRole(): ModRoleState {
  const { user } = useAuth()
  const [role, setRole] = useState<StaffRole>('user')
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole('user')
      setIsVerified(false)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    getMyModerationStatus(user.id)
      .then(status => { if (active) { setRole(status.role); setIsVerified(status.isVerified) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  const isStaff = role === 'staff' || role === 'moderator' || role === 'admin'
  return {
    role,
    isStaff,
    isAdmin: role === 'admin',
    isModOrAdmin: role === 'moderator' || role === 'admin',
    isVerified,
    canCreatePoll: isStaff || isVerified,
    loading,
  }
}
