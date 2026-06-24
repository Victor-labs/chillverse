// src/pages/Chat.tsx
import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  Smile, Paperclip, Send, X, Trash2, Reply,
  Image, FileText, Music, Camera, MessageCircle,
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

function Avatar({ name, size = 40, radius = 13 }: { name: string; size?: number; radius?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','#ff9a3c','#00e5ff']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:color, color:'#fff', fontWeight:700, fontSize:size*0.35, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
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

  // ── On mobile: showConv=false means list view, true means conversation view
  // ── On tablet/desktop: both panels show side by side
  const [showConv, setShowConv] = useState(false)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [ctxMsg, setCtxMsg] = useState<Message | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [emojiForMsg, setEmojiForMsg] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const msgEnd = useRef<HTMLDivElement>(null)
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Detect if we're on a narrow screen (phone) vs wide (tablet/desktop)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Load rooms ──────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    loadRooms()
  }, [myId])

  async function loadRooms() {
    setRoomsLoading(true)
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

    setRooms(built)
    setRoomsLoading(false)
  }

  // ── Open room ───────────────────────────────────────────────
  async function openRoom(room: ChatRoom) {
    setActiveRoom(room)
    setShowConv(true)   // on mobile this hides the list; on tablet both show
    setMessages([]); setMsgsLoading(true)
    setReplyTo(null); setText('')

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at, deleted, reply_to_id')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error || !data) { setMsgsLoading(false); return }

    const enriched: Message[] = await Promise.all(data.map(async (m) => {
      const senderMember = room.members.find(mb => mb.user_id === m.sender_id)
      const senderName = senderMember ? (senderMember.profile.display_name || senderMember.profile.username) : 'Unknown'
      const { data: reactions } = await supabase.from('message_reactions').select('emoji, user_id').eq('message_id', m.id)
      let replyPreview: string | undefined
      if (m.reply_to_id) {
        const { data: replyMsg } = await supabase.from('messages').select('content').eq('id', m.reply_to_id).single()
        replyPreview = replyMsg?.content
      }
      return { ...m, deleted: m.deleted ?? false, reactions: reactions ?? [], senderName, replyPreview }
    }))

    setMessages(enriched)
    setMsgsLoading(false)

    if (subRef.current) supabase.removeChannel(subRef.current)
    subRef.current = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` }, (payload) => {
        const raw = payload.new as { id: string; sender_id: string; content: string; created_at: string; deleted: boolean; reply_to_id: string | null }
        const senderMember = room.members.find(mb => mb.user_id === raw.sender_id)
        const senderName = senderMember ? (senderMember.profile.display_name || senderMember.profile.username) : 'Unknown'
        setMessages(ms => [...ms, { ...raw, reactions: [], senderName }])
      })
      .subscribe()
  }

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])
  useEffect(() => () => { if (subRef.current) supabase.removeChannel(subRef.current) }, [])

  // ── Send ────────────────────────────────────────────────────
  async function sendMsg() {
    if (!text.trim() || !activeRoom || !myId || sending) return
    setSending(true)
    const payload: Record<string, unknown> = { room_id: activeRoom.id, sender_id: myId, content: text.trim() }
    if (replyTo) payload.reply_to_id = replyTo.id
    const { error } = await supabase.from('messages').insert(payload)
    if (!error) { setText(''); setReplyTo(null) }
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
      return { ...m, reactions: [...m.reactions, { emoji, user_id: myId }] }
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
    if (room.name) return room.name
    const other = room.members.find(m => m.user_id !== myId)
    if (other) return other.profile.display_name || other.profile.username
    return 'Chat'
  }

  const filtered = rooms.filter(r => !search || roomLabel(r).toLowerCase().includes(search.toLowerCase()))
  const totalUnread = rooms.reduce((s, r) => s + r.unread, 0)

  // ── Layout logic ─────────────────────────────────────────────
  // Mobile: show list OR conversation full screen (never both)
  // Tablet+: show both side by side always
  const showList = !isMobile || !showConv
  const showChat = !isMobile || showConv

  return (
    <div style={{ display:'flex', height:'calc(100vh - 60px)', overflow:'hidden', background:'var(--bg)', position:'relative' }}>

      {/* ── Contact list ── */}
      {showList && (
        <div style={{
          width: isMobile ? '100%' : 320,
          flexShrink: 0,
          background:'var(--surface)',
          borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'16px 16px 10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>Messages</span>
                {totalUnread > 0 && <span style={{ background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{totalUnread}</span>}
              </div>
              <IBtn><MoreVertical size={15} /></IBtn>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', boxShadow:'inset 2px 2px 6px var(--neu-dark)', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', padding:'8px 12px' }}>
              <Search size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }} />
            </div>
          </div>

          {/* Room list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {roomsLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
                <span style={{ width:28, height:28, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:40, gap:12 }}>
                <MessageCircle size={40} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text-dim)', textAlign:'center' }}>No chats yet</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>Start a conversation from someone's profile.</p>
              </div>
            ) : (
              filtered.map(room => (
                <button key={room.id} type="button" onClick={(e) => { ripple(e); openRoom(room) }} className="ripple-wrap"
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', width:'100%', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)', background: activeRoom?.id === room.id && !isMobile ? 'rgba(255,255,255,0.07)' : 'transparent', border:'none', textAlign:'left', transition:'background 0.15s' }}
                  onMouseEnter={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = 'transparent' }}>
                  <Avatar name={roomLabel(room)} size={44} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{roomLabel(room)}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0, marginLeft:8 }}>{room.lastMsgTime}</span>
                    </div>
                    <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                      {room.lastMsg || 'No messages yet'}
                    </span>
                  </div>
                  {room.unread > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'var(--accent)', borderRadius:10, padding:'2px 6px', flexShrink:0 }}>{room.unread}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Conversation panel ── */}
      {showChat && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg)', minWidth:0, position:'relative' }}>
          {activeRoom ? (
            <>
              {/* Conv topbar */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px', height:56, flexShrink:0, background:'rgba(17,17,19,0.90)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                {/* Back arrow — always visible on mobile, also on tablet when convo is open */}
                <IBtn onClick={() => { setShowConv(false); if (!isMobile) setActiveRoom(null) }}>
                  <ArrowLeft size={15} />
                </IBtn>
                <button type="button" onClick={() => setProfileOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:10, flex:1, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', minWidth:0 }}>
                  <Avatar name={roomLabel(activeRoom)} size={34} radius={10} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{roomLabel(activeRoom)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{activeRoom.members.length} members</div>
                  </div>
                </button>
                <IBtn><Phone size={15} /></IBtn>
                <IBtn><Video size={15} /></IBtn>
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
                    return (
                      <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom:4 }}>
                        {!isMine && <span style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2, paddingLeft:2 }}>{msg.senderName}</span>}
                        {msg.replyPreview && !msg.deleted && (
                          <div style={{ fontSize:11, color:'var(--text-dim)', padding:'4px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8, borderLeft:`2px solid ${isMine ? 'var(--accent)' : 'var(--blue)'}`, marginBottom:4, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {msg.replyPreview}
                          </div>
                        )}
                        <div
                          onContextMenu={e => { if (!msg.deleted) { e.preventDefault(); setCtxMsg(msg); setCtxPos({ x: e.clientX, y: e.clientY }) }}}
                          onDoubleClick={() => { if (!msg.deleted) { setReplyTo(msg) }}}
                          style={{ maxWidth:'78%', padding:'9px 13px', borderRadius:16, background: isMine ? 'var(--accent)' : 'var(--surface)', color: isMine ? '#fff' : 'var(--text)', boxShadow: isMine ? '0 2px 12px rgba(255,107,0,0.25)' : '2px 2px 8px var(--neu-dark),-1px -1px 4px var(--neu-light)', borderBottomRightRadius: isMine ? 4 : 16, borderBottomLeftRadius: isMine ? 16 : 4, fontSize:13.5, lineHeight:1.45, fontStyle: msg.deleted ? 'italic' : 'normal', opacity: msg.deleted ? 0.6 : 1, cursor:'context-menu', userSelect:'none' }}>
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

              {/* Input bar */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, padding:'10px 12px', background:'rgba(17,17,19,0.92)', backdropFilter:'blur(14px)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <IBtn onClick={(e) => { ripple(e); setAttachOpen(v => !v) }}><Paperclip size={15} /></IBtn>
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

              {/* Global emoji picker */}
              {emojiOpen && (
                <div style={{ position:'absolute', bottom:70, right:14, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:12, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', maxWidth:230, zIndex:50 }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => { setText(t => t + em); setEmojiOpen(false) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:3 }}>{em}</button>
                  ))}
                </div>
              )}

              {/* Attach sheet */}
              {attachOpen && (
                <div style={{ position:'absolute', bottom:70, left:14, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:8, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', zIndex:50 }}>
                  {[{Icon: Image, label:'Photo'},{Icon: FileText, label:'File'},{Icon: Music, label:'Audio'},{Icon: Camera, label:'Camera'}].map(({Icon, label}) => (
                    <button key={label} type="button" onClick={() => setAttachOpen(false)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', width:'100%', background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:13, borderRadius:10 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)' }}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Context menu */}
              {ctxMsg && (
                <>
                  <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => setCtxMsg(null)} />
                  <div style={{ position:'fixed', left: Math.min(ctxPos.x, window.innerWidth - 170), top: Math.min(ctxPos.y, window.innerHeight - 140), zIndex:100, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:160 }}>
                    {[
                      { icon: <Smile size={14} />, label:'React',  action: () => { setEmojiForMsg(ctxMsg.id); setCtxMsg(null) } },
                      { icon: <Reply size={14} />, label:'Reply',  action: () => { setReplyTo(ctxMsg); setCtxMsg(null) } },
                      ...(ctxMsg.sender_id === myId ? [{ icon: <Trash2 size={14} />, label:'Delete', action: () => deleteMsg(ctxMsg.id) }] : []),
                    ].map(({ icon, label, action }) => (
                      <button key={label} type="button" onClick={action}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:13, color: label === 'Delete' ? '#ff6b6b' : 'var(--text-dim)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Profile popover */}
              {profileOpen && (
                <>
                  <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => setProfileOpen(false)} />
                  <div style={{ position:'absolute', top:64, right:14, zIndex:100, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:18, width:220, boxShadow:'0 12px 40px rgba(0,0,0,0.5)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <Avatar name={roomLabel(activeRoom)} size={48} radius={14} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{roomLabel(activeRoom)}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{activeRoom.members.length} members</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            // Desktop/tablet placeholder when no room selected
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
