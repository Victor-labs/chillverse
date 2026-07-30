// src/features/clubs/ClubChat.tsx
// Dedicated Clubs chat screen — modeled on the message-list/composer
// patterns in features/chat/Chat.tsx (fetch + realtime INSERT/UPDATE
// subscription, optimistic send, pin banner, tombstoned deletes), but
// scoped to what Clubs actually needs. DM/global-only features (blocks,
// read receipts, voice notes, polls, rank tags, calls) are intentionally
// left out rather than force-fit in.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Users, Pin, PinOff, MoreVertical, Reply, X, Trash2, Flag, Archive, Settings } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from '../../shared/lib/profanityFilter'
import Avatar from '../../shared/components/Avatar'
import {
  fetchClub, fetchClubMembers, clubPinMessage, clubUnpinMessage, clubDeleteMessage,
  type ClubRoom, type ClubMemberRow, type ClubRole,
} from './clubs'
import ClubMembersPanel from './ClubMembersPanel'
import ClubSettingsModal from './ClubSettingsModal'
import ClubIcon from './clubIcons'

const MAX_MESSAGE_LENGTH = 2000 // matches the `messages.content` check constraint in the DB

interface ClubMessage {
  id: string
  sender_id: string | null
  content: string
  created_at: string
  deleted: boolean
  hidden_reason: string | null
  reply_to_id: string | null
  senderName: string
  senderAvatar: string
}

const TOMBSTONE_LABEL: Record<string, string> = {
  deleted_by_president: 'Message deleted by the president',
  deleted_by_vp: 'Message deleted by a VP',
}

