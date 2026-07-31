// src/features/chat/FriendsPanel.tsx
//
// Discord-style "Friends" slide-over: a tap target opens this panel, which
// shows the people you already have an open DM thread with (either of you
// messaged first — this is NOT the follow list), with a search bar to
// filter them. A "New Chat" mode searches all Chillverse players by
// username so you can start a conversation with someone new. Tapping any
// row jumps straight into that DM — Chat.tsx (mounted under the Chats tab)
// watches for `state: { openRoomId }` and opens it once its room list has
// loaded, same handoff IconRail's group-chat icons use.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Search, MessageCirclePlus, Users } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useOnlineUserIds } from '../../context/OnlinePresence'
import { searchPlayers, type PlayerResult } from '../search/search'
import SharedAvatar from '../../shared/components/Avatar'

interface FriendRow {
  id: string
  roomId: string
  username: string
  display_name: string | null
  avatar: string | null
}

export default function FriendsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null
  const navigate = useNavigate()
  const onlineUserIds = useOnlineUserIds()

  const [mode, setMode] = useState<'friends' | 'find'>('friends')
  const [friends, setFriends] = useState<FriendRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [findResults, setFindResults] = useState<PlayerResult[]>([])
  const [findLoading, setFindLoading] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)

  // "Friends" = people I have a non-hidden DM thread with. Deliberately not
  // the `follows` table — this list is about who you already talk to.
  const loadFriends = useCallback(async () => {
    if (!myId) return
    const { data: memberRows } = await supabase
      .from('room_members')
      .select('room_id, hidden_at, chat_rooms!inner(type)')
      .eq('user_id', myId)
      .eq('chat_rooms.type', 'dm')
    const roomIds = (memberRows ?? []).filter(r => !r.hidden_at).map(r => r.room_id)
    if (!roomIds.length) { setFriends([]); return }

    const [{ data: otherMembers }, { data: blockedByMe }, { data: blockedMe }] = await Promise.all([
      supabase
        .from('room_members')
        .select('room_id, user_id, profiles(username, display_name, avatar)')
        .in('room_id', roomIds)
        .neq('user_id', myId),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', myId),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', myId),
    ])
    const hidden = new Set([
      ...(blockedByMe ?? []).map(b => b.blocked_id),
      ...(blockedMe ?? []).map(b => b.blocker_id),
    ])

    const rows: FriendRow[] = (otherMembers ?? [])
      .filter((m: any) => !hidden.has(m.user_id))
      .map((m: any) => ({
        id: m.user_id,
        roomId: m.room_id,
        username: m.profiles?.username ?? '?',
        display_name: m.profiles?.display_name ?? null,
        avatar: m.profiles?.avatar ?? null,
      }))
    setFriends(rows)
  }, [myId])

  useEffect(() => {
    if (!open) return
    setMode('friends')
    setQuery('')
    loadFriends()
  }, [open, loadFriends])

  // Live search against all players once in "New Chat" mode.
  useEffect(() => {
    if (mode !== 'find') return
    const q = query.trim()
    if (q.length < 2) { setFindResults([]); return }
    let cancelled = false
    setFindLoading(true)
    const t = setTimeout(async () => {
      const results = await searchPlayers(q)
      if (!cancelled) { setFindResults(results.filter(r => r.id !== myId)); setFindLoading(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, mode, myId])

  function openDm(roomId: string) {
    onClose()
    navigate('/chat?tab=chats', { state: { openRoomId: roomId } })
  }

  async function startDm(targetUserId: string) {
    if (!myId || startingId) return
    setStartingId(targetUserId)
    try {
      const { data: roomId, error } = await supabase.rpc('get_or_create_dm_room', { p_other_user_id: targetUserId })
      if (error || !roomId) { console.error('Failed to start DM:', error?.message); return }
      openDm(roomId as string)
    } finally {
      setStartingId(null)
    }
  }

  if (!open) return null

  const filteredFriends = (friends ?? []).filter(f => {
    if (!query.trim()) return true
    const label = (f.display_name || f.username).toLowerCase()
    return label.includes(query.trim().toLowerCase())
  })

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', justifyContent:'flex-end', background:'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'min(380px, 100vw)', height:'100%', background:'var(--bg)', display:'flex', flexDirection:'column',
          borderLeft:'1px solid var(--border)', boxShadow:'-8px 0 24px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 10px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Users size={18} style={{ color:'var(--accent)' }} />
            <span style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>Friends</span>
          </div>
          <button type="button" onClick={onClose} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', cursor:'pointer' }}>
            <X size={15} />
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:8, padding:'0 16px 12px', flexShrink:0 }}>
          <button type="button" onClick={() => setMode('friends')}
            style={{
              flex:1, padding:'8px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
              background: mode === 'friends' ? 'var(--accent)' : 'var(--surface)',
              color: mode === 'friends' ? '#fff' : 'var(--text-dim)',
              border: mode === 'friends' ? 'none' : '1px solid var(--border)',
            }}>
            My Friends
          </button>
          <button type="button" onClick={() => setMode('find')}
            style={{
              flex:1, padding:'8px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background: mode === 'find' ? 'var(--accent)' : 'var(--surface)',
              color: mode === 'find' ? '#fff' : 'var(--text-dim)',
              border: mode === 'find' ? 'none' : '1px solid var(--border)',
            }}>
            <MessageCirclePlus size={13} /> New Chat
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding:'0 16px 12px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'9px 12px' }}>
            <Search size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={mode === 'friends' ? 'Search your friends…' : 'Search players by username…'}
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 8px 16px' }}>
          {mode === 'friends' ? (
            friends === null ? (
              <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
            ) : filteredFriends.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'40px 20px', textAlign:'center' }}>
                <Users size={36} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:13, fontWeight:600, color:'var(--text-dim)' }}>
                  {query ? 'No friends match your search.' : "You don't have any DMs yet."}
                </p>
                {!query && (
                  <button type="button" onClick={() => setMode('find')} style={{ marginTop:4, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    Find someone to message
                  </button>
                )}
              </div>
            ) : (
              filteredFriends.map(f => (
                <FriendRowItem
                  key={f.id}
                  name={f.display_name || f.username}
                  avatar={f.avatar}
                  online={onlineUserIds.has(f.id)}
                  onClick={() => openDm(f.roomId)}
                />
              ))
            )
          ) : (
            <>
              {findLoading && <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Searching…</div>}
              {!findLoading && query.trim().length >= 2 && findResults.length === 0 && (
                <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No players found.</div>
              )}
              {!findLoading && query.trim().length < 2 && (
                <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Type at least 2 characters to search players.</div>
              )}
              {findResults.map(p => (
                <FriendRowItem
                  key={p.id}
                  name={p.display_name || p.username}
                  avatar={p.avatar}
                  online={onlineUserIds.has(p.id)}
                  onClick={() => startDm(p.id)}
                  action={
                    <button type="button" onClick={(e) => { e.stopPropagation(); startDm(p.id) }} disabled={startingId === p.id}
                      style={{
                        background:'var(--accent)', border:'none', color:'#fff', borderRadius:8, padding:'5px 10px',
                        fontSize:11, fontWeight:700, cursor:'pointer', opacity: startingId === p.id ? 0.7 : 1,
                      }}>
                      {startingId === p.id ? '…' : 'Message'}
                    </button>
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FriendRowItem({ name, avatar, online, onClick, action }: {
  name: string; avatar: string | null; online: boolean; onClick: () => void; action?: React.ReactNode
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 8px', borderRadius:10, cursor:'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <SharedAvatar name={name} src={avatar} size={38} />
        {online && (
          <span style={{ position:'absolute', right:-1, bottom:-1, width:10, height:10, borderRadius:'50%', background:'#3ecf8e', border:'2px solid var(--bg)' }} />
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        <div style={{ fontSize:11, color: online ? '#3ecf8e' : 'var(--text-muted)', fontWeight:600 }}>{online ? 'Online' : 'Offline'}</div>
      </div>
      {action}
    </div>
  )
}
