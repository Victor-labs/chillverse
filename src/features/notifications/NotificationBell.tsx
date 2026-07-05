// src/components/NotificationBell.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, Trophy, Flame, TrendingUp, MessageCircle, UserPlus, Zap,
  Star, Shield, Sparkles, Target, Award, Crown, CheckCircle,
  Sword, Rocket, Gem, Users, Heart, Mail, Sprout, User,
  Moon, Calendar, Activity, Flag, Plus, ArrowRight, Grid, Search,
  Gamepad2, Home, Lock, BarChart2, Layers, Brain, Eye, ChevronRight,
  Spade, Image, Wifi, CirclePlay, Camera,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getNotifications, markNotificationsRead, getUnreadCount } from '../achievements/achievements'
import type React from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>

const ICON_MAP: Record<string, LucideIcon> = {
  'bell': Bell, 'trophy': Trophy, 'flame': Flame, 'trending-up': TrendingUp,
  'message-circle': MessageCircle, 'user-plus': UserPlus, 'zap': Zap,
  'star': Star, 'shield': Shield, 'sparkles': Sparkles, 'target': Target,
  'award': Award, 'crown': Crown, 'check-circle': CheckCircle, 'sword': Sword,
  'rocket': Rocket, 'gem': Gem, 'diamond': Gem, 'users': Users,
  'heart': Heart, 'mail': Mail, 'sprout': Sprout, 'user': User,
  'moon': Moon, 'calendar': Calendar, 'activity': Activity, 'flag': Flag,
  'plus': Plus, 'arrow-right': ArrowRight, 'grid': Grid, 'search': Search,
  'gamepad-2': Gamepad2, 'home': Home, 'lock': Lock, 'bar-chart': BarChart2,
  'layers': Layers, 'brain': Brain, 'eye': Eye, 'settings': Sparkles,
  'spade': Spade, 'image': Image, 'wifi': Wifi, 'circle-play': CirclePlay, 'camera': Camera,
}

function NotifIcon({ iconKey, size = 15 }: { iconKey: string; size?: number }) {
  const Icon = ICON_MAP[iconKey] ?? Bell
  return <Icon size={size} />
}

interface Notification {
  id: string
  type: string
  title: string
  body: string
  icon: string
  read: boolean
  created_at: string
  meta: Record<string, unknown>
}

const TYPE_COLOR: Record<string, string> = {
  achievement: '#f5c542',
  follow:      '#3ecf8e',
  message:     '#4f8ef7',
  level_up:    '#9b6dff',
  rank_up:     '#ff6b00',
  streak:      '#ff4d8b',
}

const TYPE_ICON: Record<string, string> = {
  achievement: 'trophy',
  follow:      'user-plus',
  message:     'message-circle',
  level_up:    'trending-up',
  rank_up:     'zap',
  streak:      'flame',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export default function NotificationBell() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
      }, (payload) => {
        const n = payload.new as Notification
        setNotifications(prev => [n, ...prev])
        setUnread(c => c + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  async function handleOpen() {
    setOpen(v => !v)
    if (!open && userId) {
      setLoading(true)
      const data = await getNotifications(userId)
      setNotifications((data as Notification[]).slice(0, 5))
      setLoading(false)
      if (unread > 0) {
        await markNotificationsRead(userId)
        setUnread(0)
      }
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={handleOpen}
        style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Bell size={16} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#ff6b00', border: '2px solid var(--bg)' }} />
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 320, maxWidth: 'calc(100vw - 24px)', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 300, overflow: 'hidden' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <Bell size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const color = TYPE_COLOR[n.type] ?? '#888899'
                const iconKey = n.icon && n.icon !== 'bell' ? n.icon : (TYPE_ICON[n.type] ?? 'bell')
                return (
                  <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: !n.read ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
                      <NotifIcon iconKey={iconKey} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.body}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* View All button */}
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/notifications') }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
          >
            View All Notifications <ChevronRight size={14} />
          </button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
