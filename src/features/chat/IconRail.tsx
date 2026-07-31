// src/features/chat/IconRail.tsx
//
// The primary navigation for the Chat hub now — a Discord-style vertical
// icon strip. Top section is fixed nav: Friends (opens the friends/DM
// slide-over), Global, Chats ("all my chats" — the Messages list), and
// Clubs (browse/manage all your clubs). Below a divider: one icon per
// group chat and one per club you've joined, for one-tap access — exactly
// like Discord's server list. Tapping a group/club icon jumps straight
// into that room without going through its list first.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Globe, MessageSquare, Compass } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { getUnreadCounts } from '../../shared/lib/unread'
import { fetchMyClubs, type MyClub } from '../clubs/clubs'
import ClubIcon from '../clubs/clubIcons'
import SharedAvatar from '../../shared/components/Avatar'
import FriendsPanel from './FriendsPanel'
import type { HubTab } from './ChatHub'

interface GroupChatRow {
  id: string
  name: string | null
}

interface IconRailProps {
  active: HubTab
  badges: Record<HubTab, number>
}

export default function IconRail({ active, badges }: IconRailProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<MyClub[]>([])
  const [groups, setGroups] = useState<GroupChatRow[]>([])
  const [unread, setUnread] = useState<Map<string, number>>(new Map())
  const [friendsOpen, setFriendsOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const [myClubs, { data: memberRooms }] = await Promise.all([
      fetchMyClubs(user.id),
      supabase.from('room_members').select('chat_rooms!inner(id, name, type)').eq('user_id', user.id),
    ])
    setClubs(myClubs)

    const groupRooms: GroupChatRow[] = (memberRooms ?? [])
      .map((r: any) => r.chat_rooms)
      .filter((r: any) => r?.type === 'group')
      .map((r: any) => ({ id: r.id, name: r.name }))
    setGroups(groupRooms)

    const ids = [...myClubs.map(c => c.id), ...groupRooms.map(g => g.id)]
    if (ids.length) setUnread(await getUnreadCounts(supabase, ids, user.id))
  }, [user])

  useEffect(() => {
    load()
    if (!user) return
    // Cheap catch-all refresh — new message anywhere, or membership change
    // (joined/left a club or group) — same pattern as ChatHub's badges.
    const ch = supabase
      .channel('icon-rail')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user])

  function openGroup(id: string) {
    // Chat.tsx (mounted under the Chats screen) watches location.state.openRoomId
    // and jumps straight into that room once its room list has loaded. Using
    // ?tab=chats also flips ChatHub's active screen if we're on Global/Clubs.
    navigate('/chat?tab=chats', { state: { openRoomId: id } })
  }

  return (
    <>
      <div
        style={{
          width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10, padding: '10px 0 16px', overflowY: 'auto',
          borderRight: '1px solid var(--border)',
        }}
      >
        <RailIcon label="Friends" onClick={() => setFriendsOpen(true)}>
          <Users size={20} />
        </RailIcon>

        <div style={{ width: 32, height: 2, borderRadius: 1, background: 'var(--border)', flexShrink: 0 }} />

        <RailIcon label="Global" active={active === 'global'} unread={badges.global} onClick={() => navigate('/chat?tab=global')}>
          <Globe size={20} />
        </RailIcon>
        <RailIcon label="Chats" active={active === 'chats'} unread={badges.chats} onClick={() => navigate('/chat?tab=chats')}>
          <MessageSquare size={20} />
        </RailIcon>
        <RailIcon label="Clubs" active={active === 'clubs'} unread={badges.clubs} onClick={() => navigate('/chat?tab=clubs')}>
          <Compass size={20} />
        </RailIcon>

        {(groups.length > 0 || clubs.length > 0) && (
          <div style={{ width: 32, height: 2, borderRadius: 1, background: 'var(--border)', flexShrink: 0 }} />
        )}

        {groups.map(g => (
          <RailIcon key={g.id} label={g.name || 'Group chat'} unread={unread.get(g.id)} onClick={() => openGroup(g.id)}>
            <SharedAvatar name={g.name || 'Group'} size={44} radius={16} />
          </RailIcon>
        ))}

        {clubs.map(c => (
          <RailIcon key={c.id} label={c.name} unread={unread.get(c.id)} onClick={() => navigate(`/clubs/${c.id}`)}>
            <div style={{
              width: 44, height: 44, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), #7c5cff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <ClubIcon iconKey={c.icon_key} size={22} />
            </div>
          </RailIcon>
        ))}
      </div>

      <FriendsPanel open={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  )
}

function RailIcon({ children, label, onClick, unread, active }: {
  children: React.ReactNode
  label: string
  onClick: () => void
  unread?: number
  active?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', width: 48, height: 48, flexShrink: 0,
        borderRadius: hover || active ? 14 : 16, border: 'none',
        background: active ? 'var(--accent)' : 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: active ? '#fff' : 'var(--text-dim)',
        transition: 'border-radius 0.15s ease, background 0.15s ease, color 0.15s ease',
        padding: 0, overflow: 'hidden',
      }}
    >
      {children}
      {!!unread && (
        <span style={{
          position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
          background: active ? '#fff' : 'var(--accent)', color: active ? 'var(--accent)' : '#fff',
          fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', border: '2px solid var(--bg)',
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
