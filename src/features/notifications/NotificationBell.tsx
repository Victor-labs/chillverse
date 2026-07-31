// src/components/NotificationBell.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getUnreadCount } from '../achievements/achievements'

export default function NotificationBell() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const navigate = useNavigate()

  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!userId) return
    getUnreadCount(userId).then(setUnread)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`notif:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        setUnread(c => c + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  function handleClick() {
    navigate('/notifications')
  }

  return (
    <button type="button" onClick={handleClick} title="Notifications"
      style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface)', boxShadow: 'var(--elev-raise-sm)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Bell size={16} />
      {unread > 0 && (
        <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)' }} />
      )}
    </button>
  )
}
