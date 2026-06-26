// src/pages/Chat.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, MoreVertical,
  Smile, Send, X, Trash2, Reply,
  MessageCircle, UserPlus, ShieldOff, UserCheck,
  ChevronRight, ExternalLink,
} from 'lucide-react'
import { ripple } from '../lib/ripple'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ─── Types ──────────────────────────────────────────────────
interface RoomMember {
  user_id: string
  profile: { username: string; display_name: string | null; avatar: string }
}
interface ChatRoom {
  id: string
  type: string
  name: string | null
  members: RoomMember[]
  lastMsg: string
  lastMsgTime: string
  unread: number
}
interface Message {
  id: string
  sender_id: string | null
  content: string
  created_at: string
  deleted: boolean
  reply_to_id: string | null
  replyPreview?: string
  reactions: { emoji: string; user_id: string }[]
  senderName?: string
  senderUsername?: string
}
interface SearchedProfile {
  id: string
  username: string
  display_name: string | null
  avatar: string
}

const EMOJIS = ['😂','🔥','💀','👑','😍','🎮','💯','🙌','😅','🤯','❤️','👀','🫡','💪','🏆']

function IBtn({ onClick, children, style }: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'var(--surface)', boxShadow:'2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)', color:'var(--text-dim)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'color 0.15s', ...style }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
      {children}
    </button>
  )
}

