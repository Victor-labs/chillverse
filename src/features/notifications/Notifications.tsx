// src/pages/Notifications.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, ArrowLeft, Trophy, Flame, TrendingUp, MessageCircle,
  UserPlus, Zap, Star, Shield, Sparkles, Target, Award, Crown,
  CheckCircle, Sword, Rocket, Gem, Users, Heart, Mail, Sprout,
  User, Moon, Calendar, Activity, Flag, Plus, ArrowRight, Grid,
  Search, Gamepad2, Home, Lock, BarChart2, Layers, Brain, Eye,
  Trash2, Spade, Image, Wifi, CirclePlay,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getNotifications, markNotificationsRead } from '../achievements/achievements'
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
  'spade': Spade, 'image': Image, 'wifi': Wifi, 'circle-play': CirclePlay,
}

function NotifIcon({ iconKey, size = 16 }: { iconKey: string; size?: number }) {
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

const TYPE_LABEL: Record<string, string> = {
  achievement: 'Achievement',
  follow:      'Social',
  message:     'Message',
  level_up:    'Level Up',
  rank_up:     'Rank',
  streak:      'Streak',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const FILTERS = ['All', 'Achievement', 'Social', 'Message', 'Level Up', 'Rank', 'Streak']

export default function Notifications() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getNotifications(userId).then(data => {
      const notifs = data as Notification[]
      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read).length)
      setLoading(false)
      // Mark all read
      markNotificationsRead(userId)
    })
  }, [userId])

  // Real-time new notifications
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`notif-page:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  async function clearAll() {
    if (!userId) return
    await supabase.from('notifications').delete().eq('user_id', userId)
    setNotifications([])
  }

  async function deleteOne(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const filtered = activeFilter === 'All'
    ? notifications
    : notifications.filter(n => (TYPE_LABEL[n.type] ?? n.type) === activeFilter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Notifications</div>
            {unreadCount > 0 && <div style={{ fontSize: 11, color: 'var(--accent)' }}>{unreadCount} unread</div>}
          </div>
        </div>
        {notifications.length > 0 && (
          <button type="button" onClick={clearAll}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 0', scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f} type="button" onClick={() => setActiveFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', flexShrink: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeFilter === f ? 'var(--accent)' : 'var(--surface)', color: activeFilter === f ? '#fff' : 'var(--text-dim)', boxShadow: activeFilter === f ? '0 4px 12px rgba(255,107,0,0.3)' : '2px 2px 6px var(--neu-dark)', transition: 'all 0.15s' }}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'block', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 12 }}>
            <Bell size={40} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>No notifications here</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Play games, follow players, and level up to earn notifications.</p>
          </div>
        ) : (
          filtered.map(n => {
            const color = TYPE_COLOR[n.type] ?? '#888899'
            const iconKey = n.icon && n.icon !== 'bell' ? n.icon : (TYPE_ICON[n.type] ?? 'bell')
            const label = TYPE_LABEL[n.type] ?? n.type
            return (
              <div key={n.id}
                style={{ display: 'flex', gap: 12, padding: '14px 16px', background: !n.read ? `${color}08` : 'var(--surface)', border: !n.read ? `1px solid ${color}22` : '1px solid rgba(255,255,255,0.04)', borderRadius: 16, boxShadow: '2px 2px 8px var(--neu-dark)', transition: 'all 0.15s', position: 'relative' }}>

                {/* Icon */}
                <div style={{ width: 42, height: 42, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
                  <NotifIcon iconKey={iconKey} size={18} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{n.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: `${color}20`, color, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 4 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, alignSelf: 'center' }} />
                )}

                {/* Delete */}
                <button type="button" onClick={() => deleteOne(n.id)}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5, padding: 4 }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ff6b6b' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