export default function ClubChat() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const myId = user?.id ?? null

  const [club, setClub] = useState<ClubRoom | null>(null)
  const [members, setMembers] = useState<ClubMemberRow[]>([])
  const [messages, setMessages] = useState<ClubMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [replyTo, setReplyTo] = useState<ClubMessage | null>(null)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const membersRef = useRef<ClubMemberRow[]>([])
  membersRef.current = members

  const myRole: ClubRole | null = members.find(m => m.user_id === myId)?.role ?? null
  const canModerate = myRole === 'president' || myRole === 'vp'

  const nameFor = useCallback((userId: string | null) => {
    if (!userId) return 'Unknown'
    const m = membersRef.current.find(mb => mb.user_id === userId)
    return m ? (m.display_name || m.username) : 'Unknown'
  }, [])
  const avatarFor = useCallback((userId: string | null) => {
    const m = membersRef.current.find(mb => mb.user_id === userId)
    return m?.avatar ?? ''
  }, [])

  const load = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError('')
    try {
      const [c, mem] = await Promise.all([fetchClub(roomId), fetchClubMembers(roomId)])
      if (!c) { setError('Club not found, or you left it.'); setLoading(false); return }
      setClub(c)
      setMembers(mem)
      membersRef.current = mem

      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, deleted, hidden_reason, reply_to_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (msgErr) throw new Error(msgErr.message)

      const page = [...(msgs ?? [])].reverse().map(m => ({
        ...m,
        senderName: nameFor(m.sender_id),
        senderAvatar: avatarFor(m.sender_id),
      }))
      setMessages(page)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [roomId, nameFor, avatarFor])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ block: 'end' })
  }, [messages.length])

  // Realtime: new messages, edits (delete tombstone), and pin changes.
  useEffect(() => {
    if (!roomId) return
    if (subRef.current) supabase.removeChannel(subRef.current)
    subRef.current = supabase
      .channel(`club-chat:${roomId}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as any
        setMessages(ms => {
          if (ms.find(m => m.id === raw.id)) return ms
          return [...ms, { ...raw, senderName: nameFor(raw.sender_id), senderAvatar: avatarFor(raw.sender_id) }]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as any
        setMessages(ms => ms.map(m => m.id === raw.id ? { ...m, deleted: raw.deleted, hidden_reason: raw.hidden_reason, content: raw.deleted ? m.content : raw.content } : m))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as any
        setClub(c => c ? { ...c, pinned_message_id: raw.pinned_message_id, archived_at: raw.archived_at, grace_started_at: raw.grace_started_at, name: raw.name, is_private: raw.is_private } : c)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => {
        fetchClubMembers(roomId).then(m => { setMembers(m); membersRef.current = m })
      })
      .subscribe()
    return () => { if (subRef.current) supabase.removeChannel(subRef.current) }
  }, [roomId, nameFor, avatarFor])

  async function sendMsg() {
    const trimmed = text.trim()
    if (!trimmed || !roomId || !myId || sending) return
    if (trimmed.length > MAX_MESSAGE_LENGTH) return
    if (containsProfanity(trimmed)) { setComposerError(PROFANITY_BLOCKED_MESSAGE); return }

    setSending(true)
    setComposerError('')
    try {
      const payload: { room_id: string; sender_id: string; content: string; reply_to_id?: string } = {
        room_id: roomId, sender_id: myId, content: trimmed,
      }
      if (replyTo) payload.reply_to_id = replyTo.id
      const { data: inserted, error: sendErr } = await supabase
        .from('messages').insert(payload)
        .select('id, sender_id, content, created_at, deleted, hidden_reason, reply_to_id').single()
      if (sendErr) throw new Error(sendErr.message)
      if (inserted) {
        setMessages(ms => ms.find(m => m.id === inserted.id) ? ms : [...ms, { ...inserted, senderName: nameFor(myId), senderAvatar: avatarFor(myId) }])
      }
      setText('')
      setReplyTo(null)
    } catch (e: any) {
      setComposerError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function handlePin(messageId: string) {
    if (!roomId) return
    setMenuOpenFor(null)
    try { await clubPinMessage(roomId, messageId) } catch (e: any) { setError(e.message) }
  }
  async function handleUnpin() {
    if (!roomId) return
    try { await clubUnpinMessage(roomId) } catch (e: any) { setError(e.message) }
  }
  async function handleDelete(messageId: string) {
    setMenuOpenFor(null)
    try { await clubDeleteMessage(messageId) } catch (e: any) { setError(e.message) }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
  }
  if (error && !club) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#ff6b6b', marginBottom: 14 }}>{error}</p>
        <button onClick={() => navigate('/chat?tab=clubs')} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Back to Clubs</button>
      </div>
    )
  }
  if (!club) return null

  const pinnedMsg = club.pinned_message_id ? messages.find(m => m.id === club.pinned_message_id) : null
  const isArchived = !!club.archived_at
  const inGrace = !!club.grace_started_at && !isArchived

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 32px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/chat?tab=clubs')} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #7c5cff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <ClubIcon iconKey={club.icon_key} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{members.length} member{members.length === 1 ? '' : 's'}</div>
        </div>
        {myRole === 'president' && (
          <button onClick={() => setSettingsOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <Settings size={15} />
          </button>
        )}
        <button onClick={() => setMembersOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <Users size={15} />
        </button>
      </div>

      {isArchived && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,107,107,0.1)', borderBottom: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 12 }}>
          <Archive size={13} /> This club is archived — the president's Pro subscription lapsed. It'll be deleted 7 days after archiving unless they renew.
        </div>
      )}
      {inGrace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(245,197,66,0.1)', borderBottom: '1px solid rgba(245,197,66,0.25)', color: '#f5c542', fontSize: 12 }}>
          <Flag size={13} /> This club will be archived soon unless the president renews Pro.
        </div>
      )}
      {pinnedMsg && !pinnedMsg.deleted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <Pin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong>{pinnedMsg.senderName}:</strong> {pinnedMsg.content}
          </span>
          {canModerate && (
            <button onClick={handleUnpin} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
              <PinOff size={13} />
            </button>
          )}
        </div>
      )}
      {error && (
        <div style={{ padding: '9px 14px', fontSize: 12, color: '#ff6b6b' }}>{error}</div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No messages yet. Say hi!</div>
        ) : messages.map(m => {
          const canDelete = !m.deleted && canModerate
          return (
            <div key={m.id} style={{ display: 'flex', gap: 9, padding: '2px 14px', alignItems: 'flex-start' }}>
              <Avatar src={m.senderAvatar} name={m.senderName} userId={m.sender_id ?? undefined} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.senderName}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  {(canDelete || !m.deleted) && (
                    <div style={{ marginLeft: 'auto', position: 'relative' }}>
                      <button onClick={() => setMenuOpenFor(menuOpenFor === m.id ? null : m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.7 }}>
                        <MoreVertical size={13} />
                      </button>
                      {menuOpenFor === m.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setMenuOpenFor(null)} />
                          <div style={{ position: 'absolute', top: 22, right: 0, zIndex: 6, background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 12, minWidth: 150, boxShadow: 'var(--elev-popover)', overflow: 'hidden' }}>
                            {!m.deleted && (
                              <button onClick={() => { setReplyTo(m); setMenuOpenFor(null) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                                <Reply size={13} /> Reply
                              </button>
                            )}
                            {!m.deleted && canModerate && (
                              <button onClick={() => handlePin(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                                <Pin size={13} /> Pin
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#ff6b6b' }}>
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {m.reply_to_id && !m.deleted && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', borderLeft: '2px solid var(--border-strong)', paddingLeft: 8, marginTop: 2, marginBottom: 2 }}>
                    Replying to a message
                  </div>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.45, color: m.deleted ? 'var(--text-muted)' : 'var(--text)', fontStyle: m.deleted ? 'italic' : 'normal', wordBreak: 'break-word' }}>
                  {m.deleted ? (TOMBSTONE_LABEL[m.hidden_reason ?? ''] ?? 'Message deleted') : m.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {isArchived ? (
        <div style={{ padding: '14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          This club is archived — new messages are disabled.
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--surface)', borderRadius: 10, marginBottom: 8, fontSize: 12 }}>
              <Reply size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ flex: 1, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Replying to <strong>{replyTo.senderName}</strong>
              </span>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
            </div>
          )}
          {composerError && (
            <div style={{ fontSize: 11.5, color: '#ff6b6b', marginBottom: 6, padding: '0 4px' }}>{composerError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={text}
              onChange={e => { setText(e.target.value); setComposerError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder="Type a message…"
              maxLength={MAX_MESSAGE_LENGTH}
              style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: 'var(--text)', outline: 'none' }}
            />
            <button
              onClick={(e) => { ripple(e); sendMsg() }}
              disabled={!text.trim() || sending}
              className="ripple-wrap"
              style={{ width: 42, height: 42, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !text.trim() || sending ? 0.6 : 1 }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {membersOpen && myId && myRole && (
        <ClubMembersPanel
          club={club}
          myRole={myRole}
          myId={myId}
          onClose={() => setMembersOpen(false)}
          onLeftOrDeleted={() => navigate('/chat?tab=clubs')}
        />
      )}
      {settingsOpen && (
        <ClubSettingsModal
          club={club}
          onClose={() => setSettingsOpen(false)}
          onUpdated={(updated) => { setClub(updated); setSettingsOpen(false) }}
        />
      )}
    </div>
  )
}