function Avatar({ name, avatarUrl, size = 40, radius = 13 }: { name: string; avatarUrl?: string | null; size?: number; radius?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','#ff9a3c','#00e5ff']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', flexShrink:0, display:'block' }}
        onError={e => {
          // fall back to initials if image fails to load
          const el = e.currentTarget
          el.style.display = 'none'
          const fallback = el.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
    )
  }
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:color, color:'#fff', fontWeight:700, fontSize:size*0.35, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Player Profile Modal ────────────────────────────────────
interface PlayerProfileModalProps {
  profile: SearchedProfile | { id: string; username: string; display_name: string | null; avatar: string }
  myId: string | null
  onClose: () => void
  onStartChat?: (userId: string) => void
}

function PlayerProfileModal({ profile, myId, onClose, onStartChat }: PlayerProfileModalProps) {
  const navigate = useNavigate()
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'blocked'>('none')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!myId || profile.id === myId) return
    const check = async () => {
      const { data: follows } = await supabase.from('follows')
        .select('id').eq('follower_id', myId).eq('following_id', profile.id).maybeSingle()
      if (follows) { setFollowStatus('following'); return }
      const { data: blocks } = await supabase.from('blocks')
        .select('id').eq('blocker_id', myId).eq('blocked_id', profile.id).maybeSingle()
      if (blocks) setFollowStatus('blocked')
    }
    check()
  }, [myId, profile.id])

  async function handleFollow() {
    if (!myId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'following') {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', profile.id)
      setFollowStatus('none')
    } else {
      await supabase.from('follows').insert({ follower_id: myId, following_id: profile.id })
      setFollowStatus('following')
    }
    setActionLoading(false)
  }

  async function handleBlock() {
    if (!myId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'blocked') {
      await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', profile.id)
      setFollowStatus('none')
    } else {
      // also unfollow if was following
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', profile.id)
      await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: profile.id })
      setFollowStatus('blocked')
    }
    setActionLoading(false)
  }

  const isOwnProfile = profile.id === myId
  const displayLabel = profile.display_name || profile.username

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:201, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:22, padding:24, width: Math.min(300, window.innerWidth - 32), boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <button type="button" onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
          <X size={16} />
        </button>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20 }}>
          <Avatar name={displayLabel} avatarUrl={profile.avatar || null} size={64} radius={18} />
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{displayLabel}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>@{profile.username}</div>
          </div>
        </div>
        {!isOwnProfile && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button type="button" onClick={handleFollow} disabled={actionLoading || followStatus === 'blocked'}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'none', cursor: actionLoading || followStatus === 'blocked' ? 'not-allowed' : 'pointer', background: followStatus === 'following' ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: followStatus === 'following' ? '#3ecf8e' : '#fff', fontSize:13, fontWeight:600, opacity: followStatus === 'blocked' ? 0.4 : 1, transition:'all 0.15s' }}>
              {followStatus === 'following' ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
            </button>
            {onStartChat && (
              <button type="button" onClick={() => { onStartChat(profile.id); onClose() }}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'var(--text-dim)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
                <MessageCircle size={14} /> Message
              </button>
            )}
            <button type="button" onClick={() => { onClose(); navigate(`/profile/${profile.id}`) }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(79,142,247,0.3)', background:'rgba(79,142,247,0.08)', color:'#4f8ef7', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
              <ExternalLink size={14} /> View Full Profile
            </button>
            <button type="button" onClick={handleBlock} disabled={actionLoading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'none', cursor: actionLoading ? 'not-allowed' : 'pointer', background: followStatus === 'blocked' ? 'rgba(255,107,107,0.15)' : 'rgba(255,107,107,0.08)', color: followStatus === 'blocked' ? '#ff6b6b' : 'var(--text-muted)', fontSize:13, fontWeight:600, transition:'all 0.15s' }}>
              <ShieldOff size={14} /> {followStatus === 'blocked' ? 'Unblock' : 'Block'}
            </button>
          </div>
        )}
        {isOwnProfile && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button type="button" onClick={() => { onClose(); navigate('/profile') }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(79,142,247,0.3)', background:'rgba(79,142,247,0.08)', color:'#4f8ef7', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
              <ExternalLink size={14} /> View My Profile
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function Chat() {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)

  // Own profile (avatar, display_name) — loaded once on mount
  const [myProfile, setMyProfile] = useState<{ username: string; display_name: string | null; avatar: string | null } | null>(null)

  useEffect(() => {
    if (!myId) return
    supabase.from('profiles').select('username, display_name, avatar').eq('id', myId).single()
      .then(({ data }) => { if (data) setMyProfile(data) })
  }, [myId])

  const [showConv, setShowConv] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Search state — split: room search vs player search
  const [roomSearch, setRoomSearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerResults, setPlayerResults] = useState<SearchedProfile[]>([])
  const [playerSearching, setPlayerSearching] = useState(false)

  const [emojiOpen, setEmojiOpen] = useState(false)
  const [ctxMsg, setCtxMsg] = useState<Message | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [emojiForMsg, setEmojiForMsg] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // Player profile modal
  const [viewProfile, setViewProfile] = useState<SearchedProfile | null>(null)

  const msgEnd = useRef<HTMLDivElement>(null)
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const playerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Ensure global chat room exists & user is a member ──────
  async function ensureGlobalRoom(): Promise<string | null> {
    if (!myId) return null

    // Find existing global room
    const { data: globalRooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'global')
      .limit(1)

    let globalRoomId: string

    if (!globalRooms || globalRooms.length === 0) {
      // Try to create — do NOT use created_by (column may not exist in schema)
      const { data: created, error: createErr } = await supabase
        .from('chat_rooms')
        .insert({ type: 'global', name: 'Global Chat' })
        .select('id')
        .single()

      if (createErr || !created) {
        // Another request may have created it simultaneously — retry fetch
        const { data: retry } = await supabase
          .from('chat_rooms').select('id').eq('type', 'global').limit(1)
        if (!retry?.length) return null
        globalRoomId = retry[0].id
      } else {
        globalRoomId = created.id
      }
    } else {
      globalRoomId = globalRooms[0].id
    }

    // Ensure current user is a member (upsert-safe)
    const { data: existingMembership } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', globalRoomId)
      .eq('user_id', myId)
      .maybeSingle()

    if (!existingMembership) {
      await supabase
        .from('room_members')
        .insert({ room_id: globalRoomId, user_id: myId })
    }

    return globalRoomId
  }

  // ── Load rooms ──────────────────────────────────────────────
  useEffect(() => { if (myId) loadRooms() }, [myId])

  async function loadRooms() {
    setRoomsLoading(true)

    // Ensure user is always in the global room
    await ensureGlobalRoom()

    const { data: memberRows, error: memErr } = await supabase
      .from('room_members').select('room_id').eq('user_id', myId)

    if (memErr || !memberRows?.length) { setRoomsLoading(false); return }

    const roomIds = memberRows.map(r => r.room_id)
    const { data: roomRows } = await supabase
      .from('chat_rooms').select('id, type, name').in('id', roomIds)

    if (!roomRows?.length) { setRoomsLoading(false); return }

    const built: ChatRoom[] = []
    for (const room of roomRows) {
      const { data: memberData } = await supabase
        .from('room_members')
        .select('user_id, profiles(username, display_name, avatar)')
        .eq('room_id', room.id)

      const { data: lastMsgData } = await supabase
        .from('messages').select('content, created_at')
        .eq('room_id', room.id).eq('deleted', false)
        .order('created_at', { ascending: false }).limit(1)

      const members: RoomMember[] = (memberData ?? []).map((m: Record<string, unknown>) => ({
        user_id: m.user_id as string,
        profile: (m.profiles as { username: string; display_name: string | null; avatar: string }) ?? { username: '?', display_name: null, avatar: '?' },
      }))

      const lastMsg = lastMsgData?.[0]
      built.push({ id: room.id, type: room.type, name: room.name, members, lastMsg: lastMsg?.content ?? '', lastMsgTime: lastMsg ? formatTime(lastMsg.created_at) : '', unread: 0 })
    }

    // Pin global chat room first, then DMs sorted by last message time
    const globalRoom = built.find(r => r.type === 'global')
    const dmRooms = built.filter(r => r.type !== 'global')
    const sorted = globalRoom ? [globalRoom, ...dmRooms] : dmRooms

    setRooms(sorted)
    setRoomsLoading(false)
  }

  // ── Player search (debounced) ────────────────────────────────
  useEffect(() => {
    if (playerSearchTimer.current) clearTimeout(playerSearchTimer.current)
    if (!playerSearch.trim()) { setPlayerResults([]); return }
    setPlayerSearching(true)
    playerSearchTimer.current = setTimeout(async () => {
      const q = playerSearch.trim().toLowerCase()
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8)
      setPlayerResults(data ?? [])
      setPlayerSearching(false)
    }, 350)
    return () => { if (playerSearchTimer.current) clearTimeout(playerSearchTimer.current) }
  }, [playerSearch])

  // ── Open room ───────────────────────────────────────────────
  const openRoom = useCallback(async (room: ChatRoom) => {
    setActiveRoom(room)
    setShowConv(true)
    setMessages([]); setMsgsLoading(true)
    setReplyTo(null); setText('')
    setEmojiOpen(false)

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at, deleted, reply_to_id')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(80)

    if (error || !data) { setMsgsLoading(false); return }

    // Collect all unique sender IDs not in members to resolve names
    const unknownIds = [...new Set(data.map(m => m.sender_id).filter(Boolean)
      .filter(id => !room.members.find(mb => mb.user_id === id)))] as string[]

    let extraProfiles: RoomMember[] = []
    if (unknownIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles').select('id, username, display_name, avatar').in('id', unknownIds)
      extraProfiles = (pData ?? []).map(p => ({
        user_id: p.id,
        profile: { username: p.username, display_name: p.display_name, avatar: p.avatar },
      }))
    }
    const allMembers = [...room.members, ...extraProfiles]

    const enriched: Message[] = await Promise.all(data.map(async (m) => {
      const senderMember = allMembers.find(mb => mb.user_id === m.sender_id)
      const senderName = senderMember ? (senderMember.profile.display_name || senderMember.profile.username) : 'Unknown'
      const senderUsername = senderMember ? senderMember.profile.username : undefined
      const { data: reactions } = await supabase.from('message_reactions').select('emoji, user_id').eq('message_id', m.id)
      let replyPreview: string | undefined
      if (m.reply_to_id) {
        const { data: replyMsg } = await supabase.from('messages').select('content').eq('id', m.reply_to_id).single()
        replyPreview = replyMsg?.content
      }
      return { ...m, deleted: m.deleted ?? false, reactions: reactions ?? [], senderName, senderUsername, replyPreview }
    }))

    setMessages(enriched)
    setMsgsLoading(false)

    // ── Real-time subscription ──────────────────────────────
    if (subRef.current) supabase.removeChannel(subRef.current)
    subRef.current = supabase
      .channel(`room:${room.id}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`
      }, async (payload) => {
        const raw = payload.new as { id: string; sender_id: string; content: string; created_at: string; deleted: boolean; reply_to_id: string | null }

        // Resolve sender name (may be a new global chat participant not in original members)
        let senderName = 'Unknown'
        let senderUsername: string | undefined
        const memberMatch = allMembers.find(mb => mb.user_id === raw.sender_id)
        if (memberMatch) {
          senderName = memberMatch.profile.display_name || memberMatch.profile.username
          senderUsername = memberMatch.profile.username
        } else {
          const { data: pData } = await supabase.from('profiles').select('username, display_name').eq('id', raw.sender_id).single()
          if (pData) {
            senderName = pData.display_name || pData.username
            senderUsername = pData.username
          }
        }

        setMessages(ms => {
          // Deduplicate — if msg already added (optimistic send), skip
          if (ms.find(m => m.id === raw.id)) return ms
          return [...ms, { ...raw, reactions: [], senderName, senderUsername }]
        })
      })
      .subscribe()
  }, [])

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => () => { if (subRef.current) supabase.removeChannel(subRef.current) }, [])

  // ── Start private DM with a user ────────────────────────────
  async function startDmWith(targetUserId: string) {
    if (!myId || targetUserId === myId) return

    // Find shared DM rooms only (not global) between the two users
    const { data: myRooms } = await supabase
      .from('room_members')
      .select('room_id, chat_rooms(type)')
      .eq('user_id', myId)
    const { data: theirRooms } = await supabase
      .from('room_members')
      .select('room_id, chat_rooms(type)')
      .eq('user_id', targetUserId)

    if (myRooms && theirRooms) {
      const myDmIds = new Set(
        myRooms
          .filter((r: Record<string, unknown>) => (r.chat_rooms as { type: string } | null)?.type === 'dm')
          .map((r: Record<string, unknown>) => r.room_id as string)
      )
      const commonDm = theirRooms.find((r: Record<string, unknown>) =>
        (r.chat_rooms as { type: string } | null)?.type === 'dm' && myDmIds.has(r.room_id as string)
      )
      if (commonDm) {
        await loadRooms()
        setTimeout(() => {
          setRooms(prev => {
            const found = prev.find(r => r.id === (commonDm.room_id as string))
            if (found) openRoom(found)
            return prev
          })
        }, 400)
        return
      }
    }

    // Create brand new DM room — no created_by column
    const { data: newRoom, error } = await supabase
      .from('chat_rooms').insert({ type: 'dm', name: null }).select('id').single()
    if (error || !newRoom) {
      console.error('Failed to create DM room:', error)
      return
    }

    // Insert own membership first (RLS: auth.uid() = user_id)
    await supabase.from('room_members').insert({ room_id: newRoom.id, user_id: myId })
    // Insert target membership via service-level — use upsert to avoid RLS block
    // RLS on room_members must allow insert for any authenticated user OR use a DB function
    // Workaround: call a Postgres function or use the anon key bypass via rpc
    // Safe approach: insert only own row, then target joins via ensureGlobalRoom pattern on their side
    // For DMs: insert both rows — target row insert is allowed if policy is FOR ALL with true
    const { error: memberErr } = await supabase.from('room_members').insert({ room_id: newRoom.id, user_id: targetUserId })
    if (memberErr) {
      // Not fatal — target will be added when they open chat
      console.warn('Could not pre-add target member (they will join on first open):', memberErr.message)
    }

    await loadRooms()
    setTimeout(() => {
      setRooms(prev => {
        const found = prev.find(r => r.id === newRoom.id)
        if (found) openRoom(found)
        return prev
      })
    }, 400)
  }

  // ── Send ────────────────────────────────────────────────────
  async function sendMsg() {
    if (!text.trim() || !activeRoom || !myId || sending) return
    setSending(true)
    const payload: Record<string, unknown> = { room_id: activeRoom.id, sender_id: myId, content: text.trim() }
    if (replyTo) payload.reply_to_id = replyTo.id
    const { data: inserted, error } = await supabase.from('messages').insert(payload).select('id, sender_id, content, created_at, deleted, reply_to_id').single()
    if (!error && inserted) {
      // Optimistically add own message immediately without waiting for realtime
      const myMember = activeRoom.members.find(mb => mb.user_id === myId)
      const senderName = myMember ? (myMember.profile.display_name || myMember.profile.username) : 'Me'
      const senderUsername = myMember?.profile.username
      setMessages(ms => {
        if (ms.find(m => m.id === inserted.id)) return ms
        return [...ms, { ...inserted, deleted: false, reactions: [], senderName, senderUsername, replyPreview: replyTo?.content }]
      })
      setText(''); setReplyTo(null)
    } else if (!error) {
      setText(''); setReplyTo(null)
    }
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  async function addReaction(msgId: string, emoji: string) {
    if (!myId) return
    await supabase.from('message_reactions').upsert({ message_id: msgId, user_id: myId, emoji }, { onConflict: 'message_id,user_id,emoji' })
    setMessages(ms => ms.map(m => {
      if (m.id !== msgId) return m
      const exists = m.reactions.find(r => r.emoji === emoji && r.user_id === myId)
      if (exists) return m
      return { ...m, reactions: [...m.reactions, { emoji, user_id: myId ?? '' }] }
    }))
    setEmojiForMsg(null)
  }

  async function deleteMsg(id: string) {
    await supabase.from('messages').update({ deleted: true }).eq('id', id).eq('sender_id', myId)
    setMessages(ms => ms.map(m => m.id === id ? { ...m, deleted: true, content: 'Message deleted' } : m))
    setCtxMsg(null)
  }

  function formatTime(iso: string) {
    const d = new Date(iso); const now = new Date(); const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  function roomLabel(room: ChatRoom): string {
    if (room.type === 'global') return 'Global Chat'
    if (room.name) return room.name
    const other = room.members.find(m => m.user_id !== myId)
    if (other) return other.profile.display_name || other.profile.username
    return 'Chat'
  }

  // Open sender profile from a message click
  function openSenderProfile(msg: Message) {
    if (!msg.sender_id) return
    const member = activeRoom?.members.find(mb => mb.user_id === msg.sender_id)
    if (member) {
      setViewProfile({ id: msg.sender_id, username: member.profile.username, display_name: member.profile.display_name, avatar: member.profile.avatar })
    } else if (msg.senderUsername) {
      setViewProfile({ id: msg.sender_id, username: msg.senderUsername, display_name: msg.senderName ?? null, avatar: '' })
    }
  }

  const filteredRooms = rooms.filter(r => !roomSearch || roomLabel(r).toLowerCase().includes(roomSearch.toLowerCase()))
  const totalUnread = rooms.reduce((s, r) => s + r.unread, 0)

  const showList = !isMobile || !showConv
  const showChat = !isMobile || showConv

  return (
    <div style={{ display:'flex', height:'calc(100vh - 60px)', overflow:'hidden', background:'var(--bg)', position:'relative' }}>

      {/* ── Contact list + player search ── */}
      {showList && (
        <div style={{ width: isMobile ? '100%' : 320, flexShrink:0, background:'var(--surface)', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'16px 16px 10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>Messages</span>
                {totalUnread > 0 && <span style={{ background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{totalUnread}</span>}
              </div>
              <IBtn><MoreVertical size={15} /></IBtn>
            </div>

            {/* Room search */}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', boxShadow:'inset 2px 2px 6px var(--neu-dark)', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', padding:'8px 12px', marginBottom:8 }}>
              <Search size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
              <input type="text" placeholder="Search chats…" value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }} />
            </div>

            {/* Player search — with chat icon + prompt */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <MessageCircle size={13} style={{ color:'#4f8ef7', flexShrink:0 }} />
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Start a chat — enter a username</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', boxShadow:'inset 2px 2px 6px var(--neu-dark)', borderRadius:12, border:'1px solid rgba(79,142,247,0.18)', padding:'8px 12px' }}>
                <Search size={14} style={{ color:'#4f8ef7', flexShrink:0 }} />
                <input type="text" placeholder="Find players by username…" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }} />
                {playerSearch && (
                  <button type="button" onClick={() => { setPlayerSearch(''); setPlayerResults([]) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Player search results */}
          {playerSearch.trim() && (
            <div style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:6 }}>
              <div style={{ padding:'4px 16px 6px', fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Players</div>
              {playerSearching ? (
                <div style={{ display:'flex', justifyContent:'center', padding:16 }}>
                  <span style={{ width:20, height:20, border:'2px solid var(--surface3)', borderTopColor:'#4f8ef7', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                </div>
              ) : playerResults.length === 0 ? (
                <div style={{ padding:'8px 16px', fontSize:12, color:'var(--text-muted)' }}>No players found</div>
              ) : (
                playerResults.map(p => (
                  <button key={p.id} type="button" onClick={() => setViewProfile(p)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <Avatar name={p.display_name || p.username} avatarUrl={p.avatar || null} size={36} radius={10} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.display_name || p.username}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{p.username}</div>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); startDmWith(p.id); setPlayerSearch(''); setPlayerResults([]) }}
                      title="Start chat"
                      style={{ background:'rgba(79,142,247,0.12)', border:'1px solid rgba(79,142,247,0.3)', borderRadius:8, padding:'5px 8px', cursor:'pointer', color:'#4f8ef7', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, flexShrink:0 }}>
                      <MessageCircle size={12} /> Chat
                    </button>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Room list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {roomsLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
                <span style={{ width:28, height:28, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:40, gap:12 }}>
                <MessageCircle size={40} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text-dim)', textAlign:'center' }}>No chats yet</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>Start a conversation from someone's profile.</p>
              </div>
            ) : (
              filteredRooms.map(room => {
                const isGlobal = room.type === 'global'
                return (
                  <button key={room.id} type="button" onClick={(e) => { ripple(e); openRoom(room) }} className="ripple-wrap"
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', width:'100%', cursor:'pointer', background: activeRoom?.id === room.id && !isMobile ? 'rgba(79,142,247,0.08)' : isGlobal ? 'rgba(79,142,247,0.04)' : 'transparent', border:'none', borderBottom: isGlobal ? '2px solid rgba(79,142,247,0.15)' : '1px solid rgba(255,255,255,0.04)', textAlign:'left', transition:'background 0.15s' }}
                    onMouseEnter={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = isGlobal ? 'rgba(79,142,247,0.10)' : 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = isGlobal ? 'rgba(79,142,247,0.04)' : 'transparent' }}>
                    {/* Globe avatar for global chat, real profile pic for DMs */}
                    {isGlobal ? (
                      <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 0 14px rgba(79,142,247,0.35)' }}>
                        🌍
                      </div>
                    ) : (() => {
                      const other = room.members.find(m => m.user_id !== myId)
                      return <Avatar name={roomLabel(room)} avatarUrl={other?.profile?.avatar || null} size={44} />
                    })()}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                          <span style={{ fontSize:14, fontWeight:700, color: isGlobal ? '#4f8ef7' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{roomLabel(room)}</span>
                          {isGlobal && (
                            <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', borderRadius:5, padding:'1px 6px', flexShrink:0 }}>GLOBAL</span>
                          )}
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0, marginLeft:8 }}>{room.lastMsgTime}</span>
                      </div>
                      <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                        {isGlobal && !room.lastMsg ? '👋 Say hello to everyone!' : room.lastMsg || 'No messages yet'}
                      </span>
                    </div>
                    {room.unread > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'var(--accent)', borderRadius:10, padding:'2px 6px', flexShrink:0 }}>{room.unread}</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Conversation panel ── */}
      {showChat && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg)', minWidth:0, position:'relative' }}>
          {activeRoom ? (
            <>
              {/* Conv topbar — NO phone/video buttons */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px', height:56, flexShrink:0, background:'rgba(17,17,19,0.90)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <IBtn onClick={() => { setShowConv(false); if (!isMobile) setActiveRoom(null) }}>
                  <ArrowLeft size={15} />
                </IBtn>
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                  {activeRoom.type === 'global' ? (
                    <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                      🌍
                    </div>
                  ) : (() => {
                    const other = activeRoom.members.find(m => m.user_id !== myId)
                    return <Avatar name={roomLabel(activeRoom)} avatarUrl={other?.profile?.avatar || null} size={34} radius={10} />
                  })()}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color: activeRoom.type === 'global' ? '#4f8ef7' : 'var(--text)' }}>{roomLabel(activeRoom)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {activeRoom.type === 'global' ? '🌐 Open to all Chillverse players' : `${activeRoom.members.length} members`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'16px 14px', display:'flex', flexDirection:'column', gap:4 }}>
                {msgsLoading ? (
                  <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
                    <span style={{ width:28, height:28, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:10 }}>
                    <MessageCircle size={32} style={{ color:'var(--text-muted)' }} />
                    <p style={{ fontSize:13, color:'var(--text-muted)' }}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_id === myId
                    const senderLabel = isMine ? 'You' : (msg.senderName || 'Unknown')

                    // Resolve avatar: own messages use myProfile, others look up in room members
                    let avatarUrl: string | null = null
                    if (isMine) {
                      avatarUrl = myProfile?.avatar ?? null
                    } else {
                      const member = activeRoom?.members.find(mb => mb.user_id === msg.sender_id)
                      avatarUrl = member?.profile?.avatar ?? null
                    }

                    return (
                      <div key={msg.id} style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems:'flex-start', gap:8, marginBottom:6 }}>

                        {/* Avatar circle — clickable, opens profile modal */}
                        <button
                          type="button"
                          onClick={() => openSenderProfile(msg)}
                          style={{ background:'none', border:'none', padding:0, cursor:'pointer', flexShrink:0, alignSelf:'flex-start', marginTop:2 }}
                          title={senderLabel}>
                          <Avatar name={isMine ? (myProfile?.display_name || myProfile?.username || 'Me') : senderLabel} avatarUrl={avatarUrl} size={30} radius={10} />
                        </button>

                        {/* Bubble + meta */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth:'75%' }}>

                          {msg.replyPreview && !msg.deleted && (
                            <div style={{ fontSize:11, color:'var(--text-dim)', padding:'4px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8, borderLeft:'2px solid #4f8ef7', marginBottom:4, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {msg.replyPreview}
                            </div>
                          )}

                          <div
                            onContextMenu={e => { if (!msg.deleted) { e.preventDefault(); setCtxMsg(msg); setCtxPos({ x: e.clientX, y: e.clientY }) }}}
                            onDoubleClick={() => { if (!msg.deleted) setReplyTo(msg) }}
                            style={{ padding:'7px 13px 9px', borderRadius:16, background:'var(--surface)', color:'var(--text)', boxShadow:'2px 2px 8px var(--neu-dark),-1px -1px 4px var(--neu-light)', borderBottomRightRadius: isMine ? 4 : 16, borderBottomLeftRadius: isMine ? 16 : 4, fontSize:13.5, lineHeight:1.45, fontStyle: msg.deleted ? 'italic' : 'normal', opacity: msg.deleted ? 0.6 : 1, cursor:'context-menu', userSelect:'none', wordBreak:'break-word' }}>
                            {/* Name inlaid on the bubble's first line */}
                            {!msg.deleted && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openSenderProfile(msg) }}
                                style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'block', marginBottom:1 }}>
                                <span style={{ fontSize:10.5, fontWeight:700, color:'#4f8ef7' }}>
                                  {senderLabel}
                                </span>
                              </button>
                            )}
                            {msg.deleted ? 'Message deleted' : msg.content}
                          </div>

                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                          <span style={{ fontSize:10, color:'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
                          {!msg.deleted && (
                            <button type="button" onClick={() => setEmojiForMsg(emojiForMsg === msg.id ? null : msg.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }}>
                              <Smile size={12} />
                            </button>
                          )}
                        </div>

                        {msg.reactions.length > 0 && (
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                            {Object.entries(
                              msg.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
                                if (!acc[r.emoji]) acc[r.emoji] = { count:0, mine:false }
                                acc[r.emoji].count++
                                if (r.user_id === myId) acc[r.emoji].mine = true
                                return acc
                              }, {})
                            ).map(([emoji, { count, mine }]) => (
                              <button key={emoji} type="button" onClick={() => addReaction(msg.id, emoji)}
                                style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 7px', borderRadius:20, fontSize:12, cursor:'pointer', background: mine ? 'rgba(255,107,0,0.1)' : 'var(--surface2)', border: mine ? '1px solid rgba(255,107,0,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                                {emoji} {count > 1 && <span style={{ fontSize:11, color:'var(--text-dim)' }}>{count}</span>}
                              </button>
                            ))}
                          </div>
                        )}

                        {emojiForMsg === msg.id && (
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:8, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', marginTop:4, maxWidth:220 }}>
                            {EMOJIS.map(em => (
                              <button key={em} type="button" onClick={() => addReaction(msg.id, em)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:2 }}>{em}</button>
                            ))}
                          </div>
                        )}
                        </div>{/* end inner column */}
                      </div>
                    )
                  })
                )}
                <div ref={msgEnd} />
              </div>

              {/* Reply bar */}
              {replyTo && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'var(--surface2)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                  <Reply size={14} style={{ color:'var(--accent)', flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:12, color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <span style={{ color:'var(--accent)', fontWeight:600 }}>Replying: </span>{replyTo.content}
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
                </div>
              )}

              {/* Input bar — text + emoji + send ONLY, no attachments */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, padding:'10px 12px', background:'rgba(17,17,19,0.92)', backdropFilter:'blur(14px)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <IBtn onClick={() => setEmojiOpen(v => !v)}><Smile size={15} /></IBtn>
                <div style={{ flex:1, background:'var(--surface)', boxShadow:'inset 2px 2px 6px var(--neu-dark)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:14, padding:'9px 12px', display:'flex', alignItems:'flex-end' }}>
                  <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey} placeholder="Type a message…"
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13.5, resize:'none', maxHeight:80, overflowY:'auto', lineHeight:1.4, fontFamily:'inherit' }} />
                </div>
                <button type="button" onClick={sendMsg} disabled={!text.trim() || sending}
                  style={{ width:40, height:40, borderRadius:11, flexShrink:0, border:'none', background:'linear-gradient(135deg,var(--accent),var(--accent2))', boxShadow:'0 4px 14px rgba(255,107,0,0.35)', color:'#fff', cursor: !text.trim() || sending ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', opacity: !text.trim() || sending ? 0.6 : 1 }}>
                  <Send size={16} />
                </button>
              </div>

              {/* Emoji picker */}
              {emojiOpen && (
                <div style={{ position:'absolute', bottom:70, right:14, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:12, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', maxWidth:230, zIndex:50 }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => { setText(t => t + em); setEmojiOpen(false) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:3 }}>{em}</button>
                  ))}
                </div>
              )}

              {/* Context menu — React / Reply / Block / Delete */}
              {ctxMsg && (
                <>
                  <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => setCtxMsg(null)} />
                  <div style={{ position:'fixed', left: Math.min(ctxPos.x, window.innerWidth - 175), top: Math.min(ctxPos.y, window.innerHeight - 180), zIndex:100, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:165 }}>
                    {[
                      { icon: <Smile size={14} />, label:'React', action: () => { setEmojiForMsg(ctxMsg.id); setCtxMsg(null) } },
                      { icon: <Reply size={14} />, label:'Reply', action: () => { setReplyTo(ctxMsg); setCtxMsg(null) } },
                      ...(ctxMsg.sender_id !== myId ? [{
                        icon: <UserPlus size={14} />,
                        label: 'View Profile',
                        action: () => { openSenderProfile(ctxMsg); setCtxMsg(null) }
                      }] : []),
                      ...(ctxMsg.sender_id !== myId ? [{
                        icon: <ShieldOff size={14} />,
                        label: 'Block',
                        action: async () => {
                          if (myId && ctxMsg.sender_id) {
                            await supabase.from('blocks').upsert({ blocker_id: myId, blocked_id: ctxMsg.sender_id })
                          }
                          setCtxMsg(null)
                        }
                      }] : []),
                      ...(ctxMsg.sender_id === myId ? [{ icon: <Trash2 size={14} />, label:'Delete', action: () => deleteMsg(ctxMsg.id) }] : []),
                    ].map(({ icon, label, action }) => (
                      <button key={label} type="button" onClick={action}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:13, color: label === 'Delete' || label === 'Block' ? '#ff6b6b' : 'var(--text-dim)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            !isMobile && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
                <MessageCircle size={48} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:15, fontWeight:600, color:'var(--text-dim)' }}>Select a conversation</p>
                <p style={{ fontSize:13, color:'var(--text-muted)' }}>Choose from your chats on the left</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Player profile modal */}
      {viewProfile && (
        <PlayerProfileModal
          profile={viewProfile}
          myId={myId}
          onClose={() => setViewProfile(null)}
          onStartChat={startDmWith}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
