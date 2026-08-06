// src/features/clubs/ClubChat.tsx
// Dedicated Clubs chat screen. Messages render through the exact same
// MessageBurst/MessageLine components Global Chat and DMs use (see
// features/chat/MessageBubble.tsx) — same bubbles, same grouping, same
// long-press/right-click-to-open-menu interaction. Everything else here
// (header, banners, composer, club-specific realtime) is Clubs-specific.

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, Pin, PinOff, Reply, X, Trash2, Flag, Archive, Settings, Plus, MoreVertical, Hash } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useProfilePreview } from '../../context/ProfilePreview'
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from '../../shared/lib/profanityFilter'
import {
  type Message, type GroupedMessage, type ReadReceipt,
  groupMessages, MessageBurst,
} from '../chat/MessageBubble'
import {
  fetchClub, fetchClubMembers, clubPinMessage, clubUnpinMessage, clubDeleteMessage, joinClub,
  fetchClubChannels, createClubChannel, renameClubChannel, deleteClubChannel, setDefaultClubChannel,
  type ClubRoom, type ClubMemberRow, type ClubRole, type ClubChannel,
} from './clubs'
import ClubMembersPanel from './ClubMembersPanel'
import ClubSettingsModal from './ClubSettingsModal'
import ClubIcon from './clubIcons'

const MAX_MESSAGE_LENGTH = 2000 // matches the `messages.content` check constraint in the DB

interface RawClubMessage {
  id: string
  sender_id: string | null
  content: string
  created_at: string
  deleted: boolean
  hidden_reason: string | null
  reply_to_id: string | null
  type: string
  channel_id: string | null
}

const MARK_READ_THROTTLE_MS = 2000 // matches Chat.tsx — minimum gap between last_read_at writes

const TOMBSTONE_LABEL: Record<string, string> = {
  deleted_by_president: 'Message deleted by the president',
  deleted_by_vp: 'Message deleted by a VP',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ClubChat() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteCode = searchParams.get('code')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { openProfilePreview } = useProfilePreview()
  const myId = user?.id ?? null

  const [club, setClub] = useState<ClubRoom | null>(null)
  const [members, setMembers] = useState<ClubMemberRow[]>([])
  const [channels, setChannels] = useState<ClubChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [rawMessages, setRawMessages] = useState<RawClubMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [ctxMsg, setCtxMsg] = useState<Message | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [ctxChannel, setCtxChannel] = useState<ClubChannel | null>(null)
  const [ctxChannelPos, setCtxChannelPos] = useState({ x: 0, y: 0 })
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [channelBusy, setChannelBusy] = useState(false)
  const [channelError, setChannelError] = useState('')
  const [membersOpen, setMembersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeChannelIdRef = useRef<string | null>(null)
  activeChannelIdRef.current = activeChannelId

  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const membersRef = useRef<ClubMemberRow[]>([])
  membersRef.current = members
  const lastMarkReadAtRef = useRef(0)

  /** Persists my read position for this club, throttled the same way Chat.tsx
   *  does for DMs/Global. Without this the unread badge on the Clubs list never
   *  clears, since nothing else ever writes room_members.last_read_at for a club. */
  const markRoomAsRead = useCallback((id: string, uid: string) => {
    const now = Date.now()
    if (now - lastMarkReadAtRef.current < MARK_READ_THROTTLE_MS) return
    lastMarkReadAtRef.current = now
    supabase.from('room_members').update({ last_read_at: new Date().toISOString() })
      .eq('room_id', id).eq('user_id', uid)
      .then(({ error }) => { if (error) console.error('Failed to mark club as read:', error.message) })
  }, [])

  const myRole: ClubRole | null = members.find(m => m.user_id === myId)?.role ?? null
  const canModerate = myRole === 'president' || myRole === 'vp'

  const nameFor = useCallback((userId: string | null) => {
    if (!userId) return 'Unknown'
    const m = membersRef.current.find(mb => mb.user_id === userId)
    return m ? (m.display_name || m.username) : 'Unknown'
  }, [])
  const avatarFor = useCallback((userId: string | null) => {
    const m = membersRef.current.find(mb => mb.user_id === userId)
    return m?.avatar ?? null
  }, [])

  // Shape the raw rows into the shared Message type MessageBurst/MessageLine
  // expect — same fields Global/DMs populate, defaults for the ones Clubs
  // doesn't use yet (voice notes, polls, rank tags).
  const messages: Message[] = useMemo(() => rawMessages.map((m): Message => {
    const replySource = m.reply_to_id ? rawMessages.find(r => r.id === m.reply_to_id) : undefined
    return {
      id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at,
      deleted: m.deleted, hidden: false, hidden_reason: m.hidden_reason, reply_to_id: m.reply_to_id,
      replyPreview: replySource?.content, replyPreviewName: replySource ? nameFor(replySource.sender_id) : undefined,
      senderName: nameFor(m.sender_id),
      type: (m.type as Message['type']) ?? 'text', audio_path: null, audio_duration_seconds: null, call_id: null,
      rank_tag_group: null, poll_id: null,
      deletedLabel: TOMBSTONE_LABEL[m.hidden_reason ?? ''],
    }
  }), [rawMessages, nameFor, members])

  const groupedMessages: GroupedMessage[] = useMemo(() => groupMessages(messages), [messages])

  // Fold the flat, grouped list into consecutive-sender bursts — same
  // algorithm Chat.tsx uses for Global/DMs.
  const bursts: GroupedMessage[][] = useMemo(() => {
    const out: GroupedMessage[][] = []
    for (const m of groupedMessages) {
      const last = out[out.length - 1]
      if (last && !m.isGroupFirst) last.push(m)
      else out.push([m])
    }
    return out
  }, [groupedMessages])

  const loadMessages = useCallback(async (channelId: string) => {
    if (!roomId) return
    setMessagesLoading(true)
    try {
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, deleted, hidden_reason, reply_to_id, type, channel_id')
        .eq('room_id', roomId)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (msgErr) throw new Error(msgErr.message)
      setRawMessages([...(msgs ?? [])].reverse())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setMessagesLoading(false)
    }
  }, [roomId])

  const load = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError('')
    try {
      let c = await fetchClub(roomId)

      // Not a member yet (RLS hides the row) — if the link carried a code,
      // join automatically instead of showing "not found".
      if (!c && inviteCode) {
        try {
          await joinClub({ roomId, code: inviteCode })
          c = await fetchClub(roomId)
        } catch (joinErr: any) {
          setError(joinErr.message)
          setLoading(false)
          return
        }
      }

      if (!c) { setError('Club not found, or you left it.'); setLoading(false); return }

      // Code did its job — drop it from the URL so a refresh/share doesn't
      // re-trigger a join attempt.
      if (inviteCode) setSearchParams({}, { replace: true })

      const [mem, chans] = await Promise.all([fetchClubMembers(roomId), fetchClubChannels(roomId)])
      setClub(c)
      setMembers(mem)
      membersRef.current = mem
      setChannels(chans)

      // Land on the club's designated channel; fall back to the first one
      // if default_channel_id is somehow stale/missing.
      const landing = chans.find(ch => ch.id === c!.default_channel_id) ?? chans[0] ?? null
      const landingId = landing?.id ?? null
      setActiveChannelId(landingId)
      if (landingId) await loadMessages(landingId)
      else setRawMessages([])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [roomId, inviteCode, setSearchParams, loadMessages])

  function switchChannel(channelId: string) {
    if (channelId === activeChannelId) return
    setActiveChannelId(channelId)
    setReplyTo(null)
    loadMessages(channelId)
  }

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ block: 'end' })
  }, [rawMessages.length])

  // Entering the club counts as reading it — bypass the throttle here since
  // this only fires once per mount/room change, not on every message.
  useEffect(() => {
    if (!roomId || !myId || loading) return
    lastMarkReadAtRef.current = 0
    markRoomAsRead(roomId, myId)
  }, [roomId, myId, loading, markRoomAsRead])

  // Realtime: new messages, edits (delete tombstone), pin changes, and the
  // channel list itself (another mod adding/renaming/deleting a channel).
  useEffect(() => {
    if (!roomId) return
    if (subRef.current) supabase.removeChannel(subRef.current)
    subRef.current = supabase
      .channel(`club-chat:${roomId}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as RawClubMessage
        if (raw.channel_id !== activeChannelIdRef.current) return // different channel — not our list
        setRawMessages(ms => ms.find(m => m.id === raw.id) ? ms : [...ms, raw])
        if (myId) markRoomAsRead(roomId, myId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as RawClubMessage
        setRawMessages(ms => ms.map(m => m.id === raw.id ? { ...m, deleted: raw.deleted, hidden_reason: raw.hidden_reason, content: raw.deleted ? m.content : raw.content } : m))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const raw = payload.new as any
        setClub(c => c ? { ...c, pinned_message_id: raw.pinned_message_id, archived_at: raw.archived_at, grace_started_at: raw.grace_started_at, name: raw.name, is_private: raw.is_private, default_channel_id: raw.default_channel_id } : c)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => {
        fetchClubMembers(roomId).then(m => { setMembers(m); membersRef.current = m })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_channels', filter: `room_id=eq.${roomId}` }, () => {
        fetchClubChannels(roomId).then(setChannels)
      })
      .subscribe()
    return () => { if (subRef.current) supabase.removeChannel(subRef.current) }
  }, [roomId])

  async function sendMsg() {
    const trimmed = text.trim()
    if (!trimmed || !roomId || !myId || !activeChannelId || sending) return
    if (trimmed.length > MAX_MESSAGE_LENGTH) return
    if (containsProfanity(trimmed)) { setComposerError(PROFANITY_BLOCKED_MESSAGE); return }

    setSending(true)
    setComposerError('')
    try {
      const payload: { room_id: string; sender_id: string; content: string; reply_to_id?: string; channel_id: string } = {
        room_id: roomId, sender_id: myId, content: trimmed, channel_id: activeChannelId,
      }
      if (replyTo) payload.reply_to_id = replyTo.id
      const { data: inserted, error: sendErr } = await supabase
        .from('messages').insert(payload)
        .select('id, sender_id, content, created_at, deleted, hidden_reason, reply_to_id, type, channel_id').single()
      if (sendErr) throw new Error(sendErr.message)
      if (inserted) setRawMessages(ms => ms.find(m => m.id === inserted.id) ? ms : [...ms, inserted])
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
    setCtxMsg(null)
    try { await clubPinMessage(roomId, messageId) } catch (e: any) { setError(e.message) }
  }
  async function handleUnpin() {
    if (!roomId) return
    setCtxMsg(null)
    try { await clubUnpinMessage(roomId) } catch (e: any) { setError(e.message) }
  }
  async function handleDelete(messageId: string) {
    setCtxMsg(null)
    try { await clubDeleteMessage(messageId) } catch (e: any) { setError(e.message) }
  }

  const [renameTarget, setRenameTarget] = useState<ClubChannel | null>(null)

  function openAddChannel() {
    setNewChannelName('')
    setChannelError('')
    setAddChannelOpen(true)
  }
  function openRenameChannel(ch: ClubChannel) {
    setCtxChannel(null)
    setNewChannelName(ch.name)
    setChannelError('')
    setRenameTarget(ch)
  }
  function closeChannelModal() {
    setAddChannelOpen(false)
    setRenameTarget(null)
  }

  async function submitChannelModal() {
    const name = newChannelName.trim()
    if (!name || !roomId) return
    setChannelBusy(true)
    setChannelError('')
    try {
      if (renameTarget) {
        await renameClubChannel(renameTarget.id, name)
        setChannels(cs => cs.map(c => c.id === renameTarget.id ? { ...c, name } : c))
      } else {
        const newId = await createClubChannel(roomId, name)
        const fresh = await fetchClubChannels(roomId)
        setChannels(fresh)
        switchChannel(newId)
      }
      closeChannelModal()
    } catch (e: any) {
      setChannelError(e.message)
    } finally {
      setChannelBusy(false)
    }
  }

  async function handleSetDefaultChannel(ch: ClubChannel) {
    if (!roomId) return
    setCtxChannel(null)
    try {
      await setDefaultClubChannel(roomId, ch.id)
      setClub(c => c ? { ...c, default_channel_id: ch.id } : c)
    } catch (e: any) {
      setChannelError(e.message)
    }
  }

  async function handleDeleteChannel(ch: ClubChannel) {
    if (!roomId) return
    setCtxChannel(null)
    try {
      await deleteClubChannel(ch.id)
      const fresh = await fetchClubChannels(roomId)
      setChannels(fresh)
      if (activeChannelId === ch.id) {
        const c2 = await fetchClub(roomId)
        const landing = fresh.find(c => c.id === c2?.default_channel_id) ?? fresh[0] ?? null
        setClub(c2)
        if (landing) switchChannel(landing.id)
      }
    } catch (e: any) {
      setChannelError(e.message)
    }
  }

  const avatarForBurst = (msg: Message, isMine: boolean): string | null => isMine ? null : avatarFor(msg.sender_id)
  const readReceiptFor = (_msg: Message): ReadReceipt => null // group context — no meaningful per-message read state

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
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/chat?tab=clubs')} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          <ArrowLeft size={15} />
        </button>
        <button
          onClick={() => setMembersOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), #7c5cff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <ClubIcon iconKey={club.icon_key} iconUrl={club.icon_url} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{members.length} member{members.length === 1 ? '' : 's'}</div>
          </div>
        </button>
        {myRole && (
          <button onClick={() => setSettingsOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            <Settings size={15} />
          </button>
        )}
      </div>

      {/* Channel switcher — up to 4 per club (server-enforced). Tap to
          switch; "..." (president/vp only) opens rename/set-default/delete. */}
      {channels.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 2px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
          {channels.map(ch => {
            const active = ch.id === activeChannelId
            return (
              <button key={ch.id} onClick={() => switchChannel(ch.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '6px 10px', borderRadius: 20,
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-dim)',
                }}
              >
                <Hash size={11} /> {ch.name}
                {canModerate && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setCtxChannel(ch); setCtxChannelPos({ x: e.clientX, y: e.clientY }) }}
                    style={{ display: 'flex', marginLeft: 2, opacity: active ? 0.85 : 0.6 }}
                  >
                    <MoreVertical size={11} />
                  </span>
                )}
              </button>
            )
          })}
          {canModerate && channels.length < 4 && (
            <button onClick={openAddChannel} title="Add a channel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: '1px dashed var(--border-strong)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Plus size={13} />
            </button>
          )}
        </div>
      )}

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

      {/* Messages — same MessageBurst/MessageLine bubbles as Global Chat and DMs */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column' }}>
        {messagesLoading ? (
          <div style={{ margin: 'auto', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>
        ) : bursts.length === 0 ? (
          <div style={{ margin: 'auto', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No messages yet. Say hi!</div>
        ) : bursts.map(burst => {
          const first = burst[0]
          const isMine = first.sender_id === myId
          return (
            <Fragment key={first.id}>
              <MessageBurst
                burst={burst}
                isMine={isMine}
                senderLabel={first.senderName ?? 'Unknown'}
                avatarUrl={avatarForBurst(first, isMine)}
                onOpenProfile={(msg) => { if (msg.sender_id) openProfilePreview(msg.sender_id) }}
                onContextMenu={(m, x, y) => { setCtxMsg(m); setCtxPos({ x, y }) }}
                onDoubleClick={m => setReplyTo(m)}
                formatTime={formatTime}
                readReceiptFor={readReceiptFor}
                starredIds={new Set()}
                isGroupChat
              />
            </Fragment>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Message action menu — opened via long-press (mobile) / right-click (desktop),
          same native contextmenu trigger MessageLine uses everywhere else. */}
      {ctxMsg && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCtxMsg(null)} onContextMenu={e => { e.preventDefault(); setCtxMsg(null) }} />
          <div style={{ position: 'fixed', left: Math.min(ctxPos.x, window.innerWidth - 175), top: Math.min(ctxPos.y, window.innerHeight - 160), zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--elev-popover)', minWidth: 165 }}>
            <button onClick={() => { setReplyTo(ctxMsg); setCtxMsg(null) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
              <Reply size={13} /> Reply
            </button>
            {canModerate && (
              club.pinned_message_id === ctxMsg.id
                ? <button onClick={handleUnpin} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                    <PinOff size={13} /> Unpin
                  </button>
                : <button onClick={() => handlePin(ctxMsg.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                    <Pin size={13} /> Pin
                  </button>
            )}
            {canModerate && (
              <button onClick={() => handleDelete(ctxMsg.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#ff6b6b' }}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Channel action menu — president/vp only, opened via the "..." on a channel pill. */}
      {ctxChannel && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCtxChannel(null)} />
          <div style={{ position: 'fixed', left: Math.min(ctxChannelPos.x, window.innerWidth - 175), top: Math.min(ctxChannelPos.y, window.innerHeight - 160), zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--elev-popover)', minWidth: 165 }}>
            <button onClick={() => openRenameChannel(ctxChannel)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
              <Hash size={13} /> Rename
            </button>
            {club.default_channel_id !== ctxChannel.id && (
              <button onClick={() => handleSetDefaultChannel(ctxChannel)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                <Pin size={13} /> Set as landing channel
              </button>
            )}
            {channels.length > 1 && (
              <button onClick={() => handleDeleteChannel(ctxChannel)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#ff6b6b' }}>
                <Trash2 size={13} /> Delete channel
              </button>
            )}
          </div>
        </>
      )}

      {/* Add / rename channel — small shared modal for both flows. */}
      {(addChannelOpen || renameTarget) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={closeChannelModal}>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{renameTarget ? 'Rename channel' : 'Add a channel'}</p>
              <button onClick={closeChannelModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={16} /></button>
            </div>
            <input
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitChannelModal() }}
              maxLength={40}
              autoFocus
              placeholder="Channel name"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 10 }}
            />
            {channelError && <p style={{ fontSize: 11.5, color: '#ff6b6b', marginBottom: 8 }}>{channelError}</p>}
            <button onClick={submitChannelModal} disabled={!newChannelName.trim() || channelBusy}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: !newChannelName.trim() || channelBusy ? 0.6 : 1 }}>
              {channelBusy ? 'Saving…' : renameTarget ? 'Save' : 'Create channel'}
            </button>
          </div>
        </div>
      )}

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
              disabled={!text.trim() || sending || !activeChannelId}
              className="ripple-wrap"
              style={{ width: 42, height: 42, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !text.trim() || sending || !activeChannelId ? 0.6 : 1 }}
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
          onLeftOrDeleted={() => { setMembersOpen(false); navigate('/chat?tab=clubs') }}
        />
      )}
      {settingsOpen && myId && myRole && (
        <ClubSettingsModal
          club={club}
          members={members}
          myId={myId}
          myRole={myRole}
          onClose={() => setSettingsOpen(false)}
          onUpdated={(updated) => setClub(updated)}
          onLeftOrDeleted={() => { setSettingsOpen(false); navigate('/chat?tab=clubs') }}
        />
      )}
    </div>
  )
}
